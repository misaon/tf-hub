import { describe, expect, it, spyOn } from "bun:test";
import { defineCommand as defineCittyCommand } from "citty";
import { consola } from "consola";

import { defineCommand } from "../src/cli/command.ts";
import { runCli } from "../src/cli/main.ts";

const shipCommand = defineCommand({
  meta: { name: "ship", description: "Ship a parcel." },
  args: { parcel: { type: "string", required: true, description: "Parcel ID." } },
  run({ args }) {
    if (args.parcel === "broken") {
      throw new Error("The courier refused the parcel.");
    }
  },
});

const root = defineCittyCommand({
  meta: { name: "tf-hub", description: "Test CLI." },
  subCommands: {
    parcels: () =>
      Promise.resolve(defineCittyCommand({ meta: { name: "parcels" }, subCommands: { ship: shipCommand } })),
  },
});

function captureOutput(): { stdout: () => string; errors: () => string } {
  const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
  const errorSpy = spyOn(consola, "error").mockReturnValue(undefined);

  return {
    stdout: () => writeSpy.mock.calls.map(([chunk]) => String(chunk)).join(""),
    errors: () => errorSpy.mock.calls.map(([message]) => String(message)).join("\n"),
  };
}

describe("runCli", () => {
  it("suggests the closest command for a typo and exits with the usage code", async () => {
    const output = captureOutput();

    await runCli(root, "1.0.0", ["parcles", "ship"]);

    expect(output.errors()).toBe("Unknown command `parcles`. Did you mean `parcels`? Run `tf-hub --help` for usage.");
    expect(process.exitCode).toBe(2);
  });

  it("reports a missing required flag as a usage error scoped to the command", async () => {
    const output = captureOutput();

    await runCli(root, "1.0.0", ["parcels", "ship"]);

    expect(output.errors()).toContain("Missing required argument: --parcel.");
    expect(output.errors()).toContain("Run `tf-hub parcels ship --help` for usage.");
    expect(process.exitCode).toBe(2);
  });

  it("keeps the failure exit code for errors raised while running", async () => {
    const output = captureOutput();

    await runCli(root, "1.0.0", ["parcels", "ship", "--parcel", "broken"]);

    expect(output.errors()).toBe("The courier refused the parcel.");
    expect(process.exitCode).toBe(1);
  });

  it.each([
    ["--help on an action", ["parcels", "ship", "--help"], "tf-hub parcels ship"],
    ["a group without an action", ["parcels"], "tf-hub parcels"],
  ])("prints help for %s without failing", async (_case, rawArgs, usageLine) => {
    const output = captureOutput();

    await runCli(root, "1.0.0", rawArgs);

    expect(output.stdout()).toContain(usageLine);
    expect(process.exitCode).toBe(0);
  });

  it("prints the version", async () => {
    const output = captureOutput();

    await runCli(root, "1.0.0", ["--version"]);

    expect(output.stdout()).toBe("1.0.0\n");
  });
});
