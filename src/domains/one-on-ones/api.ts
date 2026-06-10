import { z } from "zod";

import { callApi } from "../../api/client.ts";
import { zCollaborator1On1Dto } from "../../api/generated/zod.gen.ts";
import { v3 } from "../../api/paths.ts";
import type { Paging } from "../shared.ts";

const oneOnOnesPath = v3("collaborator-1on1s");

export const oneOnOneRatings = ["BAD", "OK", "GREAT"] as const;

export type OneOnOne = z.infer<typeof zCollaborator1On1Dto>;

const oneOnOneListSchema = z.array(zCollaborator1On1Dto);

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
  return zCollaborator1On1Dto.parse(await callApi(oneOnOnesPath, { method: "POST", body: options }));
}

export async function updateOneOnOne(options: {
  uuid: string;
  message: string;
  companyRating: string;
  collaboratorRating?: string | undefined;
  isFinancialMessage: boolean;
}): Promise<OneOnOne> {
  const { uuid, ...body } = options;

  return zCollaborator1On1Dto.parse(await callApi(`${oneOnOnesPath}/${uuid}`, { method: "PUT", body }));
}

export async function deleteOneOnOne(options: { uuid: string }): Promise<void> {
  await callApi(`${oneOnOnesPath}/${options.uuid}`, { method: "DELETE" });
}
