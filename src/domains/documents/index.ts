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
import { dateTimeField, limitField, mineField, monthField, offsetField, uuidField } from "../fields.ts";
import {
  createDocument,
  deleteDocument,
  documentStates,
  listDocuments,
  omitContent,
  updateDocument,
  type DocumentSummary,
} from "./api.ts";

const documentColumns: ColumnSpec<DocumentSummary>[] = [
  ["Title", (document) => formatValue(document.title)],
  ["State", (document) => formatValue(document.documentState)],
  ["User", (document) => formatName(document.user)],
  ["Sent", (document) => formatDate(document.sentAt)],
  ["Signed", (document) => formatDate(document.signedAt)],
  ["UUID", (document) => formatValue(document.uuid)],
];

export const documentsDomain: RegistryEntry = defineDomain({
  name: "documents",
  description: "Documents for digital signing and their states.",
  actions: [
    defineAction({
      action: "list",
      description:
        "List documents for digital signing (contracts, policy acknowledgments): title, state, recipient and " +
        "dates. The content is omitted unless withContent=true returns it as plain text — combine that with " +
        "filters, documents are long. Regular users see their own documents; other users' documents require " +
        "document-management permission.",
      input: z.object({
        limit: limitField,
        offset: offsetField,
        mine: mineField("Only documents addressed to the signed-in user."),
        userUuid: uuidField("Only documents addressed to the user with this UUID.").optional(),
        month: monthField("Only documents sent in this month (YYYY-MM).").optional(),
        withContent: z.boolean().default(false).describe("Include each document's content as plain text."),
      }),
      async run({ mine, userUuid, withContent, ...rest }) {
        const documents = await listDocuments({
          ...rest,
          userUuid: await resolveCollaboratorScope({ mine, collaboratorUuid: userUuid }),
        });

        if (!withContent) {
          return documents.map((document) => omitContent(document));
        }

        return documents;
      },
      render: tableRenderer(documentColumns),
    }),
    defineAction({
      action: "create",
      annotations: { openWorldHint: true },
      description: "Create a document and send it to a user for digital signing (admin).",
      input: z.object({
        userUuid: uuidField("UUID of the user who should sign the document."),
        title: z.string().min(1).describe("Document title."),
        content: z.string().min(1).describe("Full document content (HTML or plain text)."),
        sentAt: dateTimeField("When the document is sent (YYYY-MM-DD or full ISO date-time)."),
        documentState: z
          .enum(documentStates)
          .default("WAITING_FOR_SIGN")
          .describe("Initial state of the document; usually WAITING_FOR_SIGN."),
      }),
      run: async (input) => omitContent(await createDocument(input)),
      render: detailsRenderer(documentColumns),
    }),
    defineAction({
      action: "update",
      description:
        "Change a document's state: sign it (SIGNED), reject it (REJECTED) or withdraw it (CANCELED). The title " +
        "and content cannot be changed once the document is sent.",
      input: z.object({
        uuid: uuidField("UUID of the document to update."),
        documentState: z.enum(documentStates).describe("New state of the document."),
      }),
      positionals: ["uuid", "documentState"],
      run: async (input) => omitContent(await updateDocument(input)),
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
