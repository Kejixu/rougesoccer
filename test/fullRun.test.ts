import { describe, expect, it } from "vitest";
import { createRun, applyRunAction } from "../src/core/run/run";
import type { RunState } from "../src/core/types";
import { makeContent } from "../src/data/content";
import { makeGreedyBot } from "../src/sim/strategies";
import { simulateRun } from "../src/sim/runSim";

const content = makeContent();

function playRun(seed: string): RunState {
  const bot = makeGreedyBot();
  let state = createRun(content, seed, "usa");
  for (let guard = 0; guard < 5000 && state.phase !== "DONE"; guard++) {
    const action =
      state.phase === "MATCH" && state.activeMatch
        ? ({ type: "MATCH_ACTION", action: bot.matchAction(content, state.activeMatch) } as const)
        : bot.runAction(content, state);
    state = applyRunAction(content, state, action).state;
  }
  return state;
}

describe("full campaign", () => {
  it("a greedy bot completes a whole World Cup run", () => {
    const state = playRun("fullrun-1");
    expect(state.phase).toBe("DONE");
    expect(["won", "eliminated"]).toContain(state.result);
    expect(state.deck.length).toBeGreaterThanOrEqual(14);
    expect(state.resources.budget).toBeGreaterThanOrEqual(0);
    expect(state.resources.scout).toBeGreaterThanOrEqual(0);
    // every opponent faced exactly once
    expect(new Set(state.usedTeamIds).size).toBe(state.usedTeamIds.length);
  });

  it("runs are deterministic per seed", () => {
    const a = playRun("fullrun-2");
    const b = playRun("fullrun-2");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("group elimination ends the run after 3 matches", () => {
    const state = playRun("group-exit-17");
    expect(state.result).toBe("eliminated");
    expect(state.stage).toBe("GROUP");
    expect(state.matchIndexInStage).toBe(3);
    expect(state.groupFixtures).toHaveLength(6);
  });

  it("simulateRun records one entry per match played", () => {
    const record = simulateRun(content, makeGreedyBot(), "rec-1", "usa");
    expect(record.matches.length).toBeGreaterThanOrEqual(3); // full group round robin
    expect(record.matches.length).toBeLessThanOrEqual(8); // 3 group + 5 knockout
    if (record.result === "won") {
      expect(record.matches.filter((m) => m.stage === "FINAL")).toHaveLength(1);
    }
  });
});
