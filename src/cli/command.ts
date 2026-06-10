import { type ArgsDef, type CommandContext, type CommandDef, defineCommand as defineCittyCommand } from "citty";
import { consola } from "consola";
import { z } from "zod";

function describeError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return z.prettifyError(error);
  }

  return error instanceof Error ? error.message : String(error);
}

export function defineCommand<Args extends ArgsDef = ArgsDef>(definition: CommandDef<Args>): CommandDef<Args> {
  const userRun = definition.run;

  if (!userRun) {
    return defineCittyCommand(definition);
  }

  return defineCittyCommand({
    ...definition,
    run: async (context: CommandContext<Args>) => {
      try {
        await userRun(context);
      } catch (error) {
        consola.error(describeError(error));
        process.exitCode = 1;
      }
    },
  });
}
