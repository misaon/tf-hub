import { z } from "zod";

import { callApi } from "../../api/client.ts";
import {
  zWorkingTimeRecordDto,
  zWorkingTimeRecordItemDto,
  zWorkingTimeRecordSummaryDto,
} from "../../api/generated/zod.gen.ts";
import { v3 } from "../../api/paths.ts";
import type { Paging } from "../shared.ts";

const recordsPath = v3("working-time-records");
const recordItemsPath = v3("working-time-record-items");

export const workingTimeRecordStates = [
  "WAITING_FOR_CONFIRMATION",
  "WAITING_FOR_CLOSURE",
  "CLOSED",
  "RETURNED",
] as const;
export const workingTimeRecordTypes = [
  "WORK",
  "VACATION_480",
  "VACATION_240",
  "NATIONAL_HOLIDAY",
  "ILLNESS",
  "UNPAID_TIME_OFF",
  "INACCESSIBILITY",
] as const;
export const legalTypes = ["HPP", "DPP", "ZL"] as const;

export type WorkingTimeRecord = z.infer<typeof zWorkingTimeRecordDto>;
export type WorkingTimeRecordItem = z.infer<typeof zWorkingTimeRecordItemDto>;
export type WorkingTimeRecordSummary = z.infer<typeof zWorkingTimeRecordSummaryDto>;

const recordListSchema = z.array(zWorkingTimeRecordDto);
const summaryListSchema = z.array(zWorkingTimeRecordSummaryDto);

export async function listWorkingTimeRecords(
  options: Paging & { collaboratorUuid?: string | undefined; month?: string | undefined },
): Promise<WorkingTimeRecord[]> {
  return recordListSchema.parse(await callApi(recordsPath, { query: options }));
}

export async function getWorkingTimeRecordMonth(options: {
  month: string;
  collaboratorUuid?: string | undefined;
}): Promise<WorkingTimeRecord> {
  const { month, ...query } = options;

  return zWorkingTimeRecordDto.parse(await callApi(`${recordsPath}/${month}`, { query }));
}

export async function getWorkingTimeRecordsSummary(options: {
  collaboratorUuid?: string | undefined;
  month?: string | undefined;
  year?: string | undefined;
  legalType?: string | undefined;
  state?: string | undefined;
}): Promise<WorkingTimeRecordSummary[]> {
  return summaryListSchema.parse(await callApi(`${recordsPath}/summary`, { query: options }));
}

export interface DateItemInput {
  date: string;
  workItems: { type: string; workStart: string; workEnd: string }[];
}

export async function updateWorkingTimeRecordItem(options: {
  id: number;
  state: string;
  note?: string | undefined;
  dateItems: DateItemInput[];
}): Promise<WorkingTimeRecordItem> {
  const { id, ...body } = options;

  return zWorkingTimeRecordItemDto.parse(await callApi(`${recordItemsPath}/${id}`, { method: "PUT", body }));
}

export async function updateWorkingTimeRecordItemStatus(options: {
  id: number;
  state: string;
  note: string;
}): Promise<WorkingTimeRecordItem> {
  const { id, ...body } = options;

  return zWorkingTimeRecordItemDto.parse(await callApi(`${recordItemsPath}/${id}/status`, { method: "PUT", body }));
}

export async function deleteWorkingTimeRecord(options: { id: number; legalType: string }): Promise<void> {
  await callApi(`${recordsPath}/${options.id}/${options.legalType}`, { method: "DELETE" });
}

export async function regenerateWorkingTimeRecords(options: { month: string }): Promise<void> {
  await callApi(`${recordsPath}/${options.month}/regenerate`, { method: "POST" });
}
