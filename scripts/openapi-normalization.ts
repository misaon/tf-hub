import { z } from "zod";

const nestedSchema = z.looseObject({
  type: z.string().optional(),
  enum: z.array(z.unknown()).optional(),
  $ref: z.string().optional(),
});

type NestedSchema = z.infer<typeof nestedSchema>;

const propertySchema = z.looseObject({
  type: z.string().optional(),
  format: z.string().optional(),
  enum: z.array(z.unknown()).optional(),
  nullable: z.boolean().optional(),
  default: z.unknown().optional(),
  $ref: z.string().optional(),
  allOf: z.array(nestedSchema).optional(),
  items: nestedSchema.optional(),
});

const componentSchema = z.looseObject({
  enum: z.array(z.unknown()).optional(),
  required: z.array(z.string()).optional(),
  properties: z.record(z.string(), propertySchema).optional(),
});

export const specSchema = z.looseObject({
  components: z.looseObject({ schemas: z.record(z.string(), componentSchema).optional() }).optional(),
});

type OpenApiSpec = z.infer<typeof specSchema>;

// Avatar URLs and self links are presentation and API plumbing no table or agent uses.
// Without them in the response schemas, Zod strips them at the boundary from every payload that embeds a person.
const discardedResponseProperties = ["slackAvatarUrl", "_selfUrl"];

// Request DTOs are validated by the server; we only parse responses.
function isRequestSchema(name: string): boolean {
  return name.startsWith("Create") || name.startsWith("Update");
}

// The NestJS-generated spec is too strict for reality, so this script relaxes it.
// Generated Zod schemas should validate structure, not promises the server does not keep.
// Date formats become plain strings — the server mixes dates and full timestamps.
// Response enums become plain strings — live data has values outside the declared sets.
// That covers inline enums as well as shared enum components referenced by properties or array items.
// Response properties become nullish without defaults — NestJS marks everything required,
// Hub endpoints omit fields freely, and the CLI prefers "—" over crashing.
export function normalize(spec: OpenApiSpec): void {
  const schemas = spec.components?.schemas ?? {};
  const enumReferences = new Set(
    Object.entries(schemas)
      .filter(([, schema]) => schema.enum !== undefined)
      .map(([name]) => `#/components/schemas/${name}`),
  );
  const declaresEnum = (node: NestedSchema | undefined): boolean =>
    node?.enum !== undefined || enumReferences.has(node?.$ref ?? "");

  for (const [name, schema] of Object.entries(schemas)) {
    if (!isRequestSchema(name)) {
      delete schema.required;

      for (const key of discardedResponseProperties) {
        delete schema.properties?.[key];
      }
    }

    for (const [key, property] of Object.entries(schema.properties ?? {})) {
      if (property.format === "date" || property.format === "date-time") {
        delete property.format;
      }

      const relaxesEnums = property.nullable === true || !isRequestSchema(name);
      const wrapsOnlyAnEnum = property.allOf?.length === 1 && declaresEnum(property.allOf[0]);

      if (relaxesEnums && (declaresEnum(property) || wrapsOnlyAnEnum)) {
        delete property.enum;
        delete property.$ref;
        delete property.allOf;
        property.type ??= "string";
      }

      if (relaxesEnums && declaresEnum(property.items)) {
        property.items = { type: "string" };
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
