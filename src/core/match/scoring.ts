// Pure attack resolution: committed cards in, shot value / goals / side effects out.
// ShotValue = (Σ power + formPower + flat bonuses) × (1 + Σ addMult) × Π mulMult
// Goals = floor(ShotValue / GOAL_THRESHOLD); excess is wasted.

import {
  levelStats,
  type CardDef,
  type CardInstance,
  type Condition,
} from "../types";

export interface AttackCard {
  inst: CardInstance;
  def: CardDef;
}

export interface AttackContext {
  handSizeAfter: number; // hand size once the committed cards are removed
  leading: boolean;
  trailing: boolean;
  multCap: number | null;
  goalThreshold: number;
}

export interface AttackOutcome {
  basePower: number;
  addMult: number;
  mulMult: number;
  totalMult: number; // after cap
  value: number; // floored shot value
  goals: number;
  draws: number; // cards to draw after the attack
  budget: number;
  scout: number;
  formGains: { uid: string; amount: number }[];
}

function cmp(op: "lte" | "gte", a: number, b: number): boolean {
  return op === "lte" ? a <= b : a >= b;
}

export function evalCondition(
  cond: Condition,
  cards: AttackCard[],
  ctx: AttackContext,
): boolean {
  switch (cond.kind) {
    case "attackIncludesPosition":
      return cards.some((c) => c.def.position === cond.position);
    case "attackCardCount":
      return cmp(cond.cmp, cards.length, cond.value);
    case "handSize":
      return cmp(cond.cmp, ctx.handSizeAfter, cond.value);
    case "leading":
      return ctx.leading;
    case "trailing":
      return ctx.trailing;
  }
}

function scaledAmount(amount: number, scaling: "perLevel" | undefined, level: number): number {
  return scaling === "perLevel" ? amount * (level + 1) : amount;
}

export function computeAttack(cards: AttackCard[], ctx: AttackContext): AttackOutcome {
  let basePower = 0;
  let addMult = 0;
  let mulMult = 1;
  let draws = 0;
  let budget = 0;
  let scout = 0;

  for (const c of cards) {
    basePower += (levelStats(c.def, c.inst.level).power ?? 0) + c.inst.formPower;
  }

  for (const c of cards) {
    for (const eff of c.def.effects) {
      if (eff.trigger !== "onPlay") continue;
      if (eff.condition && !evalCondition(eff.condition, cards, ctx)) continue;
      const op = eff.op;
      switch (op.kind) {
        case "addPower":
          basePower += scaledAmount(op.amount, eff.scaling, c.inst.level);
          break;
        case "addMult":
          addMult += scaledAmount(op.amount, eff.scaling, c.inst.level);
          break;
        case "mulMult":
          mulMult *= op.amount;
          break;
        case "draw":
          draws += op.amount;
          break;
        case "gainResource":
          if (op.resource === "budget") budget += op.amount;
          else scout += op.amount;
          break;
        case "gainFormPower":
        case "scripted":
          break; // gainFormPower belongs on onGoal; scripted is style-level
      }
    }
  }

  let totalMult = (1 + addMult) * mulMult;
  if (ctx.multCap !== null) totalMult = Math.min(totalMult, ctx.multCap);

  const value = Math.floor(basePower * totalMult);
  const goals = Math.floor(value / ctx.goalThreshold);

  const formGains: { uid: string; amount: number }[] = [];
  if (goals > 0) {
    for (const c of cards) {
      for (const eff of c.def.effects) {
        if (eff.trigger !== "onGoal") continue;
        if (eff.condition && !evalCondition(eff.condition, cards, ctx)) continue;
        const op = eff.op;
        if (op.kind === "gainFormPower") {
          formGains.push({
            uid: c.inst.uid,
            amount: scaledAmount(op.amount, eff.scaling, c.inst.level) * goals,
          });
        } else if (op.kind === "gainResource") {
          if (op.resource === "budget") budget += op.amount * goals;
          else scout += op.amount * goals;
        }
      }
    }
  }

  return { basePower, addMult, mulMult, totalMult, value, goals, draws, budget, scout, formGains };
}
