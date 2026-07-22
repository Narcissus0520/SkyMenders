import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createContentGateway, assertLoopbackHost } from "../src/server.js";
import { ContentWorkspace } from "../src/workspace.js";

const temporaryDirectories: string[] = [];

async function fixture(): Promise<{ readonly root: string; readonly workspace: ContentWorkspace }> {
  const root = await mkdtemp(resolve(tmpdir(), "skymenders-content-"));
  temporaryDirectories.push(root);
  await cp(resolve(import.meta.dirname, "../../../content"), resolve(root, "content"), {
    recursive: true,
  });
  return { root, workspace: new ContentWorkspace({ rootDirectory: root }) };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("content gateway", () => {
  it("rejects non-loopback binding", () => {
    expect(() => {
      assertLoopbackHost("0.0.0.0");
    }).toThrow("loopback");
    expect(() => {
      assertLoopbackHost("127.0.0.1");
    }).not.toThrow();
  });

  it("supports revision-safe structured writes and blocks invalid catalogs", async () => {
    const { workspace } = await fixture();
    const current = await workspace.readCatalog("events");
    const changed = structuredClone(current.data) as { events: { titleKey: string }[] };
    const firstEvent = changed.events[0];
    if (firstEvent === undefined) throw new Error("event fixture is empty");
    firstEvent.titleKey = "events.changed.title";
    const saved = await workspace.saveCatalog("events", current.revision, changed, "editor.one");
    expect(saved.revision).not.toBe(current.revision);
    await expect(
      workspace.saveCatalog("events", current.revision, changed, "editor.one"),
    ).rejects.toMatchObject({ code: "CATALOG_CONFLICT" });
    await expect(
      workspace.saveCatalog("events", saved.revision, { events: [] }, "editor.one"),
    ).rejects.toMatchObject({ code: "CATALOG_INVALID" });
  });

  it("requires validation, two-person approval, signing and explicit publish confirmation", async () => {
    const { root, workspace } = await fixture();
    const record = await workspace.buildPublication({
      actor: "author.one",
      rulesVersion: "0.5.0",
      commitSha: "abcdef0",
    });
    expect(record.state).toBe("validated");
    await workspace.stagePublication(record.id, "author.one");
    await expect(workspace.approvePublication(record.id, "author.one")).rejects.toMatchObject({
      code: "SEPARATION_OF_DUTIES_REQUIRED",
    });
    await workspace.approvePublication(record.id, "reviewer.two");
    await workspace.signPublication(
      record.id,
      "release.bot",
      "a-signing-secret-that-is-longer-than-thirty-two",
    );
    await expect(workspace.publish(record.id, "release.manager", "WRONG")).rejects.toMatchObject({
      code: "CONFIRMATION_REQUIRED",
    });
    const published = await workspace.publish(record.id, "release.manager", record.id);
    expect(published.state).toBe("published");
    expect(await readFile(resolve(root, ".content-publications/current.json"), "utf8")).toContain(
      record.id,
    );
  });

  it("protects writes with a per-process session and exposes field errors", async () => {
    const { workspace } = await fixture();
    const app = await createContentGateway({ workspace, sessionToken: "test-session" });
    const document = await app.inject({ method: "GET", url: "/api/catalogs/maps" });
    expect(document.statusCode).toBe(200);
    const authority = await app.inject({ method: "GET", url: "/api/authority" });
    expect(authority.statusCode).toBe(200);
    expect(authority.body).toContain("main_fold_bridge");
    expect(authority.body).toContain("enemy_scout");
    const invalidCatalog = await app.inject({ method: "GET", url: "/api/catalogs/not-a-catalog" });
    expect(invalidCatalog.statusCode).toBe(400);
    expect(invalidCatalog.json()).toMatchObject({ error: { code: "INVALID_REQUEST" } });
    const denied = await app.inject({ method: "POST", url: "/api/validate" });
    expect(denied.statusCode).toBe(401);
    const allowed = await app.inject({
      method: "POST",
      url: "/api/validate",
      headers: { "x-content-session": "test-session" },
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json()).toMatchObject({ valid: true });
    await app.close();

    const limited = await createContentGateway({
      workspace,
      sessionToken: "limited-session",
      rateLimitMax: 2,
    });
    expect((await limited.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
    expect((await limited.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
    const limitedResponse = await limited.inject({ method: "GET", url: "/health" });
    expect(limitedResponse.statusCode).toBe(429);
    expect(limitedResponse.json()).toMatchObject({ error: { code: "RATE_LIMITED" } });
    await limited.close();
  });
});
