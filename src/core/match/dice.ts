// DICE MODE (Dicey-Dungeons-style): each round you roll a pool of dice and slot
// them into cards. A card needs a die matching its slot to fire. You advance the
// ball up the pitch (Build-up -> Midfield -> Final Third -> Box); from the Box you
// SHOOT — a seeded d20 + shot quality vs the keeper's DC. The randomness is the
// roll; the skill is allocation. Pure & deterministic: all randomness via state.rng.
//
// The state deliberately carries every field the run layer's settleMatch reads
// (goals, piles, earned, extraRoundsPlayed, result, rng) so the campaign, shop,
// staff and rewards keep working unchanged — only the match internals differ.

import { nextFloat } from "../rng";
import { rollIntent } from "./intents";
import {
  dieFitsSlot,
  levelStats,
  type CardDefMap,
  type CardInstance,
  type DiceEffect,
  type DiceMatchConfig,
  type DiceMatchState,
  type DiceMatchStep,
  type DiceMatchAction,
  type GameEvent,
  type MatchPhase,
  type MatchState,
  type PassiveEffect,
} from "../types";

export const ZONE_NAMES = ["Build-up", "Midfield", "Final Third", "Box"];

// ---------- rng / pile helpers ----------

function rand(draft: DiceMatchState): number {
  const [v, next] = nextFloat(draft.rng);
  draft.rng = next;
  return v;
}

function rollDie(draft: DiceMatchState): number {
  return 1 + Math.floor(rand(draft) * draft.bal.DICE.DIE_FACES);
}

function shuffleInPlace(draft: DiceMatchState, arr: CardInstance[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand(draft) * (i + 1));
    const a = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = a;
  }
}

function drawCards(draft: DiceMatchState, n: number, events: GameEvent[]): void {
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

function passiveSum(draft: DiceMatchState, kind: PassiveEffect["kind"]): number {
  let total = 0;
  for (const p of draft.activePassives) {
    if (p.kind === kind && "amount" in p) total += p.amount;
  }
  return total;
}

// ---------- scoring helpers ----------

function addOppPoints(draft: DiceMatchState, points: number): void {
  draft.oppClockPoints += points;
  const goals = Math.floor(draft.oppClockPoints / draft.bal.DICE.OPP_GOAL_THRESHOLD);
  if (goals > 0) {
    draft.oppClockPoints -= goals * draft.bal.DICE.OPP_GOAL_THRESHOLD;
    draft.oppGoals += goals;
  }
}

function gainProgress(draft: DiceMatchState, amount: number, events: GameEvent[]): void {
  draft.progress += amount;
  events.push({ type: "PROGRESS_GAINED", amount, progress: draft.progress, zone: draft.zone });
  while (draft.progress >= draft.bal.DICE.PROGRESS_PER_ZONE && draft.zone < draft.bal.DICE.BOX_ZONE) {
    draft.progress -= draft.bal.DICE.PROGRESS_PER_ZONE;
    draft.zone += 1;
    events.push({ type: "ZONE_ADVANCED", zone: draft.zone });
  }
}

function advanceZones(draft: DiceMatchState, zones: number, events: GameEvent[]): void {
  for (let i = 0; i < zones && draft.zone < draft.bal.DICE.BOX_ZONE; i++) {
    draft.zone += 1;
    events.push({ type: "ZONE_ADVANCED", zone: draft.zone });
  }
}

// ---------- round flow ----------

function startRound(draft: DiceMatchState, events: GameEvent[]): void {
  draft.round += 1;

  const bonusDice =
    passiveSum(draft, "roundStamina") + (draft.mode === "suddendeath" ? -1 : 0);
  const poolSize = Math.max(2, draft.bal.DICE.POOL_SIZE + bonusDice - draft.diePenalty);
  draft.diePenalty = 0;
  draft.dice = Array.from({ length: poolSize }, () => ({ value: rollDie(draft), used: false }));

  draft.cover = passiveSum(draft, "blockPerRound"); // a defensive nation/staff starts covered
  draft.coverGainedThisRound = draft.cover > 0;

  const handSize = Math.max(
    2,
    draft.bal.DICE.HAND_SIZE + passiveSum(draft, "drawBonus") - draft.handPenalty,
  );
  draft.handPenalty = 0;
  drawCards(draft, handSize - draft.hand.length, events);

  // rollIntent only reads opp / intentStep / rng, all of which we carry; the
  // cast bridges the otherwise larger MatchState shape.
  const intent = rollIntent(draft as unknown as MatchState);
  draft.intent = intent;

  events.push({ type: "ROUND_START", round: draft.round, mode: draft.mode });
  events.push({ type: "DICE_ROLLED", dice: draft.dice.map((d) => d.value) });
  events.push({ type: "INTENT_REVEALED", intent });
}

function finish(draft: DiceMatchState, result: "win" | "draw" | "loss", events: GameEvent[]): void {
  draft.phase = "DONE";
  draft.result = result;
  events.push({ type: "MATCH_END", result, playerGoals: draft.playerGoals, oppGoals: draft.oppGoals });
}

function shootout(defs: CardDefMap, draft: DiceMatchState, events: GameEvent[]): void {
  // best four cards' progress potential stand in for penalty takers
  const pool = [...draft.hand, ...draft.drawPile, ...draft.discardPile];
  void defs;
  let playerRoll = 0;
  let oppRoll = 0;
  for (let i = 0; i < 10; i++) {
    playerRoll = pool.length + Math.floor(rand(draft) * (draft.bal.SHOOTOUT_RNG + 1));
    oppRoll = draft.opp.tier * 2 + Math.floor(rand(draft) * (draft.bal.SHOOTOUT_RNG + 1));
    if (playerRoll !== oppRoll) break;
  }
  const won = playerRoll >= oppRoll;
  events.push({ type: "SHOOTOUT", playerRoll, oppRoll, won });
  finish(draft, won ? "win" : "loss", events);
}

function enterSuddenDeath(draft: DiceMatchState, events: GameEvent[]): void {
  draft.mode = "suddendeath";
  events.push({ type: "SUDDEN_DEATH_START" });
  startRound(draft, events);
}

function resolveIntent(draft: DiceMatchState, events: GameEvent[]): void {
  const intent = draft.intent;
  if (!intent) return;
  const etMult = draft.mode === "extratime" ? draft.bal.EXTRA_TIME_CLOCK_MULT : 1;
  let raw = 0;
  if (intent.kind === "attack") raw = intent.points;
  else if (intent.kind === "counter") raw = draft.coverGainedThisRound ? 0 : intent.points;
  else if (intent.kind === "press") {
    draft.handPenalty = 1;
    draft.diePenalty = 1;
  }
  raw = Math.round(raw * draft.bal.DICE.THREAT_SCALE * etMult);
  const blocked = Math.min(draft.cover, raw);
  const through = raw - blocked;
  if (through > 0) addOppPoints(draft, through);
  events.push({ type: "INTENT_EXECUTED", intent, blocked, points: through, oppGoals: draft.oppGoals });
  draft.intent = null;
}

function endRound(defs: CardDefMap, draft: DiceMatchState, events: GameEvent[]): void {
  resolveIntent(draft, events);

  if (draft.hand.length > 0) {
    const uids = draft.hand.map((c) => c.uid);
    draft.discardPile.push(...draft.hand);
    draft.hand = [];
    events.push({ type: "CARDS_DISCARDED", uids, forced: true });
  }
  draft.dice = [];

  const leading = draft.playerGoals > draft.oppGoals;
  const tied = draft.playerGoals === draft.oppGoals;

  switch (draft.mode) {
    case "regulation":
      if (draft.round < draft.bal.MATCH_ROUNDS) {
        startRound(draft, events);
      } else if (leading) {
        draft.phase = "PUSH_DECISION";
        events.push({ type: "PUSH_DECISION", playerGoals: draft.playerGoals, oppGoals: draft.oppGoals });
      } else if (tied) {
        if (draft.context === "group") finish(draft, "draw", events);
        else enterSuddenDeath(draft, events);
      } else {
        finish(draft, "loss", events);
      }
      return;
    case "extratime":
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
    case "suddendeath":
      draft.suddenDeathRoundsPlayed += 1;
      if (!tied) finish(draft, leading ? "win" : "loss", events);
      else if (draft.suddenDeathRoundsPlayed < draft.bal.MAX_SUDDEN_DEATH_ROUNDS) startRound(draft, events);
      else shootout(defs, draft, events);
      return;
  }
}

// ---------- actions ----------

function applyDiceEffect(
  draft: DiceMatchState,
  eff: DiceEffect,
  dieValue: number,
  events: GameEvent[],
): void {
  switch (eff.kind) {
    case "progress":
      gainProgress(draft, eff.amount, events);
      break;
    case "progressFromDie":
      gainProgress(draft, dieValue, events);
      break;
    case "advance":
      advanceZones(draft, eff.zones, events);
      break;
    case "cover":
      draft.cover += eff.amount;
      draft.coverGainedThisRound = true;
      events.push({ type: "COVER_GAINED_D", amount: eff.amount, total: draft.cover });
      break;
    case "coverFromDie":
      draft.cover += dieValue;
      draft.coverGainedThisRound = true;
      events.push({ type: "COVER_GAINED_D", amount: dieValue, total: draft.cover });
      break;
    case "shotQuality":
      if (draft.zone >= (eff.minZone ?? 0)) draft.shotQuality += eff.amount;
      break;
    case "shotQualityFromDie":
      if (draft.zone >= (eff.minZone ?? 0)) draft.shotQuality += dieValue;
      break;
    case "draw":
      drawCards(draft, eff.amount, events);
      break;
  }
}

function assignDie(
  defs: CardDefMap,
  draft: DiceMatchState,
  uid: string,
  dieIndex: number,
  events: GameEvent[],
): void {
  const die = draft.dice[dieIndex];
  if (!die) throw new Error(`no die at index ${dieIndex}`);
  if (die.used) throw new Error("that die is already used");
  const cardIdx = draft.hand.findIndex((c) => c.uid === uid);
  if (cardIdx === -1) throw new Error(`card ${uid} not in hand`);
  const inst = draft.hand[cardIdx]!;
  const def = defs[inst.defId];
  if (!def || !def.slot) throw new Error(`card ${inst.defId} has no dice slot`);
  if (!dieFitsSlot(die.value, def.slot)) throw new Error(`die ${die.value} doesn't fit this card`);

  die.used = true;
  draft.hand.splice(cardIdx, 1);
  events.push({ type: "DIE_ASSIGNED", uid, die: die.value });
  events.push({ type: "CARD_PLAYED", uid, as: "attack", cost: 0 });

  for (const eff of def.diceEffects ?? []) applyDiceEffect(draft, eff, die.value, events);

  if (def.exileOnPlay) draft.exile.push(inst);
  else draft.discardPile.push(inst);
}

function shoot(draft: DiceMatchState, events: GameEvent[]): void {
  if (draft.zone < draft.bal.DICE.BOX_ZONE) throw new Error("you must reach the box to shoot");
  if (draft.shotQuality <= 0) throw new Error("no shot quality — work a chance first");
  const dc = draft.keeperDC + (draft.intent?.kind === "sitDeep" ? draft.bal.DICE.SIT_DEEP_DC_BONUS : 0);
  const roll = 1 + Math.floor(rand(draft) * draft.bal.DICE.SHOT_DIE);
  const total = roll + draft.shotQuality;
  const goal = total >= dc;
  events.push({ type: "SHOT_TAKEN", roll, dc, quality: draft.shotQuality, goal });
  if (goal) {
    draft.playerGoals += 1;
    events.push({ type: "GOAL_SCORED", goals: 1, total: draft.playerGoals });
    draft.zone = 1; // kickoff restart from midfield
    draft.progress = 0;
    draft.shotQuality = 0;
  } else {
    draft.shotQuality = 0;
    draft.zone = Math.min(draft.zone, draft.bal.DICE.BOX_ZONE - 1); // cleared to the edge
    draft.progress = 0;
  }
}

// ---------- public API ----------

export function createDiceMatch(defs: CardDefMap, cfg: DiceMatchConfig): DiceMatchStep {
  void defs;
  const dc = Math.min(
    18,
    cfg.balance.DICE.KEEPER_DC_BASE + Math.round(cfg.opp.attackRating * cfg.balance.DICE.KEEPER_DC_PER_RATING),
  );
  const state: DiceMatchState = {
    phase: "ROUND_ACTIVE",
    mode: "regulation",
    context: cfg.context,
    opp: cfg.opp,
    bal: cfg.balance,
    round: 0,
    zone: 1, // start at midfield
    progress: 0,
    shotQuality: 0,
    playerGoals: 0,
    oppGoals: 0,
    oppClockPoints: 0,
    keeperDC: dc,
    dice: [],
    cover: 0,
    intent: null,
    intentStep: 0,
    diePenalty: 0,
    handPenalty: 0,
    coverGainedThisRound: false,
    hand: [],
    drawPile: cfg.deck.map((c) => ({ ...c })),
    discardPile: [],
    exile: [],
    activePassives: [...(cfg.passives ?? [])],
    extraRoundsPlayed: 0,
    suddenDeathRoundsPlayed: 0,
    earned: { budget: 0, scout: 0 },
    result: "pending",
    rng: cfg.rng,
  };
  const events: GameEvent[] = [{ type: "MATCH_START", opp: cfg.opp }];
  shuffleInPlace(state, state.drawPile);
  startRound(state, events);
  return { state, events };
}

export function applyDiceAction(
  defs: CardDefMap,
  state: DiceMatchState,
  action: DiceMatchAction,
): DiceMatchStep {
  if (state.phase === "DONE") throw new Error("match is over");
  const draft: DiceMatchState = structuredClone(state);
  const events: GameEvent[] = [];

  switch (action.type) {
    case "ASSIGN_DIE":
      assertPhase(draft, "ROUND_ACTIVE");
      assignDie(defs, draft, action.uid, action.dieIndex, events);
      break;
    case "SHOOT":
      assertPhase(draft, "ROUND_ACTIVE");
      shoot(draft, events);
      break;
    case "END_ROUND":
      assertPhase(draft, "ROUND_ACTIVE");
      endRound(defs, draft, events);
      break;
    case "TAKE_WIN":
      assertPhase(draft, "PUSH_DECISION");
      finish(draft, "win", events);
      break;
    case "EXTRA_TIME":
      assertPhase(draft, "PUSH_DECISION");
      if (draft.extraRoundsPlayed >= draft.bal.MAX_EXTRA_ROUNDS) throw new Error("no extra time remaining");
      draft.mode = "extratime";
      draft.extraRoundsPlayed += 1;
      draft.phase = "ROUND_ACTIVE";
      events.push({ type: "EXTRA_TIME_START", round: draft.round + 1 });
      startRound(draft, events);
      break;
  }

  return { state: draft, events };
}

function assertPhase(state: DiceMatchState, phase: MatchPhase): void {
  if (state.phase !== phase) throw new Error(`action requires phase ${phase}, but match is in ${state.phase}`);
}

/** Which hand cards can be activated by at least one unused die right now. */
export function playableCards(defs: CardDefMap, state: DiceMatchState): Set<string> {
  const free = state.dice.filter((d) => !d.used).map((d) => d.value);
  const out = new Set<string>();
  for (const c of state.hand) {
    const slot = defs[c.defId]?.slot;
    if (slot && free.some((v) => dieFitsSlot(v, slot))) out.add(c.uid);
  }
  return out;
}

/** Best unused die index that fits a card's slot (for click-to-auto-assign). */
export function bestDieFor(defs: CardDefMap, state: DiceMatchState, uid: string): number {
  const slot = defs[state.hand.find((c) => c.uid === uid)?.defId ?? ""]?.slot;
  if (!slot) return -1;
  let best = -1;
  let bestVal = -1;
  state.dice.forEach((d, i) => {
    if (!d.used && dieFitsSlot(d.value, slot) && d.value > bestVal) {
      bestVal = d.value;
      best = i;
    }
  });
  return best;
}

export { levelStats };
