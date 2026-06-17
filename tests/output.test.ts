import { describe, expect, it } from "bun:test";

import { formatMinutes, formatName, formatValue, missingValue, plainText } from "../src/cli/output.ts";
import { renderTable } from "../src/cli/table.ts";

describe("renderTable", () => {
  it("renders a placeholder instead of an empty table", () => {
    expect(renderTable([], ["ID", "Name"])).toContain("(no data)");
  });

  it("pads every column to its widest cell", () => {
    const rendered = renderTable(
      [
        { Name: "A", Role: "Lead" },
        { Name: "Longer", Role: "QA" },
      ],
      ["Name", "Role"],
    );

    expect(rendered).toContain("A       Lead");
    expect(rendered).toContain("Longer  QA");
  });
});

describe("formatMinutes", () => {
  it("renders whole hours without a minute remainder", () => {
    expect(formatMinutes(480)).toBe("8h");
  });

  it("renders hours with the minute remainder", () => {
    expect(formatMinutes(90)).toBe("1h 30m");
  });

  it("renders the placeholder for missing values", () => {
    expect(formatMinutes(null)).toBe(missingValue);
    expect(formatMinutes(undefined)).toBe(missingValue);
  });
});

describe("formatName", () => {
  it("prefers a preformatted name", () => {
    expect(formatName({ name: "Jane Doe" })).toBe("Jane Doe");
  });

  it("joins first and last name, tolerating a missing part", () => {
    expect(formatName({ firstName: "Jane", lastName: "Doe" })).toBe("Jane Doe");
    expect(formatName({ firstName: null, lastName: "Doe" })).toBe("Doe");
  });

  it("renders the placeholder when nothing is known", () => {
    expect(formatName(null)).toBe(missingValue);
    expect(formatName({ firstName: "", lastName: "" })).toBe(missingValue);
  });
});

describe("formatValue", () => {
  it("renders booleans as yes/no and empty values as the placeholder", () => {
    expect(formatValue(true)).toBe("yes");
    expect(formatValue(false)).toBe("no");
    expect(formatValue("")).toBe(missingValue);
    expect(formatValue(null)).toBe(missingValue);
  });
});

describe("plainText", () => {
  it("replaces inline images with a placeholder", () => {
    expect(plainText('<p>Hi<img src="data:image/png;base64,AAAA"></p>')).toBe("Hi [image]");
  });

  it("strips tags, decodes entities and keeps block breaks", () => {
    expect(plainText("<h1>Title</h1><p>A &amp; B&nbsp;&lt;ok&gt;</p>")).toBe("Title\nA & B <ok>");
  });

  it("returns an empty string for missing input", () => {
    expect(plainText(null)).toBe("");
    expect(plainText(undefined)).toBe("");
  });
});
