import packageJson from "../../package.json" with { type: "json" };
import { readStoredCredentials } from "../auth/store.ts";
import { defineCommand } from "../cli/command.ts";
import { mcpConsola, startMcpServer } from "../mcp/server.ts";

export const mcpServerCommand = defineCommand({
  meta: {
    name: "mcp-server",
    description: "Start a local MCP server (stdio) exposing the data commands as tools.",
  },
  args: {
    toolsets: {
      type: "string",
      description:
        "Comma-separated domains to expose (e.g. worklogs,absences,me). Default: all. " +
        "Useful for clients with tool limits.",
    },
    readOnly: {
      type: "boolean",
      default: false,
      description: "Expose only read-only tools (no create/update/delete).",
    },
  },
  async run({ args }) {
    if (!(await readStoredCredentials())) {
      throw new Error("Not logged in. Run `tf-hub login` first, then start the MCP server.");
    }

    const toolsets =
      typeof args.toolsets === "string" && args.toolsets.length > 0
        ? args.toolsets.split(",").map((name) => name.trim())
        : undefined;

    mcpConsola.info(`tf-hub v${packageJson.version} MCP server listening on stdio.`);

    if (process.stdin.isTTY) {
      mcpConsola.info("Waiting for an MCP client to connect… press Ctrl-C to stop.");
    }

    await startMcpServer({ toolsets, readOnly: args.readOnly === true });
  },
});
