import { createRngState, createSnapshot } from "@skymenders/deterministic-runtime";
import { runtimeSnapshotSchema } from "@skymenders/protocol";
import type { ExpeditionSaveDocument, ExpeditionStateDocument } from "@skymenders/protocol";
import { sealExpeditionSave } from "@skymenders/save-migration";
import { describe, expect, it } from "vitest";

import {
  AuthSessionManager,
  CloudSaveCoordinator,
  HttpCloudSaveGateway,
  LocalSaveStore,
  MockPlatformAdapter,
  toSaveSummary,
} from "../assets/scripts/index.js";
import type {
  CloudSaveConflict,
  CloudSaveGateway,
  JsonRequest,
  JsonResponse,
} from "../assets/scripts/index.js";

describe("client authentication", () => {
  it("starts empty and rejects authenticated operations before login", async () => {
    const sessions = new AuthSessionManager(new MockPlatformAdapter(), new ScriptedTransport([]));
    expect(sessions.accessToken()).toBeNull();
    expect(sessions.accountId()).toBeNull();
    expect(await sessions.restore()).toBeNull();
    await expect(sessions.refresh()).rejects.toThrow("no active session");
    await expect(
      sessions.authorizedRequest({ method: "GET", path: "/v1/profile" }),
    ).rejects.toThrow("authentication is required");
  });

  it("sends only a one-use login code and keeps the access token in memory", async () => {
    const platform = new MockPlatformAdapter();
    const firstRefresh = "r".repeat(43);
    const transport = new ScriptedTransport([okSession(firstRefresh)]);
    const sessions = new AuthSessionManager(platform, transport);
    const session = await sessions.login();
    expect(sessions.accessToken()).toBe(session.accessToken);
    expect(sessions.accountId()).toBe(session.accountId);
    expect(await platform.readStorage("skymenders.session.refresh.v1")).toBe(firstRefresh);
    expect(transport.requests[0]).toMatchObject({
      path: "/v1/auth/wechat",
      body: { code: "mock-login-code", deviceKind: "unknown" },
    });
    expect(JSON.stringify(transport.requests[0])).not.toContain(["App", "Secret"].join(""));
  });

  it("rotates credentials after a 401 and clears an invalid stored refresh token", async () => {
    const platform = new MockPlatformAdapter();
    const firstRefresh = "r".repeat(43);
    const secondRefresh = "s".repeat(43);
    const transport = new ScriptedTransport([
      okSession(firstRefresh),
      { status: 401, body: {} },
      okSession(secondRefresh),
      { status: 200, body: { value: 7 } },
    ]);
    const sessions = new AuthSessionManager(platform, transport);
    await sessions.login();
    expect(await sessions.authorizedRequest({ method: "GET", path: "/v1/profile" })).toEqual({
      status: 200,
      body: { value: 7 },
    });
    expect(await platform.readStorage("skymenders.session.refresh.v1")).toBe(secondRefresh);

    const broken = new AuthSessionManager(platform, new RejectingTransport());
    expect(await broken.restore()).toBeNull();
    expect(await platform.readStorage("skymenders.session.refresh.v1")).toBe("");
  });

  it("rejects unsuccessful login responses and clears credentials even when logout is offline", async () => {
    const platform = new MockPlatformAdapter();
    const rejected = new AuthSessionManager(
      platform,
      new ScriptedTransport([{ status: 503, body: {} }]),
    );
    await expect(rejected.login()).rejects.toThrow("status 503");

    const transport = new ScriptedTransport([okSession("r".repeat(43))]);
    const sessions = new AuthSessionManager(platform, transport);
    await sessions.login();
    const offlineLogout = new AuthSessionManager(platform, new RejectingTransport());
    await expect(offlineLogout.logout()).rejects.toThrow("offline");
    expect(await platform.readStorage("skymenders.session.refresh.v1")).toBe("");
    await new AuthSessionManager(platform, new ScriptedTransport([])).logout();
  });
});

describe("HTTP cloud save gateway", () => {
  it("validates successful saves, conflict summaries, resolution, and error statuses", async () => {
    const local = makeSave(0, 2);
    const cloud = makeSave(3, 4);
    const transport = new ScriptedTransport([
      okSession("r".repeat(43)),
      { status: 200, body: cloud },
      {
        status: 409,
        body: {
          error: {
            code: "SAVE_CONFLICT",
            message: "conflict",
            details: { local: toSaveSummary(local), cloud: toSaveSummary(cloud) },
          },
        },
      },
      { status: 503, body: {} },
      { status: 200, body: cloud },
    ]);
    const sessions = new AuthSessionManager(new MockPlatformAdapter(), transport);
    await sessions.login();
    const gateway = new HttpCloudSaveGateway(sessions);
    expect(await gateway.put(null, local, "save-http-0001")).toEqual(cloud);
    expect(await gateway.put(0, local, "save-http-0002")).toEqual({
      kind: "conflict",
      local: toSaveSummary(local),
      cloud: toSaveSummary(cloud),
    });
    await expect(gateway.resolve("cloud", 3, null, "save-http-0003")).rejects.toThrow("status 503");
    expect(await gateway.resolve("cloud", 3, null, "save-http-0004")).toEqual(cloud);
    expect(transport.requests[1]).toMatchObject({
      method: "PUT",
      path: "/v1/saves/expedition",
      headers: { "idempotency-key": "save-http-0001" },
    });
    expect(typeof transport.requests[1]?.headers?.authorization).toBe("string");
  });
});

describe("offline-first save recovery", () => {
  it("keeps an empty store idle and rejects resolution without a conflict", async () => {
    const sync = new CloudSaveCoordinator(
      new LocalSaveStore(new MockPlatformAdapter()),
      new FlakyGateway(makeSave(0, 0), 0),
    );
    expect(await sync.hydrate()).toBeNull();
    expect(await sync.flush({ connected: true, type: "wifi" })).toEqual({ kind: "idle" });
    await expect(sync.resolve("local")).rejects.toThrow("no save conflict");
  });

  it("uses a two-slot journal and falls back after an interrupted active write", async () => {
    const platform = new MockPlatformAdapter();
    const store = new LocalSaveStore(platform);
    const first = makeSave(0, 0);
    const second = makeSave(1, 1);
    await store.writeExpedition(first);
    await store.writeExpedition(second);
    expect(await store.readExpedition()).toEqual(second);

    await platform.writeStorage("skymenders.save.expedition.b.v1", "truncated-write");
    expect(await new LocalSaveStore(platform).readExpedition()).toEqual(first);
  });

  it("survives restart while offline and retries weak-network failures with one stable request key", async () => {
    const platform = new MockPlatformAdapter();
    const store = new LocalSaveStore(platform);
    const local = makeSave(0, 5);
    const gateway = new FlakyGateway(makeSave(0, 6), 2);
    const delays: number[] = [];
    const firstProcess = new CloudSaveCoordinator(store, gateway, (milliseconds) => {
      delays.push(milliseconds);
      return Promise.resolve();
    });
    await firstProcess.queue(local);
    expect(await firstProcess.flush({ connected: false, type: "none" })).toEqual({
      kind: "queued",
    });

    const restarted = new CloudSaveCoordinator(store, gateway, (milliseconds) => {
      delays.push(milliseconds);
      return Promise.resolve();
    });
    expect(await restarted.hydrate()).toEqual(local);
    expect(await restarted.flush({ connected: true, type: "cellular" })).toEqual({
      kind: "synced",
      revision: 0,
    });
    expect(delays).toEqual([250, 500]);
    expect(new Set(gateway.keys).size).toBe(1);
    expect(await store.readExpedition()).toEqual(makeSave(0, 6));
  });

  it("exposes conflict summaries only and applies the player's explicit branch choice", async () => {
    const store = new LocalSaveStore(new MockPlatformAdapter());
    const local = makeSave(2, 5);
    const cloud = makeSave(3, 4);
    const gateway = new ConflictGateway(local, cloud);
    const sync = new CloudSaveCoordinator(store, gateway);
    await sync.queue(local);
    expect(await sync.flush({ connected: true, type: "wifi" })).toEqual({
      kind: "conflict",
      local: toSaveSummary(local),
      cloud: toSaveSummary(cloud),
    });
    expect(JSON.stringify(sync.state())).not.toContain("expedition");
    expect(await sync.resolve("cloud")).toEqual(cloud);
    expect(await store.readExpedition()).toEqual(cloud);
  });

  it("fails closed when a conflict response omits its cloud summary", async () => {
    const local = makeSave(0, 1);
    const store = new LocalSaveStore(new MockPlatformAdapter());
    const gateway: CloudSaveGateway = {
      put: () => Promise.resolve({ kind: "conflict", local: toSaveSummary(local), cloud: null }),
      resolve: () => Promise.reject(new Error("not reached")),
    };
    const sync = new CloudSaveCoordinator(store, gateway);
    await sync.queue(local);
    expect(await sync.flush({ connected: true, type: "wifi" }, 1)).toEqual({
      kind: "retry_wait",
      attempt: 1,
      message: "cloud conflict response has no cloud summary",
    });
  });
});

class ScriptedTransport {
  readonly requests: JsonRequest[] = [];
  public constructor(private readonly responses: JsonResponse[]) {}
  public request(input: JsonRequest): Promise<JsonResponse> {
    this.requests.push(input);
    const response = this.responses.shift();
    if (response === undefined) return Promise.reject(new Error("no scripted response"));
    return Promise.resolve(response);
  }
}

class RejectingTransport {
  public request(): Promise<JsonResponse> {
    return Promise.reject(new Error("offline"));
  }
}

class FlakyGateway implements CloudSaveGateway {
  readonly keys: string[] = [];
  public constructor(
    private readonly result: ExpeditionSaveDocument,
    private failures: number,
  ) {}
  public put(
    _baseRevision: number | null,
    _document: ExpeditionSaveDocument,
    idempotencyKey: string,
  ): Promise<ExpeditionSaveDocument | CloudSaveConflict> {
    this.keys.push(idempotencyKey);
    if (this.failures > 0) {
      this.failures -= 1;
      return Promise.reject(new Error("temporary network failure"));
    }
    return Promise.resolve(this.result);
  }
  public resolve(): Promise<ExpeditionSaveDocument> {
    return Promise.reject(new Error("no conflict"));
  }
}

class ConflictGateway implements CloudSaveGateway {
  public constructor(
    private readonly local: ExpeditionSaveDocument,
    private readonly cloud: ExpeditionSaveDocument,
  ) {}
  public put(): Promise<CloudSaveConflict> {
    return Promise.resolve({
      kind: "conflict",
      local: toSaveSummary(this.local),
      cloud: toSaveSummary(this.cloud),
    });
  }
  public resolve(choice: "local" | "cloud"): Promise<ExpeditionSaveDocument> {
    return Promise.resolve(choice === "local" ? this.local : this.cloud);
  }
}

function okSession(refreshToken: string): JsonResponse {
  return {
    status: 200,
    body: {
      accessToken: `access-${"x".repeat(40)}`,
      accessExpiresAt: "2026-07-22T08:15:00.000Z",
      refreshToken,
      refreshExpiresAt: "2026-08-21T08:00:00.000Z",
      accountId: "018f0f40-7b1a-7000-8000-000000000001",
    },
  };
}

function makeSave(revision: number, logicalClock: number): ExpeditionSaveDocument {
  const expedition = makeExpedition();
  return sealExpeditionSave({
    saveSchemaVersion: "0.1.0",
    saveId: "018f0f40-7b1a-7000-8000-000000000001",
    revision,
    logicalClock,
    deviceKind: "wechat",
    updatedAt: `2026-07-22T08:00:0${Math.min(9, logicalClock)}.000Z`,
    contentVersion: "0.1.0",
    rulesVersion: "0.5.0",
    expedition,
    nodeStartSnapshot: snapshot("player_planning", 0),
    battleTurnSnapshot: snapshot("player_action", logicalClock),
    summary: {
      regionIndex: 1,
      layer: 0,
      completedNodes: 0,
      squadRobotIds: ["robot_rivet", "robot_anchor", "robot_gale"],
    },
  });
}

function snapshot(phase: string, turn: number) {
  return runtimeSnapshotSchema.parse(
    createSnapshot({
      rulesVersion: "0.5.0",
      contentVersion: "0.1.0",
      replaySchemaVersion: "0.1.0",
      turnIndex: turn,
      commandIndex: turn * 3,
      rngStates: { map: createRngState(42) },
      state: { phase, turn },
    }),
  );
}

function makeExpedition(): ExpeditionStateDocument {
  return {
    plan: {
      schemaVersion: "0.1.0",
      contentVersion: "0.1.0",
      rulesVersion: "0.5.0",
      seed: 42,
      regions: [1, 2, 3, 4].map((regionIndex) => ({
        id: `region_${regionIndex}`,
        regionIndex,
        layers: [
          [node(regionIndex, 0, 0), node(regionIndex, 0, 1)],
          [node(regionIndex, 1, 0), node(regionIndex, 1, 1)],
          [node(regionIndex, 2, 0, "boss")],
        ],
      })),
    },
    status: "active",
    regionIndex: 1,
    layer: 0,
    completedNodeIds: [],
    robots: ["robot_rivet", "robot_anchor", "robot_gale"].map((robotId) => ({
      robotId,
      hp: 100,
      maxHp: 100,
      structuralDamage: 0,
      disabled: false,
    })),
    researchEarned: 0,
    supplies: 0,
    routeRevealDepth: 1,
    inventory: {
      moduleIds: ["main_fold_bridge"],
      upgradeRouteIds: [],
      temporaryModIds: [],
      consumables: 0,
    },
    restartUsedNodeIds: [],
  };
}

function node(regionIndex: number, layer: 0 | 1 | 2, index: number, type = "battle") {
  return {
    id: `region_${regionIndex}_layer_${layer}_node_${index}`,
    regionIndex,
    layer,
    type: type as "battle" | "boss",
    mapId: `map_region_${regionIndex}_${index}`,
    eventId: null,
    bossId: type === "boss" ? `boss_${regionIndex}` : null,
    risk: Math.min(3, regionIndex) as 1 | 2 | 3,
    nextNodeIds: [],
  };
}
