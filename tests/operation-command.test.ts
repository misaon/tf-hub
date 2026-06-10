import { describe, expect, it, mock, spyOn } from "bun:test";
import { runCommand } from "citty";
import { consola } from "consola";
import { z } from "zod";

import { commandFromOperation } from "../src/cli/operation-command.ts";
import { defineOperation } from "../src/domains/operation.ts";

const echoOperation = defineOperation({
  name: "echo",
  description: "Echo the parsed input.",
  input: z.object({
    limit: z.coerce.number().int().min(1).default(7).describe("Maximum records."),
    verbose: z.boolean().default(false).describe("Verbose output."),
  }),
  run: (input) => Promise.resolve(input),
});

describe("commandFromOperation", () => {
  it("derives citty args from the Zod input schema", () => {
    const command = commandFromOperation(echoOperation, { render: () => {} });

    expect(command.meta).toMatchObject({ name: "echo", description: "Echo the parsed input." });
    expect(command.args).toMatchObject({
      json: { type: "boolean" },
      limit: { type: "string", description: "Maximum records.", default: "7" },
      verbose: { type: "boolean", description: "Verbose output.", default: false },
    });
  });

  it("coerces and validates input through the schema before running", async () => {
    const render = mock(() => {});
    const command = commandFromOperation(echoOperation, { render });

    await runCommand(command, { rawArgs: ["--limit", "3"] });

    expect(render).toHaveBeenCalledWith({ limit: 3, verbose: false });
  });

  it("prints raw JSON and skips the renderer when --json is set", async () => {
    const logSpy = spyOn(consola, "log").mockReturnValue(undefined);
    const render = mock(() => {});
    const command = commandFromOperation(echoOperation, { render });

    await runCommand(command, { rawArgs: ["--json"] });

    expect(render).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({ limit: 7, verbose: false }, null, 2));
  });

  it("rejects schema-invalid input via consola and a non-zero exit code", async () => {
    const error = spyOn(consola, "error").mockReturnValue(undefined);
    const render = mock(() => {});
    const command = commandFromOperation(echoOperation, { render });

    await runCommand(command, { rawArgs: ["--limit", "0"] });

    expect(render).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it("renders declared fields as positional arguments", async () => {
    const greetOperation = defineOperation({
      name: "greet",
      description: "Greet someone.",
      input: z.object({ who: z.string().describe("Who to greet.") }),
      run: (input) => Promise.resolve(input),
    });
    const render = mock(() => {});
    const command = commandFromOperation(greetOperation, { positionals: ["who"], render });

    expect(command.args).toMatchObject({
      who: { type: "positional", required: true, description: "Who to greet." },
    });

    await runCommand(command, { rawArgs: ["World"] });

    expect(render).toHaveBeenCalledWith({ who: "World" });
  });
});
