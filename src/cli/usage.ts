import { renderUsage, type ArgsDef, type CommandDef } from "citty";
import { consola } from "consola";
import { colors } from "consola/utils";

const commandDetails = new WeakMap<object, string>();

export function registerCommandDetails(command: object, details: string): void {
  commandDetails.set(command, details);
}

// Command lists keep one-line summaries, so a command's own help appends the full description.
// It is the only place CLI users and shell-driven agents learn units, scopes and side effects.
export async function showUsage<Args extends ArgsDef = ArgsDef>(
  command: CommandDef<Args>,
  parent?: CommandDef<Args>,
): Promise<void> {
  const usage = await renderUsage(command, parent);
  const details = commandDetails.get(command);

  if (details === undefined) {
    consola.log(`${usage}\n`);

    return;
  }

  consola.log(`${usage}\n\n${colors.underline(colors.bold("DETAILS"))}\n\n  ${details}\n`);
}
