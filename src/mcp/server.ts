import { once } from "node:events";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createConsola } from "consola";

import packageJson from "../../package.json" with { type: "json" };
import { selectOperations, type OperationFilter } from "../domains/index.ts";

export const mcpConsola = createConsola({ stdout: process.stderr, stderr: process.stderr });

const serverInstructions =
  "TF Hub is the company intranet: people directory (colleagues, collaborators), documents for digital " +
  "signing, The Game (XP gamification), office absences with an approval flow, worklogs (project time " +
  "tracking), working-time records (legal attendance), projects with sitdown meetings (health ratings, " +
  "goals, notes), personal goals & visions with AI validation (validate-*), 1on1s, feedbacks, manager " +
  "notes (collaborator-notes), substitute groups, positions and settings. Most tools are named " +
  "<domain>-<action> (e.g. worklogs-list, absences-create); the standalone ones are me, whoami, " +
  "permissions, cost-categories, enums and merch-request. Start with list/show tools to discover records; " +
  "collaborators are referenced by UUID (find them via colleagues-list or collaborators-list) and some " +
  "admin records by numeric ID. Months use the YYYY-MM format, dates YYYY-MM-DD. Update tools persist " +
  "every field as given — read the current record first. The signed-in user's own identity is available " +
  "via `me`.";

function toolTitle(name: string): string {
  const spaced = name.replaceAll("-", " ");

  return `${spaced.charAt(0).toUpperCase()}${spaced.slice(1)}`;
}

export function createMcpServer(filter: OperationFilter = {}): McpServer {
  const server = new McpServer({ name: "tf-hub", version: packageJson.version }, { instructions: serverInstructions });

  server.server.oninitialized = () => {
    const client = server.server.getClientVersion();

    mcpConsola.success(`MCP client connected: ${client?.name ?? "unknown client"} v${client?.version ?? "?"}.`);
  };

  for (const operation of selectOperations(filter)) {
    server.registerTool(
      operation.name,
      {
        title: toolTitle(operation.name),
        description: operation.description,
        inputSchema: operation.input.shape,
        ...(operation.annotations ? { annotations: operation.annotations } : {}),
      },
      // The SDK already parsed and transformed the arguments; a second parse would reject them.
      async (input) => {
        const data = await operation.run(input);

        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      },
    );
  }

  return server;
}

export async function startMcpServer(filter: OperationFilter = {}): Promise<void> {
  const server = createMcpServer(filter);
  const transport = new StdioServerTransport();
  const { promise: transportClosed, resolve: markTransportClosed } = Promise.withResolvers<void>();
  transport.onclose = markTransportClosed;

  await server.connect(transport);

  // Per the MCP lifecycle, the client shuts the server down by closing stdin.
  await Promise.race([once(process.stdin, "end"), transportClosed]);
  await server.close();
}
