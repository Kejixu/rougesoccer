import { describe, expect, it } from "vitest";
import { applyMatchAction, createMatch, type MatchConfig } from "../src/core/match/engine";
import { seedRng } from "../src/core/rng";
import { DEFAULT_BALANCE } from "../src/core/balance";
import {
  levelStats,
  type CardDefMap,
  type CardInstance,
  type GameEvent,
  type MatchAction,
  type MatchState,
  type OppInfo,
} from "../src/core/types";
import { CARD_DEF_MAP, makeStartingDeck } from "../src/data/cards";

const MINNOW: OppInfo = {
  teamId: "min",
  name: "Minnowland",
  attackRating: 10,
  style: "balanced",
  tier: 4,
};

function config(overrides: Partial<MatchConfig> = {}): MatchConfig {
  return {
    opp: MINNOW,
    styleEffects: [],
    context: "group",
    deck: makeStartingDeck(),
    rng: seedRng("test-1"),
    balance: DEFAULT_BALANCE,
    ...overrides,
  };
}

function allCards(s: MatchState): CardInstance[] {
  return [...s.hand, ...s.drawPile, ...s.discardPile, ...s.exile, ...s.deployed];
}

/** Tiny deterministic greedy policy used to drive full matches in tests. */
function pickAction(defs: CardDefMap, s: MatchState, pushLuck = false): MatchAction {
  if (s.phase === "PUSH_DECISION") {
    return pushLuck && s.extraRoundsPlayed < s.bal.MAX_EXTRA_ROUNDS
      ? { type: "EXTRA_TIME" }
      : { type: "TAKE_WIN" };
  }
  const power = (c: CardInstance) =>
    (levelStats(defs[c.defId]!, c.level).power ?? 0) + c.formPower;
  const defense = (c: CardInstance) => levelStats(defs[c.defId]!, c.level).defense ?? 0;

  if (s.playsLeft > 0) {
    const attackers = s.hand
      .filter((c) => power(c) > 0)
      .sort((a, b) => power(b) - power(a))
      .slice(0, s.bal.MAX_ATTACK_CARDS);
    if (attackers.length > 0) {
      return { type: "ATTACK", cardUids: attackers.map((c) => c.uid) };
    }
    const slots = Math.max(0, s.bal.MAX_DEPLOYED - s.deployed.length);
    const defenders = s.hand
      .filter((c) => defense(c) > 0)
      .sort((a, b) => defense(b) - defense(a))
      .slice(0, Math.min(s.bal.MAX_DEFEND_CARDS, slots));
    if (defenders.length > 0) {
      return { type: "DEFEND", cardUids: defenders.map((c) => c.uid) };
    }
  }
  return { type: "END_ROUND" };
}

function playMatch(
  defs: CardDefMap,
  cfg: MatchConfig,
  pushLuck = false,
): { state: MatchState; events: GameEvent[] } {
  let { state, events } = createMatch(defs, cfg);
  const log = [...events];
  for (let guard = 0; guard < 300 && state.phase !== "DONE"; guard++) {
    const step = applyMatchAction(defs, state, pickAction(defs, state, pushLuck));
    state = step.state;
    log.push(...step.events);
  }
  return { state, events: log };
}

describe("full match", () => {
  it("a greedy policy completes a match against a minnow", () => {
    const { state, events } = playMatch(CARD_DEF_MAP, config());
    expect(state.phase).toBe("DONE");
    expect(state.result).not.toBe("pending");
    expect(events.some((e) => e.type === "MATCH_END")).toBe(true);
    // card conservation: all 16 starting cards accounted for
    expect(allCards(state)).toHaveLength(16);
    // result is consistent with the scoreline
    if (state.playerGoals > state.oppGoals) expect(state.result).toBe("win");
    if (state.playerGoals < state.oppGoals) expect(state.result).toBe("loss");
  });

  it("is deterministic: same seed + same policy = identical final state", () => {
    const a = playMatch(CARD_DEF_MAP, config());
    const b = playMatch(CARD_DEF_MAP, config());
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.events).toEqual(b.events);
  });

  it("final scoreline snapshot (balance regression guard)", () => {
    const { state } = playMatch(CARD_DEF_MAP, config());
    expect({
      result: state.result,
      playerGoals: state.playerGoals,
      oppGoals: state.oppGoals,
    }).toMatchSnapshot();
  });
});

describe("push-your-luck", () => {
  const superDeck = (): CardInstance[] =>
    Array.from({ length: 8 }, (_, i) => ({
      uid: `super-${i}`,
      defId: "st_clinical",
      level: 2 as const,
      formPower: 20,
      fatigued: false,
    }));

  it("leading at round 5 offers the push decision; extra time pays out and fatigues", () => {
    let { state } = createMatch(
      CARD_DEF_MAP,
      config({ deck: superDeck(), opp: { ...MINNOW, attackRating: 5 } }),
    );
    // power through regulation
    for (let guard = 0; guard < 100 && state.phase === "ROUND_ACTIVE"; guard++) {
      state = applyMatchAction(CARD_DEF_MAP, state, pickAction(CARD_DEF_MAP, state)).state;
    }
    expect(state.phase).toBe("PUSH_DECISION");
    expect(state.playerGoals).toBeGreaterThan(state.oppGoals);

    // opt into extra time, play it out leading
    state = applyMatchAction(CARD_DEF_MAP, state, { type: "EXTRA_TIME" }).state;
    expect(state.mode).toBe("extratime");
    for (let guard = 0; guard < 50 && state.phase === "ROUND_ACTIVE"; guard++) {
      state = applyMatchAction(CARD_DEF_MAP, state, pickAction(CARD_DEF_MAP, state)).state;
    }
    // survived one ET round in the lead: rewards earned, push offered again,
    // and the first push is "free" — no fatigue yet
    expect(state.earned.budget).toBe(DEFAULT_BALANCE.ET_BUDGET_REWARD);
    expect(state.earned.scout).toBe(DEFAULT_BALANCE.ET_SCOUT_REWARD);
    expect(state.phase).toBe("PUSH_DECISION");
    expect(allCards(state).some((c) => c.fatigued)).toBe(false);

    // push again: the second extra-time round is the one that tires the squad
    state = applyMatchAction(CARD_DEF_MAP, state, { type: "EXTRA_TIME" }).state;
    let attacked = false;
    for (let guard = 0; guard < 50 && state.phase === "ROUND_ACTIVE"; guard++) {
      const action = pickAction(CARD_DEF_MAP, state);
      if (action.type === "ATTACK" || action.type === "DEFEND") attacked = true;
      state = applyMatchAction(CARD_DEF_MAP, state, action).state;
    }
    expect(state.phase).toBe("DONE");
    expect(state.result).toBe("win");
    if (attacked) expect(allCards(state).some((c) => c.fatigued)).toBe(true);
  });
});

describe("sudden death", () => {
  it("a scoreless knockout match reaches sudden death and resolves by shootout", () => {
    const defenseDeck: CardInstance[] = Array.from({ length: 10 }, (_, i) => ({
      uid: `def-${i}`,
      defId: "df_stopper",
      level: 0 as const,
      formPower: 0,
      fatigued: false,
    }));
    const { state, events } = playMatch(
      CARD_DEF_MAP,
      config({
        deck: defenseDeck,
        context: "knockout",
        opp: { ...MINNOW, attackRating: 1 }, // floor keeps it to 1pt/round: never scores
      }),
    );
    expect(events.some((e) => e.type === "SUDDEN_DEATH_START")).toBe(true);
    expect(events.some((e) => e.type === "SHOOTOUT")).toBe(true);
    expect(state.phase).toBe("DONE");
    expect(["win", "loss"]).toContain(state.result);
  });
});

describe("style effects", () => {
  it("fortress caps the attack multiplier", () => {
    const { state } = createMatch(
      CARD_DEF_MAP,
      config({
        styleEffects: [{ trigger: "onMatchStart", op: { kind: "scripted", key: "capMultAt2x" } }],
      }),
    );
    expect(state.multCap).toBe(2);
  });

  it("possession forces a discard every round", () => {
    const { state, events } = createMatch(
      CARD_DEF_MAP,
      config({
        styleEffects: [
          { trigger: "onRoundStart", op: { kind: "scripted", key: "forceRandomDiscard1" } },
        ],
      }),
    );
    expect(events.filter((e) => e.type === "CARDS_DISCARDED" && e.forced)).toHaveLength(1);
    expect(state.hand.length).toBe(DEFAULT_BALANCE.HAND_SIZE - 1);
  });

  it("counter bursts the clock on a failed attack", () => {
    let { state } = createMatch(
      CARD_DEF_MAP,
      config({
        styleEffects: [
          { trigger: "onAttackResolve", op: { kind: "scripted", key: "burstClockOnFailedAttack" } },
        ],
      }),
    );
    // weakest single attacker: guaranteed 0 goals
    const weakest = state.hand
      .filter((c) => (levelStats(CARD_DEF_MAP[c.defId]!, c.level).power ?? 0) > 0)
      .sort(
        (a, b) =>
          (levelStats(CARD_DEF_MAP[a.defId]!, a.level).power ?? 0) -
          (levelStats(CARD_DEF_MAP[b.defId]!, b.level).power ?? 0),
      )[0];
    if (!weakest) return; // hand without attackers: nothing to assert this seed
    const step = applyMatchAction(CARD_DEF_MAP, state, {
      type: "ATTACK",
      cardUids: [weakest.uid],
    });
    expect(step.events.some((e) => e.type === "CLOCK_BURST")).toBe(true);
    expect(step.state.oppClockPoints).toBeGreaterThan(0);
  });
});

describe("action validation", () => {
  it("rejects illegal actions", () => {
    const { state } = createMatch(CARD_DEF_MAP, config());
    expect(() =>
      applyMatchAction(CARD_DEF_MAP, state, { type: "ATTACK", cardUids: ["nope"] }),
    ).toThrow(/not in hand/);
    expect(() => applyMatchAction(CARD_DEF_MAP, state, { type: "TAKE_WIN" })).toThrow(
      /requires phase/,
    );
    expect(() => applyMatchAction(CARD_DEF_MAP, state, { type: "EXTRA_TIME" })).toThrow(
      /requires phase/,
    );
  });

  it("rejects an attack with no power", () => {
    let { state } = createMatch(CARD_DEF_MAP, config());
    const tactic = state.hand.find(
      (c) => (levelStats(CARD_DEF_MAP[c.defId]!, c.level).power ?? 0) === 0,
    );
    if (!tactic) return;
    expect(() =>
      applyMatchAction(CARD_DEF_MAP, state, { type: "ATTACK", cardUids: [tactic.uid] }),
    ).toThrow(/at least one card with power/);
  });
});
