import { stripVTControlCharacters } from "node:util";
import { describe, expect, it, spyOn } from "bun:test";

import {
  formatMinutes,
  formatName,
  formatValue,
  missingValue,
  plainText,
  printJson,
  printTable,
  stripControlCharacters,
} from "../src/cli/output.ts";
import { displayWidth, renderTable } from "../src/cli/table.ts";

describe("printTable", () => {
  it("prints a message instead of an empty table and total", () => {
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

    printTable([], ["ID", "Name"]);

    const output = stripVTControlCharacters(writeSpy.mock.calls.map(([chunk]) => String(chunk)).join(""));
    expect(output).toBe("No records found.\n");
  });
});

describe("renderTable", () => {
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

  it("measures combining marks and wide characters by their display width", () => {
    expect(displayWidth("e\u0301")).toBe(1);
    expect(displayWidth("日本")).toBe(4);

    const rendered = stripVTControlCharacters(
      renderTable(
        [
          { Name: "日本", Role: "QA" },
          { Name: "Ann", Role: "Lead" },
        ],
        ["Name", "Role"],
      ),
    );

    expect(rendered).toContain("日本  QA");
    expect(rendered).toContain("Ann   Lead");
  });

  it("shrinks the widest column with an ellipsis to fit the available width", () => {
    const rendered = stripVTControlCharacters(
      renderTable([{ ID: "1", Note: "A very long note that cannot fit" }], ["ID", "Note"], 20),
    );

    expect(rendered.split("\n").every((line) => displayWidth(line) <= 20)).toBe(true);
    expect(rendered).toContain("…");
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

  it("leaves out-of-range and control-character entities encoded instead of crashing or decoding them", () => {
    expect(plainText("<p>&#9999999; &#27;[2J ok &#269;</p>")).toBe("&#9999999; &#27;[2J ok č");
  });
});

describe("printJson", () => {
  it("escapes DEL and C1 controls that JSON.stringify would pass through raw", () => {
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

    printJson({ note: "a\u009B2Jb\u007F" });

    const output = String(writeSpy.mock.calls[0]?.[0]);
    expect(output).toContain(String.raw`a\u009b2Jb\u007f`);
    expect(JSON.parse(output)).toEqual({ note: "a\u009B2Jb\u007F" });
  });
});

describe("stripControlCharacters", () => {
  it("removes terminal escape sequences' control characters but keeps tabs and newlines", () => {
    expect(stripControlCharacters("a\u001B]52;c;evil\u0007b\tc\nd")).toBe("a]52;c;evilb\tc\nd");
  });
});
