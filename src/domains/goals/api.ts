import { z } from "zod";

import { callApi } from "../../api/client.ts";
import { zCollaboratorGoalDto, zCollaboratorVisionDto } from "../../api/generated/zod.gen.ts";
import { v3 } from "../../api/paths.ts";
import { richTextSchema, type Paging } from "../shared.ts";

const goalsPath = v3("collaborator-goals");
const visionPath = v3("collaborator-vision");

const goalSchema = zCollaboratorGoalDto.extend({ message: richTextSchema });
const visionSchema = zCollaboratorVisionDto.extend({ message: richTextSchema });

export type Goal = z.infer<typeof goalSchema>;
export type Vision = z.infer<typeof visionSchema>;

const goalListSchema = z.array(goalSchema);

export async function listGoals(
  options: Paging & { collaboratorUuid?: string | undefined; fromDate: string; toDate: string },
): Promise<Goal[]> {
  const { collaboratorUuid, ...query } = options;
  const path = collaboratorUuid === undefined ? goalsPath : `${goalsPath}/collaborator/${collaboratorUuid}`;

  return goalListSchema.parse(await callApi(path, { query }));
}

export async function createGoal(options: {
  collaboratorUuid: string;
  message: string;
  startDate: string;
  deadline: string;
}): Promise<Goal> {
  return goalSchema.parse(await callApi(goalsPath, { method: "POST", body: options }));
}

export async function updateGoal(options: {
  id: number;
  collaboratorUuid?: string | undefined;
  message: string;
  startDate: string;
  deadline: string;
  done?: boolean | undefined;
  active?: boolean | undefined;
}): Promise<Goal> {
  const { id, ...body } = options;

  return goalSchema.parse(await callApi(`${goalsPath}/${id}`, { method: "PUT", body }));
}

export async function deleteGoal(options: { id: number }): Promise<void> {
  await callApi(`${goalsPath}/${options.id}`, { method: "DELETE" });
}

export async function getVision(options: { collaboratorUuid: string }): Promise<Vision> {
  return visionSchema.parse(await callApi(`${visionPath}/collaborator/${options.collaboratorUuid}`));
}

export async function createVision(options: { collaboratorUuid: string; message: string }): Promise<Vision> {
  return visionSchema.parse(await callApi(visionPath, { method: "POST", body: options }));
}

export async function updateVision(options: { id: number; message: string }): Promise<Vision> {
  const { id, ...body } = options;

  return visionSchema.parse(await callApi(`${visionPath}/${id}`, { method: "PUT", body }));
}
