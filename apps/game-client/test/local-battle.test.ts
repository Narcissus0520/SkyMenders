import { describe, expect, it } from "vitest";

import { LocalBattleController } from "../assets/scripts/battle/local/LocalBattleController";

describe("local expedition battle", () => {
  it("starts in player action with three robots and two deterministic enemies", () => {
    const snapshot = new LocalBattleController().snapshot();
    expect(snapshot.battle.phase).toBe("player_action");
    expect(snapshot.battle.actors.filter((actor) => actor.team === "player")).toHaveLength(3);
    expect(snapshot.battle.actors.filter((actor) => actor.team === "enemy")).toHaveLength(2);
    expect(snapshot.activeActor?.team).toBe("player");
    expect(snapshot.battle.objectives[0]).toMatchObject({
      trigger: "hold_round",
      required: 3,
      progress: 0,
    });
  });

  it("uses the authoritative module reducer and advances through AI/environment rounds", () => {
    const controller = new LocalBattleController();
    const before = controller.snapshot();
    const afterFire = controller.fire();
    expect(afterFire.battle.energy.current).toBeLessThan(before.battle.energy.current);
    expect(afterFire.battle.terrain.revision).toBeGreaterThan(before.battle.terrain.revision);
    expect(afterFire.activeActor?.id).not.toBe(before.activeActor?.id);

    const roundTwo = controller.endRound();
    expect(roundTwo.battle.turnIndex).toBe(1);
    expect(roundTwo.battle.phase).toBe("player_action");
    expect(roundTwo.battle.objectives[0]?.progress).toBe(1);
  });

  it("wins after holding the energy core for three environment settlements", () => {
    const controller = new LocalBattleController();
    controller.endRound();
    controller.endRound();
    const victory = controller.endRound();
    expect(victory.battle.outcome.status).toBe("victory");
    expect(victory.messageKey).toBe("battle.local.victory");
  });
});
