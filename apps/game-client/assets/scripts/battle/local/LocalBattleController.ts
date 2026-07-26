import { createAiAuthorityState, createEnemyActor } from "@skymenders/ai-core";
import { createBattleState } from "@skymenders/battle-core";
import type { BattleActor, BattleState } from "@skymenders/battle-core";
import { createTerrainState } from "@skymenders/terrain-core";
import { BattleSession } from "../BattleSession";

export interface LocalBattleTarget {
  readonly x: number;
  readonly y: number;
}

export interface LocalBattleSnapshot {
  readonly battle: BattleState;
  readonly activeActor: BattleActor | null;
  readonly target: LocalBattleTarget | null;
  readonly angleDegrees: number;
  readonly powerPermille: number;
  readonly messageKey: string;
  readonly messageVariables: Readonly<Record<string, string | number>>;
}

export class LocalBattleController {
  private angleDegreesValue = -20;
  private powerPermilleValue = 700;
  private messageKeyValue = "battle.local.ready";
  private messageVariablesValue: Readonly<Record<string, string | number>> = {};
  private commandSerial = 0;

  constructor(private readonly session = createLocalBattleSession()) {}

  snapshot(): LocalBattleSnapshot {
    const battle = this.session.battleState();
    const activeActor =
      battle.actors.find(
        (actor) => actor.team === "player" && !actor.disabled && !actor.actionEnded,
      ) ?? null;
    return {
      battle,
      activeActor,
      target: activeActor === null ? null : this.targetFor(activeActor, battle),
      angleDegrees: this.angleDegreesValue,
      powerPermille: this.powerPermilleValue,
      messageKey: this.messageKeyValue,
      messageVariables: this.messageVariablesValue,
    };
  }

  adjustAngle(deltaDegrees: number): LocalBattleSnapshot {
    this.angleDegreesValue = clamp(this.angleDegreesValue + Math.round(deltaDegrees), -55, 35);
    this.setMessage("battle.local.aim_changed");
    return this.snapshot();
  }

  adjustPower(deltaPermille: number): LocalBattleSnapshot {
    this.powerPermilleValue = clamp(
      this.powerPermilleValue + Math.round(deltaPermille),
      300,
      1_000,
    );
    this.setMessage("battle.local.aim_changed");
    return this.snapshot();
  }

  fire(): LocalBattleSnapshot {
    const snapshot = this.snapshot();
    const actor = snapshot.activeActor;
    const target = snapshot.target;
    if (snapshot.battle.outcome.status !== "ongoing") return snapshot;
    if (actor === null || target === null) {
      this.setMessage("battle.local.all_acted");
      return this.snapshot();
    }
    try {
      this.session.dispatchPlayer({
        kind: "use_module",
        commandId: this.nextCommandId("fire"),
        battleId: snapshot.battle.battleId,
        turnIndex: snapshot.battle.turnIndex,
        actorId: actor.id,
        moduleId: actor.mainModuleId,
        originX: actor.x,
        originY: actor.y,
        angleMilliDegrees: normalizeAngle(this.angleDegreesValue * 1_000),
        powerPermille: this.powerPermilleValue,
        targetX: target.x,
        targetY: target.y,
      });
      this.setMessage("battle.local.fired", {
        actor: actorNameKey(actor.id),
        x: target.x,
        y: target.y,
      });
    } catch (error) {
      this.setMessage("battle.local.command_failed", {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
    return this.snapshot();
  }

  endRound(): LocalBattleSnapshot {
    const before = this.session.battleState();
    if (before.outcome.status !== "ongoing") return this.snapshot();
    try {
      for (const actor of before.actors) {
        const latest = this.session
          .battleState()
          .actors.find((candidate) => candidate.id === actor.id);
        if (latest?.team === "player" && !latest.disabled && !latest.actionEnded) {
          this.session.dispatchPlayer({
            kind: "wait",
            commandId: this.nextCommandId("wait"),
            battleId: before.battleId,
            turnIndex: before.turnIndex,
            actorId: latest.id,
          });
        }
      }
      this.session.advancePhase();
      this.session.executeEnemyPhase();
      this.session.advancePhase();
      this.session.advancePhase();
      const settled = this.session.battleState();
      if (settled.outcome.status === "victory") {
        this.setMessage("battle.local.victory");
      } else if (settled.outcome.status === "defeat") {
        this.setMessage("battle.local.defeat");
      } else {
        this.session.advancePhase();
        this.setMessage("battle.local.round_started", { round: settled.turnIndex + 1 });
      }
    } catch (error) {
      this.setMessage("battle.local.command_failed", {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
    return this.snapshot();
  }

  private targetFor(actor: BattleActor, battle: BattleState): LocalBattleTarget {
    const distance = 2 + Math.floor((this.powerPermilleValue * 3) / 1_000);
    const radians = (this.angleDegreesValue * Math.PI) / 180;
    let deltaX = Math.round(Math.cos(radians) * distance);
    let deltaY = Math.round(Math.sin(radians) * distance);
    while (Math.abs(deltaX) + Math.abs(deltaY) > 5) {
      if (Math.abs(deltaX) >= Math.abs(deltaY)) deltaX -= Math.sign(deltaX);
      else deltaY -= Math.sign(deltaY);
    }
    return {
      x: clamp(actor.x + deltaX, 0, battle.terrain.width - 1),
      y: clamp(actor.y + deltaY, 0, battle.terrain.height - 1),
    };
  }

  private nextCommandId(kind: string): string {
    this.commandSerial += 1;
    return `local:${kind}:${this.session.battleState().turnIndex}:${this.commandSerial}`;
  }

  private setMessage(key: string, variables: Readonly<Record<string, string | number>> = {}): void {
    this.messageKeyValue = key;
    this.messageVariablesValue = variables;
  }
}

export function createLocalBattleSession(): BattleSession {
  const terrain = createTerrainState({
    width: 40,
    height: 14,
    fills: [
      { x: 1, y: 2, width: 16, height: 3, materialId: "terrain_cloud_soil" },
      { x: 4, y: 0, width: 10, height: 2, materialId: "terrain_alloy_frame" },
      { x: 17, y: 2, width: 2, height: 2, materialId: "terrain_elastic_moss" },
      { x: 19, y: 2, width: 2, height: 3, materialId: "terrain_energy_crystal" },
      { x: 21, y: 2, width: 2, height: 2, materialId: "terrain_elastic_moss" },
      { x: 23, y: 2, width: 16, height: 3, materialId: "terrain_cloud_soil" },
      { x: 26, y: 0, width: 10, height: 2, materialId: "terrain_alloy_frame" },
    ],
    supportRoots: [
      { id: "anchor:left", kind: "fixed_anchor", x: 4, y: 0, capacity: 100_000 },
      { id: "anchor:right", kind: "fixed_anchor", x: 26, y: 0, capacity: 100_000 },
    ],
  });
  const players: BattleActor[] = [
    playerActor("robot:rivet", 5),
    playerActor("robot:gale", 10),
    playerActor("robot:prism", 14),
  ];
  const enemies = [
    createEnemyActor("enemy:scout", "enemy_scout", 28, 5),
    createEnemyActor("enemy:guard", "enemy_guard", 34, 5),
  ];
  const battle = createBattleState({
    battleId: "battle:local-expedition",
    terrain,
    actors: [...players, ...enemies],
    objectives: [
      {
        id: "objective:hold",
        role: "primary",
        trigger: "hold_round",
        progress: 0,
        required: 3,
        status: "active",
        criticalInteraction: false,
        requiredModuleId: null,
        targetId: null,
      },
    ],
    worldObjects: [
      { id: "object:energy-core", kind: "task_object", x: 20, y: 5, mass: 80, active: true },
    ],
  });
  const ai = createAiAuthorityState({
    rootSeed: 0x51a7_2026,
    difficulty: "normal",
    controllers: [
      {
        actorId: "enemy:scout",
        prototypeId: "enemy_scout",
        eliteTemplateId: null,
        bossId: null,
      },
      {
        actorId: "enemy:guard",
        prototypeId: "enemy_guard",
        eliteTemplateId: null,
        bossId: null,
      },
    ],
  });
  const session = new BattleSession(battle, ai);
  session.advancePhase();
  return session;
}

function playerActor(id: string, x: number): BattleActor {
  return {
    id,
    team: "player",
    x,
    y: 5,
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
    auxiliaryModuleIds: ["aux_repair_spray", "aux_stabilizer"],
    selectedRoutes: [],
    cooldowns: [],
  };
}

function actorNameKey(actorId: string): string {
  return `battle.actor.${actorId.replace(":", ".")}`;
}

function normalizeAngle(value: number): number {
  return ((value % 360_000) + 360_000) % 360_000;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
