// Bot strategies for the balance sim — DICE MODE (roll, slot, advance, shoot).

import { bestDieFor, playableCards } from "../core/match/dice";
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
  if (effs.some((e) => e.kind === "winPossession" || e.kind === "pushBack" || e.kind === "clearance")) return "defend";
  if (effs.some((e) => e.kind === "shotQuality" || e.kind === "shotQualityFromDie")) return "finish";
  return "progress";
}

/** First playable card of a role + its best fitting die. */
function assignFor(
  content: ContentBundle,
  m: DiceMatchState,
  playable: Set<string>,
  role: Role,
): DiceMatchAction | null {
  for (const c of m.hand) {
    if (!playable.has(c.uid)) continue;
    const def = content.defs[c.defId]!;
    if (roleOf(def) !== role) continue;
    const idx = bestDieFor(content.defs, m, c.uid);
    if (idx >= 0) return { type: "ASSIGN_DIE", uid: c.uid, dieIndex: idx };
  }
  return null;
}

function diceAction(
  content: ContentBundle,
  m: DiceMatchState,
  opts: { defendBias: number; shootFloor: number; pushLead: number },
): DiceMatchAction {
  if (m.phase === "PUSH_DECISION") {
    const lead = m.playerGoals - m.oppGoals;
    if (lead >= opts.pushLead && m.extraRoundsPlayed < m.bal.MAX_EXTRA_ROUNDS) {
      return { type: "EXTRA_TIME" };
    }
    return { type: "TAKE_WIN" };
  }

  // Brazil: spend rerolls on the worst dead dice (a 1, or a 2 with no low-die card to use it)
  if (m.rerollDieLeft > 0) {
    const wantsLowDie = m.hand.some((c) => {
      const slot = content.defs[c.defId]!.slot;
      return slot?.kind === "max";
    });
    const worst = m.dice
      .map((d, i) => ({ d, i }))
      .filter((x) => !x.d.used && (x.d.value === 1 || (x.d.value === 2 && !wantsLowDie)))
      .sort((a, b) => a.d.value - b.d.value)[0];
    if (worst) return { type: "REROLL_DIE", dieIndex: worst.i };
  }

  const playable = playableCards(content.defs, m);

  const inBox = m.ball >= m.bal.DICE.THEIR_BOX;
  const dc = m.keeperDC + (m.intent?.kind === "sitDeep" ? m.bal.DICE.SIT_DEEP_DC_BONUS : 0);
  const shootThreshold = Math.max(opts.shootFloor, dc - 9);
  if (inBox && m.shotQuality >= shootThreshold) return { type: "SHOOT" };

  const projectedBall = Math.min(m.bal.DICE.PITCH_LEN, m.ball + Math.round(m.buildUp * m.bal.DICE.BUILD_UP_SCALE));
  const intentPoints = m.intent?.kind === "attack" || m.intent?.kind === "counter" ? m.intent.points : 4;
  const projectedPressure = Math.max(0, intentPoints - m.cover);
  const projectedDangerBall = m.ball - Math.round(projectedPressure * m.bal.DICE.OPP_ADVANCE_SCALE);

  if ((m.possession === "them" || projectedDangerBall <= m.bal.DICE.YOUR_BOX + 1) && m.cover < intentPoints) {
    const cover = assignFor(content, m, playable, "defend");
    if (cover) return cover;
  }

  if (projectedBall >= m.bal.DICE.THEIR_BOX || inBox) {
    const fin = assignFor(content, m, playable, "finish");
    if (fin) return fin;
  }

  if (projectedBall < m.bal.DICE.THEIR_BOX) {
    const adv = assignFor(content, m, playable, "progress");
    if (adv) return adv;
  }

  const cover = assignFor(content, m, playable, "defend");
  if (cover) return cover;

  if (inBox && m.shotQuality > 0) return { type: "SHOOT" };
  for (const c of m.hand) {
    if (!playable.has(c.uid)) continue;
    const idx = bestDieFor(content.defs, m, c.uid);
    if (idx >= 0) return { type: "ASSIGN_DIE", uid: c.uid, dieIndex: idx };
  }
  // a finisher assigned in the fallback loop above may have just created quality
  if (inBox && m.shotQuality > 0) return { type: "SHOOT" };
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
    matchAction: (content, m) => diceAction(content, m, { defendBias: 0.6, shootFloor: 4, pushLead: 2 }),
    runAction: greedyRunAction,
  };
}

export function makeDefensiveBot(): Bot {
  return {
    name: "defensive",
    matchAction: (content, m) => diceAction(content, m, { defendBias: 0.25, shootFloor: 6, pushLead: 99 }),
    runAction: greedyRunAction,
  };
}

export function makePushLuckyBot(): Bot {
  return {
    name: "pushlucky",
    matchAction: (content, m) => diceAction(content, m, { defendBias: 0.7, shootFloor: 2, pushLead: 1 }),
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
      if (m.ball >= m.bal.DICE.THEIR_BOX && m.shotQuality > 0 && (m.round + playable.length) % 3 === 0) {
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
