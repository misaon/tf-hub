import type { ArgsDef, CommandDef } from "citty";
import type { z } from "zod";

import { defineCommand } from "../cli/command.ts";
import { commandFromOperation, type OperationPresentation } from "../cli/operation-command.ts";
import type { Operation, OperationAnnotations } from "./operation.ts";

export interface DomainAction<Shape extends z.ZodRawShape = z.ZodRawShape, TOutput = unknown> {
  action: string;
  description: string;
  input: z.ZodObject<Shape>;
  annotations?: Partial<OperationAnnotations> | undefined;
  run(input: z.output<z.ZodObject<Shape>>): Promise<TOutput>;
  positionals?: readonly string[] | undefined;
  render(data: TOutput): void;
}

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
    return { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
  }

  if (action === "delete" || action.endsWith("-delete")) {
    return { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false };
  }

  if (action === "create" || action === "fetch" || action.endsWith("-give")) {
    return { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
  }

  return { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false };
}

export function defineAction<Shape extends z.ZodRawShape, TOutput>(
  action: DomainAction<Shape, TOutput>,
): DomainAction<Shape, TOutput> {
  return action;
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
  const operations: Operation[] = [];
  const subCommands: Record<string, CommandDef<ArgsDef>> = {};

  for (const action of definition.actions) {
    const operation: Operation = {
      name: `${definition.name}-${action.action}`,
      description: action.description,
      input: action.input,
      annotations: { ...deriveAnnotations(action.action), ...action.annotations },
      run: (input) => action.run(input),
    };

    operations.push(operation);
    subCommands[action.action] = commandFromOperation(operation, {
      commandName: action.action,
      positionals: action.positionals,
      render: (data) => {
        action.render(data);
      },
    });
  }

  return {
    name: definition.name,
    operations,
    command: defineCommand({
      meta: { name: definition.name, description: definition.description },
      subCommands,
    }),
  };
}

const readOnlyAnnotations: OperationAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export function standaloneEntry<Shape extends z.ZodRawShape, TOutput>(
  operation: Operation<Shape, TOutput>,
  presentation: OperationPresentation<TOutput>,
  annotations: OperationAnnotations = readOnlyAnnotations,
): RegistryEntry {
  const annotated = { ...operation, annotations };

  return {
    name: operation.name,
    operations: [annotated],
    command: commandFromOperation(annotated, presentation),
  };
}
