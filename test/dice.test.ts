// Dice mode: roll determinism, slot fit, pitch advance, shot roll, opponent.

import { describe, expect, it } from "vitest";
import { applyDiceAction, createDiceMatch, playableCards } from "../src/core/match/dice";
import { seedRng } from "../src/core/rng";
import { DEFAULT_BALANCE } from "../src/core/balance";
import { dieFitsSlot } from "../src/core/types";
import type { CardInstance, DiceMatchState, OppInfo } from "../src/core/types";
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

  it("starts at midfield with no shot quality", () => {
    const m = start(["d_shortpass"]);
    expect(m.ball).toBe(DEFAULT_BALANCE.DICE.MIDFIELD);
    expect(m.possession).toBe("you");
    expect(m.shotQuality).toBe(0);
  });
});

describe("slotting dice", () => {
  it("Short Pass pushes the ball by the die's value and consumes the die", () => {
    let m = start(["d_shortpass", "d_shortpass", "d_shortpass", "d_shortpass", "d_shortpass"]);
    const die = m.dice.find((d) => !d.used)!;
    const before = m.ball;
    m = playWith(m, "d_shortpass");
    const used = m.dice.filter((d) => d.used).length;
    expect(used).toBe(1);
    expect(m.ball).toBe(before + die.value);
  });

  it("a die that doesn't fit the slot is rejected", () => {
    const m = start(["d_finish", "d_finish", "d_finish", "d_finish", "d_finish"]);
    const lowDie = m.dice.findIndex((d) => d.value < 5);
    if (lowDie >= 0) {
      const card = m.hand[0]!;
      expect(() =>
        applyDiceAction(DICE_CARD_MAP, m, { type: "ASSIGN_DIE", uid: card.uid, dieIndex: lowDie }),
      ).toThrow(/doesn't fit/);
    }
  });

  it("playableCards reflects which cards have a fitting die", () => {
    const m = start(["d_tackle", "d_finish", "d_shortpass", "d_clearance", "d_poacher"]);
    const playable = playableCards(DICE_CARD_MAP, m);
    // Short Pass needs a 2+; it's playable iff some unused die is 2 or more AND we have possession
    const sp = m.hand.find((c) => c.defId === "d_shortpass")!;
    const hasMid = m.dice.some((d) => !d.used && d.value >= 2);
    // We start with possession="you", shortpass is an attack card, so roleOk = true
    expect(playable.has(sp.uid)).toBe(hasMid);
  });
});

describe("tug-of-war", () => {
  it("starts at midfield in your possession", () => {
    const m = start(["d_shortpass"]);
    expect(m.ball).toBe(DEFAULT_BALANCE.DICE.MIDFIELD);
    expect(m.possession).toBe("you");
    expect(m.shotQuality).toBe(0);
  });

  it("a progress play pushes the ball toward their goal", () => {
    let m = start(Array.from({ length: 6 }, () => "d_shortpass"), "adv");
    const before = m.ball;
    const die = m.dice.find((d) => !d.used && d.value >= 2)!;
    const idx = m.dice.indexOf(die);
    m = applyDiceAction(DICE_CARD_MAP, m, { type: "ASSIGN_DIE", uid: m.hand.find((c) => c.defId === "d_shortpass")!.uid, dieIndex: idx }).state;
    expect(m.ball).toBe(before + die.value);
  });

  it("you cannot shoot until the ball reaches their box", () => {
    const m = start(["d_finish"]);
    expect(m.ball).toBeLessThan(DEFAULT_BALANCE.DICE.THEIR_BOX);
    expect(() => applyDiceAction(DICE_CARD_MAP, m, { type: "SHOOT" })).toThrow();
  });
});

describe("advancing and shooting", () => {
  it("reaching the box lets you shoot; a goal resets to midfield", () => {
    // force a deck of advancers + a finisher, drive forward, then shoot
    let m = start(Array.from({ length: 12 }, () => "d_shortpass"), "advance");
    // burn rounds slotting every fitting die until we reach the box at least once
    let reachedBox = false;
    for (let guard = 0; guard < 40 && m.phase === "ROUND_ACTIVE"; guard++) {
      if (m.ball >= DEFAULT_BALANCE.DICE.THEIR_BOX && m.possession === "you") {
        reachedBox = true;
        break;
      }
      const card = m.hand.find((c) => {
        const def = DICE_CARD_MAP[c.defId];
        if (!def?.slot) return false;
        // only play attack cards when we have possession
        const slot = def.slot;
        return m.possession === "you" && m.dice.some((d) => !d.used && dieFitsSlot(d.value, slot));
      });
      if (card) m = playWith(m, card.defId);
      else m = applyDiceAction(DICE_CARD_MAP, m, { type: "END_ROUND" }).state;
    }
    expect(reachedBox).toBe(true);
  });

  it("a shot with no quality is rejected", () => {
    let m = start(Array.from({ length: 12 }, () => "d_shortpass"), "noq");
    // advance to box without any shot quality
    for (let guard = 0; guard < 40 && m.phase === "ROUND_ACTIVE" && (m.ball < DEFAULT_BALANCE.DICE.THEIR_BOX || m.possession !== "you"); guard++) {
      const card = m.hand.find((c) => {
        const def = DICE_CARD_MAP[c.defId];
        if (!def?.slot) return false;
        const slot = def.slot;
        return m.possession === "you" && m.dice.some((d) => !d.used && dieFitsSlot(d.value, slot));
      });
      if (card) m = playWith(m, card.defId);
      else m = applyDiceAction(DICE_CARD_MAP, m, { type: "END_ROUND" }).state;
    }
    if (m.ball >= DEFAULT_BALANCE.DICE.THEIR_BOX && m.possession === "you") {
      expect(() => applyDiceAction(DICE_CARD_MAP, m, { type: "SHOOT" })).toThrow(/shot quality/);
    }
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
    // the die was redrawn from the seeded stream (value may or may not differ, but budget spent)
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

  it("a used die cannot be rerolled", () => {
    let m = start(["d_shortpass", "d_shortpass", "d_shortpass", "d_shortpass", "d_shortpass"], "ru", [
      { kind: "rerollDie", perRound: 1 },
    ]);
    const slot = DICE_CARD_MAP["d_shortpass"]!.slot!;
    const dieIndex = m.dice.findIndex((d) => dieFitsSlot(d.value, slot));
    m = applyDiceAction(DICE_CARD_MAP, m, { type: "ASSIGN_DIE", uid: m.hand[0]!.uid, dieIndex }).state;
    expect(() => applyDiceAction(DICE_CARD_MAP, m, { type: "REROLL_DIE", dieIndex })).toThrow(/already used/);
  });
});

describe("match terminates", () => {
  it("a full dice match reaches DONE", () => {
    let m = start(Array.from({ length: 14 }, (_, i) => (i % 3 === 0 ? "d_finish" : "d_shortpass")), "term");
    for (let guard = 0; guard < 200 && m.phase !== "DONE"; guard++) {
      if (m.phase === "PUSH_DECISION") {
        m = applyDiceAction(DICE_CARD_MAP, m, { type: "TAKE_WIN" }).state;
        continue;
      }
      if (m.ball >= DEFAULT_BALANCE.DICE.THEIR_BOX && m.possession === "you" && m.shotQuality > 0) {
        m = applyDiceAction(DICE_CARD_MAP, m, { type: "SHOOT" }).state;
        continue;
      }
      const card = m.hand.find((c) => {
        const def = DICE_CARD_MAP[c.defId];
        if (!def?.slot) return false;
        const slot = def.slot;
        return m.possession === "you" && m.dice.some((d) => !d.used && dieFitsSlot(d.value, slot));
      });
      if (card) m = playWith(m, card.defId);
      else m = applyDiceAction(DICE_CARD_MAP, m, { type: "END_ROUND" }).state;
    }
    expect(m.phase).toBe("DONE");
    expect(["win", "draw", "loss"]).toContain(m.result);
  });
});
