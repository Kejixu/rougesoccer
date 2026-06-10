// The match state machine. Pure & deterministic: applyMatchAction(defs, state,
// action) -> { state, events }. No DOM, no timers, no ambient randomness — all
// randomness flows through the RngState carried inside MatchState.

import { nextFloat, type RngState } from "../rng";
import { clockTick } from "./clock";
import { computeAttack, type AttackCard } from "./scoring";
import {
  levelStats,
  type CardDefMap,
  type CardInstance,
  type GameEvent,
  type MatchAction,
  type MatchContext,
  type MatchState,
  type MatchStep,
  type OppInfo,
  type EffectDef,
} from "../types";
import type { BalanceConfig } from "../balance";

export interface MatchConfig {
  opp: OppInfo;
  styleEffects: EffectDef[];
  context: MatchContext;
  deck: CardInstance[];
  rng: RngState;
  balance: BalanceConfig;
}

// ---------- rng helpers (advance the state's own rng) ----------

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

// ---------- pile helpers ----------

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

function takeFromHand(draft: MatchState, uids: string[]): CardInstance[] {
  const taken: CardInstance[] = [];
  for (const uid of uids) {
    const idx = draft.hand.findIndex((c) => c.uid === uid);
    if (idx === -1) throw new Error(`card ${uid} is not in hand`);
    taken.push(draft.hand.splice(idx, 1)[0]!);
  }
  return taken;
}

export function defenseRating(defs: CardDefMap, state: MatchState): number {
  let total = 0;
  for (const inst of state.deployed) {
    const def = defs[inst.defId];
    if (!def) continue;
    total += levelStats(def, inst.level).defense ?? 0;
  }
  return total;
}

function addOppClockPoints(draft: MatchState, points: number): number {
  draft.oppClockPoints += points;
  const goals = Math.floor(draft.oppClockPoints / draft.bal.GOAL_THRESHOLD);
  draft.oppClockPoints -= goals * draft.bal.GOAL_THRESHOLD;
  draft.oppGoals += goals;
  return goals;
}

// ---------- style effects (scripted registry interpretation) ----------

function fireStyleEffects(
  draft: MatchState,
  trigger: "onMatchStart" | "onRoundStart" | "onAttackResolve",
  events: GameEvent[],
  attackGoals?: number,
): void {
  for (const eff of draft.styleEffects) {
    if (eff.trigger !== trigger) continue;
    if (eff.op.kind !== "scripted") continue;
    switch (eff.op.key) {
      case "capMultAt2x":
        draft.multCap = 2;
        break;
      case "shrinkHand1":
        draft.handSizeMod = -1;
        break;
      case "forceRandomDiscard1": {
        if (draft.hand.length === 0) break;
        const idx = randInt(draft, draft.hand.length);
        const card = draft.hand.splice(idx, 1)[0]!;
        draft.discardPile.push(card);
        events.push({ type: "CARDS_DISCARDED", uids: [card.uid], forced: true });
        break;
      }
      case "burstClockOnFailedAttack": {
        if (attackGoals === 0) {
          const pts = draft.bal.COUNTER_BURST_POINTS;
          addOppClockPoints(draft, pts);
          events.push({ type: "CLOCK_BURST", points: pts });
        }
        break;
      }
    }
  }
}

// ---------- round flow ----------

function startRound(defs: CardDefMap, draft: MatchState, events: GameEvent[]): void {
  draft.round += 1;
  const sd = draft.mode === "suddendeath";
  draft.playsLeft = sd ? 1 : draft.bal.PLAYS_PER_ROUND;
  draft.discardsLeft = sd ? 1 : draft.bal.DISCARDS_PER_ROUND;
  events.push({ type: "ROUND_START", round: draft.round, mode: draft.mode });
  const handSize = Math.max(1, draft.bal.HAND_SIZE + draft.handSizeMod);
  drawCards(draft, handSize - draft.hand.length, events);
  fireStyleEffects(draft, "onRoundStart", events);
  void defs;
}

function finish(
  draft: MatchState,
  result: "win" | "draw" | "loss",
  events: GameEvent[],
): void {
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
  const pool = [
    ...draft.hand,
    ...draft.drawPile,
    ...draft.discardPile,
    ...draft.deployed,
  ];
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

function enterSuddenDeath(defs: CardDefMap, draft: MatchState, events: GameEvent[]): void {
  draft.mode = "suddendeath";
  events.push({ type: "SUDDEN_DEATH_START" });
  startRound(defs, draft, events);
}

function endRound(defs: CardDefMap, draft: MatchState, events: GameEvent[]): void {
  // Opponent clock tick
  const tick = clockTick({
    attackRating: draft.opp.attackRating,
    clockMult: draft.mode === "extratime" ? draft.bal.EXTRA_TIME_CLOCK_MULT : 1,
    defense: defenseRating(defs, draft),
    currentPoints: draft.oppClockPoints,
    goalThreshold: draft.bal.GOAL_THRESHOLD,
    floorRatio: draft.bal.CLOCK_FLOOR_RATIO,
  });
  draft.oppClockPoints = tick.newPoints;
  draft.oppGoals += tick.oppGoalsScored;
  events.push({
    type: "CLOCK_TICK",
    points: tick.effectiveRate,
    totalPoints: draft.oppClockPoints,
    oppGoals: draft.oppGoals,
  });

  const leading = draft.playerGoals > draft.oppGoals;
  const tied = draft.playerGoals === draft.oppGoals;

  switch (draft.mode) {
    case "regulation": {
      if (draft.round < draft.bal.MATCH_ROUNDS) {
        startRound(defs, draft, events);
        return;
      }
      if (leading) {
        draft.phase = "PUSH_DECISION";
        events.push({
          type: "PUSH_DECISION",
          playerGoals: draft.playerGoals,
          oppGoals: draft.oppGoals,
        });
      } else if (tied) {
        if (draft.context === "group") finish(draft, "draw", events);
        else enterSuddenDeath(defs, draft, events);
      } else {
        finish(draft, "loss", events);
      }
      return;
    }
    case "extratime": {
      if (leading) {
        draft.earned.budget += draft.bal.ET_BUDGET_REWARD;
        draft.earned.scout += draft.bal.ET_SCOUT_REWARD;
        events.push({
          type: "ET_SURVIVED",
          budget: draft.bal.ET_BUDGET_REWARD,
          scout: draft.bal.ET_SCOUT_REWARD,
        });
        if (draft.extraRoundsPlayed < draft.bal.MAX_EXTRA_ROUNDS) {
          draft.phase = "PUSH_DECISION";
          events.push({
            type: "PUSH_DECISION",
            playerGoals: draft.playerGoals,
            oppGoals: draft.oppGoals,
          });
        } else {
          finish(draft, "win", events);
        }
      } else if (tied) {
        if (draft.context === "group") finish(draft, "draw", events);
        else enterSuddenDeath(defs, draft, events);
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
        startRound(defs, draft, events);
      } else {
        shootout(defs, draft, events);
      }
      return;
    }
  }
}

// ---------- public API ----------

export function createMatch(defs: CardDefMap, cfg: MatchConfig): MatchStep {
  const state: MatchState = {
    phase: "ROUND_ACTIVE",
    mode: "regulation",
    context: cfg.context,
    opp: cfg.opp,
    styleEffects: cfg.styleEffects,
    bal: cfg.balance,
    round: 0,
    playerGoals: 0,
    oppGoals: 0,
    oppClockPoints: 0,
    multCap: null,
    handSizeMod: 0,
    hand: [],
    drawPile: cfg.deck.map((c) => ({ ...c })),
    discardPile: [],
    exile: [],
    deployed: [],
    playsLeft: 0,
    discardsLeft: 0,
    extraRoundsPlayed: 0,
    suddenDeathRoundsPlayed: 0,
    earned: { budget: 0, scout: 0 },
    result: "pending",
    rng: cfg.rng,
  };
  const events: GameEvent[] = [{ type: "MATCH_START", opp: cfg.opp }];
  shuffleInPlace(state, state.drawPile);
  fireStyleEffects(state, "onMatchStart", events);
  startRound(defs, state, events);
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
    case "ATTACK": {
      assertPhase(draft, "ROUND_ACTIVE");
      if (draft.playsLeft <= 0) throw new Error("no plays left this round");
      const n = action.cardUids.length;
      if (n < 1 || n > draft.bal.MAX_ATTACK_CARDS)
        throw new Error(`attack must commit 1-${draft.bal.MAX_ATTACK_CARDS} cards`);
      const insts = takeFromHand(draft, action.cardUids);
      const cards: AttackCard[] = insts.map((inst) => {
        const def = defs[inst.defId];
        if (!def) throw new Error(`unknown card def ${inst.defId}`);
        return { inst, def };
      });
      const hasPower = cards.some(
        (c) => (levelStats(c.def, c.inst.level).power ?? 0) + c.inst.formPower > 0,
      );
      if (!hasPower) throw new Error("attack needs at least one card with power");

      const outcome = computeAttack(cards, {
        handSizeAfter: draft.hand.length,
        leading: draft.playerGoals > draft.oppGoals,
        trailing: draft.playerGoals < draft.oppGoals,
        multCap: draft.multCap,
        goalThreshold: draft.bal.GOAL_THRESHOLD,
      });

      for (const c of cards) events.push({ type: "CARD_PLAYED", uid: c.inst.uid, as: "attack" });
      events.push({
        type: "SHOT_VALUE",
        basePower: outcome.basePower,
        mult: outcome.totalMult,
        value: outcome.value,
      });

      draft.playerGoals += outcome.goals;
      if (outcome.goals > 0)
        events.push({ type: "GOAL_SCORED", goals: outcome.goals, total: draft.playerGoals });

      for (const gain of outcome.formGains) {
        const inst = insts.find((c) => c.uid === gain.uid);
        if (inst && inst.formPower < draft.bal.FORM_CAP) {
          inst.formPower = Math.min(draft.bal.FORM_CAP, inst.formPower + gain.amount);
          events.push({
            type: "FORM_GAINED",
            uid: inst.uid,
            amount: gain.amount,
            formPower: inst.formPower,
          });
        }
      }

      draft.earned.budget += outcome.budget;
      draft.earned.scout += outcome.scout;

      const fatigued: string[] = [];
      for (const inst of insts) {
        const def = defs[inst.defId]!;
        if (draft.mode === "extratime" && draft.extraRoundsPlayed >= 2 && !inst.fatigued) {
          inst.fatigued = true;
          fatigued.push(inst.uid);
        }
        if (def.exileOnPlay) draft.exile.push(inst);
        else draft.discardPile.push(inst);
      }
      if (fatigued.length > 0) events.push({ type: "CARD_FATIGUED", uids: fatigued });

      if (outcome.draws > 0) drawCards(draft, outcome.draws, events);
      fireStyleEffects(draft, "onAttackResolve", events, outcome.goals);
      draft.playsLeft -= 1;
      break;
    }

    case "DEFEND": {
      assertPhase(draft, "ROUND_ACTIVE");
      if (draft.playsLeft <= 0) throw new Error("no plays left this round");
      const n = action.cardUids.length;
      if (n < 1 || n > draft.bal.MAX_DEFEND_CARDS)
        throw new Error(`defend deploys 1-${draft.bal.MAX_DEFEND_CARDS} cards`);
      if (draft.deployed.length + n > draft.bal.MAX_DEPLOYED)
        throw new Error(`only ${draft.bal.MAX_DEPLOYED} defender slots`);
      const insts = takeFromHand(draft, action.cardUids);
      const fatigued: string[] = [];
      for (const inst of insts) {
        const def = defs[inst.defId];
        if (!def) throw new Error(`unknown card def ${inst.defId}`);
        if ((levelStats(def, inst.level).defense ?? 0) <= 0)
          throw new Error(`${def.name} has no defense and cannot be deployed`);
        if (draft.mode === "extratime" && draft.extraRoundsPlayed >= 2 && !inst.fatigued) {
          inst.fatigued = true;
          fatigued.push(inst.uid);
        }
        draft.deployed.push(inst);
        events.push({ type: "CARD_PLAYED", uid: inst.uid, as: "defend" });
      }
      if (fatigued.length > 0) events.push({ type: "CARD_FATIGUED", uids: fatigued });
      draft.playsLeft -= 1;
      break;
    }

    case "DISCARD": {
      assertPhase(draft, "ROUND_ACTIVE");
      if (draft.discardsLeft <= 0) throw new Error("no discards left this round");
      const n = action.cardUids.length;
      if (n < 1 || n > draft.bal.MAX_DISCARD_CARDS)
        throw new Error(`discard 1-${draft.bal.MAX_DISCARD_CARDS} cards`);
      const insts = takeFromHand(draft, action.cardUids);
      for (const inst of insts) {
        const def = defs[inst.defId];
        draft.discardPile.push(inst);
        if (def) {
          for (const eff of def.effects) {
            if (eff.trigger !== "onDiscard") continue;
            if (eff.op.kind === "draw") drawCards(draft, eff.op.amount, events);
            else if (eff.op.kind === "gainResource") {
              if (eff.op.resource === "budget") draft.earned.budget += eff.op.amount;
              else draft.earned.scout += eff.op.amount;
            }
          }
        }
      }
      events.push({ type: "CARDS_DISCARDED", uids: action.cardUids, forced: false });
      drawCards(draft, n, events);
      draft.discardsLeft -= 1;
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
      startRound(defs, draft, events);
      break;
    }
  }

  return { state: draft, events };
}

function assertPhase(state: MatchState, phase: MatchState["phase"]): void {
  if (state.phase !== phase)
    throw new Error(`action requires phase ${phase}, but match is in ${state.phase}`);
}
