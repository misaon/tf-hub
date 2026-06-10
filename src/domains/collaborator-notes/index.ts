import { z } from "zod";

import { callApi } from "../../api/client.ts";
import { zCollaboratorNoteDto } from "../../api/generated/zod.gen.ts";
import { v3 } from "../../api/paths.ts";
import {
  deletedRenderer,
  detailsRenderer,
  ellipsize,
  formatDate,
  formatName,
  formatValue,
  tableRenderer,
} from "../../cli/output.ts";
import { defineAction, defineDomain, type RegistryEntry } from "../domain.ts";
import { dateField, limitField, offsetField, uuidField } from "../fields.ts";
import type { Paging } from "../shared.ts";

const notesPath = v3("collaborator-notes");

type CollaboratorNote = z.infer<typeof zCollaboratorNoteDto>;
const noteListSchema = z.array(zCollaboratorNoteDto);

async function listCollaboratorNotes(
  options: Paging & {
    collaboratorUuid?: string | undefined;
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
  },
): Promise<CollaboratorNote[]> {
  return noteListSchema.parse(await callApi(notesPath, { query: options }));
}

async function createCollaboratorNote(options: { collaboratorUuid: string; note: string }): Promise<CollaboratorNote> {
  return zCollaboratorNoteDto.parse(await callApi(notesPath, { method: "POST", body: options }));
}

async function updateCollaboratorNote(options: { uuid: string; note: string }): Promise<CollaboratorNote> {
  const { uuid, ...body } = options;

  return zCollaboratorNoteDto.parse(await callApi(`${notesPath}/${uuid}`, { method: "PUT", body }));
}

async function deleteCollaboratorNote(options: { uuid: string }): Promise<void> {
  await callApi(`${notesPath}/${options.uuid}`, { method: "DELETE" });
}

const noteDetails = detailsRenderer<CollaboratorNote>([
  ["Date", (note) => formatDate(note.createdAt)],
  ["Collaborator", (note) => formatName(note.collaborator)],
  ["Editor", (note) => formatName(note.editor)],
  ["Note", (note) => ellipsize(note.note, 100)],
  ["UUID", (note) => formatValue(note.uuid)],
]);

export const collaboratorNotesDomain: RegistryEntry = defineDomain({
  name: "collaborator-notes",
  description: "Managers' notes about team members (performance, behavior, development areas).",
  actions: [
    defineAction({
      action: "list",
      description:
        "List managers' notes about team members (performance, behavior, development areas). Visible to the " +
        "team's manager and admins only.",
      input: z.object({
        limit: limitField,
        offset: offsetField,
        collaboratorUuid: uuidField("Only notes about the collaborator with this UUID.").optional(),
        dateFrom: dateField("Only notes created on or after this date (YYYY-MM-DD).").optional(),
        dateTo: dateField("Only notes created on or before this date (YYYY-MM-DD).").optional(),
      }),
      run: (input) => listCollaboratorNotes(input),
      render: tableRenderer<CollaboratorNote>([
        ["Date", (note) => formatDate(note.createdAt)],
        ["Collaborator", (note) => formatName(note.collaborator)],
        ["Note", (note) => ellipsize(note.note, 60)],
        ["UUID", (note) => formatValue(note.uuid)],
      ]),
    }),
    defineAction({
      action: "create",
      description: "Write a note about a team member (managers).",
      input: z.object({
        collaboratorUuid: uuidField("UUID of the collaborator the note is about."),
        note: z.string().min(1).describe("Note text (HTML or plain text)."),
      }),
      run: (input) => createCollaboratorNote(input),
      render: noteDetails,
    }),
    defineAction({
      action: "update",
      description: "Update a note about a team member (managers).",
      input: z.object({
        uuid: uuidField("UUID of the note."),
        note: z.string().min(1).describe("Updated note text."),
      }),
      positionals: ["uuid"],
      run: (input) => updateCollaboratorNote(input),
      render: noteDetails,
    }),
    defineAction({
      action: "delete",
      description: "Delete a note about a team member (managers).",
      input: z.object({ uuid: uuidField("UUID of the note to delete.") }),
      positionals: ["uuid"],
      async run(input) {
        await deleteCollaboratorNote(input);

        return { deleted: input.uuid };
      },
      render: deletedRenderer("Collaborator note"),
    }),
  ],
});
