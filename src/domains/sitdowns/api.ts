import { z } from "zod";

import { callApi } from "../../api/client.ts";
import { zSitdownNotesDto, zSitdownsDto, zSitdownsRatingsDto, zSitdownsTimesDto } from "../../api/generated/zod.gen.ts";
import { v2 } from "../../api/paths.ts";
import type { Paging } from "../shared.ts";

const sitdownsPath = v2("sitdowns");
const sitdownNotesPath = v2("sitdown-notes");
const sitdownTimesPath = v2("sitdown-times");
const sitdownRatingsPath = v2("sitdowns-ratings");

export const sitdownRatingValues = ["FAIL", "OK", "GOOD"] as const;

export type Sitdown = z.infer<typeof zSitdownsDto>;
export type SitdownNote = z.infer<typeof zSitdownNotesDto>;
export type SitdownTime = z.infer<typeof zSitdownsTimesDto>;
export type SitdownRating = z.infer<typeof zSitdownsRatingsDto>;

const sitdownListSchema = z.array(zSitdownsDto);
const sitdownNoteListSchema = z.array(zSitdownNotesDto);
const sitdownTimeListSchema = z.array(zSitdownsTimesDto);
const sitdownRatingListSchema = z.array(zSitdownsRatingsDto);

export async function listSitdowns(
  options: Paging & { month: string; monthsBack?: number | undefined },
): Promise<Sitdown[]> {
  return sitdownListSchema.parse(await callApi(sitdownsPath, { query: options }));
}

export async function createSitdown(options: { date: string }): Promise<Sitdown> {
  return zSitdownsDto.parse(await callApi(sitdownsPath, { method: "POST", body: options }));
}

export async function updateSitdown(options: { id: number; date: string }): Promise<Sitdown> {
  const { id, ...body } = options;

  return zSitdownsDto.parse(await callApi(`${sitdownsPath}/${id}`, { method: "PUT", body }));
}

export async function deleteSitdown(options: { id: number }): Promise<void> {
  await callApi(`${sitdownsPath}/${options.id}`, { method: "DELETE" });
}

export async function listSitdownNotes(
  options: Paging & {
    projectUuid?: string | undefined;
    withDeleted?: boolean | undefined;
    orderBy?: string | undefined;
    orderDir?: string | undefined;
  },
): Promise<SitdownNote[]> {
  return sitdownNoteListSchema.parse(await callApi(sitdownNotesPath, { query: options }));
}

export async function createSitdownNote(options: {
  text: string;
  projectId: number;
  deadline: string;
}): Promise<SitdownNote> {
  return zSitdownNotesDto.parse(await callApi(sitdownNotesPath, { method: "POST", body: options }));
}

export async function updateSitdownNote(options: {
  id: number;
  text: string;
  projectId: number;
  deadline: string;
}): Promise<SitdownNote> {
  const { id, ...body } = options;

  return zSitdownNotesDto.parse(await callApi(`${sitdownNotesPath}/${id}`, { method: "PUT", body }));
}

export async function deleteSitdownNote(options: { id: number }): Promise<void> {
  await callApi(`${sitdownNotesPath}/${options.id}`, { method: "DELETE" });
}

export async function listSitdownTimes(options: Paging): Promise<SitdownTime[]> {
  return sitdownTimeListSchema.parse(await callApi(sitdownTimesPath, { query: options }));
}

export async function createSitdownTime(options: {
  name: string;
  time: string;
  weekDay: number;
}): Promise<SitdownTime> {
  return zSitdownsTimesDto.parse(await callApi(sitdownTimesPath, { method: "POST", body: options }));
}

export async function updateSitdownTime(options: {
  id: number;
  name: string;
  time: string;
  weekDay: number;
}): Promise<SitdownTime> {
  const { id, ...body } = options;

  return zSitdownsTimesDto.parse(await callApi(`${sitdownTimesPath}/${id}`, { method: "PUT", body }));
}

export async function deleteSitdownTime(options: { id: number }): Promise<void> {
  await callApi(`${sitdownTimesPath}/${options.id}`, { method: "DELETE" });
}

export async function listSitdownRatings(
  options: Paging & { month: string; monthsBack?: number | undefined },
): Promise<SitdownRating[]> {
  return sitdownRatingListSchema.parse(await callApi(sitdownRatingsPath, { query: options }));
}

export async function createSitdownRating(options: {
  sitdownId: number;
  projectId: number;
  ratingGoalsValue?: string | undefined;
  ratingFeelingValue?: string | undefined;
  ratingRefactor?: boolean | undefined;
  ratingTests?: boolean | undefined;
  ratingDocumentation?: boolean | undefined;
  ratingSecurityAudit?: boolean | undefined;
  ratingLicenseAudit?: boolean | undefined;
  ratingProjectChecklist?: boolean | undefined;
  coverage?: number | undefined;
}): Promise<SitdownRating> {
  return zSitdownsRatingsDto.parse(await callApi(sitdownRatingsPath, { method: "POST", body: options }));
}
