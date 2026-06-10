import { z } from "zod";

import { callApi } from "../../api/client.ts";
import { zCollaboratorLabelDto, zCollaboratorsDto } from "../../api/generated/zod.gen.ts";
import { v3 } from "../../api/paths.ts";
import type { Paging } from "../shared.ts";

const collaboratorsPath = v3("collaborators");
const collaboratorPath = (uuid: string): string => v3(`collaborators/${uuid}`);

export type Collaborator = z.infer<typeof zCollaboratorsDto>;

const collaboratorListSchema = z.array(zCollaboratorsDto);
const collaboratorLabelListSchema = z.array(zCollaboratorLabelDto);

export async function getCurrentCollaborator(): Promise<Collaborator> {
  return zCollaboratorsDto.parse(await callApi(v3("collaborators/me")));
}

export async function getCurrentCollaboratorUuid(): Promise<string> {
  const me = await getCurrentCollaborator();

  if (!me.uuid) {
    throw new Error("The profile response did not include a UUID.");
  }

  return me.uuid;
}

export async function listPublicCollaborators({ limit, offset }: Paging): Promise<Collaborator[]> {
  return collaboratorListSchema.parse(await callApi(v3("collaborators/public"), { query: { limit, offset } }));
}

export async function getPublicCollaborator({ uuid }: { uuid: string }): Promise<Collaborator> {
  return zCollaboratorsDto.parse(await callApi(v3(`collaborators/${uuid}/public`)));
}

export async function listCollaborators(
  options: Paging & {
    permissionSubject?: string | undefined;
    permissionAction?: string | undefined;
    worklogsAuditorUuid?: string | undefined;
    collaboratorUuid?: string | undefined;
    responsiblePersonUuid?: string | undefined;
    onlyWithWorkingTimeRecords?: boolean | undefined;
    workEndMaxDaysOld?: number | undefined;
  },
): Promise<Collaborator[]> {
  return collaboratorListSchema.parse(await callApi(collaboratorsPath, { query: options }));
}

export async function listCollaboratorLabels(): Promise<{ name?: string | null | undefined }[]> {
  return collaboratorLabelListSchema.parse(await callApi(v3("collaborators/labels")));
}

export async function updateCollaborator(options: {
  uuid: string;
  primaryOfficeAbsenceApproverId: number;
  isPublic: boolean;
  positionOverride: string;
  labels: string[];
  notifyResponsiblePersonAboutBirthday?: boolean | undefined;
}): Promise<Collaborator> {
  const { uuid, ...body } = options;

  return zCollaboratorsDto.parse(await callApi(collaboratorPath(uuid), { method: "PUT", body }));
}

export async function updateCollaboratorBio(options: { uuid: string; bioText: string }): Promise<Collaborator> {
  const { uuid, ...body } = options;

  return zCollaboratorsDto.parse(await callApi(v3(`collaborators/${uuid}/bio`), { method: "PUT", body }));
}

export async function updateCollaboratorLanguage(options: { uuid: string; language: string }): Promise<Collaborator> {
  const { uuid, ...body } = options;

  return zCollaboratorsDto.parse(
    await callApi(v3(`collaborators/${uuid}/collaboratorSettings`), { method: "PUT", body }),
  );
}

export async function confirmSecurityPolicy(options: { uuid: string }): Promise<Collaborator> {
  return zCollaboratorsDto.parse(
    await callApi(v3(`collaborators/${options.uuid}/confirmSecurityTF`), { method: "PUT" }),
  );
}
