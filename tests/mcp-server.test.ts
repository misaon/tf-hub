import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { z } from "zod";

import { createMcpServer, mcpConsola } from "../src/mcp/server.ts";
import { operations, selectOperations } from "../src/domains/index.ts";
import { jsonResponse, mockFetch, seedValidSession } from "./support.ts";

const textContentSchema = z.array(z.object({ type: z.literal("text"), text: z.string() }));

const openClients: Client[] = [];

afterEach(async () => {
  await Promise.all(openClients.splice(0).map((client) => client.close()));
});

async function connectClient(): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });

  await Promise.all([createMcpServer().connect(serverTransport), client.connect(clientTransport)]);
  openClients.push(client);

  return client;
}

describe("mcp server", () => {
  it("exposes every operation as a tool, with the input schema attached", async () => {
    const client = await connectClient();

    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name).toSorted()).toEqual(operations.map((operation) => operation.name).toSorted());

    const colleagues = tools.find((tool) => tool.name === "colleagues-list");
    expect(colleagues?.description?.length).toBeGreaterThan(20);
    expect(colleagues?.inputSchema["properties"]).toHaveProperty("limit");
  });

  it("derives a unique tool name for every operation", () => {
    const names = operations.map((operation) => operation.name);

    expect(new Set(names).size).toBe(names.length);
  });

  it("annotates tools so clients can auto-approve reads and confirm destructive calls", async () => {
    const client = await connectClient();

    const { tools } = await client.listTools();
    const annotationsByName = new Map(tools.map((tool) => [tool.name, tool.annotations]));

    expect(annotationsByName.get("worklogs-list")).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    expect(annotationsByName.get("documents-delete")).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    expect(annotationsByName.get("worklogs-create")).toMatchObject({ readOnlyHint: false, destructiveHint: false });
    expect(annotationsByName.get("validate-goal")).toMatchObject({ readOnlyHint: true });
    expect(annotationsByName.get("merch-request")).toMatchObject({ readOnlyHint: false });

    for (const tool of tools) {
      expect(tool.annotations).toBeDefined();
    }
  });

  it("logs the connected client after the handshake", async () => {
    const { promise: loggedMessage, resolve } = Promise.withResolvers<string>();
    const record = (message: unknown): void => {
      resolve(String(message));
    };
    spyOn(mcpConsola, "success").mockImplementation(Object.assign(record, { raw: record }));

    await connectClient();

    expect(await loggedMessage).toContain("MCP client connected: test-client v0.0.0");
  });

  it("runs an operation and returns its data as JSON text", async () => {
    await seedValidSession();

    const collaborator = {
      uuid: "u1",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      positions: [],
    };
    mockFetch(() => Promise.resolve(jsonResponse({ message: "ok", data: [collaborator] })));

    const client = await connectClient();
    const result = await client.callTool({ name: "colleagues-list", arguments: { limit: 5 } });

    expect(result.isError).toBeFalsy();

    const [block] = textContentSchema.parse(result.content);
    expect(JSON.parse(block?.text ?? "")).toEqual([collaborator]);
  });

  it("accepts already-transformed arguments for tools with transform fields", async () => {
    await seedValidSession();

    let requestBody: unknown = null;
    mockFetch((_input, init) => {
      requestBody = JSON.parse(String(init?.body));

      return Promise.resolve(jsonResponse({ message: "OK", data: { id: 1, name: "Backend", users: [] } }));
    });

    const client = await connectClient();
    const result = await client.callTool({
      name: "substitute-groups-create",
      arguments: { name: "Backend", userIds: "1, 2,3" },
    });

    expect(result.isError).toBeFalsy();
    expect(requestBody).toEqual({ name: "Backend", userIds: [1, 2, 3] });
  });

  it("narrows the published tools via toolsets and read-only filters", () => {
    const worklogTools = selectOperations({ toolsets: ["worklogs", "me"] });
    expect(worklogTools.map((operation) => operation.name)).toContain("worklogs-create");
    expect(worklogTools.map((operation) => operation.name)).toContain("me");
    expect(worklogTools.map((operation) => operation.name)).not.toContain("documents-list");

    const readOnlyWorklogTools = selectOperations({ toolsets: ["worklogs"], readOnly: true });
    expect(readOnlyWorklogTools.every((operation) => operation.annotations?.readOnlyHint === true)).toBe(true);
    expect(readOnlyWorklogTools.map((operation) => operation.name)).not.toContain("worklogs-create");

    expect(() => selectOperations({ toolsets: ["nope"] })).toThrow(/Unknown toolset/u);
  });

  it("returns a clean in-band error when not logged in", async () => {
    const client = await connectClient();
    const result = await client.callTool({ name: "me", arguments: {} });

    expect(result.isError).toBe(true);

    const [block] = textContentSchema.parse(result.content);
    expect(block?.text).toContain("Not logged in");
  });
});
