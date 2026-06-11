// COMBAT MODE (Slay-the-Spire-style): stamina costs, telegraphed opponent
// intents, per-round block. Pure & deterministic: applyMatchAction(defs, state,
// action) -> { state, events }. All randomness flows through state.rng.
//
// Round loop: draw -> intent revealed -> play cards within stamina ->
// END_ROUND executes the intent (block absorbs) -> next round / verdict.
// Push-your-luck extra time and sudden death carry over from the clock mode.

import { nextFloat, type RngState } from "../rng";
import { rollIntent } from "./intents";
import {
  cardCost,
  levelStats,
  type CardDefMap,
  type CardInstance,
  type EffectDef,
  type GameEvent,
  type MatchAction,
  type MatchContext,
  type MatchState,
  type MatchStep,
  type OppInfo,
  type PlayDef,
  type Condition,
} from "../types";
import type { BalanceConfig } from "../balance";

export interface MatchConfig {
  opp: OppInfo;
  styleEffects: EffectDef[];
  plays: PlayDef[];
  context: MatchContext;
  deck: CardInstance[];
  rng: RngState;
  balance: BalanceConfig;
}

// ---------- rng / pile helpers ----------

function rand(draft: MatchState): number {
  const [v, next] = nextFloat(draft.rng);
  draft.rng = next;
  return v;
}

function randInt(draft: MatchState, maxExclusive: number): number {
  return Math.floor(rand(draft) * maxExclusive);
}

function shuffleInPlace(draft: MatchState, arr: CardInstance[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(draft, i + 1);
    const a = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = a;
  }
}

function drawCards(draft: MatchState, n: number, events: GameEvent[]): void {
  const drawn: string[] = [];
  for (let i = 0; i < n; i++) {
    if (draft.drawPile.length === 0) {
      if (draft.discardPile.length === 0) break;
      draft.drawPile = draft.discardPile;
      draft.discardPile = [];
      shuffleInPlace(draft, draft.drawPile);
      events.push({ type: "PILE_RESHUFFLED" });
    }
    const card = draft.drawPile.pop()!;
    draft.hand.push(card);
    drawn.push(card.uid);
  }
  if (drawn.length > 0) events.push({ type: "CARDS_DRAWN", uids: drawn });
}

// ---------- scoring helpers ----------

function addPlayerPoints(draft: MatchState, points: number, events: GameEvent[]): number {
  // sit-deep parry absorbs first
  const absorbed = Math.min(draft.sitDeepPool, points);
  draft.sitDeepPool -= absorbed;
  const gained = points - absorbed;
  draft.playerShotPoints += gained;
  const goals = Math.floor(draft.playerShotPoints / draft.bal.GOAL_THRESHOLD);
  if (goals > 0) {
    draft.playerShotPoints -= goals * draft.bal.GOAL_THRESHOLD;
    draft.playerGoals += goals;
    events.push({ type: "GOAL_SCORED", goals, total: draft.playerGoals });
  }
  return goals;
}

function addOppPoints(draft: MatchState, points: number): number {
  draft.oppClockPoints += points;
  const goals = Math.floor(draft.oppClockPoints / draft.bal.GOAL_THRESHOLD);
  draft.oppClockPoints -= goals * draft.bal.GOAL_THRESHOLD;
  draft.oppGoals += goals;
  return goals;
}

function evalCombatCondition(draft: MatchState, cond: Condition): boolean {
  switch (cond.kind) {
    case "attackIncludesPosition":
      // "alongside a ST" = a ST was already played this round
      return draft.playedThisRound.some((p) => p.position === cond.position);
    case "attackCardCount": {
      const n = draft.playedThisRound.length + 1; // including this card
      return cond.cmp === "lte" ? n <= cond.value : n >= cond.value;
    }
    case "handSize": {
      const n = draft.hand.length; // card already removed from hand
      return cond.cmp === "lte" ? n <= cond.value : n >= cond.value;
    }
    case "leading":
      return draft.playerGoals > draft.oppGoals;
    case "trailing":
      return draft.playerGoals < draft.oppGoals;
  }
}

function scaled(amount: number, scaling: "perLevel" | undefined, level: number): number {
  return scaling === "perLevel" ? amount * (level + 1) : amount;
}

// ---------- round flow ----------

function startRound(draft: MatchState, events: GameEvent[]): void {
  draft.round += 1;
  draft.stamina = draft.mode === "suddendeath" ? draft.bal.STAMINA_PER_ROUND - 1 : draft.bal.STAMINA_PER_ROUND;
  draft.block = 0;
  draft.pendingMult = 1;
  draft.pendingFlat = 0;
  draft.playedThisRound = [];
  events.push({ type: "ROUND_START", round: draft.round, mode: draft.mode });
  const handSize = Math.max(2, draft.bal.HAND_SIZE - draft.handPenalty);
  draft.handPenalty = 0;
  drawCards(draft, handSize - draft.hand.length, events);
  const intent = rollIntent(draft);
  draft.intent = intent;
  draft.sitDeepPool = intent.kind === "sitDeep" ? intent.amount : 0;
  events.push({ type: "INTENT_REVEALED", intent });
}

function finish(draft: MatchState, result: "win" | "draw" | "loss", events: GameEvent[]): void {
  draft.phase = "DONE";
  draft.result = result;
  events.push({
    type: "MATCH_END",
    result,
    playerGoals: draft.playerGoals,
    oppGoals: draft.oppGoals,
  });
}

function shootout(defs: CardDefMap, draft: MatchState, events: GameEvent[]): void {
  const pool = [...draft.hand, ...draft.drawPile, ...draft.discardPile];
  const powers = pool
    .map((inst) => {
      const def = defs[inst.defId];
      return def ? (levelStats(def, inst.level).power ?? 0) + inst.formPower : 0;
    })
    .sort((a, b) => b - a)
    .slice(0, 4);
  const base = powers.reduce((s, p) => s + p, 0);

  let playerRoll = 0;
  let oppRoll = 0;
  for (let i = 0; i < 10; i++) {
    playerRoll = base + randInt(draft, draft.bal.SHOOTOUT_RNG + 1);
    oppRoll = draft.opp.attackRating + randInt(draft, draft.bal.SHOOTOUT_RNG + 1);
    if (playerRoll !== oppRoll) break;
  }
  const won = playerRoll >= oppRoll; // exhausted rerolls -> home crowd edge
  events.push({ type: "SHOOTOUT", playerRoll, oppRoll, won });
  finish(draft, won ? "win" : "loss", events);
}

function enterSuddenDeath(draft: MatchState, events: GameEvent[]): void {
  draft.mode = "suddendeath";
  events.push({ type: "SUDDEN_DEATH_START" });
  startRound(draft, events);
}

function executeIntent(draft: MatchState, events: GameEvent[]): void {
  const intent = draft.intent;
  if (!intent) return;
  const etMult = draft.mode === "extratime" ? draft.bal.EXTRA_TIME_CLOCK_MULT : 1;
  let raw = 0;
  if (intent.kind === "attack") raw = intent.points;
  else if (intent.kind === "counter") {
    const attacksPlayed = draft.playedThisRound.filter((p) => p.isAttack).length;
    raw = attacksPlayed < 2 ? intent.points : 0;
  } else if (intent.kind === "press") {
    draft.handPenalty = 1;
  }
  raw = Math.round(raw * etMult);
  const blocked = Math.min(draft.block, raw);
  const through = raw - blocked;
  if (through > 0) addOppPoints(draft, through);
  events.push({
    type: "INTENT_EXECUTED",
    intent,
    blocked,
    points: through,
    oppGoals: draft.oppGoals,
  });
  draft.intent = null;
}

function endRound(defs: CardDefMap, draft: MatchState, events: GameEvent[]): void {
  executeIntent(draft, events);

  // hand fully discards at end of round (Slay-the-Spire economy)
  if (draft.hand.length > 0) {
    const uids = draft.hand.map((c) => c.uid);
    draft.discardPile.push(...draft.hand);
    draft.hand = [];
    events.push({ type: "CARDS_DISCARDED", uids, forced: true });
  }

  const leading = draft.playerGoals > draft.oppGoals;
  const tied = draft.playerGoals === draft.oppGoals;

  switch (draft.mode) {
    case "regulation": {
      if (draft.round < draft.bal.MATCH_ROUNDS) {
        startRound(draft, events);
        return;
      }
      if (leading) {
        draft.phase = "PUSH_DECISION";
        events.push({ type: "PUSH_DECISION", playerGoals: draft.playerGoals, oppGoals: draft.oppGoals });
      } else if (tied) {
        if (draft.context === "group") finish(draft, "draw", events);
        else enterSuddenDeath(draft, events);
      } else {
        finish(draft, "loss", events);
      }
      return;
    }
    case "extratime": {
      if (leading) {
        draft.earned.budget += draft.bal.ET_BUDGET_REWARD;
        draft.earned.scout += draft.bal.ET_SCOUT_REWARD;
        events.push({ type: "ET_SURVIVED", budget: draft.bal.ET_BUDGET_REWARD, scout: draft.bal.ET_SCOUT_REWARD });
        if (draft.extraRoundsPlayed < draft.bal.MAX_EXTRA_ROUNDS) {
          draft.phase = "PUSH_DECISION";
          events.push({ type: "PUSH_DECISION", playerGoals: draft.playerGoals, oppGoals: draft.oppGoals });
        } else {
          finish(draft, "win", events);
        }
      } else if (tied) {
        if (draft.context === "group") finish(draft, "draw", events);
        else enterSuddenDeath(draft, events);
      } else {
        finish(draft, "loss", events);
      }
      return;
    }
    case "suddendeath": {
      draft.suddenDeathRoundsPlayed += 1;
      if (!tied) {
        finish(draft, leading ? "win" : "loss", events);
      } else if (draft.suddenDeathRoundsPlayed < draft.bal.MAX_SUDDEN_DEATH_ROUNDS) {
        startRound(draft, events);
      } else {
        shootout(defs, draft, events);
      }
      return;
    }
  }
}

// ---------- card resolution ----------

function playCard(defs: CardDefMap, draft: MatchState, uid: string, events: GameEvent[]): void {
  const idx = draft.hand.findIndex((c) => c.uid === uid);
  if (idx === -1) throw new Error(`card ${uid} is not in hand`);
  const inst = draft.hand[idx]!;
  const def = defs[inst.defId];
  if (!def) throw new Error(`unknown card def ${inst.defId}`);
  const cost = cardCost(def);
  if (draft.stamina < cost) throw new Error(`not enough stamina (${def.name} costs ${cost})`);

  draft.hand.splice(idx, 1);
  draft.stamina -= cost;

  const stats = levelStats(def, inst.level);
  const isDefender = (stats.defense ?? 0) > 0;
  const power = (stats.power ?? 0) + inst.formPower;

  events.push({ type: "CARD_PLAYED", uid, as: isDefender ? "defend" : "attack", cost });

  if (isDefender) {
    draft.block += stats.defense ?? 0;
    events.push({ type: "BLOCK_GAINED", amount: stats.defense ?? 0, total: draft.block });
  } else {
    // gather this card's own onPlay effects
    let ownAdd = 0;
    let ownMul = 1;
    let ownFlat = 0;
    let draws = 0;
    for (const eff of def.effects) {
      if (eff.trigger !== "onPlay") continue;
      if (eff.condition && !evalCombatCondition(draft, eff.condition)) continue;
      const op = eff.op;
      if (op.kind === "addPower") ownFlat += scaled(op.amount, eff.scaling, inst.level);
      else if (op.kind === "addMult") ownAdd += scaled(op.amount, eff.scaling, inst.level);
      else if (op.kind === "mulMult") ownMul *= op.amount;
      else if (op.kind === "draw") draws += op.amount;
      else if (op.kind === "gainResource") {
        if (op.resource === "budget") draft.earned.budget += op.amount;
        else draft.earned.scout += op.amount;
      }
    }

    if (power > 0) {
      // attack card: buffs (its own + pending) multiply its shot points
      let mult = draft.pendingMult * (1 + ownAdd) * ownMul;
      if (draft.multCap !== null) mult = Math.min(mult, draft.multCap);
      const value = Math.floor((power + ownFlat + draft.pendingFlat) * mult);
      draft.pendingMult = 1;
      draft.pendingFlat = 0;
      events.push({
        type: "SHOT_VALUE",
        basePower: power,
        mult,
        value,
        playName: def.name,
      });
      const goals = addPlayerPoints(draft, value, events);
      if (goals > 0) {
        for (const eff of def.effects) {
          if (eff.trigger !== "onGoal") continue;
          const op = eff.op;
          if (op.kind === "gainFormPower" && inst.formPower < draft.bal.FORM_CAP) {
            inst.formPower = Math.min(
              draft.bal.FORM_CAP,
              inst.formPower + scaled(op.amount, eff.scaling, inst.level) * goals,
            );
            events.push({ type: "FORM_GAINED", uid, amount: op.amount * goals, formPower: inst.formPower });
          } else if (op.kind === "gainResource") {
            if (op.resource === "budget") draft.earned.budget += op.amount * goals;
            else draft.earned.scout += op.amount * goals;
          }
        }
      }
    } else {
      // pure tactic/moment: buff the next attack card this round
      draft.pendingMult *= (1 + ownAdd) * ownMul;
      draft.pendingFlat += ownFlat;
    }

    if (draws > 0) drawCards(draft, draws, events);
  }

  draft.playedThisRound.push({ uid, position: def.position, isAttack: !isDefender && power > 0 });

  if (draft.mode === "extratime" && draft.extraRoundsPlayed >= 2 && !inst.fatigued) {
    inst.fatigued = true;
    events.push({ type: "CARD_FATIGUED", uids: [uid] });
  }

  if (def.exileOnPlay) draft.exile.push(inst);
  else draft.discardPile.push(inst);
}

// ---------- public API ----------

export function createMatch(_defs: CardDefMap, cfg: MatchConfig): MatchStep {
  const state: MatchState = {
    phase: "ROUND_ACTIVE",
    mode: "regulation",
    context: cfg.context,
    opp: cfg.opp,
    styleEffects: cfg.styleEffects,
    plays: cfg.plays,
    bal: cfg.balance,
    round: 0,
    playerGoals: 0,
    oppGoals: 0,
    playerShotPoints: 0,
    oppClockPoints: 0,
    stamina: 0,
    block: 0,
    pendingMult: 1,
    pendingFlat: 0,
    sitDeepPool: 0,
    handPenalty: 0,
    intent: null,
    intentStep: 0,
    playedThisRound: [],
    multCap: null,
    hand: [],
    drawPile: cfg.deck.map((c) => ({ ...c })),
    discardPile: [],
    exile: [],
    extraRoundsPlayed: 0,
    suddenDeathRoundsPlayed: 0,
    earned: { budget: 0, scout: 0 },
    result: "pending",
    rng: cfg.rng,
  };
  const events: GameEvent[] = [{ type: "MATCH_START", opp: cfg.opp }];
  shuffleInPlace(state, state.drawPile);
  // fortress style still caps single-card mults
  for (const eff of cfg.styleEffects) {
    if (eff.op.kind === "scripted" && eff.op.key === "capMultAt2x") state.multCap = 2;
  }
  startRound(state, events);
  return { state, events };
}

export function applyMatchAction(
  defs: CardDefMap,
  state: MatchState,
  action: MatchAction,
): MatchStep {
  if (state.phase === "DONE") throw new Error("match is over");
  const draft: MatchState = structuredClone(state);
  const events: GameEvent[] = [];

  switch (action.type) {
    case "PLAY_CARD": {
      assertPhase(draft, "ROUND_ACTIVE");
      playCard(defs, draft, action.uid, events);
      break;
    }
    case "END_ROUND": {
      assertPhase(draft, "ROUND_ACTIVE");
      endRound(defs, draft, events);
      break;
    }
    case "TAKE_WIN": {
      assertPhase(draft, "PUSH_DECISION");
      finish(draft, "win", events);
      break;
    }
    case "EXTRA_TIME": {
      assertPhase(draft, "PUSH_DECISION");
      if (draft.extraRoundsPlayed >= draft.bal.MAX_EXTRA_ROUNDS)
        throw new Error("no extra time remaining");
      draft.mode = "extratime";
      draft.extraRoundsPlayed += 1;
      draft.phase = "ROUND_ACTIVE";
      events.push({ type: "EXTRA_TIME_START", round: draft.round + 1 });
      startRound(draft, events);
      break;
    }
  }

  return { state: draft, events };
}

function assertPhase(state: MatchState, phase: MatchState["phase"]): void {
  if (state.phase !== phase)
    throw new Error(`action requires phase ${phase}, but match is in ${state.phase}`);
}

/** Sum of deployed... in combat mode, current block (kept for UI compatibility). */
export function defenseRating(state: MatchState): number {
  return state.block;
}

/** Would this card's conditional bonus fire if played right now?
 * "active" / "inactive" for conditional cards, null for unconditional ones.
 * Drives the live combo badge in the UI. */
export function comboStatus(
  defs: CardDefMap,
  state: MatchState,
  inst: CardInstance,
): "active" | "inactive" | null {
  const def = defs[inst.defId];
  if (!def) return null;
  const conditionals = def.effects.filter((e) => e.trigger === "onPlay" && e.condition);
  if (conditionals.length === 0) return null;
  return conditionals.some((e) => evalCombatCondition(state, e.condition!))
    ? "active"
    : "inactive";
}
