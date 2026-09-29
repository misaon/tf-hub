import { describe, expect, it } from "bun:test";

import { colleaguesDomain } from "../src/domains/collaborators/index.ts";
import { documentsDomain } from "../src/domains/documents/index.ts";
import { oneOnOnesDomain } from "../src/domains/one-on-ones/index.ts";
import { sitdownNotesDomain } from "../src/domains/sitdowns/index.ts";
import { jsonResponse, mockFetch, operationByName, seedValidSession } from "./support.ts";

describe("documents operations", () => {
  const storedDocument = Object.freeze({
    uuid: "0f4ad4e4-7a69-11ed-9965-42010a7f9011",
    title: "Employment contract",
    content: "<h1>Contract</h1><p>Terms &amp; conditions</p>",
    documentState: "WAITING_FOR_SIGN",
  });

  it("omits the content from lists unless it is requested, then returns it as plain text", async () => {
    await seedValidSession();
    mockFetch(() => Promise.resolve(jsonResponse({ message: "OK", data: [storedDocument] })));

    const listOperation = operationByName(documentsDomain.operations, "documents-list");
    const withoutContent = await listOperation.run(listOperation.input.parse({}));
    const withContent = await listOperation.run(listOperation.input.parse({ withContent: true }));

    expect(withoutContent).toEqual([expect.not.objectContaining({ content: expect.anything() })]);
    expect(withContent).toEqual([expect.objectContaining({ content: "Contract\nTerms & conditions" })]);
  });

  it("signs a document with only its state, re-sending the stored title and content untouched", async () => {
    await seedValidSession();

    let requestBody: unknown = null;
    mockFetch((_input, init) => {
      if (init?.method === "PUT") {
        requestBody = JSON.parse(String(init.body));

        return Promise.resolve(jsonResponse({ message: "OK", data: { ...storedDocument, documentState: "SIGNED" } }));
      }

      return Promise.resolve(jsonResponse({ message: "OK", data: [storedDocument] }));
    });

    const updateOperation = operationByName(documentsDomain.operations, "documents-update");
    await updateOperation.run(updateOperation.input.parse({ uuid: storedDocument.uuid, documentState: "SIGNED" }));

    expect(requestBody).toEqual({
      documentState: "SIGNED",
      title: storedDocument.title,
      content: storedDocument.content,
    });
  });
});

describe("sitdown-notes-list operation", () => {
  it("sends withDeleted only when resolved notes are wanted, because the Hub treats any value as true", async () => {
    await seedValidSession();

    const fetchSpy = mockFetch(() => Promise.resolve(jsonResponse({ message: "OK", data: [] })));
    const listOperation = operationByName(sitdownNotesDomain.operations, "sitdown-notes-list");

    await listOperation.run(listOperation.input.parse({}));
    await listOperation.run(listOperation.input.parse({ withDeleted: true }));

    expect(String(fetchSpy.mock.calls[0]?.[0])).not.toContain("withDeleted");
    expect(String(fetchSpy.mock.calls[1]?.[0])).toContain("withDeleted=true");
  });
});

describe("one-on-ones-list operation", () => {
  it("returns the notes as plain text without embedded images", async () => {
    await seedValidSession();
    mockFetch(() =>
      Promise.resolve(
        jsonResponse({
          message: "OK",
          data: [{ uuid: "o1", message: '<p>Salary review<img src="data:image/png;base64,AAAA"></p>' }],
        }),
      ),
    );

    const listOperation = operationByName(oneOnOnesDomain.operations, "one-on-ones-list");
    const oneOnOnes = await listOperation.run(listOperation.input.parse({}));

    expect(oneOnOnes).toEqual([expect.objectContaining({ message: "Salary review [image]" })]);
  });
});

describe("colleagues-list operation", () => {
  it("leaves out the permission lists every position repeats", async () => {
    await seedValidSession();
    mockFetch(() =>
      Promise.resolve(
        jsonResponse({
          message: "OK",
          data: [
            {
              uuid: "UUID-1",
              firstName: "Test",
              lastName: "User",
              positions: [{ id: 1, name: "Developer", permissions: [{ id: 3, name: "Read" }] }],
            },
          ],
        }),
      ),
    );

    const listOperation = operationByName(colleaguesDomain.operations, "colleagues-list");
    const colleagues = await listOperation.run(listOperation.input.parse({}));

    expect(colleagues).toEqual([expect.objectContaining({ positions: [{ id: 1, name: "Developer" }] })]);
  });
});
