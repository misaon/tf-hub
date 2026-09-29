import { describe, expect, it, mock, spyOn } from "bun:test";
import { runCommand } from "citty";
import { consola } from "consola";
import { z } from "zod";

import { callApi } from "../src/api/client.ts";
import { commandFromOperation, summarize } from "../src/cli/operation-command.ts";
import { showUsage } from "../src/cli/usage.ts";
import { defineOperation } from "../src/domains/operation.ts";
import { jsonResponse, mockFetch, seedValidSession } from "./support.ts";

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

  it("prints compact JSON and skips the renderer when --json is piped", async () => {
    const logSpy = spyOn(consola, "log").mockReturnValue(undefined);
    const render = mock(() => {});
    const command = commandFromOperation(echoOperation, { render });

    await runCommand(command, { rawArgs: ["--json"] });

    expect(render).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({ limit: 7, verbose: false }));
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

describe("paging notices", () => {
  it("warns on stderr when the server holds more records than it returned", async () => {
    await seedValidSession();
    mockFetch(() =>
      Promise.resolve(jsonResponse({ message: "OK", data: [{ id: 1 }], metadata: { totalItems: 3, offset: 0 } })),
    );
    spyOn(consola, "log").mockReturnValue(undefined);
    const warnSpy = spyOn(consola, "warn").mockReturnValue(undefined);
    const pagedOperation = defineOperation({
      name: "paged",
      description: "List paged things.",
      input: z.object({ offset: z.coerce.number().default(0) }),
      run: () => callApi("/things"),
    });

    await runCommand(commandFromOperation(pagedOperation, { render: () => {} }), { rawArgs: ["--json"] });

    expect(warnSpy).toHaveBeenCalledWith(
      "Returned 1 of 3 matching records (offset 0). Narrow the filters or request the next page with offset=1.",
    );
  });
});

describe("showUsage", () => {
  it("appends the full description to an operation command's own help", async () => {
    const logSpy = spyOn(consola, "log").mockReturnValue(undefined);
    const detailedOperation = defineOperation({
      name: "detailed",
      description: "List things. Durations are in minutes.",
      input: z.object({}),
      run: () => Promise.resolve([]),
    });

    await showUsage(commandFromOperation(detailedOperation, { render: () => {} }));

    const usage = String(logSpy.mock.calls[0]?.[0]);
    expect(usage).toContain("DETAILS");
    expect(usage).toContain("Durations are in minutes.");
  });

  it("adds nothing when the summary already is the whole description", async () => {
    const logSpy = spyOn(consola, "log").mockReturnValue(undefined);

    await showUsage(commandFromOperation(echoOperation, { render: () => {} }));

    expect(String(logSpy.mock.calls[0]?.[0])).not.toContain("DETAILS");
  });
});

describe("summarize", () => {
  it("keeps only the headline before a detail colon", () => {
    expect(summarize("List things: every detail imaginable.")).toBe("List things.");
  });

  it("keeps only the first sentence", () => {
    expect(summarize("List things. They have details. More details.")).toBe("List things.");
  });

  it("does not treat abbreviations or examples as a sentence boundary", () => {
    expect(summarize("Show a month, e.g. 2026-05 works.")).toBe("Show a month, e.g. 2026-05 works.");
  });

  it("returns a single-sentence description unchanged", () => {
    expect(summarize("Delete a worklog entry.")).toBe("Delete a worklog entry.");
  });
});
