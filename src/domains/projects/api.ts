import { z } from "zod";

import { callApi } from "../../api/client.ts";
import {
  zProjectLeadersHistoryDto,
  zProjectReportDto,
  zProjectsDto,
  zSonarCloudMetricsDto,
  zUpdateProjectReportNoteDto,
} from "../../api/generated/zod.gen.ts";
import { v2, v3 } from "../../api/paths.ts";
import type { Paging } from "../shared.ts";

const projectListPath = v3("projects");
const projectsPath = v2("projects");
const projectReportsPath = v2("projects-report");
const sonarCloudMetricsPath = v3("sonar-cloud-metrics");

export type Project = z.infer<typeof zProjectsDto>;
export type ProjectLeaderHistory = z.infer<typeof zProjectLeadersHistoryDto>;
export type ProjectReport = z.infer<typeof zProjectReportDto>;
export type SonarCloudMetrics = z.infer<typeof zSonarCloudMetricsDto>;

export const updateProjectReportNoteSchema = zUpdateProjectReportNoteDto;

const projectListSchema = z.array(zProjectsDto);
const projectLeaderHistoryListSchema = z.array(zProjectLeadersHistoryDto);

export async function listProjects(options: Paging): Promise<Project[]> {
  return projectListSchema.parse(await callApi(projectListPath, { query: options }));
}

export async function updateProject(options: {
  id: number;
  sonarCloudApiKey?: string | undefined;
  sonarCloudProjectIds: string[];
  slackChannel?: string | undefined;
  sitdownTimeId?: number | undefined;
  showInSitdowns?: boolean | undefined;
}): Promise<Project> {
  const { id, ...body } = options;

  return zProjectsDto.parse(await callApi(`${projectsPath}/${id}`, { method: "PUT", body }));
}

export async function updateProjectLeader(options: {
  id: number;
  leaderId: number;
  fromMonth: number;
  fromYear: number;
}): Promise<Project> {
  const { id, ...body } = options;

  return zProjectsDto.parse(await callApi(`${projectsPath}/${id}/leader`, { method: "PUT", body }));
}

export async function listProjectLeaderHistory(): Promise<ProjectLeaderHistory[]> {
  return projectLeaderHistoryListSchema.parse(await callApi(`${projectsPath}/leader-history`));
}

export async function getProjectReport(options: { uuid: string; date: string }): Promise<ProjectReport> {
  const { uuid, ...query } = options;

  return zProjectReportDto.parse(await callApi(`${projectReportsPath}/${uuid}`, { query }));
}

export async function updateProjectReport(options: {
  uuid: string;
  date: string;
  companyProjectName?: string | undefined;
  reportTitle?: string | undefined;
  unresolvedPoints?: string | undefined;
  currentNote?: { id: number; text: string; deadline: string } | undefined;
  prevNote?: { id: number; text: string; deadline: string } | undefined;
}): Promise<ProjectReport> {
  const { uuid, ...body } = options;

  return zProjectReportDto.parse(await callApi(`${projectReportsPath}/${uuid}`, { method: "PUT", body }));
}

export async function getSonarCloudMetrics(options: Paging & { projectUuid: string }): Promise<SonarCloudMetrics> {
  return zSonarCloudMetricsDto.parse(await callApi(sonarCloudMetricsPath, { query: options }));
}

export async function fetchSonarCloudMetrics(options: { projectUuid: string }): Promise<void> {
  await callApi(sonarCloudMetricsPath, { method: "POST", body: options });
}
