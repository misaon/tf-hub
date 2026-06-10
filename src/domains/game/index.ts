import { z } from "zod";

import {
  deletedRenderer,
  detailsRenderer,
  formatName,
  formatValue,
  printJson,
  printSuccess,
  tableRenderer,
} from "../../cli/output.ts";
import { defineAction, defineDomain, type DomainAction, type RegistryEntry } from "../domain.ts";
import { idField, monthField } from "../fields.ts";
import {
  createBonusExperience,
  deleteBonusExperience,
  getGameMonth,
  listGameDonatedCollaborators,
  listGameDonors,
  updateGameLock,
  type BonusExperience,
  type BonusXpCollaborator,
  type MonthGameState,
} from "./api.ts";

const monthInput = z.object({ month: monthField() });

const xpTable = tableRenderer<BonusXpCollaborator>([
  ["ID", (collaborator) => formatValue(collaborator.id)],
  ["Name", (collaborator) => formatValue(collaborator.userName)],
  ["XP", (collaborator) => formatValue(collaborator.value)],
]);

function lockAction(action: "lock" | "unlock", description: string): DomainAction {
  const locked = action === "lock";

  return defineAction({
    action,
    description,
    input: monthInput,
    positionals: ["month"],
    run: ({ month }) => updateGameLock({ month, locked }),
    render(state: MonthGameState) {
      const month = state.month ? ` ${state.month}` : "";

      printSuccess(`Game${month} ${locked ? "locked" : "unlocked"}.`);
    },
  });
}

export const gameDomain: RegistryEntry = defineDomain({
  name: "game",
  description: "The Game — company XP gamification: leaderboards, bonus XP donations and month locking.",
  actions: [
    defineAction({
      action: "show",
      description:
        "Show The Game (company XP gamification) leaderboard for a month: every player's level, XP from project " +
        "worklogs and sitdown ratings, bonus XP received, and whether the month is locked. Leagues: DEV, TL, QA.",
      input: monthInput,
      positionals: ["month"],
      run: (input) => getGameMonth(input),
      render: printJson,
    }),
    defineAction({
      action: "donors",
      description:
        "List collaborators eligible to donate bonus XP in a month, with their remaining donation allowance.",
      input: monthInput,
      positionals: ["month"],
      run: (input) => listGameDonors(input),
      render: xpTable,
    }),
    defineAction({
      action: "donated",
      description: "List collaborators who received bonus XP donations in a month, with the donated amounts.",
      input: monthInput,
      positionals: ["month"],
      run: (input) => listGameDonatedCollaborators(input),
      render: xpTable,
    }),
    defineAction({
      action: "bonus-give",
      description:
        "Donate bonus XP to a collaborator in The Game for a given month, with a note explaining why. Each donor " +
        "has a monthly XP allowance (see `game-donors`). Recipient IDs come from `game-show` or `collaborators-list`.",
      input: z.object({
        month: monthField(),
        recipientId: idField("Numeric ID of the collaborator receiving the XP."),
        value: z.coerce.number().int().min(1).describe("Amount of XP to donate (at least 1)."),
        description: z.string().min(1).describe("Why the collaborator deserves the bonus XP."),
        includeToHeroes: z
          .boolean()
          .default(true)
          .describe("Count this bonus towards the monthly heroes (Skokani) leaderboard."),
      }),
      positionals: ["month"],
      run: (input) => createBonusExperience(input),
      render: detailsRenderer<BonusExperience>([
        ["ID", (bonus) => formatValue(bonus.id)],
        ["Recipient", (bonus) => formatName(bonus.recipient)],
        ["XP", (bonus) => formatValue(bonus.value)],
        ["Description", (bonus) => formatValue(bonus.description)],
        ["Counts for heroes", (bonus) => formatValue(bonus.includeToHeroes)],
      ]),
    }),
    defineAction({
      action: "bonus-delete",
      description: "Delete a previously given bonus XP record. Find the record ID in the `game-show` month detail.",
      input: z.object({
        month: monthField(),
        id: idField("ID of the bonus XP record to delete."),
      }),
      positionals: ["month", "id"],
      async run(input) {
        await deleteBonusExperience(input);

        return { deleted: input.id };
      },
      render: deletedRenderer("Bonus XP record"),
    }),
    lockAction(
      "lock",
      "Lock The Game for a month: finalizes the monthly ranking and prevents further bonus XP changes (game managers).",
    ),
    lockAction("unlock", "Unlock The Game for a month, allowing bonus XP changes again (game managers)."),
  ],
});
