import { describe, expect, it, mock } from "bun:test";
import { runCommand } from "citty";
import { z } from "zod";

import { defineAction, defineDomain } from "../src/domains/domain.ts";

const thingsDomain = defineDomain({
  name: "things",
  description: "Things.",
  actions: [
    defineAction({
      action: "list",
      description: "List things.",
      input: z.object({
        limit: z.coerce.number().int().default(5).describe("Maximum records."),
      }),
      run: (input) => Promise.resolve(input),
      render: () => {},
    }),
  ],
});

describe("defineDomain", () => {
  it("derives MCP tool names from the domain and action names", () => {
    expect(thingsDomain.operations.map((operation) => operation.name)).toEqual(["things-list"]);
    expect(thingsDomain.operations[0]?.description).toBe("List things.");
  });

  it("exposes each action as a CLI subcommand of the domain command", async () => {
    expect(Object.keys(thingsDomain.command.subCommands ?? {})).toEqual(["list"]);

    const render = mock(() => {});
    const domain = defineDomain({
      name: "things",
      description: "Things.",
      actions: [
        defineAction({
          action: "list",
          description: "List things.",
          input: z.object({ limit: z.coerce.number().int().default(5) }),
          run: (input) => Promise.resolve(input),
          render,
        }),
      ],
    });

    await runCommand(domain.command, { rawArgs: ["list", "--limit", "3"] });

    expect(render).toHaveBeenCalledWith({ limit: 3 });
  });
});
