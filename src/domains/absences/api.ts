import { z } from "zod";

import { callApi } from "../../api/client.ts";
import {
  zBackupAbsenceApproverDto,
  zOfficeAbsencesBasicStatisticsDto,
  zOfficeAbsencesDto,
} from "../../api/generated/zod.gen.ts";
import { v3 } from "../../api/paths.ts";
import type { Paging } from "../shared.ts";

const absencesPath = v3("office-absences");

export const officeAbsenceTypes = ["HOME_OFFICE", "HOLIDAY", "WORK_TRAVEL", "ILLNESS", "INACCESSIBILITY"] as const;
export const officeAbsenceStates = [
  "WAITING_FOR_APPROVAL",
  "APPROVED",
  "REJECTED",
  "AWAITING_CANCELLATION_APPROVAL",
  "CANCELED",
  "DONE",
] as const;

export type OfficeAbsence = z.infer<typeof zOfficeAbsencesDto>;
export type OfficeAbsenceStatistics = z.infer<typeof zOfficeAbsencesBasicStatisticsDto>;
export type BackupAbsenceApprover = z.infer<typeof zBackupAbsenceApproverDto>;

const officeAbsenceListSchema = z.array(zOfficeAbsencesDto);

export async function listOfficeAbsences(
  options: Paging & {
    type?: string | undefined;
    states?: string[] | undefined;
    collaboratorUuid?: string | undefined;
    approverUuid?: string | undefined;
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
  },
): Promise<OfficeAbsence[]> {
  return officeAbsenceListSchema.parse(await callApi(absencesPath, { query: options }));
}

export async function createOfficeAbsence(options: {
  type: string;
  dateFrom: string;
  dateTo: string;
  hours: number;
  generalDescription: string;
  approverDescription: string;
  collaboratorUuid: string;
  approverUuid: string;
}): Promise<OfficeAbsence> {
  return zOfficeAbsencesDto.parse(await callApi(absencesPath, { method: "POST", body: options }));
}

export async function updateOfficeAbsence(options: {
  id: number;
  state: string;
  approverDescription?: string | undefined;
  generalDescription?: string | undefined;
}): Promise<OfficeAbsence> {
  const { id, ...body } = options;

  return zOfficeAbsencesDto.parse(await callApi(`${absencesPath}/${id}`, { method: "PUT", body }));
}

export async function getOfficeAbsenceStatistics(options: { fullYear: number }): Promise<OfficeAbsenceStatistics> {
  return zOfficeAbsencesBasicStatisticsDto.parse(
    await callApi(`${absencesPath}/statistics`, { query: { fullYear: options.fullYear } }),
  );
}

export async function getBackupAbsenceApprover(): Promise<BackupAbsenceApprover> {
  return zBackupAbsenceApproverDto.parse(await callApi(`${absencesPath}/backup-approver`));
}
