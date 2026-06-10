import { describe, expect, it } from "vitest";
import { computeAttack, type AttackCard } from "./scoring";
import type { CardDef, CardInstance } from "../types";

function card(def: Partial<CardDef> & { id: string }, level: 0 | 1 | 2 = 0, formPower = 0): AttackCard {
  const fullDef: CardDef = {
    kind: "player",
    name: def.id,
    rarity: "common",
    levels: [{ text: "" }],
    effects: [],
    ...def,
  };
  const inst: CardInstance = { uid: `u-${def.id}`, defId: def.id, level, formPower, fatigued: false };
  return { inst, def: fullDef };
}

const baseCtx = {
  handSizeAfter: 3,
  leading: false,
  trailing: false,
  multCap: null,
  goalThreshold: 25,
  plays: [],
};

const striker = () =>
  card({ id: "st", position: "ST", levels: [{ power: 12, text: "" }] });
const metronome = () =>
  card({
    id: "mf",
    position: "MF",
    levels: [{ power: 4, text: "" }],
    effects: [{ trigger: "onPlay", op: { kind: "addMult", amount: 0.25 } }],
  });
const winger = () =>
  card({
    id: "wg",
    position: "WG",
    levels: [{ power: 8, text: "" }],
    effects: [
      {
        trigger: "onPlay",
        condition: { kind: "attackIncludesPosition", position: "ST" },
        op: { kind: "addMult", amount: 0.25 },
      },
    ],
  });
const throughBall = () =>
  card({
    id: "tac",
    kind: "tactic",
    levels: [{ text: "" }],
    effects: [{ trigger: "onPlay", op: { kind: "mulMult", amount: 1.5 } }],
  });

describe("computeAttack", () => {
  it("single striker: 12 power, no goal", () => {
    const out = computeAttack([striker()], baseCtx);
    expect(out.value).toBe(12);
    expect(out.goals).toBe(0);
  });

  it("striker + metronome: additive mult", () => {
    const out = computeAttack([striker(), metronome()], baseCtx);
    expect(out.basePower).toBe(16);
    expect(out.totalMult).toBe(1.25);
    expect(out.value).toBe(20);
    expect(out.goals).toBe(0);
  });

  it("striker + winger + through ball: (12+8) x 1.25 x 1.5 = 37 -> 1 goal", () => {
    const out = computeAttack([striker(), winger(), throughBall()], baseCtx);
    expect(out.basePower).toBe(20);
    expect(out.totalMult).toBe(1.875);
    expect(out.value).toBe(37);
    expect(out.goals).toBe(1);
  });

  it("winger synergy condition fails without a striker", () => {
    const out = computeAttack([winger(), metronome()], baseCtx);
    expect(out.totalMult).toBe(1.25); // only the metronome's mult applies
  });

  it("mult cap clamps the total multiplier", () => {
    const screamer = card({
      id: "mom",
      kind: "moment",
      levels: [{ text: "" }],
      effects: [{ trigger: "onPlay", op: { kind: "mulMult", amount: 2 } }],
    });
    const out = computeAttack(
      [striker(), metronome(), metronome(), screamer],
      { ...baseCtx, multCap: 2 },
    );
    // uncapped would be (1 + 0.5) x 2 = 3
    expect(out.totalMult).toBe(2);
  });

  it("formPower contributes to base power", () => {
    const out = computeAttack([card({ id: "st", position: "ST", levels: [{ power: 12, text: "" }] }, 0, 13)], baseCtx);
    expect(out.basePower).toBe(25);
    expect(out.goals).toBe(1);
  });

  it("perLevel scaling multiplies the amount", () => {
    const longBall = (level: 0 | 1 | 2) =>
      card(
        {
          id: "lb",
          kind: "tactic",
          levels: [{ text: "" }, { text: "" }, { text: "" }],
          effects: [
            { trigger: "onPlay", op: { kind: "addPower", amount: 8 }, scaling: "perLevel" },
          ],
        },
        level,
      );
    expect(computeAttack([striker(), longBall(0)], baseCtx).basePower).toBe(20);
    expect(computeAttack([striker(), longBall(2)], baseCtx).basePower).toBe(36);
  });

  it("onGoal gainFormPower scales with goals scored", () => {
    const finisher = card({
      id: "fin",
      position: "ST",
      levels: [{ power: 50, text: "" }],
      effects: [{ trigger: "onGoal", op: { kind: "gainFormPower", amount: 3 } }],
    });
    const out = computeAttack([finisher], baseCtx);
    expect(out.goals).toBe(2);
    expect(out.formGains).toEqual([{ uid: "u-fin", amount: 6 }]);
  });

  it("attackCardCount condition gates the poacher bonus", () => {
    const poacher = () =>
      card({
        id: "po",
        position: "ST",
        levels: [{ power: 12, text: "" }],
        effects: [
          {
            trigger: "onPlay",
            condition: { kind: "attackCardCount", cmp: "lte", value: 2 },
            op: { kind: "addPower", amount: 4 },
          },
        ],
      });
    expect(computeAttack([poacher()], baseCtx).basePower).toBe(16);
    expect(
      computeAttack([poacher(), metronome(), metronome(), metronome()], baseCtx).basePower,
    ).toBe(24); // 12 + 4 + 4 + 4, no bonus
  });
});
