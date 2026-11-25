#!/usr/bin/env bun
// Builds the Node-ready npm bundle: a small entry plus lazily loaded chunks (MCP server, browser login).
import { rm } from "node:fs/promises";
import { consola } from "consola";

const outputDirectory = "dist";

await rm(outputDirectory, { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: ["src/index.ts"],
  outdir: outputDirectory,
  target: "node",
  format: "esm",
  minify: true,
  splitting: true,
  // Node >= 22 has native fetch, so ofetch's universal entry avoids bundling node-fetch-native.
  conditions: ["worker"],
  naming: { entry: "[name].mjs", chunk: "chunks/[name]-[hash].mjs" },
});

if (!result.success) {
  throw new AggregateError(result.logs, "The bundle build failed.");
}

const totalBytes = result.outputs.reduce((sum, output) => sum + output.size, 0);

consola.success(`${result.outputs.length} files in ${outputDirectory}/ (${totalBytes} bytes).`);
