import { describe, expect, it, mock, spyOn } from "bun:test";
import { runCommand } from "citty";
import { consola } from "consola";
import { z } from "zod";

import { callApi } from "../src/api/client.ts";
import { commandFromOperation, summarize } from "../src/cli/operation-command.ts";
import { cliWording, showUsage } from "../src/cli/usage.ts";
import { defineOperation } from "../src/domains/operation.ts";
import { jsonResponse, mockFetch, seedValidSession } from "./support.ts";

const echoOperation = defineOperation({
  name: "echo",
  description: "Echo the parsed input.",
  input: z.object({
    limit: z.coerce.number().int().min(1).default(7).describe("Maximum records."),
    withDetails: z.boolean().default(false).describe("Include details."),
    state: z.enum(["OPEN", "CLOSED"]).describe("Record state.").optional(),
    note: z.string().describe("Required note.").optional(),
  }),
  run: (input) => Promise.resolve(input),
});

function captureStdout(): () => string {
  const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

  return () => writeSpy.mock.calls.map(([chunk]) => String(chunk)).join("");
}

describe("commandFromOperation", () => {
  it("derives kebab-case citty flags, enum options and requirements from the Zod input schema", () => {
    const required = defineOperation({
      name: "required",
      description: "Needs a title.",
      input: z.object({ title: z.string().describe("Title.") }),
      run: (input) => Promise.resolve(input),
    });

    expect(commandFromOperation(echoOperation, { cliPath: "echo", render: () => {} }).args).toMatchObject({
      json: { type: "boolean" },
      limit: { type: "string", description: "Maximum records.", default: "7", required: false },
      "with-details": { type: "boolean", description: "Include details." },
      state: { type: "enum", options: ["OPEN", "CLOSED"], required: false },
    });
    expect(commandFromOperation(required, { cliPath: "required", render: () => {} }).args).toMatchObject({
      title: { type: "string", required: true },
    });
  });

  it.each([["--with-details"], ["--withDetails"]])("accepts the %s spelling of a flag", async (flag) => {
    const render = mock(() => {});
    const command = commandFromOperation(echoOperation, { cliPath: "echo", render });

    await runCommand(command, { rawArgs: ["--limit", "3", flag] });

    expect(render).toHaveBeenCalledWith({ limit: 3, withDetails: true });
  });

  it("prints compact JSON on stdout without consola and skips the renderer when --json is piped", async () => {
    const stdout = captureStdout();
    const render = mock(() => {});
    const command = commandFromOperation(
      defineOperation({
        name: "styled",
        description: "Return text consola would restyle.",
        input: z.object({}),
        run: () => Promise.resolve({ note: "run `bun test` with snake _case_" }),
      }),
      { cliPath: "styled", render },
    );

    await runCommand(command, { rawArgs: ["--json"] });

    expect(render).not.toHaveBeenCalled();
    expect(stdout()).toBe(`${JSON.stringify({ note: "run `bun test` with snake _case_" })}\n`);
  });

  it.each([
    ["schema-invalid input", ["--limit", "0"], /--limit: .+\nRun `tf-hub echo --help` for usage\./u],
    ["an unknown flag", ["--verbose"], /Unknown option --verbose\./u],
    ["an unexpected positional argument", ["extra"], /Unexpected argument extra\./u],
  ])("rejects %s as a usage error with exit code 2", async (_case, rawArgs, message) => {
    const error = spyOn(consola, "error").mockReturnValue(undefined);
    const render = mock(() => {});
    const command = commandFromOperation(echoOperation, { cliPath: "echo", render });

    await runCommand(command, { rawArgs });

    expect(render).not.toHaveBeenCalled();
    expect(String(error.mock.calls[0]?.[0])).toMatch(message);
    expect(process.exitCode).toBe(2);
  });

  it("renders declared fields as positional arguments and lists enum choices in their description", async () => {
    const greetOperation = defineOperation({
      name: "greet",
      description: "Greet someone.",
      input: z.object({ who: z.string().describe("Who to greet."), mood: z.enum(["HAPPY", "SAD"]).describe("Mood.") }),
      run: (input) => Promise.resolve(input),
    });
    const render = mock(() => {});
    const command = commandFromOperation(greetOperation, { cliPath: "greet", positionals: ["who", "mood"], render });

    expect(command.args).toMatchObject({
      who: { type: "positional", required: true, description: "Who to greet." },
      mood: { type: "positional", description: "Mood. One of: HAPPY, SAD." },
    });

    await runCommand(command, { rawArgs: ["World", "HAPPY"] });

    expect(render).toHaveBeenCalledWith({ who: "World", mood: "HAPPY" });
  });
});

describe("paging notices", () => {
  it("warns on stderr after the output, in CLI wording, when the server holds more records", async () => {
    await seedValidSession();
    mockFetch(() =>
      Promise.resolve(jsonResponse({ message: "OK", data: [{ id: 1 }], metadata: { totalItems: 3, offset: 0 } })),
    );
    captureStdout();
    const warnSpy = spyOn(consola, "warn").mockReturnValue(undefined);
    const pagedOperation = defineOperation({
      name: "paged",
      description: "List paged things.",
      input: z.object({ offset: z.coerce.number().default(0) }),
      run: () => callApi("/tf/hub/v3/tf/things"),
    });

    await runCommand(commandFromOperation(pagedOperation, { cliPath: "paged", render: () => {} }), {
      rawArgs: ["--json"],
    });

    expect(warnSpy).toHaveBeenCalledWith(
      "Returned 1 of 3 matching records (offset 0). Narrow the filters or request the next page with --offset=1.",
    );
  });
});

describe("showUsage", () => {
  it("appends the rest of the description to an operation command's own help, in CLI wording", async () => {
    const stdout = captureStdout();
    commandFromOperation(echoOperation, { cliPath: "things echo", render: () => {} });
    const detailedOperation = defineOperation({
      name: "detailed",
      description: "List things. Durations are in minutes; see `echo` and pass withDetails=true.",
      input: z.object({}),
      run: () => Promise.resolve([]),
    });

    await showUsage(commandFromOperation(detailedOperation, { cliPath: "detailed", render: () => {} }));

    expect(stdout()).toContain("DETAILS");
    expect(stdout()).toContain("Durations are in minutes; see `tf-hub things echo` and pass --with-details.");
    expect(stdout()).not.toContain("\u001B[");
  });

  it("adds nothing when the summary already is the whole description", async () => {
    const stdout = captureStdout();

    await showUsage(commandFromOperation(echoOperation, { cliPath: "echo", render: () => {} }));

    expect(stdout()).not.toContain("DETAILS");
  });
});

describe("cliWording", () => {
  it("keeps unknown tool names and renders non-boolean values as flag assignments", () => {
    expect(cliWording("See `unknown-tool`; pass done=true.")).toBe("See `unknown-tool`; pass --done=true.");
  });

  it("leaves chained or embedded assignments alone", () => {
    expect(cliWording("a dateFrom=dateTo=x range and some-key=value")).toBe(
      "a dateFrom=dateTo=x range and some-key=value",
    );
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
