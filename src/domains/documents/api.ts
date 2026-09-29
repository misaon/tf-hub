import { z } from "zod";

import { callApi } from "../../api/client.ts";
import { zDocumentDto } from "../../api/generated/zod.gen.ts";
import { v3 } from "../../api/paths.ts";
import { maxRecordsPerPage } from "../../config.ts";
import type { Paging } from "../shared.ts";

const documentsPath = v3("documents");

export const documentStates = ["SIGNED", "REJECTED", "WAITING_FOR_SIGN", "CANCELED"] as const;

export type Document = z.infer<typeof zDocumentDto>;

const documentListSchema = z.array(zDocumentDto);

export async function listDocuments(
  options: Paging & { userUuid?: string | undefined; month?: string | undefined },
): Promise<Document[]> {
  return documentListSchema.parse(await callApi(documentsPath, { query: options }));
}

export function omitContent(document: Document): Omit<Document, "content"> {
  const { content, ...rest } = document;
  void content;

  return rest;
}

// The Hub has no single-document endpoint; the list holds every document the caller may update.
export async function findDocument(uuid: string): Promise<Document> {
  const documents = await listDocuments({ limit: maxRecordsPerPage, offset: 0 });
  const document = documents.find((candidate) => candidate.uuid === uuid);

  if (!document) {
    throw new Error(`Document ${uuid} is not among the documents visible to you. Pass title and content explicitly.`);
  }

  return document;
}

export async function createDocument(options: {
  userUuid: string;
  title: string;
  content: string;
  sentAt: string;
  documentState: string;
}): Promise<Document> {
  return zDocumentDto.parse(await callApi(documentsPath, { method: "POST", body: options }));
}

export async function updateDocument(options: {
  uuid: string;
  title: string;
  content: string;
  documentState: string;
}): Promise<Document> {
  const { uuid, ...body } = options;

  return zDocumentDto.parse(await callApi(`${documentsPath}/${uuid}`, { method: "PUT", body }));
}

export async function deleteDocument(options: { uuid: string }): Promise<void> {
  await callApi(`${documentsPath}/${options.uuid}`, { method: "DELETE" });
}
