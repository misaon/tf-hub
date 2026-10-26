import { once } from "node:events";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createConsola } from "consola";

import packageJson from "../../package.json" with { type: "json" };
import { selectOperations, type OperationFilter } from "../domains/index.ts";
import { runOperation } from "../domains/operation.ts";

export const mcpConsola = createConsola({ stdout: process.stderr, stderr: process.stderr });

const serverInstructions =
  "TF Hub is the company intranet: people directory, documents to sign, The Game (XP gamification), office " +
  "absences, worklogs (project time tracking), working-time records (legal attendance), projects and sitdowns, " +
  "goals and visions, 1on1s, feedbacks, manager notes, substitute groups, positions and settings. Tools are " +
  "named <domain>-<action>; me, whoami, permissions, cost-categories, enums and merch-request stand alone.\n" +
  "- Identity: `me` returns your uuid (how people are referenced) and numeric id (worklogs, bonus XP).\n" +
  "- Scope: list tools with a `mine` parameter read everyone visible to you unless mine=true. For anything " +
  'about "my …" pass mine=true — other people\'s records usually need extra permissions.\n' +
  "- Size: lists return at most `limit` records (default 999). When more exist, the result opens with a note " +
  "giving the total and the next offset; narrow the filters (dates, person, project) rather than paging.\n" +
  "- Formats: dates YYYY-MM-DD, months YYYY-MM, worklog timeSpent in minutes, absence hours with 8 per working " +
  "day. Rich text (notes, messages, document content) comes back as plain text.\n" +
  "- Writes: update tools store every field they take as given — read the record first and pass the current " +
  "values of fields you keep.";

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
        inputSchema: operation.input,
        ...(operation.annotations ? { annotations: operation.annotations } : {}),
      },
      // The SDK already parsed and transformed the arguments; a second parse would reject them.
      async (input) => {
        const { data, notices } = await runOperation(operation, input);

        // Notices lead: a client that truncates a long result must still learn that records are missing.
        return { content: [...notices, JSON.stringify(data)].map((text) => ({ type: "text" as const, text })) };
      },
    );
  }

  return server;
}

export async function startMcpServer(filter: OperationFilter = {}): Promise<void> {
  const connection = serveStdio(() => createMcpServer(filter), {
    onerror: (error) => mcpConsola.error(error),
  });

  // Per the MCP lifecycle, the client shuts the server down by closing stdin.
  await once(process.stdin, "end");
  await connection.close();
}
