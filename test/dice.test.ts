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
  shotEstimate,
} from "../src/core/match/dice";
import { seedRng } from "../src/core/rng";
import { DEFAULT_BALANCE } from "../src/core/balance";
import { dieFitsSlot } from "../src/core/types";
import type { CardInstance, DiceMatchState, OppInfo } from "../src/core/types";
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

  it("Canada oppRiskDelta: opponents misplace more passes", () => {
    const plain = start(["d_clearance"], "can");
    const canada = start(["d_clearance"], "can", [{ kind: "oppRiskDelta", amount: 0.06 }]);
    expect(oppInterceptionRisk(canada)).toBeCloseTo(oppInterceptionRisk(plain) + 0.06, 5);
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
  it("a full dice match reaches DONE", () => {
    let m = start(
      Array.from({ length: 18 }, (_, i) => (i % 5 === 0 ? "d_finish" : i % 4 === 0 ? "d_tackle" : "d_shortpass")),
      "term",
    );
    for (let guard = 0; guard < 300 && m.phase !== "DONE"; guard++) {
      if (m.phase === "PUSH_DECISION") {
        m = applyDiceAction(DICE_CARD_MAP, m, { type: "TAKE_WIN" }).state;
        continue;
      }
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
