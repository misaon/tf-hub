import type { ArgsDef, CommandDef } from "citty";

import { absencesDomain } from "./absences/index.ts";
import { collaboratorNotesDomain } from "./collaborator-notes/index.ts";
import { collaboratorsDomain, colleaguesDomain } from "./collaborators/index.ts";
import { documentsDomain } from "./documents/index.ts";
import type { RegistryEntry } from "./domain.ts";
import { feedbacksDomain } from "./feedbacks/index.ts";
import { gameDomain } from "./game/index.ts";
import { goalsDomain, visionDomain } from "./goals/index.ts";
import { oneOnOnesDomain } from "./one-on-ones/index.ts";
import type { Operation } from "./operation.ts";
import { positionsDomain } from "./positions/index.ts";
import { meEntry, whoamiEntry } from "./profile/index.ts";
import { projectsDomain, sonarDomain } from "./projects/index.ts";
import { costCategoriesEntry, enumsEntry, permissionsEntry } from "./reference/index.ts";
import { merchRequestEntry, settingsDomain } from "./settings/index.ts";
import { sitdownNotesDomain, sitdownRatingsDomain, sitdownsDomain, sitdownTimesDomain } from "./sitdowns/index.ts";
import { substituteGroupsDomain } from "./substitute-groups/index.ts";
import { validateDomain } from "./validate/index.ts";
import { workingTimeDomain } from "./working-time/index.ts";
import { worklogsDomain } from "./worklogs/index.ts";

const registry: readonly RegistryEntry[] = [
  whoamiEntry,
  meEntry,
  colleaguesDomain,
  collaboratorsDomain,
  documentsDomain,
  gameDomain,
  absencesDomain,
  worklogsDomain,
  workingTimeDomain,
  projectsDomain,
  sonarDomain,
  sitdownsDomain,
  sitdownNotesDomain,
  sitdownTimesDomain,
  sitdownRatingsDomain,
  substituteGroupsDomain,
  positionsDomain,
  permissionsEntry,
  costCategoriesEntry,
  enumsEntry,
  feedbacksDomain,
  oneOnOnesDomain,
  goalsDomain,
  visionDomain,
  collaboratorNotesDomain,
  settingsDomain,
  merchRequestEntry,
  validateDomain,
];

export const operations: readonly Operation[] = registry.flatMap((entry) => entry.operations);

export const registryCommands: Record<string, CommandDef<ArgsDef>> = Object.fromEntries(
  registry.map((entry) => [entry.name, entry.command]),
);

export interface OperationFilter {
  toolsets?: readonly string[] | undefined;
  readOnly?: boolean | undefined;
}

export function selectOperations({ toolsets, readOnly }: OperationFilter = {}): readonly Operation[] {
  let entries = registry;

  if (toolsets !== undefined) {
    const known = new Set(registry.map((entry) => entry.name));
    const unknown = toolsets.filter((name) => !known.has(name));

    if (unknown.length > 0) {
      throw new Error(`Unknown toolset(s): ${unknown.join(", ")}. Available: ${[...known].join(", ")}.`);
    }

    const wanted = new Set(toolsets);
    entries = registry.filter((entry) => wanted.has(entry.name));
  }

  const selected = entries.flatMap((entry) => entry.operations);

  return readOnly ? selected.filter((operation) => operation.annotations?.readOnlyHint === true) : selected;
}
