import { describe, expect, it } from "vitest";
import * as runModule from "../src/core/run/run";
import { createRun, applyRunAction } from "../src/core/run/run";
import type { ContentBundle, GameEvent, GroupRow, RunState } from "../src/core/types";
import { makeContent } from "../src/data/content";
import { PLAYABLE_TEAM_IDS, TEAMS } from "../src/data/teams";
import { makeGreedyBot } from "../src/sim/strategies";

const content = makeContent();

type GroupResolver = (content: ContentBundle, state: RunState) => GameEvent[];

function groupResolver(): GroupResolver {
  const resolve = (
    runModule as unknown as { resolveGroupStage?: GroupResolver }
  ).resolveGroupStage;
  expect(resolve, "run.ts must export the group-stage advancement resolver").toBeTypeOf(
    "function",
  );
  return resolve!;
}

function playThroughGroup(seed: string, playerTeamId = "usa"): RunState {
  const bot = makeGreedyBot();
  let state = createRun(content, seed, playerTeamId);
  for (let guard = 0; guard < 5000 && state.stage === "GROUP" && state.phase !== "DONE"; guard++) {
    const action =
      state.phase === "MATCH" && state.activeMatch
        ? ({ type: "MATCH_ACTION", action: bot.matchAction(content, state.activeMatch) } as const)
        : bot.runAction(content, state);
    state = applyRunAction(content, state, action).state;
  }
  return state;
}

function rankedState(
  rank: 1 | 2 | 3 | 4,
  seed: string,
  player: { pts: number; gd: number },
): RunState {
  const state = createRun(content, seed, "usa");
  const [a, b, c] = state.groupTeamIds;
  const rowsByRank: Record<1 | 2 | 3 | 4, Array<{ id: string; pts: number; gd: number }>> = {
    1: [
      { id: "usa", pts: player.pts, gd: player.gd },
      { id: a!, pts: 6, gd: 3 },
      { id: b!, pts: 3, gd: 0 },
      { id: c!, pts: 0, gd: -6 },
    ],
    2: [
      { id: a!, pts: 9, gd: 6 },
      { id: "usa", pts: player.pts, gd: player.gd },
      { id: b!, pts: 3, gd: 0 },
      { id: c!, pts: 0, gd: -6 },
    ],
    3: [
      { id: a!, pts: 9, gd: 6 },
      { id: b!, pts: 7, gd: 3 },
      { id: "usa", pts: player.pts, gd: player.gd },
      { id: c!, pts: 0, gd: player.gd - 10 },
    ],
    4: [
      { id: a!, pts: 9, gd: 6 },
      { id: b!, pts: 6, gd: 3 },
      { id: c!, pts: 0, gd: player.gd + 10 },
      { id: "usa", pts: player.pts, gd: player.gd },
    ],
  };
  state.groupTable = rowsByRank[rank].map(
    ({ id, pts, gd }): GroupRow => ({
      teamId: id,
      pts,
      w: 0,
      d: 0,
      l: 0,
      gf: Math.max(0, gd),
      ga: Math.max(0, -gd),
    }),
  );
  return state;
}

describe("real group data", () => {
  it("contains the eight added teams with their verified group letters", () => {
    const expected = {
      cze: "A",
      bih: "B",
      sui: "B",
      hai: "C",
      sco: "C",
      par: "D",
      aus: "D",
      tur: "D",
    } as const;

    expect(TEAMS).toHaveLength(26);
    for (const [id, group] of Object.entries(expected)) {
      expect(TEAMS.find((team) => team.id === id)?.group).toBe(group);
    }
  });

  it("gives every playable nation a complete four-team real group", () => {
    for (const playerId of PLAYABLE_TEAM_IDS) {
      const player = TEAMS.find((team) => team.id === playerId)!;
      expect(TEAMS.filter((team) => team.group === player.group).map((team) => team.id)).toHaveLength(4);
    }
  });
});

describe("four-team group schedule", () => {
  it("createRun selects the player's three real groupmates", () => {
    for (const playerId of PLAYABLE_TEAM_IDS) {
      const state = createRun(content, `real-group-${playerId}`, playerId);
      const player = content.teams.find((team) => team.id === playerId)!;
      const expected = content.teams
        .filter((team) => team.group === player.group && team.id !== playerId)
        .map((team) => team.id)
        .sort();

      expect([...state.groupTeamIds].sort()).toEqual(expected);
      expect(state.groupOpponentOrder).toHaveLength(3);
    }
  });

  it("plays every pair exactly once over three matchdays", () => {
    const state = playThroughGroup("round-robin-complete");
    const pairs = state.groupFixtures.map((fixture) =>
      [fixture.homeId, fixture.awayId].sort().join("-"),
    );

    expect(state.groupFixtures).toHaveLength(6);
    expect(new Set(pairs).size).toBe(6);
    expect(state.groupFixtures.filter((fixture) => fixture.homeId === "usa")).toHaveLength(3);
    for (const matchday of [1, 2, 3]) {
      expect(state.groupFixtures.filter((fixture) => fixture.matchday === matchday)).toHaveLength(2);
    }
  });
});

describe("group advancement", () => {
  it.each([1, 2] as const)("advances local rank %i directly to the R32", (rank) => {
    const state = rankedState(rank, `rank-${rank}`, { pts: rank === 1 ? 9 : 6, gd: 5 });

    const events = groupResolver()(content, state);

    expect(state.stage).toBe("R32");
    expect(state.result).toBe("active");
    expect(state.thirdsVerdict).toBeNull();
    expect(events).toEqual([]);
  });

  it("resolves a fixed-seed third-place team through and emits the verdict", () => {
    const state = rankedState(3, "third-through", { pts: 6, gd: 10 });

    const events = groupResolver()(content, state);

    expect(state.stage).toBe("R32");
    expect(state.thirdsVerdict).toEqual({ points: 6, gd: 10, rank: 1, through: true });
    expect(events).toEqual([{ type: "THIRDS_VERDICT", points: 6, gd: 10, rank: 1, through: true }]);
  });

  it("resolves a fixed-seed third-place team out", () => {
    const state = rankedState(3, "third-out", { pts: 0, gd: -10 });

    const events = groupResolver()(content, state);

    expect(state.stage).toBe("GROUP");
    expect(state.result).toBe("eliminated");
    expect(state.phase).toBe("DONE");
    expect(state.thirdsVerdict).toEqual({ points: 0, gd: -10, rank: 12, through: false });
    expect(events).toEqual([{ type: "THIRDS_VERDICT", points: 0, gd: -10, rank: 12, through: false }]);
  });

  it("produces the same third-place verdict for the same seed", () => {
    const a = rankedState(3, "third-deterministic", { pts: 4, gd: 0 });
    const b = rankedState(3, "third-deterministic", { pts: 4, gd: 0 });

    const eventsA = groupResolver()(content, a);
    const eventsB = groupResolver()(content, b);

    expect(a.thirdsVerdict).toEqual(b.thirdsVerdict);
    expect(eventsA).toEqual(eventsB);
  });

  it("eliminates local rank 4 without a best-thirds verdict", () => {
    const state = rankedState(4, "rank-four", { pts: 0, gd: -10 });

    const events = groupResolver()(content, state);

    expect(state.stage).toBe("GROUP");
    expect(state.result).toBe("eliminated");
    expect(state.phase).toBe("DONE");
    expect(state.thirdsVerdict).toBeNull();
    expect(events).toEqual([]);
  });
});
