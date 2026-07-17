import { describe, expect, it } from "vitest";
import type { GameEvent } from "../src/core/types";
import { stageEvents } from "../src/ui/eventTimeline";

describe("stageEvents", () => {
  it("assigns monotonic delays while only popup events advance the clock", () => {
    const events: GameEvent[] = [
      { type: "DICE_ROLLED", dice: [4] },
      { type: "PASS_CHALLENGED", roll: 12, pressure: 5, survived: true },
      { type: "BALL_MOVED", ball: 14, toward: "theirs" },
      { type: "DIE_ASSIGNED", uid: "pass", die: 4 },
      { type: "CHAIN_INTERCEPTED", byYou: false, passes: 2, chanceLost: 3 },
      { type: "BALL_MOVED", ball: 2, toward: "yours" },
    ];

    const staged = stageEvents(events);
    const delays = staged.map(({ delay }) => delay);

    expect(delays).toEqual([0, 0, 520, 520, 520, 1120]);
    expect(delays.every((delay, index) => index === 0 || delay >= delays[index - 1]!)).toBe(true);
    expect(staged.map(({ event }) => event)).toEqual(events);
  });

  it("stages an opponent ball move before the shot without consuming another beat", () => {
    const events: GameEvent[] = [
      { type: "OPP_PASS_CHALLENGED", roll: 14, pressure: 4, survived: true },
      { type: "BALL_MOVED", ball: 6, toward: "yours" },
      { type: "OPP_PASS", passes: 2, oppChance: 6, risk: 0.18 },
      { type: "OPP_SHOT", roll: 17, danger: 6, dc: 15, goal: true },
    ];

    const staged = stageEvents(events);
    const ballIndex = staged.findIndex(({ event }) => event.type === "BALL_MOVED");
    const shotIndex = staged.findIndex(({ event }) => event.type === "OPP_SHOT");

    expect(ballIndex).toBeLessThan(shotIndex);
    expect(staged[ballIndex]!.delay).toBe(520);
    expect(staged[shotIndex]!.delay).toBe(staged[ballIndex]!.delay);
  });
});
