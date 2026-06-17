import { describe, expect, it } from "bun:test";
import { z } from "zod";

import {
  commaSeparatedNumbersField,
  commaSeparatedStringsField,
  explicitBooleanField,
  jsonField,
  monthField,
} from "../src/domains/fields.ts";

describe("monthField", () => {
  it("normalizes months to the unpadded form the Hub expects", () => {
    expect(monthField("m").parse("2026-05")).toBe("2026-5");
    expect(monthField("m").parse("2026-5")).toBe("2026-5");
    expect(monthField("m").parse("2026-12")).toBe("2026-12");
    expect(monthField("m").parse("2026-10")).toBe("2026-10");
  });

  it("rejects invalid months", () => {
    expect(() => monthField("m").parse("2026-13")).toThrow();
    expect(() => monthField("m").parse("nope")).toThrow();
  });
});

describe("explicitBooleanField", () => {
  it("parses only the literal strings true and false", () => {
    expect(explicitBooleanField("b").parse("true")).toBe(true);
    expect(explicitBooleanField("b").parse("false")).toBe(false);
    expect(() => explicitBooleanField("b").parse("yes")).toThrow();
  });
});

describe("comma-separated fields", () => {
  it("parses numeric ID lists and rejects non-numbers", () => {
    expect(commaSeparatedNumbersField("ids").parse("1, 2,3")).toEqual([1, 2, 3]);
    expect(() => commaSeparatedNumbersField("ids").parse("1,x")).toThrow();
  });

  it("parses string lists and drops empty items", () => {
    expect(commaSeparatedStringsField("labels").parse("a, b,,c")).toEqual(["a", "b", "c"]);
    expect(commaSeparatedStringsField("labels").parse("")).toEqual([]);
  });
});

describe("jsonField", () => {
  const field = jsonField(z.array(z.object({ date: z.string() })), "items");

  it("parses JSON and validates it against the inner schema", () => {
    expect(field.parse('[{"date":"2026-06-10"}]')).toEqual([{ date: "2026-06-10" }]);
  });

  it("rejects invalid JSON and schema mismatches", () => {
    expect(() => field.parse("not-json")).toThrow();
    expect(() => field.parse('{"date":1}')).toThrow();
  });
});
