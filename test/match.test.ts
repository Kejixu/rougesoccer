import { describe, expect, it } from "vitest";
import { applyMatchAction, createMatch, type MatchConfig } from "../src/core/match/engine";
import { seedRng } from "../src/core/rng";
import { DEFAULT_BALANCE } from "../src/core/balance";
import {
  cardCost,
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
    plays: [],
    context: "group",
    deck: makeStartingDeck(),
    rng: seedRng("test-1"),
    balance: DEFAULT_BALANCE,
    ...overrides,
  };
}

function allCards(s: MatchState): CardInstance[] {
  return [...s.hand, ...s.drawPile, ...s.discardPile, ...s.exile];
}

/** Tiny deterministic policy: block real threats, then attack, then end. */
function pickAction(defs: CardDefMap, s: MatchState, pushLuck = false): MatchAction {
  if (s.phase === "PUSH_DECISION") {
    return pushLuck && s.extraRoundsPlayed < s.bal.MAX_EXTRA_ROUNDS
      ? { type: "EXTRA_TIME" }
      : { type: "TAKE_WIN" };
  }
  const power = (c: CardInstance) =>
    (levelStats(defs[c.defId]!, c.level).power ?? 0) + c.formPower;
  const defense = (c: CardInstance) => levelStats(defs[c.defId]!, c.level).defense ?? 0;
  const affordable = s.hand.filter((c) => cardCost(defs[c.defId]!) <= s.stamina);
  if (affordable.length === 0) return { type: "END_ROUND" };

  const threat =
    s.intent?.kind === "attack" ? Math.max(0, s.intent.points - s.block) : 0;
  if (threat >= s.bal.GOAL_THRESHOLD * 0.3) {
    const blocker = affordable.sort((a, b) => defense(b) - defense(a))[0]!;
    if (defense(blocker) > 0) return { type: "PLAY_CARD", uid: blocker.uid };
  }
  const attacker = affordable.sort((a, b) => power(b) - power(a))[0]!;
  if (power(attacker) > 0) return { type: "PLAY_CARD", uid: attacker.uid };
  return { type: "END_ROUND" };
}

function playMatch(
  defs: CardDefMap,
  cfg: MatchConfig,
  pushLuck = false,
): { state: MatchState; events: GameEvent[] } {
  let { state, events } = createMatch(defs, cfg);
  const log = [...events];
  for (let guard = 0; guard < 400 && state.phase !== "DONE"; guard++) {
    const step = applyMatchAction(defs, state, pickAction(defs, state, pushLuck));
    state = step.state;
    log.push(...step.events);
  }
  return { state, events: log };
}

describe("combat match", () => {
  it("a simple policy completes a match; intents are revealed every round", () => {
    const { state, events } = playMatch(CARD_DEF_MAP, config());
    expect(state.phase).toBe("DONE");
    expect(state.result).not.toBe("pending");
    expect(events.filter((e) => e.type === "INTENT_REVEALED").length).toBeGreaterThanOrEqual(
      DEFAULT_BALANCE.MATCH_ROUNDS,
    );
    expect(events.some((e) => e.type === "MATCH_END")).toBe(true);
    expect(allCards(state)).toHaveLength(makeStartingDeck().length);
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

  it("stamina gates card plays", () => {
    let { state } = createMatch(CARD_DEF_MAP, config());
    expect(state.stamina).toBe(DEFAULT_BALANCE.STAMINA_PER_ROUND);
    // drain stamina, then any further play must throw
    for (let guard = 0; guard < 10; guard++) {
      const affordable = state.hand.find(
        (c) => cardCost(CARD_DEF_MAP[c.defId]!) <= state.stamina && cardCost(CARD_DEF_MAP[c.defId]!) > 0,
      );
      if (!affordable) break;
      state = applyMatchAction(CARD_DEF_MAP, state, { type: "PLAY_CARD", uid: affordable.uid }).state;
    }
    const tooExpensive = state.hand.find(
      (c) => cardCost(CARD_DEF_MAP[c.defId]!) > state.stamina,
    );
    if (tooExpensive) {
      expect(() =>
        applyMatchAction(CARD_DEF_MAP, state, { type: "PLAY_CARD", uid: tooExpensive.uid }),
      ).toThrow(/stamina/);
    }
  });

  it("block absorbs an attack intent", () => {
    // craft: opp always attacks (balanced pattern round 1 = attack)
    let { state } = createMatch(CARD_DEF_MAP, config({ rng: seedRng("block-test") }));
    expect(state.intent?.kind).toBe("attack");
    const defender = state.hand.find(
      (c) => (levelStats(CARD_DEF_MAP[c.defId]!, c.level).defense ?? 0) > 0,
    );
    if (!defender) return; // seed without a defender in hand: skip
    state = applyMatchAction(CARD_DEF_MAP, state, { type: "PLAY_CARD", uid: defender.uid }).state;
    expect(state.block).toBeGreaterThan(0);
    const step = applyMatchAction(CARD_DEF_MAP, state, { type: "END_ROUND" });
    const exec = step.events.find((e) => e.type === "INTENT_EXECUTED");
    expect(exec).toBeDefined();
    if (exec && exec.type === "INTENT_EXECUTED") {
      expect(exec.blocked).toBeGreaterThan(0);
    }
    expect(step.state.block).toBe(0); // block expires
  });

  it("tactics buff the next attack card", () => {
    const deck: CardInstance[] = [
      { uid: "t1", defId: "tac_through", level: 0, formPower: 0, fatigued: false },
      { uid: "s1", defId: "st_clinical", level: 0, formPower: 0, fatigued: false },
      ...Array.from({ length: 6 }, (_, i) => ({
        uid: `f-${i}`,
        defId: "mf_engine",
        level: 0 as const,
        formPower: 0,
        fatigued: false,
      })),
    ];
    let { state } = createMatch(CARD_DEF_MAP, config({ deck, rng: seedRng("buff-test") }));
    const tactic = state.hand.find((c) => c.defId === "tac_through");
    const striker = state.hand.find((c) => c.defId === "st_clinical");
    if (!tactic || !striker) return; // hand draw didn't include both: skip
    state = applyMatchAction(CARD_DEF_MAP, state, { type: "PLAY_CARD", uid: tactic.uid }).state;
    expect(state.pendingMult).toBeCloseTo(1.5);
    const step = applyMatchAction(CARD_DEF_MAP, state, { type: "PLAY_CARD", uid: striker.uid });
    const shot = step.events.find((e) => e.type === "SHOT_VALUE");
    if (shot && shot.type === "SHOT_VALUE") {
      expect(shot.value).toBe(Math.floor(12 * 1.5));
    }
    expect(step.state.pendingMult).toBe(1); // buff consumed
  });
});

describe("push-your-luck", () => {
  const superDeck = (): CardInstance[] =>
    Array.from({ length: 8 }, (_, i) => ({
      uid: `super-${i}`,
      defId: "st_clinical",
      level: 2 as const,
      formPower: 10,
      fatigued: false,
    }));

  it("first extra round is fatigue-free, second tires the squad", () => {
    let { state } = createMatch(
      CARD_DEF_MAP,
      config({ deck: superDeck(), opp: { ...MINNOW, attackRating: 3 } }),
    );
    for (let guard = 0; guard < 100 && state.phase === "ROUND_ACTIVE"; guard++) {
      state = applyMatchAction(CARD_DEF_MAP, state, pickAction(CARD_DEF_MAP, state)).state;
    }
    expect(state.phase).toBe("PUSH_DECISION");

    state = applyMatchAction(CARD_DEF_MAP, state, { type: "EXTRA_TIME" }).state;
    for (let guard = 0; guard < 50 && state.phase === "ROUND_ACTIVE"; guard++) {
      state = applyMatchAction(CARD_DEF_MAP, state, pickAction(CARD_DEF_MAP, state)).state;
    }
    expect(state.earned.budget).toBe(DEFAULT_BALANCE.ET_BUDGET_REWARD);
    expect(state.phase).toBe("PUSH_DECISION");
    expect(allCards(state).some((c) => c.fatigued)).toBe(false);

    state = applyMatchAction(CARD_DEF_MAP, state, { type: "EXTRA_TIME" }).state;
    let played = false;
    for (let guard = 0; guard < 50 && state.phase === "ROUND_ACTIVE"; guard++) {
      const action = pickAction(CARD_DEF_MAP, state);
      if (action.type === "PLAY_CARD") played = true;
      state = applyMatchAction(CARD_DEF_MAP, state, action).state;
    }
    expect(state.phase).toBe("DONE");
    expect(state.result).toBe("win");
    if (played) expect(allCards(state).some((c) => c.fatigued)).toBe(true);
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
        opp: { ...MINNOW, attackRating: 1 }, // tiny intents, always blockable
      }),
    );
    expect(events.some((e) => e.type === "SUDDEN_DEATH_START")).toBe(true);
    expect(events.some((e) => e.type === "SHOOTOUT")).toBe(true);
    expect(state.phase).toBe("DONE");
    expect(["win", "loss"]).toContain(state.result);
  });
});

describe("action validation", () => {
  it("rejects illegal actions", () => {
    const { state } = createMatch(CARD_DEF_MAP, config());
    expect(() =>
      applyMatchAction(CARD_DEF_MAP, state, { type: "PLAY_CARD", uid: "nope" }),
    ).toThrow(/not in hand/);
    expect(() => applyMatchAction(CARD_DEF_MAP, state, { type: "TAKE_WIN" })).toThrow(
      /requires phase/,
    );
    expect(() => applyMatchAction(CARD_DEF_MAP, state, { type: "EXTRA_TIME" })).toThrow(
      /requires phase/,
    );
  });
});
