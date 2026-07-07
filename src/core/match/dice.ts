// DICE MODE: pass-by-pass possession chains. Each card + die is one pass that
// resolves immediately; later passes risk interception, shots cash in banked Chance.
// Pure & deterministic: all randomness flows through state.rng.

import { nextFloat } from "../rng";
import { rollIntent } from "./intents";
import {
  dieFitsSlot,
  levelStats,
  type CardDef,
  type CardDefMap,
  type CardInstance,
  type DiceEffect,
  type DiceMatchAction,
  type DiceMatchConfig,
  type DiceMatchState,
  type DiceMatchStep,
  type DiceMutator,
  type GameEvent,
  type MatchPhase,
  type MatchResult,
  type MatchState,
  type PassiveEffect,
  type Position,
} from "../types";

export const ZONE_NAMES = ["Your Box", "Your Third", "Midfield", "Their Third", "Their Box"];

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

// ---------- chain math (pure, exported for UI + bots) ----------

function riskBase(state: DiceMatchState): number {
  const k = state.intent?.kind;
  if (k === "press") return state.bal.DICE.RISK_BASE_PRESS;
  if (k === "sitDeep") return state.bal.DICE.RISK_BASE_DEEP;
  return state.bal.DICE.RISK_BASE_BALANCED;
}

/** Risk that YOUR next pass is intercepted. First pass of a possession is free. */
export function interceptionRisk(state: DiceMatchState): number {
  if (state.possession !== "you" || state.passes === 0) return 0;
  const raw = riskBase(state) + state.bal.DICE.RISK_RAMP * (state.passes - 1) + state.nextRiskDelta;
  return Math.min(state.bal.DICE.RISK_CAP, Math.max(0.02, raw));
}

/** Risk that THEIR next pass is intercepted (your defense commits included). */
export function oppInterceptionRisk(state: DiceMatchState): number {
  const raw =
    state.bal.DICE.OPP_RISK_BASE +
    state.bal.DICE.OPP_RISK_RAMP * state.oppPasses +
    state.defenseCommit +
    mutatorSum(state.mutators, "oppRiskDelta");
  return Math.min(state.bal.DICE.RISK_CAP, Math.max(0.02, raw));
}

/** DC and win probability if you pressed SHOOT right now. */
export function shotEstimate(state: DiceMatchState): { dc: number; p: number } {
  const zonePen = state.bal.DICE.ZONE_DC_PENALTY[zoneOf(state.ball, state.bal)] ?? 0;
  const sitDeep = state.intent?.kind === "sitDeep" ? state.bal.DICE.SIT_DEEP_DC_BONUS : 0;
  const dc = state.keeperDC + zonePen + sitDeep;
  const p = Math.max(
    0.05,
    Math.min(0.95, (state.bal.DICE.SHOT_DIE - dc + 1 + state.shotQuality) / state.bal.DICE.SHOT_DIE),
  );
  return { dc, p };
}

function isDefenseCard(def: CardDef | undefined): boolean {
  return (def?.diceEffects ?? []).some((e) => e.kind === "defend");
}

export function effectsFor(def: CardDef, level: number): DiceEffect[] {
  return levelStats(def, level).diceEffects ?? def.diceEffects ?? [];
}

export function comboFor(
  last: Position | null,
  next: Position,
): { label: string; chance: number; riskDelta: number } | null {
  if (last === "MF" && next === "WG") return { label: "Switch of play", chance: 0, riskDelta: -0.08 };
  if (last === "WG" && next === "ST") return { label: "Delivered onto the run", chance: 3, riskDelta: 0 };
  if (last === "MF" && next === "ST") return { label: "Through the middle", chance: 2, riskDelta: 0 };
  return null;
}

// ---------- round flow ----------

function resetChain(draft: DiceMatchState): void {
  draft.passes = 0;
  draft.lastPassPosition = null;
  draft.nextChanceBonus = 0;
  draft.nextRiskDelta = 0;
  draft.defenseCommit = 0;
  draft.oppPasses = 0;
  draft.oppChance = 0;
  draft.shotQuality = 0;
}

function startRound(draft: DiceMatchState, events: GameEvent[]): void {
  draft.round += 1;
  resetChain(draft);
  draft.possession = draft.round % 2 === 1 ? "you" : "them";

  const bonusDice =
    passiveSum(draft, "roundStamina") +
    mutatorSum(draft.mutators, "poolDelta") +
    (draft.mode === "suddendeath" ? -1 : 0);
  const poolSize = Math.max(2, draft.bal.DICE.POOL_SIZE + bonusDice - draft.diePenalty);
  draft.diePenalty = 0;
  draft.dice = Array.from({ length: poolSize }, () => ({ value: rollDie(draft), used: false }));

  draft.rerollDieLeft = mutatorSum(draft.mutators, "rerollDie");

  const handSize = Math.max(2, draft.bal.DICE.HAND_SIZE + passiveSum(draft, "drawBonus") - draft.handPenalty);
  draft.handPenalty = 0;
  drawCards(draft, handSize - draft.hand.length, events);

  events.push({ type: "ROUND_START", round: draft.round, mode: draft.mode });
  events.push({ type: "DICE_ROLLED", dice: draft.dice.map((d) => d.value) });

  if (draft.possession === "you") {
    const intent = rollIntent(draft as unknown as MatchState);
    draft.intent = intent;
    events.push({ type: "INTENT_REVEALED", intent });
  } else {
    draft.intent = null;
  }
}

function finish(draft: DiceMatchState, result: Exclude<MatchResult, "pending">, events: GameEvent[]): void {
  draft.phase = "DONE";
  draft.result = result;
  events.push({ type: "MATCH_END", result, playerGoals: draft.playerGoals, oppGoals: draft.oppGoals });
}

function shootout(defs: CardDefMap, draft: DiceMatchState, events: GameEvent[]): void {
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

// Close out the current possession: clear the hand and dice, then advance to
// the next round, the push decision, or the result.
function concludeRound(defs: CardDefMap, draft: DiceMatchState, events: GameEvent[]): void {
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
  extraChance = 0,
): number {
  switch (eff.kind) {
    case "progress":
      moveBall(draft, eff.amount, events);
      return 0;
    case "progressFromDie":
      moveBall(draft, dieValue, events);
      return 0;
    case "shotQuality":
    case "shotQualityFromDie": {
      const base = eff.kind === "shotQuality" ? eff.amount : dieValue;
      const gained = base + draft.nextChanceBonus + draft.passes * draft.bal.DICE.DEVELOPMENT_GAIN + extraChance;
      draft.nextChanceBonus = 0;
      draft.shotQuality += gained;
      return gained;
    }
    case "safePass":
      draft.nextRiskDelta -= eff.amount;
      return 0;
    case "setupNext":
      draft.nextChanceBonus += eff.bonus;
      return 0;
    case "defend":
      draft.defenseCommit += eff.amount;
      return 0;
    case "draw":
      drawCards(draft, eff.amount, events);
      return 0;
  }
}

function chainIntercepted(defs: CardDefMap, draft: DiceMatchState, events: GameEvent[]): void {
  events.push({ type: "CHAIN_INTERCEPTED", byYou: false, passes: draft.passes, chanceLost: draft.shotQuality });
  draft.shotQuality = 0;
  const shallow = draft.ball < draft.bal.DICE.MIDFIELD ? draft.bal.DICE.COUNTER_SHALLOW_BONUS : 0;
  const gain = Math.min(
    draft.bal.DICE.OPP_CHANCE_CAP,
    Math.round(draft.opp.attackRating * draft.bal.DICE.OPP_CHANCE_PER_RATING),
  );
  const bonus = gain + shallow;
  const roll = 1 + Math.floor(rand(draft) * draft.bal.DICE.SHOT_DIE);
  const goal = roll + bonus >= draft.ownKeeperDC;
  events.push({ type: "COUNTER_SHOT", byYou: false, roll, bonus, dc: draft.ownKeeperDC, goal });
  if (goal) {
    draft.oppGoals += 1;
    events.push({ type: "GOAL_SCORED", goals: 0, total: draft.oppGoals });
  }
  draft.ball = draft.bal.DICE.MIDFIELD;
  concludeRound(defs, draft, events);
}

function oppPassAttempt(defs: CardDefMap, draft: DiceMatchState, events: GameEvent[]): void {
  const risk = oppInterceptionRisk(draft);
  if (rand(draft) < risk) {
    events.push({ type: "CHAIN_INTERCEPTED", byYou: true, passes: draft.oppPasses, chanceLost: draft.oppChance });
    const bonus = draft.bal.DICE.COUNTER_CHANCE + mutatorSum(draft.mutators, "counterSpring");
    const roll = 1 + Math.floor(rand(draft) * draft.bal.DICE.SHOT_DIE);
    const goal = roll + bonus >= draft.keeperDC;
    events.push({ type: "COUNTER_SHOT", byYou: true, roll, bonus, dc: draft.keeperDC, goal });
    if (goal) {
      draft.playerGoals += 1;
      events.push({ type: "GOAL_SCORED", goals: 1, total: draft.playerGoals });
    }
    draft.ball = draft.bal.DICE.MIDFIELD;
    concludeRound(defs, draft, events);
    return;
  }

  draft.oppPasses += 1;
  draft.oppChance += Math.min(
    draft.bal.DICE.OPP_CHANCE_CAP,
    Math.round(draft.opp.attackRating * draft.bal.DICE.OPP_CHANCE_PER_RATING),
  );
  moveBall(draft, -draft.bal.DICE.OPP_PASS_ADVANCE, events);
  events.push({ type: "OPP_PASS", passes: draft.oppPasses, oppChance: draft.oppChance, risk });

  const target = draft.bal.DICE.OPP_CHAIN_TARGET[draft.opp.style] ?? 3;
  if (draft.oppPasses >= target || draft.ball <= draft.bal.DICE.YOUR_BOX) {
    const zonePen = draft.bal.DICE.ZONE_DC_PENALTY[4 - zoneOf(draft.ball, draft.bal)] ?? 0;
    const dc = draft.ownKeeperDC + zonePen;
    const roll = 1 + Math.floor(rand(draft) * draft.bal.DICE.SHOT_DIE);
    const goal = roll + draft.oppChance >= dc;
    events.push({ type: "OPP_SHOT", roll, danger: draft.oppChance, dc, goal });
    if (goal) {
      draft.oppGoals += 1;
      events.push({ type: "GOAL_SCORED", goals: 0, total: draft.oppGoals });
    }
    draft.ball = draft.bal.DICE.MIDFIELD;
    concludeRound(defs, draft, events);
  }
}

function assignDie(defs: CardDefMap, draft: DiceMatchState, uid: string, dieIndex: number, events: GameEvent[]): void {
  const die = draft.dice[dieIndex];
  if (!die) throw new Error(`no die at index ${dieIndex}`);
  if (die.used) throw new Error("that die is already used");
  const cardIdx = draft.hand.findIndex((c) => c.uid === uid);
  if (cardIdx === -1) throw new Error(`card ${uid} not in hand`);
  const inst = draft.hand[cardIdx]!;
  const def = defs[inst.defId];
  if (!def || !def.slot) throw new Error(`card ${inst.defId} has no dice slot`);
  if (!dieFitsSlot(die.value, def.slot)) throw new Error(`die ${die.value} doesn't fit this card`);

  const defense = isDefenseCard(def);
  if (draft.possession === "you" && defense) throw new Error("you have the ball - defensive cards wait for their possession");
  if (draft.possession === "them" && !defense) throw new Error("they have the ball - commit defense or stand off");

  die.used = true;
  draft.hand.splice(cardIdx, 1);
  events.push({ type: "DIE_ASSIGNED", uid, die: die.value });
  events.push({ type: "CARD_PLAYED", uid, as: defense ? "defend" : "attack", cost: 0 });
  const discard = () => {
    if (def.exileOnPlay) draft.exile.push(inst);
    else draft.discardPile.push(inst);
  };

  if (draft.possession === "them") {
    const effects = effectsFor(def, inst.level);
    for (const eff of effects) applyDiceEffect(draft, eff, die.value, events);
    const amount = effects.reduce((a, e) => (e.kind === "defend" ? a + e.amount : a), 0);
    events.push({ type: "DEFENSE_COMMITTED", uid, cardName: def.name, die: die.value, amount, total: draft.defenseCommit });
    discard();
    oppPassAttempt(defs, draft, events);
    return;
  }

  const combo = def.position ? comboFor(draft.lastPassPosition, def.position) : null;
  const risk = interceptionRisk(draft);
  draft.nextRiskDelta = 0;
  if (risk > 0 && rand(draft) < risk) {
    discard();
    chainIntercepted(defs, draft, events);
    return;
  }

  let gained = 0;
  let comboChance = combo?.chance ?? 0;
  if (combo?.riskDelta) draft.nextRiskDelta += combo.riskDelta;
  for (const eff of effectsFor(def, inst.level)) {
    const extra = comboChance > 0 && (eff.kind === "shotQuality" || eff.kind === "shotQualityFromDie") ? comboChance : 0;
    gained += applyDiceEffect(draft, eff, die.value, events, extra);
    if (extra > 0) comboChance = 0;
  }
  draft.passes += 1;
  if (def.position) draft.lastPassPosition = def.position;
  events.push({
    type: "PASS_COMPLETED",
    uid,
    cardName: def.name,
    passes: draft.passes,
    chanceGained: gained,
    shotQuality: draft.shotQuality,
    risked: risk,
    combo: combo?.label,
  });
  discard();
}

function shoot(defs: CardDefMap, draft: DiceMatchState, events: GameEvent[]): void {
  if (draft.possession !== "you") throw new Error("you don't have the ball");
  if (draft.passes < 1) throw new Error("work at least one pass first");
  const { dc } = shotEstimate(draft);
  const roll = 1 + Math.floor(rand(draft) * draft.bal.DICE.SHOT_DIE);
  const goal = roll + draft.shotQuality >= dc;
  events.push({ type: "SHOT_TAKEN", roll, dc, quality: draft.shotQuality, goal });
  if (goal) {
    draft.playerGoals += 1;
    events.push({ type: "GOAL_SCORED", goals: 1, total: draft.playerGoals });
  }
  draft.shotQuality = 0;
  draft.ball = draft.bal.DICE.MIDFIELD;
  concludeRound(defs, draft, events);
}

function endRound(defs: CardDefMap, draft: DiceMatchState, events: GameEvent[]): void {
  if (draft.possession === "you") {
    concludeRound(defs, draft, events);
    return;
  }
  oppPassAttempt(defs, draft, events);
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
      cfg.balance.DICE.KEEPER_DC_BASE + Math.round(cfg.opp.attackRating * cfg.balance.DICE.KEEPER_DC_PER_RATING),
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
    passes: 0,
    lastPassPosition: null,
    nextChanceBonus: 0,
    nextRiskDelta: 0,
    defenseCommit: 0,
    oppPasses: 0,
    oppChance: 0,
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

export function applyDiceAction(defs: CardDefMap, state: DiceMatchState, action: DiceMatchAction): DiceMatchStep {
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
      shoot(defs, draft, events);
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
    const defense = isDefenseCard(def);
    if (state.possession === "you" && defense) continue;
    if (state.possession === "them" && !defense) continue;
    if (free.some((v) => dieFitsSlot(v, slot))) out.add(c.uid);
  }
  return out;
}

/** Best unused die index that fits a card's slot (for click-to-auto-assign). */
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
