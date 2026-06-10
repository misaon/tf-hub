import { z } from "zod";

import { callApi, callApiEnvelope } from "../../api/client.ts";
import { zWorklogsCategorySumDto, zWorklogsCategoryYearStatsDto, zWorklogsDto } from "../../api/generated/zod.gen.ts";
import { v3 } from "../../api/paths.ts";
import type { Paging } from "../shared.ts";

const worklogsPath = v3("work-logs");

export type Worklog = z.infer<typeof zWorklogsDto>;
export type WorklogCategorySum = z.infer<typeof zWorklogsCategorySumDto>;
export type WorklogYearStats = z.infer<typeof zWorklogsCategoryYearStatsDto>;

const worklogListEnvelopeSchema = z.object({
  data: z.array(zWorklogsDto),
  timeSpentSum: z.number().nullish(),
});

const worklogCategorySumListSchema = z.array(zWorklogsCategorySumDto);
const worklogYearStatsListSchema = z.array(zWorklogsCategoryYearStatsDto);

export type WorklogFilters = Paging & {
  fromDate?: string | undefined;
  toDate?: string | undefined;
  collaboratorUuid?: string | undefined;
  costCategoryId?: number | undefined;
};

export async function listWorklogs(
  options: WorklogFilters,
): Promise<{ worklogs: Worklog[]; timeSpentSum: number | null }> {
  const envelope = worklogListEnvelopeSchema.parse(await callApiEnvelope(worklogsPath, { query: options }));

  return { worklogs: envelope.data, timeSpentSum: envelope.timeSpentSum ?? null };
}

export async function getWorklog(options: { id: number }): Promise<Worklog> {
  return zWorklogsDto.parse(await callApi(`${worklogsPath}/${options.id}`));
}

export async function createWorklog(options: {
  description: string;
  timeSpent: number;
  started: string;
  costCategoryId: number;
  projectUuid: string | null;
  collaboratorId: number;
}): Promise<Worklog> {
  return zWorklogsDto.parse(await callApi(worklogsPath, { method: "POST", body: options }));
}

export async function updateWorklog(options: {
  id: number;
  description: string;
  timeSpent: number;
  started: string;
  costCategoryId: number;
  projectUuid: string | null;
}): Promise<Worklog> {
  const { id, ...body } = options;

  return zWorklogsDto.parse(await callApi(`${worklogsPath}/${id}`, { method: "PUT", body }));
}

export async function deleteWorklog(options: { id: number }): Promise<void> {
  await callApi(`${worklogsPath}/${options.id}`, { method: "DELETE" });
}

export async function getWorklogCategorySum(options: WorklogFilters): Promise<WorklogCategorySum[]> {
  return worklogCategorySumListSchema.parse(await callApi(`${worklogsPath}/category-sum`, { query: options }));
}

export async function getWorklogYearStats(options: {
  toDate: string;
  collaboratorUuid?: string | undefined;
}): Promise<WorklogYearStats[]> {
  const { toDate, ...query } = options;

  return worklogYearStatsListSchema.parse(await callApi(`${worklogsPath}/year-stats/${toDate}`, { query }));
}
