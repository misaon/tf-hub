import { z } from "zod";

import {
  detailsRenderer,
  ellipsize,
  formatDate,
  formatName,
  formatValue,
  printTable,
  tableRenderer,
  type ColumnSpec,
} from "../../cli/output.ts";
import { appLocale } from "../../config.ts";
import { defineAction, defineDomain, type RegistryEntry } from "../domain.ts";
import {
  commaSeparatedStringsField,
  explicitBooleanField,
  idField,
  limitField,
  offsetField,
  uuidField,
} from "../fields.ts";
import {
  confirmSecurityPolicy,
  getCurrentCollaboratorUuid,
  listCollaboratorLabels,
  listCollaborators,
  listPublicCollaborators,
  getPublicCollaborator,
  updateCollaborator,
  updateCollaboratorBio,
  updateCollaboratorLanguage,
  type Collaborator,
} from "./api.ts";

export function positionOf(collaborator: Collaborator): string {
  return collaborator.positionOverride || formatValue(collaborator.positions?.[0]?.name);
}

export function fullName(collaborator: Collaborator): string {
  return formatValue(`${collaborator.firstName ?? ""} ${collaborator.lastName ?? ""}`.trim());
}

function byLastName(collaborators: Collaborator[]): Collaborator[] {
  return collaborators.toSorted((first, second) =>
    (first.lastName ?? "").localeCompare(second.lastName ?? "", appLocale),
  );
}

function sortedTableRenderer(columns: ColumnSpec<Collaborator>[]): (collaborators: Collaborator[]) => void {
  return (collaborators) => {
    tableRenderer(columns)(byLastName(collaborators));
  };
}

const collaboratorDetails = detailsRenderer<Collaborator>([
  ["Name", fullName],
  ["Email", (collaborator) => formatValue(collaborator.email)],
  ["Position", positionOf],
  ["Approver", (collaborator) => formatName(collaborator.primaryOfficeAbsenceApprover)],
  ["Public", (collaborator) => formatValue(collaborator.isPublic)],
  ["Labels", (collaborator) => formatValue(collaborator.labels?.join(", "))],
  ["Language", (collaborator) => formatValue(collaborator.language)],
  ["Security confirmed", (collaborator) => formatDate(collaborator.confirmSecurityTFDate)],
  ["UUID", (collaborator) => formatValue(collaborator.uuid)],
]);

export const colleaguesDomain: RegistryEntry = defineDomain({
  name: "colleagues",
  description: "Public company directory: browse colleague profiles.",
  actions: [
    defineAction({
      action: "list",
      description:
        "List the public company directory of colleagues: name, position, department and email. Bios are omitted — use colleagues-show for one person's full profile.",
      input: z.object({ limit: limitField, offset: offsetField }),
      async run(input) {
        const collaborators = await listPublicCollaborators(input);

        return collaborators.map(({ bioText, ...rest }) => {
          void bioText;

          return rest;
        });
      },
      render: sortedTableRenderer([
        ["Name", fullName],
        ["Position", positionOf],
        ["Department", (collaborator) => formatValue(collaborator.positions?.[0]?.department?.name)],
        ["Email", (collaborator) => formatValue(collaborator.email)],
      ]),
    }),
    defineAction({
      action: "show",
      description:
        "Show the public profile of a single colleague (bio, position, department, email, game level). " +
        "Find the UUID with `colleagues-list`.",
      input: z.object({ uuid: uuidField("UUID of the colleague.") }),
      positionals: ["uuid"],
      run: (input) => getPublicCollaborator(input),
      render: detailsRenderer<Collaborator>([
        ["Name", fullName],
        ["Position", positionOf],
        ["Department", (colleague) => formatValue(colleague.positions?.[0]?.department?.name)],
        ["Email", (colleague) => formatValue(colleague.email)],
        ["Level", (colleague) => formatValue(colleague.currentGameState?.level)],
        ["Bio", (colleague) => ellipsize(colleague.bioText, 100)],
        ["UUID", (colleague) => formatValue(colleague.uuid)],
      ]),
    }),
  ],
});

export const collaboratorsDomain: RegistryEntry = defineDomain({
  name: "collaborators",
  description: "Employee administration: profiles, approvers, labels, language and security confirmation.",
  actions: [
    defineAction({
      action: "list",
      description:
        "List all collaborators (employees) with admin-level detail: positions, permissions, approvers, labels, " +
        "game state. Supports filtering. Requires user-management permission; for the public directory use " +
        "`colleagues-list`.",
      input: z.object({
        limit: limitField,
        offset: offsetField,
        collaboratorUuid: uuidField("Return only the collaborator with this UUID.").optional(),
        responsiblePersonUuid: uuidField("Filter by the responsible person (direct manager) UUID.").optional(),
        worklogsAuditorUuid: uuidField("Filter by worklogs auditor UUID.").optional(),
        permissionSubject: z.string().describe("Return only collaborators holding this permission subject.").optional(),
        permissionAction: z.string().describe("Return only collaborators holding this permission action.").optional(),
        onlyWithWorkingTimeRecords: z
          .boolean()
          .default(false)
          .describe("Return only collaborators who have working time records."),
        workEndMaxDaysOld: z.coerce
          .number()
          .int()
          .describe("Include recently departed collaborators whose employment ended at most this many days ago.")
          .optional(),
      }),
      async run(input) {
        const collaborators = await listCollaborators(input);

        return collaborators.map(({ bioText, ...rest }) => {
          void bioText;

          return rest;
        });
      },
      render: sortedTableRenderer([
        ["ID", (collaborator) => formatValue(collaborator.id)],
        ["Name", fullName],
        ["Email", (collaborator) => formatValue(collaborator.email)],
        ["Position", positionOf],
        ["Active", (collaborator) => formatValue(collaborator.isActive)],
        ["UUID", (collaborator) => formatValue(collaborator.uuid)],
      ]),
    }),
    defineAction({
      action: "update",
      description:
        "Update a collaborator's administration fields: absence approver, profile visibility, position override " +
        "and labels (admin). All fields are persisted as given — pass the current values for fields you do not " +
        "want to change.",
      input: z.object({
        uuid: uuidField("UUID of the collaborator to update."),
        primaryOfficeAbsenceApproverId: idField("Numeric ID of the collaborator who approves this person's absences."),
        isPublic: explicitBooleanField(
          "Whether the profile is visible in the public colleagues directory (true/false).",
        ),
        positionOverride: z
          .string()
          .default("")
          .describe("Position title override shown instead of the synced position name. Empty string clears it."),
        labels: commaSeparatedStringsField(
          "Comma-separated list of labels (free-text tags), e.g. 'backend,mentor'.",
        ).default([]),
        notifyResponsiblePersonAboutBirthday: explicitBooleanField(
          "Whether to notify the responsible person about this collaborator's birthday (true/false).",
        ).optional(),
      }),
      positionals: ["uuid"],
      run: (input) => updateCollaborator(input),
      render: collaboratorDetails,
    }),
    defineAction({
      action: "update-bio",
      description: "Update the bio (about) text shown on a colleague's public profile. Editable by self or managers.",
      input: z.object({
        uuid: uuidField("UUID of the collaborator whose bio to update."),
        bioText: z.string().describe("New bio text."),
      }),
      positionals: ["uuid"],
      run: (input) => updateCollaboratorBio(input),
      render: collaboratorDetails,
    }),
    defineAction({
      action: "set-language",
      description: "Set the signed-in user's preferred communication language in TF Hub.",
      input: z.object({
        language: z.enum(["cs", "en"]).describe("Preferred language: cs (Czech) or en (English)."),
      }),
      positionals: ["language"],
      async run({ language }) {
        const uuid = await getCurrentCollaboratorUuid();

        return updateCollaboratorLanguage({ uuid, language });
      },
      render: collaboratorDetails,
    }),
    defineAction({
      action: "confirm-security",
      description:
        "Confirm that the signed-in user has read and accepted the company IT security policy. " +
        "Records today's date as the confirmation date.",
      input: z.object({}),
      async run() {
        const uuid = await getCurrentCollaboratorUuid();

        return confirmSecurityPolicy({ uuid });
      },
      render: collaboratorDetails,
    }),
    defineAction({
      action: "labels",
      description: "List all unique labels (free-text tags) used across collaborator profiles.",
      input: z.object({}),
      run: () => listCollaboratorLabels(),
      render(labels) {
        printTable(
          labels.map((label) => ({ Label: formatValue(label.name) })),
          ["Label"],
        );
      },
    }),
  ],
});
