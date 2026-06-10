// Bot strategies for the balance sim — combat mode (stamina / intents / block).

import { cardCost, levelStats } from "../core/types";
import type {
  CardInstance,
  ContentBundle,
  MatchAction,
  MatchState,
  RunAction,
  RunState,
} from "../core/types";
import type { Bot } from "./bot";

function power(content: ContentBundle, c: CardInstance): number {
  return (levelStats(content.defs[c.defId]!, c.level).power ?? 0) + c.formPower;
}

function defense(content: ContentBundle, c: CardInstance): number {
  return levelStats(content.defs[c.defId]!, c.level).defense ?? 0;
}

function cost(content: ContentBundle, c: CardInstance): number {
  return cardCost(content.defs[c.defId]!);
}

function isTactic(content: ContentBundle, c: CardInstance): boolean {
  return power(content, c) === 0 && defense(content, c) === 0;
}

/** Incoming damage if we end the round now. */
function incomingThreat(m: MatchState): number {
  const i = m.intent;
  if (!i) return 0;
  const et = m.mode === "extratime" ? m.bal.EXTRA_TIME_CLOCK_MULT : 1;
  if (i.kind === "attack") return Math.max(0, Math.round(i.points * et) - m.block);
  if (i.kind === "counter") {
    const attacks = m.playedThisRound.filter((p) => p.isAttack).length;
    return attacks < 2 ? Math.max(0, Math.round(i.points * et) - m.block) : 0;
  }
  return 0;
}

function combatAction(
  content: ContentBundle,
  m: MatchState,
  opts: { blockBias: number; pushLead: number },
): MatchAction {
  if (m.phase === "PUSH_DECISION") {
    const lead = m.playerGoals - m.oppGoals;
    if (lead >= opts.pushLead && m.extraRoundsPlayed < m.bal.MAX_EXTRA_ROUNDS) {
      return { type: "EXTRA_TIME" };
    }
    return { type: "TAKE_WIN" };
  }

  const affordable = m.hand.filter((c) => cost(content, c) <= m.stamina);
  if (affordable.length === 0) return { type: "END_ROUND" };

  const threat = incomingThreat(m);

  // block a real threat first (threat worth ~blockBias of a goal)
  if (threat >= m.bal.GOAL_THRESHOLD * opts.blockBias) {
    const blocker = affordable
      .filter((c) => defense(content, c) > 0)
      .sort((a, b) => defense(content, b) - defense(content, a))[0];
    if (blocker) return { type: "PLAY_CARD", uid: blocker.uid };
  }

  // tactic first if an attack card can cash the buff afterwards
  const tactic = affordable.find((c) => isTactic(content, c));
  if (tactic && m.pendingMult === 1 && m.pendingFlat === 0) {
    const after = m.stamina - cost(content, tactic);
    const cashable = m.hand.some(
      (c) => c !== tactic && power(content, c) > 0 && cost(content, c) <= after,
    );
    if (cashable) return { type: "PLAY_CARD", uid: tactic.uid };
  }

  // best attacker by points per stamina
  const attacker = affordable
    .filter((c) => power(content, c) > 0)
    .sort(
      (a, b) =>
        power(content, b) / Math.max(1, cost(content, b)) -
        power(content, a) / Math.max(1, cost(content, a)),
    )[0];
  if (attacker) return { type: "PLAY_CARD", uid: attacker.uid };

  // nothing useful to attack with: bank block if threatened at all
  if (threat > 0) {
    const blocker = affordable
      .filter((c) => defense(content, c) > 0)
      .sort((a, b) => defense(content, b) - defense(content, a))[0];
    if (blocker) return { type: "PLAY_CARD", uid: blocker.uid };
  }
  return { type: "END_ROUND" };
}

// ---------- run-policy (unchanged economy heuristics) ----------

function rewardScore(content: ContentBundle, defId: string): number {
  const def = content.defs[defId]!;
  const rarityScore = def.rarity === "legendary" ? 40 : def.rarity === "rare" ? 20 : 0;
  const stats = levelStats(def, 0);
  return rarityScore + (stats.power ?? 0) + (stats.defense ?? 0) * 1.2;
}

function greedyRunAction(content: ContentBundle, r: RunState): RunAction {
  if (r.phase === "REWARD" && r.pendingReward) {
    let bestIdx = 0;
    let bestScore = -1;
    r.pendingReward.defIds.forEach((defId, i) => {
      const s = rewardScore(content, defId);
      if (s > bestScore) {
        bestScore = s;
        bestIdx = i;
      }
    });
    return { type: "PICK_REWARD", index: bestIdx };
  }

  if (r.phase === "IDLE") {
    const prices = content.balance.SHOP_PRICES;
    if (r.shop && r.resources.budget >= prices.train + 10) {
      const trainable = r.deck
        .filter((c) => {
          const def = content.defs[c.defId]!;
          const maxLevel = Math.min(content.balance.TRAIN_MAX_LEVEL, def.levels.length - 1);
          return c.level < maxLevel && (levelStats(def, c.level).power ?? 0) >= 8;
        })
        .sort(
          (a, b) =>
            (levelStats(content.defs[b.defId]!, b.level).power ?? 0) -
            (levelStats(content.defs[a.defId]!, a.level).power ?? 0),
        )[0];
      if (trainable) return { type: "TRAIN_CARD", uid: trainable.uid };
    }
    if (r.shop && r.deck.length < 24) {
      const idx = r.shop.cards.findIndex(
        (slot) =>
          !slot.sold &&
          r.resources.budget >= slot.price &&
          rewardScore(content, slot.defId) >= 20,
      );
      if (idx !== -1) return { type: "BUY_CARD", index: idx };
    }
    return { type: "START_MATCH" };
  }

  throw new Error(`bot has no action for phase ${r.phase}`);
}

// ---------- the strategies ----------

export function makeGreedyBot(): Bot {
  return {
    name: "greedy",
    matchAction: (content, m) => combatAction(content, m, { blockBias: 0.35, pushLead: 2 }),
    runAction: greedyRunAction,
  };
}

export function makeDefensiveBot(): Bot {
  return {
    name: "defensive",
    matchAction: (content, m) => combatAction(content, m, { blockBias: 0.15, pushLead: 99 }),
    runAction: greedyRunAction,
  };
}

export function makePushLuckyBot(): Bot {
  return {
    name: "pushlucky",
    matchAction: (content, m) => combatAction(content, m, { blockBias: 0.35, pushLead: 1 }),
    runAction: greedyRunAction,
  };
}

export function makeRandomBot(): Bot {
  return {
    name: "random",
    matchAction: (content, m) => {
      if (m.phase === "PUSH_DECISION") {
        return (m.playerGoals + m.round) % 2 === 0 ? { type: "EXTRA_TIME" } : { type: "TAKE_WIN" };
      }
      const affordable = m.hand.filter((c) => cost(content, c) <= m.stamina);
      if (affordable.length === 0 || (m.round + m.hand.length) % 4 === 0) {
        return { type: "END_ROUND" };
      }
      const pick = affordable[(m.round * 7 + m.hand.length) % affordable.length]!;
      return { type: "PLAY_CARD", uid: pick.uid };
    },
    runAction: (_content, r) => {
      if (r.phase === "REWARD" && r.pendingReward) {
        return { type: "PICK_REWARD", index: r.deck.length % r.pendingReward.defIds.length };
      }
      if (r.phase === "IDLE") return { type: "START_MATCH" };
      throw new Error(`bot has no action for phase ${r.phase}`);
    },
  };
}

export const STRATEGIES: Record<string, () => Bot> = {
  greedy: makeGreedyBot,
  defensive: makeDefensiveBot,
  pushlucky: makePushLuckyBot,
  random: makeRandomBot,
};
