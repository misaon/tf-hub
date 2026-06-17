import { describe, expect, it } from "bun:test";

import { getCurrentCollaborator, resolveCollaboratorScope } from "../src/domains/collaborators/api.ts";
import { absencesDomain } from "../src/domains/absences/index.ts";
import { documentsDomain } from "../src/domains/documents/index.ts";
import { colleaguesDomain } from "../src/domains/collaborators/index.ts";
import { gameDomain } from "../src/domains/game/index.ts";
import { goalsDomain } from "../src/domains/goals/index.ts";
import { meEntry } from "../src/domains/profile/index.ts";
import type { Operation } from "../src/domains/operation.ts";
import { worklogsDomain } from "../src/domains/worklogs/index.ts";
import { jsonResponse, mockFetch, seedValidSession } from "./support.ts";

function operationByName(operations: readonly Operation[], name: string): Operation {
  const operation = operations.find((candidate) => candidate.name === name);

  if (!operation) {
    throw new Error(`Operation ${name} is not registered.`);
  }

  return operation;
}

const me = Object.freeze({
  id: 7,
  uuid: "UUID-1",
  firstName: "Test",
  lastName: "User",
  email: "test@example.com",
  positions: [],
});

describe("documents-list operation", () => {
  it("scopes to the current collaborator when --mine is set", async () => {
    await seedValidSession();

    const fetchSpy = mockFetch((input) =>
      Promise.resolve(
        String(input).includes("/collaborators/me")
          ? jsonResponse({ message: "OK", data: me })
          : jsonResponse({ message: "OK", data: [{ uuid: "d1", title: "Doc", documentState: "SIGNED" }] }),
      ),
    );

    const listOperation = operationByName(documentsDomain.operations, "documents-list");
    const documents = await listOperation.run(listOperation.input.parse({ mine: true }));

    expect(documents).toHaveLength(1);

    const documentsCall = fetchSpy.mock.calls.find(([requestUrl]) => String(requestUrl).includes("/documents"));
    expect(String(documentsCall?.[0])).toContain("userUuid=UUID-1");
  });

  it("rejects a malformed collaborator payload instead of returning unsafe data", async () => {
    await seedValidSession();

    mockFetch(() => Promise.resolve(jsonResponse({ message: "OK", data: { uuid: 42 } })));

    await expect(getCurrentCollaborator()).rejects.toThrow();
  });
});

describe("worklogs-create operation", () => {
  it("fills in the signed-in collaborator id and a null projectUuid", async () => {
    await seedValidSession();

    let requestBody: unknown = null;
    const worklog = {
      id: 1,
      timeSpent: 60,
      started: "2026-06-10",
    };
    mockFetch((input, init) => {
      if (String(input).includes("/collaborators/me")) {
        return Promise.resolve(jsonResponse({ message: "OK", data: me }));
      }

      requestBody = JSON.parse(String(init?.body));

      return Promise.resolve(jsonResponse({ message: "OK", data: worklog }));
    });

    const createOperation = operationByName(worklogsDomain.operations, "worklogs-create");
    await createOperation.run(
      createOperation.input.parse({
        description: "Work",
        timeSpent: "60",
        started: "2026-06-10",
        costCategoryId: "3",
      }),
    );

    expect(requestBody).toEqual({
      description: "Work",
      timeSpent: 60,
      started: "2026-06-10",
      costCategoryId: 3,
      projectUuid: null,
      collaboratorId: 7,
    });
  });
});

describe("absences-list operation", () => {
  it("scopes to the current collaborator when mine is set", async () => {
    await seedValidSession();

    const fetchSpy = mockFetch((input) =>
      Promise.resolve(
        String(input).includes("/collaborators/me")
          ? jsonResponse({ message: "OK", data: me })
          : jsonResponse({ message: "OK", data: [] }),
      ),
    );

    const listOperation = operationByName(absencesDomain.operations, "absences-list");
    await listOperation.run(listOperation.input.parse({ mine: true }));

    const absencesCall = fetchSpy.mock.calls.find(([requestUrl]) => String(requestUrl).includes("/office-absences"));
    expect(String(absencesCall?.[0])).toContain("collaboratorUuid=UUID-1");
  });
});

describe("goals-list operation", () => {
  it("scopes to the current collaborator when mine is set", async () => {
    await seedValidSession();

    const fetchSpy = mockFetch((input) =>
      Promise.resolve(
        String(input).includes("/collaborators/me")
          ? jsonResponse({ message: "OK", data: me })
          : jsonResponse({ message: "OK", data: [] }),
      ),
    );

    const listOperation = operationByName(goalsDomain.operations, "goals-list");
    await listOperation.run(listOperation.input.parse({ mine: true }));

    const goalsCall = fetchSpy.mock.calls.find(([requestUrl]) => String(requestUrl).includes("/collaborator-goals"));
    expect(String(goalsCall?.[0])).toContain("/collaborator-goals/collaborator/UUID-1");
  });
});

describe("resolveCollaboratorScope", () => {
  it("prefers an explicit UUID over mine and never calls the API", async () => {
    const fetchSpy = mockFetch(() => Promise.resolve(jsonResponse({ message: "OK", data: me })));

    await expect(resolveCollaboratorScope({ mine: true, collaboratorUuid: "UUID-9" })).resolves.toBe("UUID-9");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("resolves to nothing when neither mine nor a UUID is given", async () => {
    const fetchSpy = mockFetch(() => Promise.resolve(jsonResponse({ message: "OK", data: me })));

    await expect(resolveCollaboratorScope({ mine: false, collaboratorUuid: undefined })).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("colleagues operations", () => {
  const profile = Object.freeze({
    ...me,
    bioText: '<h1>About</h1><p>Hello<img src="data:image/png;base64,AAAA"></p>',
  });

  it("returns plain-text bios for the whole directory in a single call", async () => {
    await seedValidSession();

    const fetchSpy = mockFetch(() => Promise.resolve(jsonResponse({ message: "OK", data: [profile] })));

    const listOperation = operationByName(colleaguesDomain.operations, "colleagues-list");
    const colleagues = await listOperation.run(listOperation.input.parse({ withBios: true }));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(colleagues).toEqual([expect.objectContaining({ bioText: "About\nHello [image]" })]);
  });
});

describe("game month formatting", () => {
  it("sends the unpadded month the Hub keys its records on", async () => {
    await seedValidSession();

    const fetchSpy = mockFetch(() => Promise.resolve(jsonResponse({ message: "OK", data: [] })));

    const donorsOperation = operationByName(gameDomain.operations, "game-donors");
    await donorsOperation.run(donorsOperation.input.parse({ month: "2026-06" }));

    const requestUrl = String(fetchSpy.mock.calls[0]?.[0]);
    expect(requestUrl).toContain("/game/donors/2026-6");
    expect(requestUrl).not.toContain("2026-06");
  });
});

describe("me operation", () => {
  it("omits the bio from the identity payload", async () => {
    await seedValidSession();
    mockFetch(() => Promise.resolve(jsonResponse({ message: "OK", data: { ...me, bioText: "x".repeat(30_000) } })));

    const meOperation = operationByName(meEntry.operations, "me");
    const identity = await meOperation.run(meOperation.input.parse({}));

    expect(identity).not.toContainKey("bioText");
    expect(identity).toMatchObject({ uuid: "UUID-1", id: 7 });
  });
});
