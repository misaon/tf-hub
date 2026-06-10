import { z } from "zod";

import {
  deletedRenderer,
  detailsRenderer,
  formatDate,
  formatName,
  formatValue,
  tableRenderer,
  type ColumnSpec,
} from "../../cli/output.ts";
import { resolveCollaboratorScope } from "../collaborators/api.ts";
import { defineAction, defineDomain, type RegistryEntry } from "../domain.ts";
import { dateTimeField, limitField, monthField, offsetField, uuidField } from "../fields.ts";
import { createDocument, deleteDocument, documentStates, listDocuments, updateDocument, type Document } from "./api.ts";

const documentColumns: ColumnSpec<Document>[] = [
  ["Title", (document) => formatValue(document.title)],
  ["State", (document) => formatValue(document.documentState)],
  ["User", (document) => formatName(document.user)],
  ["Sent", (document) => formatDate(document.sentAt)],
  ["Signed", (document) => formatDate(document.signedAt)],
  ["UUID", (document) => formatValue(document.uuid)],
];

export const documentsDomain: RegistryEntry = defineDomain({
  name: "documents",
  description: "Documents for digital signing: contracts, policy acknowledgments and their states.",
  actions: [
    defineAction({
      action: "list",
      description:
        "List documents for digital signing (contracts, policy acknowledgments): title, state, recipient and " +
        "dates. Regular users see their own documents; listing other users' documents requires document-management " +
        "permission.",
      input: z.object({
        limit: limitField,
        offset: offsetField,
        mine: z.boolean().default(false).describe("Only documents addressed to the signed-in user."),
        userUuid: uuidField("Only documents addressed to the user with this UUID.").optional(),
        month: monthField("Only documents sent in this month (YYYY-MM).").optional(),
      }),
      async run({ mine, userUuid, ...rest }) {
        return listDocuments({
          ...rest,
          userUuid: await resolveCollaboratorScope({ mine, collaboratorUuid: userUuid }),
        });
      },
      render: tableRenderer(documentColumns),
    }),
    defineAction({
      action: "create",
      description: "Create a document and send it to a collaborator for digital signing (admin).",
      input: z.object({
        userUuid: uuidField("UUID of the collaborator who should sign the document."),
        title: z.string().min(1).describe("Document title."),
        content: z.string().min(1).describe("Full document content (HTML or plain text)."),
        sentAt: dateTimeField("Date and time when the document is sent, e.g. 2026-06-10T09:00:00."),
        documentState: z
          .enum(documentStates)
          .default("WAITING_FOR_SIGN")
          .describe("Initial state of the document; usually WAITING_FOR_SIGN."),
      }),
      run: (input) => createDocument(input),
      render: detailsRenderer(documentColumns),
    }),
    defineAction({
      action: "update",
      description:
        "Update a document's title, content or state. Signing or rejecting a document is done by setting " +
        "documentState to SIGNED or REJECTED; CANCELED withdraws it.",
      input: z.object({
        uuid: uuidField("UUID of the document to update."),
        title: z.string().min(1).describe("Updated document title."),
        content: z.string().min(1).describe("Updated document content."),
        documentState: z.enum(documentStates).describe("New state of the document."),
      }),
      positionals: ["uuid"],
      run: (input) => updateDocument(input),
      render: detailsRenderer(documentColumns),
    }),
    defineAction({
      action: "delete",
      description: "Permanently delete a document (admin).",
      input: z.object({ uuid: uuidField("UUID of the document to delete.") }),
      positionals: ["uuid"],
      async run(input) {
        await deleteDocument(input);

        return { deleted: input.uuid };
      },
      render: deletedRenderer("Document"),
    }),
  ],
});
