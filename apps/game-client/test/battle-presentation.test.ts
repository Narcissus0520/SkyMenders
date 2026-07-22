import { describe, expect, it } from "vitest";
import { createAiAuthorityState, createEnemyActor } from "@skymenders/ai-core";
import { createBattleState } from "@skymenders/battle-core";
import type { BattleActor, BattleState } from "@skymenders/battle-core";
import { createTerrainState } from "@skymenders/terrain-core";

import { RobotAnimator } from "../assets/scripts/battle/animation/RobotAnimator.js";
import { BattleSession } from "../assets/scripts/battle/BattleSession.js";
import { CameraDirector } from "../assets/scripts/battle/camera/CameraDirector.js";
import { EffectBudget } from "../assets/scripts/battle/effects/EffectBudget.js";
import { AimingController } from "../assets/scripts/battle/input/AimingController.js";
import { isPinchGesture, routeGesture } from "../assets/scripts/battle/input/GestureRouter.js";
import { BattlePresentationStore } from "../assets/scripts/battle/presentation/BattlePresentationStore.js";
import { buildBattleHud } from "../assets/scripts/battle/ui/BattleHudModel.js";
import { PerformanceMonitor } from "../assets/scripts/diagnostics/PerformanceMonitor.js";
import { DEFAULT_CLIENT_SETTINGS } from "../assets/scripts/settings/settings.js";

describe("aim and gesture input", () => {
  it("quantizes screen gestures into one validated, confirmation-gated command", () => {
    const aim = new AimingController({
      commandId: "cmd:aim",
      battleId: "battle:client",
      turnIndex: 0,
      actorId: "player:1",
      moduleId: "main_drill_bee",
      originX: 2,
      originY: 1,
    });
    expect(() => aim.confirm()).toThrow(/released/);
    const dragged = aim.drag(30.2, 40.7);
    expect(Number.isInteger(dragged.angleMilliDegrees)).toBe(true);
    expect(Number.isInteger(dragged.powerPermille)).toBe(true);
    expect(dragged.status).toBe("aiming");
    aim.microAdjust(-400_000, 999);
    aim.setPowerSlider(750);
    aim.setTarget(8.3, 1.2, "enemy:1");
    aim.release();
    const command = aim.confirm();
    expect(command).toMatchObject({
      kind: "use_module",
      powerPermille: 750,
      targetX: 8,
      targetY: 1,
      targetId: "enemy:1",
    });
    expect(Number.isInteger(command.angleMilliDegrees)).toBe(true);
    expect(aim.predictionFractionPermille(false)).toBe(500);
    expect(aim.predictionFractionPermille(true)).toBe(1_000);
    aim.cancelConfirmation();
    expect(aim.state().status).toBe("aiming");
  });

  it("prioritizes aim, then UI, then camera and reserves clear pinch routing", () => {
    expect(routeGesture({ onAimHandle: true, onUi: true, touchCount: 1 })).toBe("aim");
    expect(routeGesture({ onAimHandle: false, onUi: true, touchCount: 1 })).toBe("ui");
    expect(routeGesture({ onAimHandle: false, onUi: false, touchCount: 1 })).toBe("camera");
    expect(isPinchGesture({ onAimHandle: false, onUi: false, touchCount: 2 })).toBe(true);
    expect(isPinchGesture({ onAimHandle: true, onUi: false, touchCount: 2 })).toBe(false);
  });
});

describe("camera, effects, and procedural animation", () => {
  it("clamps manual camera and protects inspection from normal automatic focus", () => {
    const camera = new CameraDirector(
      {
        minimumX: 0,
        maximumX: 100,
        minimumY: 0,
        maximumY: 50,
        minimumZoomPermille: 500,
        maximumZoomPermille: 2_000,
      },
      { x: 50, y: 25, zoomPermille: 1_000 },
    );
    expect(camera.manualPan(1_000, -1_000, 100)).toMatchObject({ x: 100, y: 0 });
    expect(camera.pinch(8, 200).zoomPermille).toBe(2_000);
    expect(() => camera.pinch(0, 300)).toThrow(RangeError);
    expect(
      camera.request(
        {
          id: "actor",
          mode: "follow_actor",
          pose: { x: 1, y: 1, zoomPermille: 900 },
          priority: 10,
          requestedAtMs: 201,
        },
        300,
      ),
    ).toBe(false);
    expect(
      camera.request(
        {
          id: "boss",
          mode: "boss_mechanic_focus",
          pose: { x: 20, y: 10, zoomPermille: 800 },
          priority: 100,
          requestedAtMs: 202,
        },
        300,
      ),
    ).toBe(true);
    camera.release("boss");
    expect(camera.shakeAmplitude(30, false)).toBe(12);
    expect(camera.shakeAmplitude(5, true)).toBe(0);
  });

  it("honors motion, flash, shake, particle, and debris budgets", () => {
    const allocation = new EffectBudget().allocate(
      { particles: 999, debris: 99, flashPermille: 900, shake: 99 },
      { ...DEFAULT_CLIENT_SETTINGS, reducedMotion: true, reducedFlash: true, reducedShake: true },
    );
    expect(allocation).toEqual({ particles: 60, debris: 4, flashPermille: 150, shake: 0 });
  });

  it("produces bounded procedural states with reduced-motion variants", () => {
    const animator = new RobotAnimator();
    expect(animator.update(500, false).elapsedMs).toBe(100);
    animator.setState("hit");
    expect(animator.update(16, false).tiltDegrees).toBe(-8);
    animator.setState("disabled");
    expect(animator.update(16, true).opacityPermille).toBe(550);
    animator.setState("knockback");
    expect(animator.update(16, true).tiltDegrees).toBeCloseTo(2.4);
  });
});

describe("read-only presentation and authority gateway", () => {
  it("parses authoritative events into a bounded presentation queue", () => {
    const store = new BattlePresentationStore(2);
    store.consume({
      kind: "actor_moved",
      battleId: "b",
      sequence: 0,
      turnIndex: 0,
      commandId: "c",
      actorId: "a",
      fromX: 0,
      fromY: 0,
      toX: 2,
      toY: 1,
    });
    store.consume({
      kind: "turn_waited",
      battleId: "b",
      sequence: 1,
      turnIndex: 0,
      commandId: "d",
      actorId: "a",
    });
    store.consume({
      kind: "battle_phase_changed",
      battleId: "b",
      sequence: 2,
      turnIndex: 0,
      commandId: "e",
      fromPhase: "player_action",
      toPhase: "enemy_action",
    });
    expect(store.snapshot()).toHaveLength(2);
    expect(store.drain()).toHaveLength(2);
    expect(store.snapshot()).toHaveLength(0);
    expect(() => new BattlePresentationStore(0)).toThrow(RangeError);
  });

  it("exposes HUD redundancy and accepts only validated player commands", () => {
    const { battle, ai } = fixture("player_action");
    const session = new BattleSession(battle, ai);
    let events = 0;
    session.subscribe((batch) => (events += batch.length));
    session.dispatchPlayer({
      kind: "wait",
      commandId: "cmd:wait",
      battleId: battle.battleId,
      turnIndex: battle.turnIndex,
      actorId: "player:1",
    });
    expect(session.commands()).toHaveLength(1);
    expect(events).toBeGreaterThan(0);
    expect(session.presentation.snapshot().some((cue) => cue.kind === "status")).toBe(true);
    expect(() =>
      session.dispatchPlayer({
        kind: "advance_phase",
        commandId: "bad",
        battleId: battle.battleId,
        turnIndex: 0,
        actorId: "system",
        expectedPhase: "player_action",
      }),
    ).toThrow(/rejects system/);
    const hud = buildBattleHud(session.battleState(), DEFAULT_CLIENT_SETTINGS);
    expect(hud.actors.find((actor) => actor.team === "player")?.semantic).toMatchObject({
      iconKey: "icon.faction.player",
      pattern: "diagonal",
    });
    expect(hud.energy.maximum).toBe(12);
  });

  it("runs enemy decisions through the same battle reducer", () => {
    const { battle, ai } = fixture("enemy_action");
    const session = new BattleSession(battle, ai);
    expect(session.executeEnemyPhase().length).toBeGreaterThan(0);
    expect(session.commands().every((command) => command.actorId === "enemy:1")).toBe(true);
  });
});

describe("performance telemetry", () => {
  it("reports empty, healthy, and long-task frame samples", () => {
    const monitor = new PerformanceMonitor(30, 3);
    expect(monitor.snapshot().withinBudget).toBe(false);
    for (const value of [30, 31, 32, -1, Number.NaN]) monitor.recordFrame(value);
    expect(monitor.snapshot()).toMatchObject({
      sampleCount: 3,
      withinBudget: true,
      longTaskCount: 0,
    });
    monitor.recordFrame(120);
    expect(monitor.snapshot()).toMatchObject({
      sampleCount: 3,
      withinBudget: false,
      longTaskCount: 1,
    });
  });
});

function fixture(phase: "player_action" | "enemy_action") {
  const terrain = createTerrainState({
    width: 24,
    height: 6,
    fills: [{ x: 0, y: 0, width: 24, height: 1, materialId: "terrain_alloy_frame" }],
    supportRoots: [{ id: "anchor", kind: "fixed_anchor", x: 0, y: 0, capacity: 10_000 }],
  });
  const player: BattleActor = {
    id: "player:1",
    team: "player",
    x: 2,
    y: 1,
    hp: 100,
    maxHp: 100,
    structuralDamage: 0,
    faults: [],
    disabled: false,
    recoveryBeaconId: null,
    carriedObjectId: null,
    movementUsed: false,
    mainModuleUsed: false,
    actionEnded: false,
    auxiliaryUses: 0,
    mainModuleId: "main_drill_bee",
    auxiliaryModuleIds: ["aux_repair_spray", "aux_jammer"],
    selectedRoutes: [],
    cooldowns: [],
  };
  const players: BattleActor[] = [
    player,
    { ...player, id: "player:2", x: 3, mainModuleId: "main_fold_bridge" },
    { ...player, id: "player:3", x: 4, mainModuleId: "main_support_frame" },
  ];
  const enemy = createEnemyActor("enemy:1", "enemy_scout", 8, 1);
  let battle: BattleState = createBattleState({
    battleId: "battle:client",
    terrain,
    actors: [...players, enemy],
    objectives: [
      {
        id: "objective:1",
        role: "primary",
        trigger: "defeat_guard",
        progress: 0,
        required: 1,
        status: "active",
        criticalInteraction: false,
        requiredModuleId: null,
        targetId: "enemy:1",
      },
    ],
  });
  battle = { ...battle, phase };
  const ai = createAiAuthorityState({
    rootSeed: 42,
    difficulty: "normal",
    controllers: [
      { actorId: "enemy:1", prototypeId: "enemy_scout", eliteTemplateId: null, bossId: null },
    ],
  });
  return { battle, ai };
}
