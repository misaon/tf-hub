import type { ArgsDef, CommandDef } from "citty";

import { absencesDomain } from "./absences";
import { collaboratorNotesDomain } from "./collaborator-notes";
import { collaboratorsDomain, colleaguesDomain } from "./collaborators";
import { documentsDomain } from "./documents";
import type { RegistryEntry } from "./domain.ts";
import { feedbacksDomain } from "./feedbacks";
import { gameDomain } from "./game";
import { goalsDomain, visionDomain } from "./goals";
import { oneOnOnesDomain } from "./one-on-ones";
import type { Operation } from "./operation.ts";
import { positionsDomain } from "./positions";
import { meEntry, whoamiEntry } from "./profile";
import { projectsDomain, sonarDomain } from "./projects";
import { costCategoriesEntry, enumsEntry, permissionsEntry } from "./reference";
import { merchRequestEntry, settingsDomain } from "./settings";
import { sitdownNotesDomain, sitdownRatingsDomain, sitdownsDomain, sitdownTimesDomain } from "./sitdowns";
import { substituteGroupsDomain } from "./substitute-groups";
import { validateDomain } from "./validate";
import { workingTimeDomain } from "./working-time";
import { worklogsDomain } from "./worklogs";

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
