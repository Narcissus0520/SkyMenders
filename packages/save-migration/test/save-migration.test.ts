import { createRngState, createSnapshot } from "@skymenders/deterministic-runtime";
import { runtimeSnapshotSchema } from "@skymenders/protocol";
import type { ExpeditionSaveDocument, ExpeditionStateDocument } from "@skymenders/protocol";
import { describe, expect, it } from "vitest";

import {
  consumeNodeRestart,
  mergeAccountProgress,
  migrateExpeditionSave,
  recoverExpeditionSave,
  resolveExpeditionConflict,
  sealExpeditionSave,
  verifyExpeditionSave,
} from "../src/index.js";

const compatibility = {
  rulesVersion: "0.5.0",
  contentVersion: "0.1.0",
  replaySchemaVersion: "0.1.0",
};

describe("expedition save lifecycle", () => {
  it("seals and verifies the authoritative version dimensions and summary", () => {
    const document = makeSave();
    expect(verifyExpeditionSave(document)).toEqual(document);
    expect(() => verifyExpeditionSave({ ...document, revision: 99 })).toThrow(
      "save integrity mismatch",
    );
    expect(() => sealExpeditionSave({ ...unsigned(document), contentVersion: "9.9.9" })).toThrow(
      "save version dimensions",
    );
    expect(() =>
      sealExpeditionSave({
        ...unsigned(document),
        summary: { ...document.summary, completedNodes: 1 },
      }),
    ).toThrow("save summary");
    expect(() =>
      sealExpeditionSave({
        ...unsigned(document),
        expedition: {
          ...document.expedition,
          restartUsedNodeIds: ["region_1_layer_0_node_0", "region_1_layer_0_node_0"],
        },
      }),
    ).toThrow("restart ledger");
  });

  it("migrates the supported legacy save without inventing progress", () => {
    const current = makeSave();
    const migrated = migrateExpeditionSave({
      saveSchemaVersion: "0.0.1",
      saveId: current.saveId,
      updatedAt: current.updatedAt,
      contentVersion: current.contentVersion,
      rulesVersion: current.rulesVersion,
      expedition: current.expedition,
      summary: current.summary,
    });
    expect(migrated).toMatchObject({
      saveSchemaVersion: "0.1.0",
      revision: 0,
      logicalClock: 0,
      deviceKind: "unknown",
      nodeStartSnapshot: null,
      battleTurnSnapshot: null,
    });
    expect(migrateExpeditionSave(migrated)).toEqual(migrated);
    expect(() => migrateExpeditionSave({ saveSchemaVersion: "99.0.0" })).toThrow(
      "unsupported or invalid",
    );
  });

  it("recovers from the newest valid turn snapshot and falls back to node start", () => {
    const document = makeSave();
    expect(recoverExpeditionSave(document, compatibility)).toMatchObject({
      source: "battle_turn",
      recoveredState: { phase: "player_action", turn: 2 },
      warnings: [],
    });
    const battleTurnSnapshot = document.battleTurnSnapshot;
    if (battleTurnSnapshot === null) {
      throw new Error("test fixture must include a battle turn snapshot");
    }
    const corrupted = sealExpeditionSave({
      ...unsigned(document),
      battleTurnSnapshot: { ...battleTurnSnapshot, stateHash: "0000000000000000" },
    });
    expect(recoverExpeditionSave(corrupted, compatibility)).toMatchObject({
      source: "node_start",
      recoveredState: { phase: "player_planning", turn: 0 },
    });
    expect(recoverExpeditionSave(corrupted, compatibility).warnings[0]).toContain(
      "battle turn snapshot rejected",
    );
    const withoutSnapshots = sealExpeditionSave({
      ...unsigned(document),
      nodeStartSnapshot: null,
      battleTurnSnapshot: null,
    });
    expect(recoverExpeditionSave(withoutSnapshots, compatibility)).toMatchObject({
      source: "expedition",
      recoveredState: null,
    });
    expect(() =>
      recoverExpeditionSave(document, { ...compatibility, rulesVersion: "9.9.9" }),
    ).toThrow("unavailable rules or content");
  });

  it("records the one restart allowance in the sealed save", () => {
    const restarted = consumeNodeRestart(
      makeSave(),
      "region_1_layer_0_node_0",
      "2026-07-22T08:01:00.000Z",
    );
    expect(restarted.expedition.restartUsedNodeIds).toEqual(["region_1_layer_0_node_0"]);
    expect(restarted.revision).toBe(1);
    expect(() =>
      consumeNodeRestart(restarted, "region_1_layer_0_node_0", "2026-07-22T08:02:00.000Z"),
    ).toThrow("already consumed");
    expect(() => consumeNodeRestart(makeSave(), "Bad ID", "2026-07-22T08:02:00.000Z")).toThrow(
      "invalid",
    );
  });

  it("resolves divergent expedition branches explicitly and archives the rejected branch", () => {
    const local = makeSave({ revision: 3, logicalClock: 8, deviceKind: "wechat" });
    const cloud = makeSave({ revision: 4, logicalClock: 7, deviceKind: "web" });
    const resolved = resolveExpeditionConflict(local, cloud, "local", "2026-07-22T08:03:00.000Z");
    expect(resolved.authoritative).toMatchObject({ revision: 5, logicalClock: 9 });
    expect(resolved.authoritative.deviceKind).toBe("wechat");
    expect(resolved.archived.deviceKind).toBe("web");
    expect(verifyExpeditionSave(resolved.authoritative)).toEqual(resolved.authoritative);
    const selectedCloud = resolveExpeditionConflict(
      local,
      cloud,
      "cloud",
      "2026-07-22T08:04:00.000Z",
    );
    expect(selectedCloud.authoritative.deviceKind).toBe("web");
    const other = sealExpeditionSave({
      ...unsigned(cloud),
      saveId: "018f0f40-7b1a-7000-8000-000000000002",
    });
    expect(() =>
      resolveExpeditionConflict(local, other, "local", "2026-07-22T08:05:00.000Z"),
    ).toThrow("different ids");
  });
});

describe("account progress merge", () => {
  it("unions discovery state, keeps max counters, and takes settings from the latest clock", () => {
    const local = progress(3, ["robot_rivet"], { nodes_completed: 5 }, false);
    const cloud = progress(4, ["robot_anchor"], { nodes_completed: 4, bosses_defeated: 1 }, true);
    expect(mergeAccountProgress(local, cloud, "2026-07-22T09:00:00.000Z")).toMatchObject({
      logicalClock: 5,
      unlockIds: ["robot_anchor", "robot_rivet"],
      statistics: { bosses_defeated: 1, nodes_completed: 5 },
      settings: { highContrast: true },
    });
    const latestLocal = mergeAccountProgress(
      progress(8, ["robot_rivet"], {}, false),
      progress(4, ["robot_rivet"], {}, true),
      "2026-07-22T09:01:00.000Z",
    );
    expect(latestLocal.settings.highContrast).toBe(false);
  });
});

function makeSave(
  overrides: Partial<Pick<ExpeditionSaveDocument, "revision" | "logicalClock" | "deviceKind">> = {},
): ExpeditionSaveDocument {
  const expedition = makeExpedition();
  return sealExpeditionSave({
    saveSchemaVersion: "0.1.0",
    saveId: "018f0f40-7b1a-7000-8000-000000000001",
    revision: overrides.revision ?? 0,
    logicalClock: overrides.logicalClock ?? 0,
    deviceKind: overrides.deviceKind ?? "wechat",
    updatedAt: "2026-07-22T08:00:00.000Z",
    contentVersion: compatibility.contentVersion,
    rulesVersion: compatibility.rulesVersion,
    expedition,
    nodeStartSnapshot: runtimeSnapshotSchema.parse(
      createSnapshot({
        ...compatibility,
        turnIndex: 0,
        commandIndex: 0,
        rngStates: { map: createRngState(11) },
        state: { phase: "player_planning", turn: 0 },
      }),
    ),
    battleTurnSnapshot: runtimeSnapshotSchema.parse(
      createSnapshot({
        ...compatibility,
        turnIndex: 2,
        commandIndex: 6,
        rngStates: { map: createRngState(11), ai: createRngState(22) },
        state: { phase: "player_action", turn: 2 },
      }),
    ),
    summary: {
      regionIndex: expedition.regionIndex,
      layer: expedition.layer,
      completedNodes: expedition.completedNodeIds.length,
      squadRobotIds: expedition.robots.map((robot) => robot.robotId),
    },
  });
}

function makeExpedition(): ExpeditionStateDocument {
  return {
    plan: {
      schemaVersion: "0.1.0",
      contentVersion: compatibility.contentVersion,
      rulesVersion: compatibility.rulesVersion,
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
    mapId: type === "boss" ? `map_boss_${regionIndex}` : `map_region_${regionIndex}_${index}`,
    eventId: null,
    bossId: type === "boss" ? `boss_${regionIndex}` : null,
    risk: Math.min(3, regionIndex) as 1 | 2 | 3,
    nextNodeIds: [],
  };
}

function unsigned(document: ExpeditionSaveDocument) {
  const { integrityHash, ...rest } = document;
  void integrityHash;
  return rest;
}

function progress(
  logicalClock: number,
  unlockIds: string[],
  statistics: Record<string, number>,
  highContrast: boolean,
) {
  return {
    saveSchemaVersion: "0.1.0" as const,
    logicalClock,
    updatedAt: "2026-07-22T08:00:00.000Z",
    unlockIds,
    achievementIds: [],
    compendiumEntryIds: [],
    completedTutorialIds: [],
    settings: {
      textScalePermille: 1_000,
      highContrast,
      colorVisionPreset: "standard" as const,
      reduceFlash: false,
      reduceCameraMotion: false,
      cameraShakePermille: 1_000,
      leftHanded: false,
      aimingSensitivityPermille: 1_000,
      cameraSensitivityPermille: 1_000,
      releaseToFire: false,
      masterVolumePermille: 1_000,
      musicVolumePermille: 800,
      ambientVolumePermille: 800,
      combatVolumePermille: 1_000,
      uiVolumePermille: 1_000,
      vibration: true,
    },
    statistics,
  };
}
