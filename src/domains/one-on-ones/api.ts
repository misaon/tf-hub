import { z } from "zod";

import { callApi } from "../../api/client.ts";
import { zCollaborator1On1Dto, zCollaborator1On1Rating } from "../../api/generated/zod.gen.ts";
import { v3 } from "../../api/paths.ts";
import { richTextSchema, type Paging } from "../shared.ts";

const oneOnOnesPath = v3("collaborator-1on1s");

export const oneOnOneRatings = zCollaborator1On1Rating.options;

const oneOnOneSchema = zCollaborator1On1Dto.extend({ message: richTextSchema });

export type OneOnOne = z.infer<typeof oneOnOneSchema>;

const oneOnOneListSchema = z.array(oneOnOneSchema);

export async function listOneOnOnes(
  options: Paging & {
    mine: boolean;
    collaboratorUuid?: string | undefined;
    onlyFinancialMessages: boolean;
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
  },
): Promise<OneOnOne[]> {
  const { mine, onlyFinancialMessages, ...query } = options;
  const path = mine ? `${oneOnOnesPath}/me` : oneOnOnesPath;

  // The server parses this flag from the literal string "true".
  return oneOnOneListSchema.parse(
    await callApi(path, { query: { ...query, onlyFinancialMessages: String(onlyFinancialMessages) } }),
  );
}

export async function createOneOnOne(options: {
  collaboratorUuid: string;
  date: string;
  message: string;
  companyRating: string;
  collaboratorRating?: string | undefined;
  isFinancialMessage: boolean;
}): Promise<OneOnOne> {
  return oneOnOneSchema.parse(await callApi(oneOnOnesPath, { method: "POST", body: options }));
}

export async function updateOneOnOne(options: {
  uuid: string;
  message: string;
  companyRating: string;
  collaboratorRating?: string | undefined;
  isFinancialMessage: boolean;
}): Promise<OneOnOne> {
  const { uuid, ...body } = options;

  return oneOnOneSchema.parse(await callApi(`${oneOnOnesPath}/${uuid}`, { method: "PUT", body }));
}

export async function deleteOneOnOne(options: { uuid: string }): Promise<void> {
  await callApi(`${oneOnOnesPath}/${options.uuid}`, { method: "DELETE" });
}
