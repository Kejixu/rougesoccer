// Dice mode: roll determinism, slot fit, possession chains, shots, opponent chain.

import { describe, expect, it } from "vitest";
import {
  applyDiceAction,
  comboFor,
  createDiceMatch,
  effectsFor,
  interceptionRisk,
  oppInterceptionRisk,
  playableCards,
  projectedShotEstimate,
  shotEstimate,
} from "../src/core/match/dice";
import { seedRng } from "../src/core/rng";
import { DEFAULT_BALANCE } from "../src/core/balance";
import { dieFitsSlot, pressureOf } from "../src/core/types";
import type { CardDefMap, CardInstance, DiceMatchState, OppInfo } from "../src/core/types";
import { applyRunAction, createRun } from "../src/core/run/run";
import { makeContent } from "../src/data/content";
import { DICE_CARD_MAP } from "../src/data/diceCards";

const OPP: OppInfo = { teamId: "qat", name: "Qatar", attackRating: 12, style: "balanced", tier: 4 };

function inst(defId: string, i: number): CardInstance {
  return { uid: `t-${defId}-${i}`, defId, level: 0, formPower: 0, fatigued: false };
}

function start(defIds: string[], seed = "dice", mutators: DiceMatchConfigMutators = []): DiceMatchState {
  return createDiceMatch(DICE_CARD_MAP, {
    opp: OPP,
    styleEffects: [],
    plays: [],
    context: "group",
    deck: defIds.map((id, i) => inst(id, i)),
    mutators,
    rng: seedRng(seed),
    balance: DEFAULT_BALANCE,
  }).state;
}
type DiceMatchConfigMutators = import("../src/core/types").DiceMutator[];

/** Assign the first unused die that fits the named card. */
function playWith(m: DiceMatchState, defId: string): DiceMatchState {
  const card = m.hand.find((c) => c.defId === defId);
  if (!card) throw new Error(`${defId} not in hand`);
  const slot = DICE_CARD_MAP[defId]!.slot!;
  const dieIndex = m.dice.findIndex((d) => !d.used && dieFitsSlot(d.value, slot));
  if (dieIndex === -1) throw new Error(`no die fits ${defId} (roll: ${m.dice.map((d) => d.value)})`);
  return applyDiceAction(DICE_CARD_MAP, m, { type: "ASSIGN_DIE", uid: card.uid, dieIndex }).state;
}

describe("dice slot fit", () => {
  it("matches min / max / exact / parity / any", () => {
    expect(dieFitsSlot(5, { kind: "min", value: 5 })).toBe(true);
    expect(dieFitsSlot(4, { kind: "min", value: 5 })).toBe(false);
    expect(dieFitsSlot(2, { kind: "max", value: 2 })).toBe(true);
    expect(dieFitsSlot(3, { kind: "max", value: 2 })).toBe(false);
    expect(dieFitsSlot(4, { kind: "exact", value: 4 })).toBe(true);
    expect(dieFitsSlot(4, { kind: "parity", even: true })).toBe(true);
    expect(dieFitsSlot(3, { kind: "parity", even: true })).toBe(false);
    expect(dieFitsSlot(1, { kind: "any" })).toBe(true);
  });
});

describe("dice card levels", () => {
  it("effectsFor resolves level-specific dice effects without changing the base definition", () => {
    expect(effectsFor(DICE_CARD_MAP.d_drivingrun!, 0)).toEqual([{ kind: "progress", amount: 4 }]);
    expect(effectsFor(DICE_CARD_MAP.d_drivingrun!, 1)).toEqual([{ kind: "progress", amount: 5 }]);
    expect(effectsFor(DICE_CARD_MAP.d_drivingrun!, 2)).toEqual([{ kind: "progress", amount: 6 }]);
    expect(effectsFor(DICE_CARD_MAP.d_drivingrun!, 99)).toEqual([{ kind: "progress", amount: 6 }]);
    expect(DICE_CARD_MAP.d_drivingrun!.diceEffects).toEqual([{ kind: "progress", amount: 4 }]);
  });

  it("TRAIN_CARD upgrades the instance effect used by the live dice match", () => {
    const content = makeContent(DEFAULT_BALANCE);
    let run = createRun(content, "train-live-effect", "usa");
    const card = run.deck.find((c) => c.defId === "d_shortpass")!;
    run = { ...run, resources: { ...run.resources, budget: 999 } };

    run = applyRunAction(content, run, { type: "TRAIN_CARD", uid: card.uid }).state;
    expect(run.deck.find((c) => c.uid === card.uid)?.level).toBe(1);

    run = applyRunAction(content, run, { type: "START_MATCH" }).state;
    const upgraded = run.deck.find((c) => c.uid === card.uid)!;
    const match = run.activeMatch!;
    run = {
      ...run,
      activeMatch: {
        ...match,
        ball: DEFAULT_BALANCE.DICE.MIDFIELD,
        passes: 0,
        dice: [{ value: 4, used: false }],
        hand: [{ ...upgraded, formPower: 0, fatigued: false }],
      },
    };

    const step = applyRunAction(content, run, {
      type: "MATCH_ACTION",
      action: { type: "ASSIGN_DIE", uid: upgraded.uid, dieIndex: 0 },
    });
    expect(step.state.activeMatch?.ball).toBe(DEFAULT_BALANCE.DICE.MIDFIELD + 5);
  });

  it.each([
    { level: 0, progress: 2, chance: 0 },
    { level: 1, progress: 3, chance: 0 },
    { level: 2, progress: 3, chance: 1 },
  ] as const)("One-Two level $level progresses and cycles", ({ level, progress, chance }) => {
    const cyclingCard = { ...inst("d_onetwo", 0), level };
    const drawnCard = inst("d_shortpass", 1);
    const before = {
      ...start(["d_shortpass"], `one-two-${level}`),
      ball: DEFAULT_BALANCE.DICE.MIDFIELD,
      dice: [{ value: 2, used: false }],
      hand: [cyclingCard],
      drawPile: [drawnCard],
      discardPile: [],
    };

    const step = applyDiceAction(DICE_CARD_MAP, before, {
      type: "ASSIGN_DIE",
      uid: cyclingCard.uid,
      dieIndex: 0,
    });

    expect(step.state.ball).toBe(DEFAULT_BALANCE.DICE.MIDFIELD + progress);
    expect(step.state.shotQuality).toBe(chance);
    expect(step.state.hand.map((card) => card.uid)).toEqual([drawnCard.uid]);
    expect(step.state.discardPile.map((card) => card.uid)).toContain(cyclingCard.uid);
  });

  it.each([
    { level: 0, defend: 0.12, draws: 1 },
    { level: 1, defend: 0.16, draws: 1 },
    { level: 2, defend: 0.16, draws: 2 },
  ] as const)("Sweeper Keeper level $level defends and cycles", ({ level, defend, draws }) => {
    const cyclingCard = { ...inst("d_sweeperkeeper", 0), level };
    const drawnCards = Array.from({ length: draws }, (_, i) => inst("d_shortpass", i + 1));
    const before = {
      ...start(["d_shortpass"], `sweeper-${level}`),
      round: 2,
      possession: "them" as const,
      rng: seedRng("s-32"),
      dice: [{ value: 3, used: false }],
      hand: [cyclingCard],
      drawPile: drawnCards,
      discardPile: [],
    };

    const step = applyDiceAction(DICE_CARD_MAP, before, {
      type: "ASSIGN_DIE",
      uid: cyclingCard.uid,
      dieIndex: 0,
    });

    expect(step.events).toContainEqual(expect.objectContaining({ type: "DEFENSE_COMMITTED", amount: defend }));
    expect(step.state.defenseCommit).toBeCloseTo(defend, 5);
    expect(step.state.hand).toHaveLength(draws);
    expect(step.state.discardPile.map((card) => card.uid)).toContain(cyclingCard.uid);
  });
});

describe("persistent dice hand", () => {
  it("keeps unplayed cards across rounds and refills only to HAND_SIZE", () => {
    const held = [inst("d_finish", 20), inst("d_tackle", 21)];
    const refill = [inst("d_shortpass", 22), inst("d_clearance", 23), inst("d_poacher", 24)];
    const before = {
      ...start(["d_shortpass"], "persistent-held"),
      hand: held,
      drawPile: refill,
      discardPile: [],
    };

    const step = applyDiceAction(DICE_CARD_MAP, before, { type: "END_ROUND" });

    expect(step.state.hand).toHaveLength(DEFAULT_BALANCE.DICE.HAND_SIZE);
    expect(step.state.hand.map((card) => card.uid)).toEqual(expect.arrayContaining(held.map((card) => card.uid)));
    expect(step.events.some((event) => event.type === "CARDS_DISCARDED" && event.forced)).toBe(false);
  });

  it("discards played cards while leaving unplayed cards in hand", () => {
    const played = inst("d_shortpass", 30);
    const held = inst("d_finish", 31);
    const before = {
      ...start(["d_shortpass"], "persistent-played"),
      dice: [{ value: 2, used: false }],
      hand: [played, held],
      drawPile: [inst("d_poacher", 32), inst("d_clearance", 33), inst("d_tackle", 34)],
      discardPile: [],
    };

    const afterPlay = applyDiceAction(DICE_CARD_MAP, before, {
      type: "ASSIGN_DIE",
      uid: played.uid,
      dieIndex: 0,
    }).state;
    const afterRound = applyDiceAction(DICE_CARD_MAP, afterPlay, { type: "END_ROUND" }).state;

    expect(afterRound.discardPile.map((card) => card.uid)).toContain(played.uid);
    expect(afterRound.hand.map((card) => card.uid)).toContain(held.uid);
  });

  it("still exiles exile-on-play cards", () => {
    const exileDef = { ...DICE_CARD_MAP.d_shortpass!, id: "d_test_exile", exileOnPlay: true };
    const defs: CardDefMap = { ...DICE_CARD_MAP, [exileDef.id]: exileDef };
    const card = inst(exileDef.id, 40);
    const before = {
      ...start(["d_shortpass"], "persistent-exile"),
      dice: [{ value: 2, used: false }],
      hand: [card],
      drawPile: [],
      discardPile: [],
      exile: [],
    };

    const after = applyDiceAction(defs, before, { type: "ASSIGN_DIE", uid: card.uid, dieIndex: 0 }).state;

    expect(after.exile.map((instance) => instance.uid)).toEqual([card.uid]);
    expect(after.discardPile).toHaveLength(0);
  });

  it("draws at least one card when the held hand is at HAND_SIZE", () => {
    const hand = Array.from({ length: DEFAULT_BALANCE.DICE.HAND_SIZE }, (_, i) => inst("d_shortpass", 50 + i));
    const fresh = inst("d_finish", 60);
    const before = {
      ...start(["d_shortpass"], "persistent-minimum-draw"),
      hand,
      drawPile: [fresh],
      discardPile: [],
    };

    const step = applyDiceAction(DICE_CARD_MAP, before, { type: "END_ROUND" });

    expect(step.state.hand).toHaveLength(DEFAULT_BALANCE.DICE.HAND_SIZE + 1);
    expect(step.state.hand.map((card) => card.uid)).toContain(fresh.uid);
  });

  it("does not draw when the held hand is at the hard cap", () => {
    const hand = Array.from({ length: DEFAULT_BALANCE.DICE.HAND_SIZE + 1 }, (_, i) => inst("d_shortpass", 70 + i));
    const fresh = inst("d_finish", 80);
    const before = {
      ...start(["d_shortpass"], "persistent-cap"),
      hand,
      drawPile: [fresh],
      discardPile: [],
    };

    const step = applyDiceAction(DICE_CARD_MAP, before, { type: "END_ROUND" });

    expect(step.state.hand.map((card) => card.uid)).toEqual(hand.map((card) => card.uid));
    expect(step.state.drawPile.map((card) => card.uid)).toEqual([fresh.uid]);
  });

  it("applies drawBonus relative to HAND_SIZE without exceeding the cap", () => {
    const hand = Array.from({ length: DEFAULT_BALANCE.DICE.HAND_SIZE - 1 }, (_, i) => inst("d_shortpass", 90 + i));
    const fresh = [inst("d_finish", 100), inst("d_poacher", 101), inst("d_tackle", 102)];
    const before = {
      ...start(["d_shortpass"], "persistent-draw-bonus"),
      activePassives: [{ kind: "drawBonus" as const, amount: 1 }],
      hand,
      drawPile: fresh,
      discardPile: [],
    };

    const step = applyDiceAction(DICE_CARD_MAP, before, { type: "END_ROUND" });
    const drawn = step.events.find((event) => event.type === "CARDS_DRAWN");

    expect(step.state.hand).toHaveLength(DEFAULT_BALANCE.DICE.HAND_SIZE + 1);
    expect(drawn).toMatchObject({ type: "CARDS_DRAWN", uids: expect.any(Array) });
    if (drawn?.type === "CARDS_DRAWN") expect(drawn.uids).toHaveLength(2);
  });
});

describe("position combos", () => {
  it("comboFor recognizes only the approved footballing links", () => {
    expect(comboFor(null, "WG")).toBeNull();
    expect(comboFor("MF", "WG")).toEqual({ label: "Switch of play", chance: 0, riskDelta: -0.08 });
    expect(comboFor("WG", "ST")).toEqual({ label: "Delivered onto the run", chance: 3, riskDelta: 0 });
    expect(comboFor("MF", "ST")).toEqual({ label: "Through the middle", chance: 2, riskDelta: 0 });
    expect(comboFor("WG", "MF")).toBeNull();
    expect(comboFor("ST", "WG")).toBeNull();
  });

  it("applies combo risk bonuses to the next pass and records the last pass position", () => {
    const base = start(["d_flankrun"], "combo-risk");
    const m = {
      ...base,
      passes: 1,
      lastPassPosition: "MF" as const,
      nextRiskDelta: -10,
      intent: { kind: "sitDeep" as const, amount: 1 },
      rng: seedRng("combo-risk-survives"),
      dice: [{ value: 4, used: false }],
      hand: [inst("d_flankrun", 0)],
    };

    const step = applyDiceAction(DICE_CARD_MAP, m, { type: "ASSIGN_DIE", uid: m.hand[0]!.uid, dieIndex: 0 });
    expect(step.events).toContainEqual(expect.objectContaining({ type: "PASS_COMPLETED", combo: "Switch of play" }));
    expect(step.state.nextRiskDelta).toBeCloseTo(-0.08, 5);
    expect(step.state.lastPassPosition).toBe("WG");
  });

  it("adds combo chance into the same pass-completed accounting", () => {
    const base = start(["d_poacher"], "combo-chance");
    const m = {
      ...base,
      passes: 1,
      lastPassPosition: "WG" as const,
      nextRiskDelta: -10,
      intent: { kind: "sitDeep" as const, amount: 1 },
      rng: seedRng("combo-chance-survives"),
      dice: [{ value: 2, used: false }],
      hand: [inst("d_poacher", 0)],
    };

    const step = applyDiceAction(DICE_CARD_MAP, m, { type: "ASSIGN_DIE", uid: m.hand[0]!.uid, dieIndex: 0 });
    expect(step.events).toContainEqual(
      expect.objectContaining({ type: "PASS_COMPLETED", combo: "Delivered onto the run", chanceGained: 9 }),
    );
    expect(step.state.shotQuality).toBe(9);
    expect(step.state.lastPassPosition).toBe("ST");
  });

  it("resets lastPassPosition when a new possession starts", () => {
    const m = {
      ...start(["d_shortpass"], "combo-reset"),
      passes: 1,
      lastPassPosition: "MF" as const,
      hand: [],
    };

    const step = applyDiceAction(DICE_CARD_MAP, m, { type: "END_ROUND" });
    expect(step.state.possession).toBe("them");
    expect(step.state.lastPassPosition).toBeNull();
  });
});

describe("dice roll", () => {
  it("rolls POOL_SIZE dice in 1..DIE_FACES, deterministically per seed", () => {
    const a = start(["d_shortpass"]);
    const b = start(["d_shortpass"]);
    expect(a.dice).toHaveLength(DEFAULT_BALANCE.DICE.POOL_SIZE);
    for (const d of a.dice) {
      expect(d.value).toBeGreaterThanOrEqual(1);
      expect(d.value).toBeLessThanOrEqual(DEFAULT_BALANCE.DICE.DIE_FACES);
      expect(d.used).toBe(false);
    }
    expect(a.dice.map((d) => d.value)).toEqual(b.dice.map((d) => d.value));
  });

  it("starts at midfield with no shot quality and an empty chain", () => {
    const m = start(["d_shortpass"]);
    expect(m.ball).toBe(DEFAULT_BALANCE.DICE.MIDFIELD);
    expect(m.possession).toBe("you");
    expect(m.shotQuality).toBe(0);
    expect(m.passes).toBe(0);
    expect(m.oppPasses).toBe(0);
  });
});

describe("slotting dice", () => {
  it("a die that doesn't fit the slot is rejected", () => {
    const m = start(["d_finish", "d_finish", "d_finish", "d_finish", "d_finish"], "fit-low");
    const lowDie = m.dice.findIndex((d) => d.value < 5);
    expect(lowDie).toBeGreaterThanOrEqual(0);
    const card = m.hand[0]!;
    expect(() => applyDiceAction(DICE_CARD_MAP, m, { type: "ASSIGN_DIE", uid: card.uid, dieIndex: lowDie })).toThrow(
      /doesn't fit/,
    );
  });

  it("playableCards reflects die fit and possession role", () => {
    const m = start(["d_tackle", "d_finish", "d_shortpass", "d_clearance", "d_poacher"], "playable");
    const playable = playableCards(DICE_CARD_MAP, m);
    const sp = m.hand.find((c) => c.defId === "d_shortpass")!;
    const tackle = m.hand.find((c) => c.defId === "d_tackle")!;
    const hasMid = m.dice.some((d) => !d.used && d.value >= 2);
    expect(playable.has(sp.uid)).toBe(hasMid);
    expect(playable.has(tackle.uid)).toBe(false);
  });
});

describe("your chain", () => {
  it("the first pass is always safe and resolves immediately", () => {
    let m = start(["d_shortpass", "d_shortpass", "d_shortpass", "d_shortpass"], "chain1");
    m = { ...m, dice: [{ value: 4, used: false }], hand: [inst("d_shortpass", 0)] };
    const step = applyDiceAction(DICE_CARD_MAP, m, { type: "ASSIGN_DIE", uid: m.hand[0]!.uid, dieIndex: 0 });
    const pass = step.events.find((e) => e.type === "PASS_COMPLETED");
    expect(pass).toMatchObject({ type: "PASS_COMPLETED", passes: 1, risked: 0 });
    expect(step.state.ball).toBe(DEFAULT_BALANCE.DICE.MIDFIELD + 4);
    expect(step.state.passes).toBe(1);
  });

  it("interceptionRisk is 0 before the first pass, then base + ramp", () => {
    let m = start(["d_shortpass"], "risk");
    m = { ...m, intent: { kind: "press" }, passes: 0 };
    expect(interceptionRisk(m)).toBe(0);
    m = { ...m, passes: 1 };
    expect(interceptionRisk(m)).toBeCloseTo(DEFAULT_BALANCE.DICE.RISK_BASE_PRESS, 5);
    m = { ...m, passes: 3 };
    expect(interceptionRisk(m)).toBeCloseTo(
      DEFAULT_BALANCE.DICE.RISK_BASE_PRESS + 2 * DEFAULT_BALANCE.DICE.RISK_RAMP,
      5,
    );
  });

  it("pressureOf quantizes raw interception risk to d20 pressure", () => {
    expect(pressureOf(0)).toBe(0);
    expect(pressureOf(0.02)).toBe(0);
    expect(pressureOf(0.225)).toBe(5);
    expect(pressureOf(0.65)).toBe(13);
    expect(pressureOf(0.99)).toBe(20);
  });

  it("emits PASS_CHALLENGED and uses the quantized d20 outcome for your challenged pass", () => {
    const m = {
      ...start(["d_shortpass"], "pressure-quantized"),
      passes: 1,
      intent: { kind: "press" as const },
      nextRiskDelta: -0.045,
      rng: seedRng("q-20"),
      dice: [{ value: 4, used: false }],
      hand: [inst("d_shortpass", 0)],
      shotQuality: 7,
    };

    expect(interceptionRisk(m)).toBeCloseTo(0.225, 5);
    const step = applyDiceAction(DICE_CARD_MAP, m, { type: "ASSIGN_DIE", uid: m.hand[0]!.uid, dieIndex: 0 });

    expect(step.events[2]).toEqual({ type: "PASS_CHALLENGED", roll: 5, pressure: 5, survived: false });
    expect(step.events).toContainEqual(expect.objectContaining({ type: "CHAIN_INTERCEPTED", byYou: false, chanceLost: 7 }));
  });

  it("does not emit PASS_CHALLENGED for the free first pass", () => {
    const m = {
      ...start(["d_shortpass"], "first-pass-no-pressure"),
      passes: 0,
      rng: seedRng("first-pass-no-pressure-action"),
      dice: [{ value: 4, used: false }],
      hand: [inst("d_shortpass", 0)],
    };

    const step = applyDiceAction(DICE_CARD_MAP, m, { type: "ASSIGN_DIE", uid: m.hand[0]!.uid, dieIndex: 0 });
    expect(step.events.some((e) => e.type === "PASS_CHALLENGED")).toBe(false);
  });

  it("chance effects grow with development: later passes are worth more", () => {
    let m = start(["d_poacher"], "dev");
    m = {
      ...m,
      passes: 3,
      nextChanceBonus: 0,
      intent: { kind: "sitDeep", amount: 1 },
      rng: seedRng("survive-poacher"),
      dice: [{ value: 2, used: false }],
      hand: [inst("d_poacher", 0)],
    };
    const before = m.shotQuality;
    const after = applyDiceAction(DICE_CARD_MAP, m, { type: "ASSIGN_DIE", uid: m.hand[0]!.uid, dieIndex: 0 }).state;
    expect(after.passes).toBe(4);
    expect(after.shotQuality - before).toBe(5 + 3 * DEFAULT_BALANCE.DICE.DEVELOPMENT_GAIN);
  });

  it("setupNext banks a bonus for the next chance effect", () => {
    let m = start(["d_throughball", "d_poacher"], "setup");
    m = {
      ...m,
      passes: 0,
      intent: { kind: "sitDeep", amount: 1 },
      rng: seedRng("setup-survive"),
      dice: [
        { value: 5, used: false },
        { value: 2, used: false },
      ],
      hand: [inst("d_throughball", 0), inst("d_poacher", 1)],
    };
    m = applyDiceAction(DICE_CARD_MAP, m, { type: "ASSIGN_DIE", uid: m.hand[0]!.uid, dieIndex: 0 }).state;
    expect(m.nextChanceBonus).toBe(4);
    expect(interceptionRisk(m)).toBeLessThan(1);
    const sq = m.shotQuality;
    const step = applyDiceAction(DICE_CARD_MAP, m, { type: "ASSIGN_DIE", uid: m.hand[0]!.uid, dieIndex: 1 });
    const after = step.state;
    expect(after.passes).toBe(2);
    expect(step.events).toContainEqual(expect.objectContaining({ type: "PASS_COMPLETED", combo: "Through the middle" }));
    expect(after.shotQuality - sq).toBe(5 + 4 + 2 + 1 * DEFAULT_BALANCE.DICE.DEVELOPMENT_GAIN);
    expect(after.nextChanceBonus).toBe(0);
  });

  it("you can shoot from midfield at a punt penalty; from the box at none", () => {
    let m = start(["d_shortpass"], "zones");
    m = { ...m, passes: 1, shotQuality: 4, ball: DEFAULT_BALANCE.DICE.MIDFIELD, intent: null };
    expect(shotEstimate(m).dc).toBe(m.keeperDC + 6);
    m = { ...m, ball: DEFAULT_BALANCE.DICE.THEIR_BOX };
    expect(shotEstimate(m).dc).toBe(m.keeperDC);
    const step = applyDiceAction(DICE_CARD_MAP, m, { type: "SHOOT" });
    expect(step.events.some((e) => e.type === "SHOT_TAKEN")).toBe(true);
    expect(step.state.round).toBeGreaterThan(m.round);
  });

  it("allows a zero-Chance punt after at least one completed pass", () => {
    const m = {
      ...start(["d_shortpass"], "punt"),
      passes: 1,
      shotQuality: 0,
      ball: DEFAULT_BALANCE.DICE.MIDFIELD,
      intent: null,
    };
    const step = applyDiceAction(DICE_CARD_MAP, m, { type: "SHOOT" });
    expect(step.events).toContainEqual(
      expect.objectContaining({ type: "SHOT_TAKEN", quality: 0, dc: m.keeperDC + 6 }),
    );
    expect(step.state.round).toBeGreaterThan(m.round);
  });

  it("an interception loses the whole banked chance and triggers their counter", () => {
    const base = start(["d_shortpass"], "picked");
    let sawInterception = false;
    for (const seed of ["a", "b", "c", "d", "e", "f", "g"]) {
      const fresh = {
        ...base,
        passes: 4,
        shotQuality: 9,
        intent: { kind: "press" as const },
        nextRiskDelta: 10,
        rng: seedRng(seed),
        dice: [{ value: 4, used: false }],
        hand: [inst("d_shortpass", 0)],
      };
      const step = applyDiceAction(DICE_CARD_MAP, fresh, { type: "ASSIGN_DIE", uid: fresh.hand[0]!.uid, dieIndex: 0 });
      const picked = step.events.find((e) => e.type === "CHAIN_INTERCEPTED");
      if (picked) {
        sawInterception = true;
        expect(picked).toMatchObject({ byYou: false, chanceLost: 9 });
        expect(step.events.some((e) => e.type === "COUNTER_SHOT" && !e.byYou)).toBe(true);
        expect(step.state.shotQuality).toBe(0);
        expect(step.state.round).toBeGreaterThan(base.round);
        break;
      }
    }
    expect(sawInterception).toBe(true);
  });

  it("END_ROUND recycles safely: possession ends, no shot, no counter", () => {
    let m = start(["d_shortpass"], "recycle");
    m = { ...m, passes: 2, shotQuality: 5 };
    const step = applyDiceAction(DICE_CARD_MAP, m, { type: "END_ROUND" });
    expect(step.events.some((e) => e.type === "CHAIN_INTERCEPTED" || e.type === "SHOT_TAKEN")).toBe(false);
    expect(step.state.round).toBeGreaterThan(m.round);
  });
});

describe("set pieces", () => {
  const rngStateForRoll: Record<number, number> = {
    5: 15,
    6: 0,
    7: 24,
    8: 18,
    9: 14,
    10: 58,
    11: 6,
    12: 13,
  };

  function readyShot(margin: 1 | 2 | 3 | 4 | 5): DiceMatchState {
    const base = start(["d_drivingrun", "d_quickcombo", "d_shortpass", "d_poacher"], `margin-${margin}`);
    const roll = base.keeperDC - margin;
    return {
      ...base,
      ball: DEFAULT_BALANCE.DICE.THEIR_BOX,
      passes: 1,
      shotQuality: 0,
      intent: null,
      rng: { s: rngStateForRoll[roll]! },
    };
  }

  it.each([
    { margin: 5 as const, corner: false, rattled: false },
    { margin: 4 as const, corner: true, rattled: false },
    { margin: 3 as const, corner: true, rattled: false },
    { margin: 2 as const, corner: true, rattled: true },
    { margin: 1 as const, corner: true, rattled: true },
  ])("nests corner and rattled windows for a miss by $margin", ({ margin, corner, rattled }) => {
    const before = readyShot(margin);
    const step = applyDiceAction(DICE_CARD_MAP, before, { type: "SHOOT" });

    expect(step.events.some((event) => event.type === "CORNER_EARNED")).toBe(corner);
    expect(step.events.some((event) => event.type === "KEEPER_RATTLED")).toBe(rattled);
    expect(step.state.corner).toBe(corner);
    expect(step.state.keeperRattled).toBe(rattled);
    if (corner) {
      expect(step.events).toContainEqual({ type: "CORNER_EARNED", margin });
      expect(step.state.round).toBe(before.round);
      expect(step.state.ball).toBe(before.ball);
      expect(step.state.shotQuality).toBe(0);
    } else {
      expect(step.state.round).toBeGreaterThan(before.round);
    }
  });

  it("plays one corner delivery, then immediately takes the automatic header", () => {
    const before = {
      ...readyShot(4),
      corner: true,
      rng: { s: 36 }, // header roll 20
      dice: [{ value: 4, used: false }],
      hand: [inst("d_quickcombo", 0)],
    };

    const step = applyDiceAction(DICE_CARD_MAP, before, {
      type: "ASSIGN_DIE",
      uid: before.hand[0]!.uid,
      dieIndex: 0,
    });

    expect(step.events).toContainEqual(expect.objectContaining({ type: "PASS_COMPLETED", chanceGained: 3 }));
    expect(step.events).toContainEqual(
      expect.objectContaining({ type: "SHOT_TAKEN", corner: true, quality: 3, goal: true }),
    );
    expect(step.state.round).toBeGreaterThan(before.round);
    expect(step.state.corner).toBe(false);
  });

  it("computes the miss margin from roll plus banked Chance", () => {
    const before = {
      ...readyShot(4),
      shotQuality: 3,
      rng: { s: rngStateForRoll[readyShot(4).keeperDC - 4 - 3]! },
    };

    const step = applyDiceAction(DICE_CARD_MAP, before, { type: "SHOOT" });
    expect(step.events).toContainEqual({ type: "CORNER_EARNED", margin: 4 });
    expect(step.state.corner).toBe(true);
  });

  it("lets the player clear an unplayable corner without taking a shot", () => {
    const before = { ...readyShot(4), corner: true, hand: [], dice: [] };
    const step = applyDiceAction(DICE_CARD_MAP, before, { type: "END_ROUND" });

    expect(step.events.some((event) => event.type === "SHOT_TAKEN")).toBe(false);
    expect(step.state.round).toBeGreaterThan(before.round);
    expect(step.state.corner).toBe(false);
  });

  it("applies the rattled keeper DC once and clears it after a regular shot", () => {
    const before = {
      ...readyShot(2),
      keeperRattled: true,
      rng: { s: rngStateForRoll[readyShot(2).keeperDC - 2]! },
    };

    expect(shotEstimate(before).dc).toBe(before.keeperDC - 2);
    const step = applyDiceAction(DICE_CARD_MAP, before, { type: "SHOOT" });
    expect(step.events).toContainEqual(
      expect.objectContaining({ type: "SHOT_TAKEN", dc: before.keeperDC - 2, goal: true }),
    );
    expect(step.state.keeperRattled).toBe(false);
  });

  it("applies rattled once to your counter shot and clears it", () => {
    const before = {
      ...start(["d_tackle"], "rattled-counter"),
      round: 2,
      possession: "them" as const,
      keeperRattled: true,
      defenseCommit: 0.9,
      rng: { s: 0 }, // their challenged pass fails, then your counter resolves
      hand: [],
      dice: [],
    };

    const step = applyDiceAction(DICE_CARD_MAP, before, { type: "END_ROUND" });
    expect(step.events).toContainEqual(
      expect.objectContaining({ type: "COUNTER_SHOT", byYou: true, dc: before.keeperDC - 2 }),
    );
    expect(step.state.keeperRattled).toBe(false);
  });

  it("never chains another corner from the automatic corner header", () => {
    const before = {
      ...readyShot(4),
      corner: true,
      rng: { s: 18 }, // header misses by 4
      dice: [{ value: 4, used: false }],
      hand: [inst("d_drivingrun", 0)],
    };

    const step = applyDiceAction(DICE_CARD_MAP, before, {
      type: "ASSIGN_DIE",
      uid: before.hand[0]!.uid,
      dieIndex: 0,
    });

    expect(step.events).toContainEqual(
      expect.objectContaining({ type: "SHOT_TAKEN", corner: true, goal: false }),
    );
    expect(step.events.some((event) => event.type === "CORNER_EARNED")).toBe(false);
    expect(step.state.round).toBeGreaterThan(before.round);
    expect(step.state.corner).toBe(false);
  });
});

describe("their chain", () => {
  function theirRound(defIds: string[], seed = "def"): DiceMatchState {
    let m = start(defIds, seed);
    m = applyDiceAction(DICE_CARD_MAP, m, { type: "END_ROUND" }).state;
    expect(m.possession).toBe("them");
    return m;
  }

  it("possession alternates: round 1 yours, round 2 theirs", () => {
    const m = theirRound(["d_tackle", "d_tackle", "d_tackle", "d_tackle"]);
    expect(m.round).toBe(2);
    expect(m.oppPasses).toBe(0);
  });

  it("standing off lets their chain advance one pass", () => {
    const m = theirRound(["d_tackle", "d_tackle", "d_tackle", "d_tackle"], "standoff");
    const step = applyDiceAction(DICE_CARD_MAP, m, { type: "END_ROUND" });
    const advanced = step.events.some((e) => e.type === "OPP_PASS");
    const picked = step.events.some((e) => e.type === "CHAIN_INTERCEPTED" && e.byYou);
    expect(advanced || picked).toBe(true);
    if (advanced) expect(step.state.ball).toBeLessThan(m.ball);
  });

  it("committing a defensive card raises their risk and their next pass happens", () => {
    let m = theirRound(["d_tackle", "d_tackle", "d_tackle", "d_tackle"], "commit");
    m = { ...m, dice: [{ value: 2, used: false }], hand: [inst("d_tackle", 0)] };
    const step = applyDiceAction(DICE_CARD_MAP, m, { type: "ASSIGN_DIE", uid: m.hand[0]!.uid, dieIndex: 0 });
    const committed = step.events.find((e) => e.type === "DEFENSE_COMMITTED");
    expect(committed).toMatchObject({ type: "DEFENSE_COMMITTED", amount: 0.18, total: 0.18 });
    expect(step.events.some((e) => e.type === "OPP_PASS" || e.type === "CHAIN_INTERCEPTED")).toBe(true);
  });

  it("emits OPP_PASS_CHALLENGED before resolving their pass", () => {
    let m = theirRound(["d_tackle", "d_tackle", "d_tackle", "d_tackle"], "opp-pressure");
    m = {
      ...m,
      rng: seedRng("s-32"),
      defenseCommit: 0.18,
    };
    const step = applyDiceAction(DICE_CARD_MAP, m, { type: "END_ROUND" });
    const challenged = step.events.find((e) => e.type === "OPP_PASS_CHALLENGED");

    expect(challenged).toEqual({ type: "OPP_PASS_CHALLENGED", roll: 13, pressure: 5, survived: true });
    expect(step.events.findIndex((e) => e.type === "OPP_PASS_CHALLENGED")).toBeLessThan(
      step.events.findIndex((e) => e.type === "OPP_PASS"),
    );
  });

  it("attack cards cannot be played on their possession", () => {
    const m = theirRound(["d_shortpass", "d_shortpass", "d_shortpass", "d_shortpass"], "wrongrole");
    const playable = playableCards(DICE_CARD_MAP, m);
    expect(playable.size).toBe(0);
    expect(() => applyDiceAction(DICE_CARD_MAP, m, { type: "ASSIGN_DIE", uid: m.hand[0]!.uid, dieIndex: 0 })).toThrow();
  });

  it("winning the interception gives you an instant counter shot", () => {
    let saw = false;
    for (const seed of ["c1", "c2", "c3", "c4", "c5", "c6"]) {
      let m = theirRound(["d_tackle", "d_tackle", "d_tackle", "d_tackle"], seed);
      m = { ...m, defenseCommit: 0.9 };
      const step = applyDiceAction(DICE_CARD_MAP, m, { type: "END_ROUND" });
      const counter = step.events.find((e) => e.type === "COUNTER_SHOT");
      if (counter) {
        saw = true;
        expect(counter).toMatchObject({ byYou: true });
        break;
      }
    }
    expect(saw).toBe(true);
  });
});

describe("nation mutators", () => {
  it("Brazil: rerollDie gives a per-round budget and reroll changes the die", () => {
    let m = start(["d_shortpass", "d_shortpass", "d_shortpass", "d_shortpass", "d_shortpass"], "bra", [
      { kind: "rerollDie", perRound: 1 },
    ]);
    expect(m.rerollDieLeft).toBe(1);
    const before = m.dice[0]!.value;
    m = applyDiceAction(DICE_CARD_MAP, m, { type: "REROLL_DIE", dieIndex: 0 }).state;
    expect(m.rerollDieLeft).toBe(0);
    expect(typeof m.dice[0]!.value).toBe("number");
    void before;
    expect(() => applyDiceAction(DICE_CARD_MAP, m, { type: "REROLL_DIE", dieIndex: 1 })).toThrow(/no rerolls/);
  });

  it("keeperDcDelta raises the keeper DC", () => {
    const plain = start(["d_shortpass"], "dc");
    const brazil = start(["d_shortpass"], "dc", [{ kind: "keeperDcDelta", amount: 2 }]);
    expect(brazil.keeperDC).toBe(plain.keeperDC + 2);
  });

  it("poolDelta adds dice", () => {
    const mex = start(["d_shortpass"], "pool", [{ kind: "poolDelta", amount: 1 }]);
    expect(mex.dice).toHaveLength(DEFAULT_BALANCE.DICE.POOL_SIZE + 1);
  });

  it("USA counterSpring improves your instant counter shot", () => {
    let m = start(["d_tackle", "d_tackle", "d_tackle", "d_tackle"], "usa", [{ kind: "counterSpring", amount: 3 }]);
    m = applyDiceAction(DICE_CARD_MAP, m, { type: "END_ROUND" }).state;
    expect(m.possession).toBe("them");
    m = { ...m, defenseCommit: 0.9, rng: seedRng("usa-counter") };
    const step = applyDiceAction(DICE_CARD_MAP, m, { type: "END_ROUND" });
    const counter = step.events.find((e) => e.type === "COUNTER_SHOT");
    expect(counter).toMatchObject({ byYou: true, bonus: DEFAULT_BALANCE.DICE.COUNTER_CHANCE + 3 });
  });

  it("Canada keeps Resolute defense with a one-DC finishing tax", () => {
    const plain = start(["d_clearance"], "can");
    const mutators = makeContent().nationDiceKits?.can?.mutators ?? [];
    const canada = start(["d_clearance"], "can", mutators);
    expect(oppInterceptionRisk(canada)).toBeCloseTo(oppInterceptionRisk(plain) + 0.04, 5);
    expect(canada.keeperDC).toBe(plain.keeperDC + 1);
  });

  it("a used die cannot be rerolled", () => {
    let m = start(["d_shortpass", "d_shortpass", "d_shortpass", "d_shortpass", "d_shortpass"], "ru", [
      { kind: "rerollDie", perRound: 1 },
    ]);
    const slot = DICE_CARD_MAP["d_shortpass"]!.slot!;
    const dieIndex = m.dice.findIndex((d) => dieFitsSlot(d.value, slot));
    expect(dieIndex).toBeGreaterThanOrEqual(0);
    m = applyDiceAction(DICE_CARD_MAP, m, { type: "ASSIGN_DIE", uid: m.hand[0]!.uid, dieIndex }).state;
    expect(() => applyDiceAction(DICE_CARD_MAP, m, { type: "REROLL_DIE", dieIndex })).toThrow(/already used/);
  });
});

describe("match terminates", () => {
  it("ends a regulation lead at full time without a push decision", () => {
    const m = {
      ...start(["d_shortpass"], "full-time-lead"),
      round: DEFAULT_BALANCE.MATCH_ROUNDS,
      possession: "you" as const,
      playerGoals: 1,
      oppGoals: 0,
      hand: [],
      dice: [],
    };

    const step = applyDiceAction(DICE_CARD_MAP, m, { type: "END_ROUND" });

    expect(step.state.phase).toBe("DONE");
    expect(step.state.result).toBe("win");
    expect(step.events).toContainEqual({ type: "MATCH_END", result: "win", playerGoals: 1, oppGoals: 0 });
    expect(step.events.some((event) => event.type === "PUSH_DECISION")).toBe(false);
  });

  it("takes a tied knockout through golden-goal extra time and then a shootout", () => {
    const regulation = {
      ...start(["d_shortpass"], "golden-goal-shootout"),
      context: "knockout" as const,
      round: DEFAULT_BALANCE.MATCH_ROUNDS,
      possession: "you" as const,
      playerGoals: 0,
      oppGoals: 0,
      hand: [],
      dice: [],
    };

    let step = applyDiceAction(DICE_CARD_MAP, regulation, { type: "END_ROUND" });
    expect(step.state.mode).toBe("suddendeath");
    expect(step.state.phase).toBe("ROUND_ACTIVE");
    expect(step.events).toContainEqual({ type: "SUDDEN_DEATH_START" });

    for (let round = 0; round < DEFAULT_BALANCE.MAX_SUDDEN_DEATH_ROUNDS; round++) {
      step = applyDiceAction(
        DICE_CARD_MAP,
        { ...step.state, possession: "you", hand: [], dice: [], playerGoals: 0, oppGoals: 0 },
        { type: "END_ROUND" },
      );
    }

    expect(step.state.phase).toBe("DONE");
    expect(step.events.some((event) => event.type === "SHOOTOUT")).toBe(true);
    expect(step.events.some((event) => event.type === "MATCH_END")).toBe(true);
  });

  it("a full dice match reaches DONE", () => {
    let m = start(
      Array.from({ length: 18 }, (_, i) => (i % 5 === 0 ? "d_finish" : i % 4 === 0 ? "d_tackle" : "d_shortpass")),
      "term",
    );
    for (let guard = 0; guard < 300 && m.phase !== "DONE"; guard++) {
      if (m.possession === "you" && m.passes >= 1 && m.shotQuality > 0) {
        m = applyDiceAction(DICE_CARD_MAP, m, { type: "SHOOT" }).state;
        continue;
      }
      const card = m.hand.find((c) => playableCards(DICE_CARD_MAP, m).has(c.uid));
      if (card) m = playWith(m, card.defId);
      else m = applyDiceAction(DICE_CARD_MAP, m, { type: "END_ROUND" }).state;
    }
    expect(m.phase).toBe("DONE");
    expect(["win", "draw", "loss"]).toContain(m.result);
  });
});

describe("projectedShotEstimate", () => {
  it("with no staged plays it equals the live estimate", () => {
    const m = start(["d_shortpass", "d_finish", "d_poacher", "d_sideways"]);
    expect(projectedShotEstimate(DICE_CARD_MAP, m, [])).toEqual(shotEstimate(m));
  });

  it("matches the real estimate after a risk-free first pass", () => {
    const m = start(["d_shortpass", "d_finish", "d_poacher", "d_sideways"], "project-1");
    const card = m.hand.find((c) => c.defId === "d_shortpass")!;
    const slot = DICE_CARD_MAP.d_shortpass!.slot!;
    const dieIndex = m.dice.findIndex((d) => !d.used && dieFitsSlot(d.value, slot));
    expect(dieIndex).toBeGreaterThanOrEqual(0);
    const projected = projectedShotEstimate(DICE_CARD_MAP, m, [{ uid: card.uid, dieIndex }]);
    const after = playWith(m, "d_shortpass");
    expect(after.passes).toBe(1); // first pass is always free
    expect(projected).toEqual(shotEstimate(after));
  });

  it("stacks development gain and ball movement across staged plays", () => {
    const m = start(["d_shortpass", "d_poacher", "d_finish", "d_sideways"], "project-2");
    const pass = m.hand.find((c) => c.defId === "d_shortpass")!;
    const poacher = m.hand.find((c) => c.defId === "d_poacher")!;
    const passSlot = DICE_CARD_MAP.d_shortpass!.slot!;
    const poacherSlot = DICE_CARD_MAP.d_poacher!.slot!;
    const passDie = m.dice.findIndex((d) => !d.used && dieFitsSlot(d.value, passSlot));
    const poacherDie = m.dice.findIndex(
      (d, i) => i !== passDie && !d.used && dieFitsSlot(d.value, poacherSlot),
    );
    expect(passDie).toBeGreaterThanOrEqual(0);
    expect(poacherDie).toBeGreaterThanOrEqual(0);

    const projected = projectedShotEstimate(DICE_CARD_MAP, m, [
      { uid: pass.uid, dieIndex: passDie },
      { uid: poacher.uid, dieIndex: poacherDie },
    ]);

    // hand-computed: short pass moves the ball by the die (progressFromDie),
    // then poacher banks 5 + combo + passes(1) * DEVELOPMENT_GAIN
    const passEffects = effectsFor(DICE_CARD_MAP.d_shortpass!, 0);
    const progress = passEffects.reduce(
      (a, e) => (e.kind === "progress" ? a + e.amount : e.kind === "progressFromDie" ? a + m.dice[passDie]!.value : a),
      0,
    );
    const combo = comboFor(
      DICE_CARD_MAP.d_shortpass!.position ?? null,
      DICE_CARD_MAP.d_poacher!.position!,
    );
    const quality = 5 + (combo?.chance ?? 0) + 1 * DEFAULT_BALANCE.DICE.DEVELOPMENT_GAIN;
    const expected = shotEstimate({ ...m, ball: m.ball + progress, shotQuality: quality });
    expect(projected).toEqual(expected);
  });
});
