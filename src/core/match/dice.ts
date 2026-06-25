// DICE MODE (Dicey-Dungeons-style): each round you roll a pool of dice and slot
// them into cards. A card needs a die matching its slot to fire. You advance the
// ball up the pitch (0 = your goal, PITCH_LEN = their goal); from the box you
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
  type CardDef,
  type CardDefMap,
  type CardInstance,
  type DiceEffect,
  type DiceMatchConfig,
  type DiceMatchState,
  type DiceMatchStep,
  type DiceMatchAction,
  type DiceMutator,
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

function mutatorSum(mutators: DiceMutator[], kind: DiceMutator["kind"]): number {
  let total = 0;
  for (const m of mutators) {
    if (m.kind === kind) {
      if (m.kind === "rerollDie") total += m.perRound;
      else total += m.amount;
    }
  }
  return total;
}

// ---------- ball movement ----------

export function zoneOf(ball: number, bal: import("../balance").BalanceConfig): number {
  return Math.max(0, Math.min(4, Math.floor(ball / bal.DICE.ZONE_WIDTH)));
}

function moveBall(draft: DiceMatchState, steps: number, events: GameEvent[]): void {
  const next = Math.max(0, Math.min(draft.bal.DICE.PITCH_LEN, draft.ball + steps));
  draft.ball = next;
  events.push({ type: "BALL_MOVED", ball: next, toward: steps >= 0 ? "theirs" : "yours" });
}

// ---------- round flow ----------

function startRound(draft: DiceMatchState, events: GameEvent[]): void {
  draft.round += 1;

  const bonusDice =
    passiveSum(draft, "roundStamina") +
    mutatorSum(draft.mutators, "poolDelta") +
    (draft.mode === "suddendeath" ? -1 : 0);
  const poolSize = Math.max(2, draft.bal.DICE.POOL_SIZE + bonusDice - draft.diePenalty);
  draft.diePenalty = 0;
  draft.dice = Array.from({ length: poolSize }, () => ({ value: rollDie(draft), used: false }));

  // per-round mutator budgets (Brazil reroll)
  draft.rerollDieLeft = mutatorSum(draft.mutators, "rerollDie");

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

function oppShoot(draft: DiceMatchState, events: GameEvent[]): void {
  const danger = Math.round(draft.opp.attackRating * draft.bal.DICE.OPP_DANGER_PER_RATING);
  const roll = 1 + Math.floor(rand(draft) * draft.bal.DICE.SHOT_DIE);
  const goal = roll + danger >= draft.ownKeeperDC;
  events.push({ type: "OPP_SHOT", roll, danger, dc: draft.ownKeeperDC, goal });
  if (goal) {
    draft.oppGoals += 1;
    events.push({ type: "GOAL_SCORED", goals: 0, total: draft.oppGoals }); // goals:0 marks a concede
  }
  draft.possession = "you"; // kickoff after a goal, or your keeper claims the save
  draft.ball = draft.bal.DICE.MIDFIELD;
}

function resolveIntent(draft: DiceMatchState, events: GameEvent[]): void {
  const intent = draft.intent;
  if (!intent) return;
  const etMult = draft.mode === "extratime" ? draft.bal.EXTRA_TIME_CLOCK_MULT : 1;

  if (draft.possession === "you") {
    // they contest: a press/attack wins the ball back unless you got it deep
    if ((intent.kind === "attack" || intent.kind === "counter") && draft.ball < draft.bal.DICE.STEAL_LINE) {
      draft.possession = "them";
      events.push({ type: "POSSESSION_LOST" });
    }
    if (intent.kind === "press") {
      draft.handPenalty = 1;
      draft.diePenalty = 1;
    }
  } else {
    // they have it: advance toward your goal, shoot if they reach your box
    const points = intent.kind === "attack" || intent.kind === "counter" ? intent.points : 4;
    const base = Math.round(points * draft.bal.DICE.OPP_ADVANCE_SCALE * etMult);
    const steps = Math.max(1, base + mutatorSum(draft.mutators, "oppAdvanceDelta"));
    moveBall(draft, -steps, events);
    if (draft.ball <= draft.bal.DICE.YOUR_BOX) oppShoot(draft, events);
  }
  events.push({ type: "INTENT_EXECUTED", intent, blocked: 0, points: 0, oppGoals: draft.oppGoals });
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
      moveBall(draft, eff.amount, events);
      break;
    case "progressFromDie":
      moveBall(draft, dieValue, events);
      break;
    case "advance":
      moveBall(draft, eff.zones * draft.bal.DICE.ZONE_WIDTH, events);
      break;
    case "shotQuality":
      if (zoneOf(draft.ball, draft.bal) >= (eff.minZone ?? 0)) draft.shotQuality += eff.amount;
      break;
    case "shotQualityFromDie":
      if (zoneOf(draft.ball, draft.bal) >= (eff.minZone ?? 0)) draft.shotQuality += dieValue;
      break;
    case "winPossession":
      draft.possession = "you";
      moveBall(draft, mutatorSum(draft.mutators, "counterSpring"), events); // USA spring
      events.push({ type: "POSSESSION_WON" });
      break;
    case "pushBack":
      moveBall(draft, eff.steps, events);
      break;
    case "clearance":
      draft.ball = draft.bal.DICE.MIDFIELD;
      events.push({ type: "BALL_CLEARED", ball: draft.ball });
      break;
    case "draw":
      drawCards(draft, eff.amount, events);
      break;
  }
}

function isDefenseCard(def: CardDef | undefined): boolean {
  return (def?.diceEffects ?? []).some(
    (e) => e.kind === "winPossession" || e.kind === "pushBack" || e.kind === "clearance",
  );
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

  const roleOk = isDefenseCard(def) ? draft.possession === "them" : draft.possession === "you";
  if (!roleOk) throw new Error("that card can't be played right now");

  die.used = true;
  draft.hand.splice(cardIdx, 1);
  events.push({ type: "DIE_ASSIGNED", uid, die: die.value });
  events.push({ type: "CARD_PLAYED", uid, as: "attack", cost: 0 });

  for (const eff of def.diceEffects ?? []) applyDiceEffect(draft, eff, die.value, events);

  if (def.exileOnPlay) draft.exile.push(inst);
  else draft.discardPile.push(inst);
}

function shoot(draft: DiceMatchState, events: GameEvent[]): void {
  if (draft.possession !== "you") throw new Error("you don't have the ball");
  if (draft.ball < draft.bal.DICE.THEIR_BOX) throw new Error("you must reach the box to shoot");
  if (draft.shotQuality <= 0) throw new Error("no shot quality — work a chance first");
  const dc = draft.keeperDC + (draft.intent?.kind === "sitDeep" ? draft.bal.DICE.SIT_DEEP_DC_BONUS : 0);
  const roll = 1 + Math.floor(rand(draft) * draft.bal.DICE.SHOT_DIE);
  const total = roll + draft.shotQuality;
  const goal = total >= dc;
  events.push({ type: "SHOT_TAKEN", roll, dc, quality: draft.shotQuality, goal });
  if (goal) {
    draft.playerGoals += 1;
    events.push({ type: "GOAL_SCORED", goals: 1, total: draft.playerGoals });
  }
  draft.shotQuality = 0;
  draft.possession = "them";
  draft.ball = draft.bal.DICE.MIDFIELD; // their kickoff / goal kick
}

// ---------- init helpers ----------

function passiveSumPlain(passives: PassiveEffect[], kind: PassiveEffect["kind"]): number {
  let total = 0;
  for (const p of passives) if (p.kind === kind && "amount" in p) total += p.amount;
  return total;
}

// ---------- public API ----------

export function createDiceMatch(defs: CardDefMap, cfg: DiceMatchConfig): DiceMatchStep {
  void defs;
  const mutators = cfg.mutators ?? [];
  const dcDelta = mutatorSum(mutators, "keeperDcDelta");
  const dc =
    Math.min(
      18,
      cfg.balance.DICE.KEEPER_DC_BASE +
        Math.round(cfg.opp.attackRating * cfg.balance.DICE.KEEPER_DC_PER_RATING),
    ) + dcDelta;
  const state: DiceMatchState = {
    phase: "ROUND_ACTIVE",
    mode: "regulation",
    context: cfg.context,
    opp: cfg.opp,
    bal: cfg.balance,
    round: 0,
    ball: cfg.balance.DICE.MIDFIELD,
    possession: "you",
    ownKeeperDC: cfg.balance.DICE.OWN_KEEPER_DC_BASE + passiveSumPlain(cfg.passives ?? [], "blockPerRound"),
    shotQuality: 0,
    playerGoals: 0,
    oppGoals: 0,
    keeperDC: dc,
    dice: [],
    intent: null,
    intentStep: 0,
    diePenalty: 0,
    handPenalty: 0,
    mutators,
    rerollDieLeft: 0,
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
    case "REROLL_DIE": {
      assertPhase(draft, "ROUND_ACTIVE");
      if (draft.rerollDieLeft <= 0) throw new Error("no rerolls left this round");
      const die = draft.dice[action.dieIndex];
      if (!die) throw new Error(`no die at index ${action.dieIndex}`);
      if (die.used) throw new Error("that die is already used");
      const from = die.value;
      die.value = rollDie(draft);
      draft.rerollDieLeft -= 1;
      events.push({ type: "DIE_REROLLED", dieIndex: action.dieIndex, from, to: die.value });
      break;
    }
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
    const def = defs[c.defId];
    const slot = def?.slot;
    if (!slot) continue;
    const roleOk = isDefenseCard(def) ? state.possession === "them" : state.possession === "you";
    if (roleOk && free.some((v) => dieFitsSlot(v, slot))) out.add(c.uid);
  }
  return out;
}

/** Best unused die index that fits a card's slot (for click-to-auto-assign).
 * Cards whose effect scales with the die value want the HIGHEST fitting die;
 * flat-value cards take the LOWEST fitting die so high dice stay free for
 * finishing (a 6 is precious — don't waste it on a flat +4). */
export function bestDieFor(defs: CardDefMap, state: DiceMatchState, uid: string): number {
  const def = defs[state.hand.find((c) => c.uid === uid)?.defId ?? ""];
  const slot = def?.slot;
  if (!slot) return -1;
  const scales = (def?.diceEffects ?? []).some(
    (e) => e.kind === "progressFromDie" || e.kind === "shotQualityFromDie",
  );
  let best = -1;
  let bestVal = scales ? -1 : 99;
  state.dice.forEach((d, i) => {
    if (!d.used && dieFitsSlot(d.value, slot) && (scales ? d.value > bestVal : d.value < bestVal)) {
      bestVal = d.value;
      best = i;
    }
  });
  return best;
}

export { levelStats };
