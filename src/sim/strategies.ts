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
  if (effs.some((e) => e.kind === "cover" || e.kind === "coverFromDie")) return "defend";
  if (effs.some((e) => e.kind === "shotQuality" || e.kind === "shotQualityFromDie")) return "finish";
  return "progress";
}

/** Scaled incoming threat if the round ended now. */
function incomingThreat(m: DiceMatchState): number {
  const i = m.intent;
  if (!i) return 0;
  const et = m.mode === "extratime" ? m.bal.EXTRA_TIME_CLOCK_MULT : 1;
  let raw = 0;
  if (i.kind === "attack") raw = i.points;
  else if (i.kind === "counter") raw = m.coverGainedThisRound ? 0 : i.points;
  raw = Math.round(raw * m.bal.DICE.THREAT_SCALE * et);
  return Math.max(0, raw - m.cover);
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

  const playable = playableCards(content.defs, m);
  const inBox = m.zone >= m.bal.DICE.BOX_ZONE;
  const threat = incomingThreat(m);
  const dc = m.keeperDC + (m.intent?.kind === "sitDeep" ? m.bal.DICE.SIT_DEEP_DC_BONUS : 0);
  const shootThreshold = Math.max(opts.shootFloor, dc - 9);

  // 1) defend a real threat
  if (threat >= m.bal.DICE.OPP_GOAL_THRESHOLD * opts.defendBias) {
    const def = assignFor(content, m, playable, "defend");
    if (def) return def;
  }

  // 2) in the box: bank quality, then shoot when it's worth it
  if (inBox) {
    if (m.shotQuality < shootThreshold) {
      const fin = assignFor(content, m, playable, "finish");
      if (fin) return fin;
    }
    if (m.shotQuality > 0) return { type: "SHOOT" };
  }

  // 3) advance up the pitch
  const adv = assignFor(content, m, playable, "progress");
  if (adv) return adv;

  // 4) anything still playable (finishers out of the box bank nothing — skip to defend/progress already tried)
  for (const c of m.hand) {
    if (!playable.has(c.uid)) continue;
    const idx = bestDieFor(content.defs, m, c.uid);
    if (idx >= 0) return { type: "ASSIGN_DIE", uid: c.uid, dieIndex: idx };
  }

  // 5) nothing useful left
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
      if (m.zone >= m.bal.DICE.BOX_ZONE && m.shotQuality > 0 && (m.round + playable.length) % 3 === 0) {
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
