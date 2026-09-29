#!/usr/bin/env bun
// Downloads the Hub OpenAPI spec and normalizes it for codegen (runs as part of `bun run generate`).
import { consola } from "consola";

import { apiBaseUrl } from "../src/config.ts";
import { normalize, specSchema } from "./openapi-normalization.ts";

const specUrl = `${apiBaseUrl}/tf/hub/api-docs-json`;

const response = await fetch(specUrl);

if (!response.ok) {
  throw new Error(`Failed to download the OpenAPI spec from ${specUrl} (HTTP ${response.status}).`);
}

const spec = specSchema.parse(await response.json());
normalize(spec);

await Bun.write("openapi.json", `${JSON.stringify(spec, null, 2)}\n`);
consola.success(`openapi.json updated from ${specUrl}.`);
