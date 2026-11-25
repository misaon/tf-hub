import type { ArgsDef, CommandDef } from "citty";
import type { z } from "zod";

import { defineCommand } from "../cli/command.ts";
import { commandFromOperation, type OperationPresentation } from "../cli/operation-command.ts";
import type { Operation, OperationAnnotations } from "./operation.ts";

export const readOnlyAnnotations: OperationAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export const additiveAnnotations: OperationAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

const destructiveAnnotations: OperationAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
};

const readVerbs = new Set([
  "list",
  "show",
  "donors",
  "donated",
  "statistics",
  "summary",
  "labels",
  "metrics",
  "category-sum",
  "year-stats",
  "backup-approver",
  "report",
]);

function deriveAnnotations(action: string): OperationAnnotations {
  if (readVerbs.has(action)) {
    return readOnlyAnnotations;
  }

  if (action === "create" || action === "fetch" || action.endsWith("-give")) {
    return additiveAnnotations;
  }

  return destructiveAnnotations;
}

export interface DomainActionDefinition<Shape extends z.ZodRawShape, TOutput> {
  action: string;
  description: string;
  input: z.ZodObject<Shape>;
  annotations?: Partial<OperationAnnotations> | undefined;
  run: (input: z.output<z.ZodObject<Shape>>) => Promise<TOutput>;
  positionals?: readonly (keyof Shape & string)[] | undefined;
  render: (data: TOutput) => void;
}

interface DomainEntry {
  operation: Operation;
  command: CommandDef<ArgsDef>;
}

export interface DomainAction {
  action: string;
  bind(domainName: string): DomainEntry;
}

// Binds the input and output types here, so each action's render receives exactly what its run returns.
export function defineAction<Shape extends z.ZodRawShape, TOutput>(
  definition: DomainActionDefinition<Shape, TOutput>,
): DomainAction {
  return {
    action: definition.action,
    bind(domainName) {
      const operation: Operation<Shape, TOutput> = {
        name: `${domainName}-${definition.action}`,
        description: definition.description,
        input: definition.input,
        annotations: { ...deriveAnnotations(definition.action), ...definition.annotations },
        run: definition.run,
      };
      const command = commandFromOperation(operation, {
        cliPath: `${domainName} ${definition.action}`,
        positionals: definition.positionals,
        render: definition.render,
      });

      return { operation, command };
    },
  };
}

export interface RegistryEntry {
  name: string;
  operations: readonly Operation[];
  command: CommandDef<ArgsDef>;
}

export function defineDomain(definition: {
  name: string;
  description: string;
  actions: readonly DomainAction[];
}): RegistryEntry {
  const entries = definition.actions.map((action) => [action.action, action.bind(definition.name)] as const);

  return {
    name: definition.name,
    operations: entries.map(([, entry]) => entry.operation),
    command: defineCommand({
      meta: { name: definition.name, description: definition.description },
      subCommands: Object.fromEntries(entries.map(([action, entry]) => [action, entry.command])),
    }),
  };
}

export function standaloneEntry<Shape extends z.ZodRawShape, TOutput>(
  operation: Operation<Shape, TOutput>,
  presentation: Omit<OperationPresentation<TOutput>, "cliPath">,
  annotations: OperationAnnotations,
): RegistryEntry {
  const annotated = { ...operation, annotations };

  return {
    name: operation.name,
    operations: [annotated],
    command: commandFromOperation(annotated, { ...presentation, cliPath: operation.name }),
  };
}
