// Bot strategies for the balance sim - DICE MODE possession chains.

import { bestDieFor, interceptionRisk, playableCards, shotEstimate } from "../core/match/dice";
import type {
  CardDef,
  ContentBundle,
  DiceMatchAction,
  DiceMatchState,
  RunAction,
  RunState,
} from "../core/types";
import type { Bot } from "./bot";

type Role = "defend" | "finish" | "progress";

function roleOf(def: CardDef): Role {
  const effs = def.diceEffects ?? [];
  if (effs.some((e) => e.kind === "defend")) return "defend";
  if (effs.some((e) => e.kind === "shotQuality" || e.kind === "shotQualityFromDie" || e.kind === "setupNext")) {
    return "finish";
  }
  return "progress";
}

function diceAction(
  content: ContentBundle,
  m: DiceMatchState,
  opts: { greed: number; riskTolerance: number; pushLead: number },
): DiceMatchAction {
  if (m.phase === "PUSH_DECISION") {
    const lead = m.playerGoals - m.oppGoals;
    if (lead >= opts.pushLead && m.extraRoundsPlayed < m.bal.MAX_EXTRA_ROUNDS) return { type: "EXTRA_TIME" };
    return { type: "TAKE_WIN" };
  }
  if (m.rerollDieLeft > 0) {
    const worst = m.dice.map((d, i) => ({ d, i })).filter((x) => !x.d.used && x.d.value === 1)[0];
    if (worst) return { type: "REROLL_DIE", dieIndex: worst.i };
  }
  const playable = playableCards(content.defs, m);

  if (m.possession === "them") {
    // commit defense while their chance threatens; otherwise stand off
    const threat = m.oppChance >= m.ownKeeperDC - 12;
    if (threat) {
      for (const c of m.hand) {
        if (!playable.has(c.uid)) continue;
        const idx = bestDieFor(content.defs, m, c.uid);
        if (idx >= 0) return { type: "ASSIGN_DIE", uid: c.uid, dieIndex: idx };
      }
    }
    return { type: "END_ROUND" };
  }

  // your chain: shoot when the estimate is good enough or the next pass is too hot
  const est = shotEstimate(m);
  const risk = interceptionRisk(m);
  const canShoot = m.passes >= 1 && m.shotQuality > 0;
  if (canShoot && (est.p >= opts.greed || risk >= opts.riskTolerance)) return { type: "SHOOT" };

  // order: setup > chance-when-developed > progress; else anything playable
  const byRole = (want: (def: CardDef) => boolean): DiceMatchAction | null => {
    for (const c of m.hand) {
      if (!playable.has(c.uid)) continue;
      const def = content.defs[c.defId]!;
      if (!want(def)) continue;
      const idx = bestDieFor(content.defs, m, c.uid);
      if (idx >= 0) return { type: "ASSIGN_DIE", uid: c.uid, dieIndex: idx };
    }
    return null;
  };
  const effs = (d: CardDef) => d.diceEffects ?? [];
  const pick =
    (m.passes >= 1 ? byRole((d) => effs(d).some((e) => e.kind === "setupNext")) : null) ??
    (m.passes >= 1
      ? byRole((d) => effs(d).some((e) => e.kind === "shotQuality" || e.kind === "shotQualityFromDie"))
      : null) ??
    byRole((d) => effs(d).some((e) => e.kind === "progress" || e.kind === "progressFromDie" || e.kind === "safePass")) ??
    byRole(() => true);
  if (pick) return pick;
  if (canShoot) return { type: "SHOOT" };
  return { type: "END_ROUND" };
}

// ---------- run policy ----------

function rewardScore(content: ContentBundle, defId: string): number {
  const def = content.defs[defId]!;
  const rarityScore = def.rarity === "legendary" ? 30 : def.rarity === "rare" ? 18 : 6;
  const role = roleOf(def);
  return rarityScore + (role === "finish" ? 4 : role === "progress" ? 3 : 2);
}

function greedyRunAction(content: ContentBundle, r: RunState): RunAction {
  if (r.phase === "STAFF" && r.pendingStaff) {
    const rank = { legendary: 2, rare: 1, common: 0 } as const;
    let bestIdx = 0;
    let best = -1;
    r.pendingStaff.staffIds.forEach((id, i) => {
      const s = content.staffPool.find((x) => x.id === id);
      const score = s ? rank[s.rarity] : 0;
      if (score > best) {
        best = score;
        bestIdx = i;
      }
    });
    return { type: "PICK_STAFF", index: bestIdx };
  }

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
    if (r.shop && r.deck.length < 22) {
      const idx = r.shop.cards.findIndex(
        (slot) => !slot.sold && r.resources.budget >= slot.price && rewardScore(content, slot.defId) >= 18,
      );
      if (idx !== -1) return { type: "BUY_CARD", index: idx };
    }
    void prices;
    return { type: "START_MATCH" };
  }

  throw new Error(`bot has no action for phase ${r.phase}`);
}

// ---------- strategies ----------

export function makeGreedyBot(): Bot {
  return {
    name: "greedy",
    matchAction: (content, m) => diceAction(content, m, { greed: 0.62, riskTolerance: 0.3, pushLead: 2 }),
    runAction: greedyRunAction,
  };
}

export function makeDefensiveBot(): Bot {
  return {
    name: "defensive",
    matchAction: (content, m) => diceAction(content, m, { greed: 0.5, riskTolerance: 0.22, pushLead: 99 }),
    runAction: greedyRunAction,
  };
}

export function makePushLuckyBot(): Bot {
  return {
    name: "pushlucky",
    matchAction: (content, m) => diceAction(content, m, { greed: 0.78, riskTolerance: 0.42, pushLead: 1 }),
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
      const playable = [...playableCards(content.defs, m)];
      if (m.possession === "them" && (m.round + m.oppPasses) % 2 === 1) return { type: "END_ROUND" };
      if (m.passes >= 2 && m.shotQuality > 0 && (m.round + m.passes) % 3 === 0) {
        return { type: "SHOOT" };
      }
      if (playable.length === 0) return { type: "END_ROUND" };
      const uid = playable[(m.round * 5 + playable.length) % playable.length]!;
      const idx = bestDieFor(content.defs, m, uid);
      if (idx < 0) return { type: "END_ROUND" };
      return { type: "ASSIGN_DIE", uid, dieIndex: idx };
    },
    runAction: (_content, r) => {
      if (r.phase === "STAFF" && r.pendingStaff) {
        return { type: "PICK_STAFF", index: r.deck.length % r.pendingStaff.staffIds.length };
      }
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
