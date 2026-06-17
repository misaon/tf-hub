import { z } from "zod";

import {
  detailsRenderer,
  ellipsize,
  formatDate,
  formatName,
  formatValue,
  plainText,
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
  getPublicCollaborator,
  listPublicCollaborators,
  omitBio,
  updateCollaborator,
  updateCollaboratorBio,
  updateCollaboratorLanguage,
  type Collaborator,
} from "./api.ts";

export function positionOf(collaborator: Collaborator): string {
  return collaborator.positionOverride || formatValue(collaborator.positions?.[0]?.name);
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
  ["Name", formatName],
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
  description: "Public company directory of colleague profiles.",
  actions: [
    defineAction({
      action: "list",
      description:
        "List the public company directory of colleagues: name, position, department and email. Bios are " +
        "omitted unless withBios=true returns them as plain text — one call instead of one per person.",
      input: z.object({
        limit: limitField,
        offset: offsetField,
        withBios: z.boolean().default(false).describe("Include each colleague's bio as plain text."),
      }),
      async run({ withBios, ...paging }) {
        const collaborators = await listPublicCollaborators(paging);

        if (!withBios) {
          return collaborators.map((collaborator) => omitBio(collaborator));
        }

        return collaborators.map((collaborator) =>
          Object.assign(collaborator, { bioText: plainText(collaborator.bioText) }),
        );
      },
      render: sortedTableRenderer([
        ["Name", formatName],
        ["Position", positionOf],
        ["Department", (collaborator) => formatValue(collaborator.positions?.[0]?.department?.name)],
        ["Email", (collaborator) => formatValue(collaborator.email)],
      ]),
    }),
    defineAction({
      action: "show",
      description:
        "Show the public profile of a single colleague: bio (as plain text), position, department, email and " +
        "game level.",
      input: z.object({ uuid: uuidField("UUID of the colleague (see `colleagues-list`).") }),
      positionals: ["uuid"],
      async run(input) {
        const profile = await getPublicCollaborator(input);

        return { ...profile, bioText: plainText(profile.bioText) };
      },
      render: detailsRenderer<Collaborator>([
        ["Name", formatName],
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
  description: "Employee administration: profiles, approvers, labels.",
  actions: [
    defineAction({
      action: "list",
      description:
        "List all collaborators with admin-level detail. Includes positions, permissions, approvers, labels and " +
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

        return collaborators.map((collaborator) => omitBio(collaborator));
      },
      render: sortedTableRenderer([
        ["ID", (collaborator) => formatValue(collaborator.id)],
        ["Name", formatName],
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
      description: "Update a colleague's public bio text (self or managers). The bio appears on the public profile.",
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
      description: "Set the signed-in user's preferred language. It is used for TF Hub communication.",
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
        "Confirm the company IT security policy. The signed-in user confirms they have read and " +
        "accepted it; records today's date as the confirmation date.",
      input: z.object({}),
      async run() {
        const uuid = await getCurrentCollaboratorUuid();

        return confirmSecurityPolicy({ uuid });
      },
      render: collaboratorDetails,
    }),
    defineAction({
      action: "labels",
      description: "List all unique collaborator labels. They are free-text tags used across profiles.",
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
