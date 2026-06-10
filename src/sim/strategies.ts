// Bot strategies for the balance sim. They reuse the engine's pure scoring
// function to evaluate candidate attacks, so their play quality tracks the
// real rules automatically.

import { computeAttack, type AttackCard } from "../core/match/scoring";
import { defenseRating } from "../core/match/engine";
import { levelStats } from "../core/types";
import type {
  CardInstance,
  ContentBundle,
  MatchAction,
  MatchState,
  RunAction,
  RunState,
} from "../core/types";
import type { Bot } from "./bot";

// ---------- match-policy helpers ----------

function power(content: ContentBundle, c: CardInstance): number {
  return (levelStats(content.defs[c.defId]!, c.level).power ?? 0) + c.formPower;
}

function defense(content: ContentBundle, c: CardInstance): number {
  return levelStats(content.defs[c.defId]!, c.level).defense ?? 0;
}

function toAttackCards(content: ContentBundle, cards: CardInstance[]): AttackCard[] {
  return cards.map((inst) => ({ inst, def: content.defs[inst.defId]! }));
}

function evaluate(content: ContentBundle, m: MatchState, cards: CardInstance[]) {
  return computeAttack(toAttackCards(content, cards), {
    handSizeAfter: m.hand.length - cards.length,
    leading: m.playerGoals > m.oppGoals,
    trailing: m.playerGoals < m.oppGoals,
    multCap: m.multCap,
    goalThreshold: m.bal.GOAL_THRESHOLD,
    plays: m.plays,
  });
}

/** Try a handful of candidate combos and return the best (goals, then value). */
function bestAttack(
  content: ContentBundle,
  m: MatchState,
): { cards: CardInstance[]; goals: number; value: number } | null {
  const powerCards = m.hand
    .filter((c) => power(content, c) > 0)
    .sort((a, b) => power(content, b) - power(content, a));
  if (powerCards.length === 0) return null;
  const tactics = m.hand.filter(
    (c) => power(content, c) === 0 && content.defs[c.defId]!.kind !== "player",
  );

  const candidates: CardInstance[][] = [];
  for (let k = 1; k <= Math.min(m.bal.MAX_ATTACK_CARDS, powerCards.length); k++) {
    candidates.push(powerCards.slice(0, k));
  }
  for (const t of tactics) {
    candidates.push([...powerCards.slice(0, m.bal.MAX_ATTACK_CARDS - 1), t]);
    if (tactics.length >= 2) {
      const others = tactics.filter((x) => x !== t).slice(0, 1);
      candidates.push([...powerCards.slice(0, m.bal.MAX_ATTACK_CARDS - 2), t, ...others]);
    }
  }

  // play-directed candidates: hunt the named combos like a human would
  const byPos = (pos: string) =>
    powerCards.filter((c) => content.defs[c.defId]!.position === pos);
  const st = byPos("ST");
  const wg = byPos("WG");
  const mf = byPos("MF");
  const df = m.hand.filter(
    (c) => content.defs[c.defId]!.position === "DF" && power(content, c) > 0,
  );
  const top = (arr: CardInstance[], n: number) => arr.slice(0, n);
  const playShapes: CardInstance[][] = [
    [...top(wg, 1), ...top(st, 1)], // counter / wing play
    [...top(mf, 1), ...top(st, 1)], // through ball
    [...top(mf, 2)], // one-two
    [...top(mf, 3)], // tiki-taka
    [...top(mf, 3), ...top(st, 1)], // tiki-taka + finisher
    [...top(df, 1), ...top(wg, 1), ...top(st, 1)], // overlap
    [...top(st, 1), ...top(wg, 1), ...top(mf, 1), ...top(df, 1)], // total football
    [...top(wg, 1), ...top(st, 1), ...tactics.slice(0, 1)], // wing play + tactic
  ];
  for (const shape of playShapes) {
    if (shape.length > 0 && shape.length <= m.bal.MAX_ATTACK_CARDS) candidates.push(shape);
  }

  let best: { cards: CardInstance[]; goals: number; value: number } | null = null;
  for (const cards of candidates) {
    if (cards.length === 0 || cards.length > m.bal.MAX_ATTACK_CARDS) continue;
    const out = evaluate(content, m, cards);
    if (!best || out.goals > best.goals || (out.goals === best.goals && out.value > best.value)) {
      best = { cards, goals: out.goals, value: out.value };
    }
  }
  return best;
}

function bestDefenders(content: ContentBundle, m: MatchState): CardInstance[] {
  const slots = Math.max(0, m.bal.MAX_DEPLOYED - m.deployed.length);
  return m.hand
    .filter((c) => defense(content, c) > 0)
    .sort((a, b) => defense(content, b) - defense(content, a))
    .slice(0, Math.min(m.bal.MAX_DEFEND_CARDS, slots));
}

function greedyMatchAction(
  content: ContentBundle,
  m: MatchState,
  opts: { defendThreshold: number; pushLead: number },
): MatchAction {
  if (m.phase === "PUSH_DECISION") {
    const lead = m.playerGoals - m.oppGoals;
    if (lead >= opts.pushLead && m.extraRoundsPlayed < m.bal.MAX_EXTRA_ROUNDS) {
      return { type: "EXTRA_TIME" };
    }
    return { type: "TAKE_WIN" };
  }

  if (m.playsLeft > 0) {
    // shore up the defense early if the clock is running hot
    const currentDef = defenseRating(content.defs, m);
    const defenders = bestDefenders(content, m);
    const clockHot = m.opp.attackRating - currentDef > m.opp.attackRating * opts.defendThreshold;
    if (clockHot && defenders.length > 0 && m.round <= m.bal.MATCH_ROUNDS - 1) {
      return { type: "DEFEND", cardUids: defenders.map((c) => c.uid) };
    }

    const attack = bestAttack(content, m);
    if (attack && attack.goals >= 1) {
      return { type: "ATTACK", cardUids: attack.cards.map((c) => c.uid) };
    }
    // weak hand: cycle it if we can
    if (m.discardsLeft > 0 && m.drawPile.length + m.discardPile.length > 0) {
      const junk = m.hand
        .filter((c) => defense(content, c) === 0)
        .sort((a, b) => power(content, a) - power(content, b))
        .slice(0, m.bal.MAX_DISCARD_CARDS);
      if (junk.length > 0) return { type: "DISCARD", cardUids: junk.map((c) => c.uid) };
    }
    // last round: fire the best we have even if it won't convert
    if (attack && m.round >= m.bal.MATCH_ROUNDS) {
      return { type: "ATTACK", cardUids: attack.cards.map((c) => c.uid) };
    }
    if (defenders.length > 0) {
      return { type: "DEFEND", cardUids: defenders.map((c) => c.uid) };
    }
  }
  return { type: "END_ROUND" };
}

// ---------- run-policy helpers ----------

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
    // train the best attacker while budget is comfortable
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
    // buy a strong card if affordable and the deck isn't bloated
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
    matchAction: (content, m) =>
      greedyMatchAction(content, m, { defendThreshold: 0.5, pushLead: 2 }),
    runAction: greedyRunAction,
  };
}

export function makeDefensiveBot(): Bot {
  return {
    name: "defensive",
    matchAction: (content, m) =>
      greedyMatchAction(content, m, { defendThreshold: 0.25, pushLead: 99 }), // never pushes
    runAction: greedyRunAction,
  };
}

export function makePushLuckyBot(): Bot {
  return {
    name: "pushlucky",
    matchAction: (content, m) =>
      greedyMatchAction(content, m, { defendThreshold: 0.5, pushLead: 1 }),
    runAction: greedyRunAction,
  };
}

export function makeRandomBot(): Bot {
  // Deterministic "random": keyed off state counters, not an external RNG,
  // so sim runs stay replayable.
  return {
    name: "random",
    matchAction: (content, m) => {
      if (m.phase === "PUSH_DECISION") {
        return (m.playerGoals + m.round) % 2 === 0 ? { type: "EXTRA_TIME" } : { type: "TAKE_WIN" };
      }
      if (m.playsLeft > 0) {
        const pick = m.hand.filter((c) => power(content, c) > 0).slice(0, 2);
        if (pick.length > 0 && (m.round + m.hand.length) % 3 !== 0) {
          return { type: "ATTACK", cardUids: pick.map((c) => c.uid) };
        }
        const defs = bestDefenders(content, m);
        if (defs.length > 0) return { type: "DEFEND", cardUids: defs.map((c) => c.uid) };
        if (pick.length > 0) return { type: "ATTACK", cardUids: pick.map((c) => c.uid) };
      }
      return { type: "END_ROUND" };
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
