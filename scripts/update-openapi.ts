#!/usr/bin/env bun
// Downloads the Hub OpenAPI spec and normalizes it for codegen (runs as part of `bun run generate`).
import { consola } from "consola";
import { z } from "zod";

import { apiBaseUrl } from "../src/config.ts";

const specUrl = `${apiBaseUrl}/tf/hub/api-docs-json`;

const propertySchema = z.looseObject({
  type: z.string().optional(),
  format: z.string().optional(),
  enum: z.array(z.unknown()).optional(),
  nullable: z.boolean().optional(),
  default: z.unknown().optional(),
  $ref: z.string().optional(),
});

const componentSchema = z.looseObject({
  required: z.array(z.string()).optional(),
  properties: z.record(z.string(), propertySchema).optional(),
});

const specSchema = z.looseObject({
  components: z.looseObject({ schemas: z.record(z.string(), componentSchema).optional() }).optional(),
});

type OpenApiSpec = z.infer<typeof specSchema>;

// Request DTOs are validated by the server; we only parse responses.
function isRequestSchema(name: string): boolean {
  return name.startsWith("Create") || name.startsWith("Update");
}

// The NestJS-generated spec is too strict for reality, so this script relaxes it.
// Generated Zod schemas should validate structure, not promises the server does not keep.
// Date formats become plain strings — the server mixes dates and full timestamps.
// Response enums become plain strings — live data has values outside the declared sets.
// Response properties become nullish without defaults — NestJS marks everything required,
// Hub endpoints omit fields freely, and the CLI prefers "—" over crashing.
function normalize(spec: OpenApiSpec): void {
  for (const [name, schema] of Object.entries(spec.components?.schemas ?? {})) {
    if (!isRequestSchema(name)) {
      delete schema.required;
    }

    for (const [key, property] of Object.entries(schema.properties ?? {})) {
      if (property.format === "date" || property.format === "date-time") {
        delete property.format;
      }

      if (property.enum && (property.nullable === true || !isRequestSchema(name))) {
        delete property.enum;
        property.type ??= "string";
      }

      if (!isRequestSchema(name)) {
        // Responses must not fabricate values for missing fields.
        delete property.default;

        // `nullable` is not a valid sibling of $ref in OpenAPI 3.0 — wrap the reference instead.
        if (property.$ref === undefined) {
          property.nullable = true;
        } else {
          schema.properties![key] = { allOf: [{ $ref: property.$ref }], nullable: true };
        }
      }
    }
  }
}

const response = await fetch(specUrl);

if (!response.ok) {
  throw new Error(`Failed to download the OpenAPI spec from ${specUrl} (HTTP ${response.status}).`);
}

const spec = specSchema.parse(await response.json());
normalize(spec);

await Bun.write("openapi.json", `${JSON.stringify(spec, null, 2)}\n`);
consola.success(`openapi.json updated from ${specUrl}.`);
