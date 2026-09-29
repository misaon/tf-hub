import { describe, expect, it } from "bun:test";

import { normalize, specSchema } from "../scripts/openapi-normalization.ts";

const stateEnum = { type: "string", enum: ["OPEN", "DONE"] };
const stateReference = { $ref: "#/components/schemas/State" };

function normalizedSchemas(schemas: Record<string, unknown>) {
  const spec = specSchema.parse({ components: { schemas } });
  normalize(spec);

  return spec.components?.schemas ?? {};
}

describe("normalize", () => {
  it("relaxes shared enum components referenced by response properties and array items", () => {
    const schemas = normalizedSchemas({
      State: stateEnum,
      TaskDto: {
        required: ["state"],
        properties: {
          state: { allOf: [stateReference] },
          history: { type: "array", items: stateReference },
        },
      },
    });

    expect(schemas["TaskDto"]?.required).toBeUndefined();
    expect(schemas["TaskDto"]?.properties?.["state"]).toEqual({ type: "string", nullable: true });
    expect(schemas["TaskDto"]?.properties?.["history"]).toEqual({
      type: "array",
      items: { type: "string" },
      nullable: true,
    });
  });

  it("keeps the enums and required fields of request schemas", () => {
    const schemas = normalizedSchemas({
      State: stateEnum,
      CreateTaskDto: { required: ["state"], properties: { state: { allOf: [stateReference] } } },
    });

    expect(schemas["CreateTaskDto"]?.required).toEqual(["state"]);
    expect(schemas["CreateTaskDto"]?.properties?.["state"]).toEqual({ allOf: [stateReference] });
  });

  it("drops avatar URLs and self links from responses so the parsed data never carries them", () => {
    const schemas = normalizedSchemas({
      PersonDto: {
        properties: { name: { type: "string" }, slackAvatarUrl: { type: "string" }, _selfUrl: { type: "string" } },
      },
    });

    expect(Object.keys(schemas["PersonDto"]?.properties ?? {})).toEqual(["name"]);
  });

  it("wraps references to other schemas instead of placing nullable next to $ref", () => {
    const schemas = normalizedSchemas({
      OwnerDto: { properties: {} },
      TaskDto: { properties: { owner: { $ref: "#/components/schemas/OwnerDto" } } },
    });

    expect(schemas["TaskDto"]?.properties?.["owner"]).toEqual({
      allOf: [{ $ref: "#/components/schemas/OwnerDto" }],
      nullable: true,
    });
  });
});
