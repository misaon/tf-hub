import { z } from "zod";

import { callApi } from "../../api/client.ts";
import { zBonusExperiencesDto, zBonusXpCollaboratorsDto, zMonthGameStateDto } from "../../api/generated/zod.gen.ts";
import { v2 } from "../../api/paths.ts";

const gamePath = (month: string): string => v2(`game/${month}`);
const bonusExperiencePath = (month: string): string => v2(`game/${month}/bonus-experience`);

export type BonusExperience = z.infer<typeof zBonusExperiencesDto>;
export type MonthGameState = z.infer<typeof zMonthGameStateDto>;
export type BonusXpCollaborator = z.infer<typeof zBonusXpCollaboratorsDto>;

const bonusXpCollaboratorListSchema = z.array(zBonusXpCollaboratorsDto);

export async function getGameMonth({ month }: { month: string }): Promise<MonthGameState> {
  return zMonthGameStateDto.parse(await callApi(gamePath(month)));
}

export async function listGameDonors({ month }: { month: string }): Promise<BonusXpCollaborator[]> {
  return bonusXpCollaboratorListSchema.parse(await callApi(v2(`game/donors/${month}`)));
}

export async function listGameDonatedCollaborators({ month }: { month: string }): Promise<BonusXpCollaborator[]> {
  return bonusXpCollaboratorListSchema.parse(await callApi(v2(`game/donated-collaborators/${month}`)));
}

export async function createBonusExperience(options: {
  month: string;
  recipientId: number;
  value: number;
  description: string;
  includeToHeroes: boolean;
}): Promise<BonusExperience> {
  const { month, ...body } = options;

  return zBonusExperiencesDto.parse(await callApi(bonusExperiencePath(month), { method: "POST", body }));
}

export async function deleteBonusExperience(options: { month: string; id: number }): Promise<void> {
  await callApi(`${bonusExperiencePath(options.month)}/${options.id}`, { method: "DELETE" });
}

export async function updateGameLock(options: { month: string; locked: boolean }): Promise<MonthGameState> {
  const { month, ...body } = options;

  return zMonthGameStateDto.parse(await callApi(gamePath(month), { method: "PUT", body }));
}
