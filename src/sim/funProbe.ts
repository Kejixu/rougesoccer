// Throwaway: instruments matches to measure the STRUCTURAL ingredients of fun.
// Not a balance sim — it records decision texture, dopamine-beat frequency,
// near-miss rate, and whether nations actually play differently.

import { makeContent } from "../data/content";
import { createRun, applyRunAction } from "../core/run/run";
import { playableCards } from "../core/match/dice";
import { makeGreedyBot } from "./strategies";
import type { DiceMatchState, GameEvent, RunState } from "../core/types";

const content = makeContent();

interface MatchStats {
  rounds: number;
  attackRounds: number;
  defenseRounds: number;
  decisionsWithChoice: number; // rounds where >1 distinct card was playable
  forcedDecisions: number; // exactly 1 playable card
  deadAttackRounds: number; // your possession, 0 playable attacking cards
  standOffOnly: number; // their possession, 0 playable defense cards (legal stand off)
  shots: number;
  goalsFor: number;
  goalsAgainst: number;
  shotRolls: { roll: number; quality: number; dc: number; goal: boolean }[];
  rerolls: number;
  // bite metrics
  rolesSum: number; // distinct roles (defend/progress/finish) doable this round, 0..3
  oneRoleRounds: number; // the roll dictates posture: only one role doable
  highDice: number; // dice >=5 rolled
  highWanters: number; // cards in hand that want a high die (min5/min6/fromDie finishers)
  chains: number; // your possessions with at least one completed pass
  passesTotal: number;
  intercepted: number; // your chain got picked
  oppIntercepted: number; // you picked their chain
  counterGoalsFor: number;
  counterGoalsAgainst: number;
  corners: number;
  rattledConversions: number; // goals scored on a shot while the keeper was rattled
  rattledPending: boolean;
}

const ROLE_OF: Record<string, "defend" | "progress" | "finish"> = {};
for (const d of content.cardPool) {
  const effs = d.diceEffects ?? [];
  ROLE_OF[d.id] = effs.some((e) => e.kind === "defend")
    ? "defend"
    : effs.some((e) => e.kind === "shotQuality" || e.kind === "shotQualityFromDie" || e.kind === "setupNext")
      ? "finish"
      : "progress";
}

function distinctPlayableCards(m: DiceMatchState): number {
  const ids = new Set<string>();
  for (const uid of playableCards(content.defs, m)) {
    const c = m.hand.find((x) => x.uid === uid);
    if (c) ids.add(c.defId);
  }
  return ids.size;
}

function rolesDoable(m: DiceMatchState): Set<string> {
  const roles = new Set<string>();
  for (const uid of playableCards(content.defs, m)) {
    const c = m.hand.find((x) => x.uid === uid);
    if (c) roles.add(ROLE_OF[c.defId]!);
  }
  return roles;
}

function probe(team: string, seed: string): { matches: MatchStats[]; result: string } {
  const bot = makeGreedyBot();
  let state: RunState = createRun(content, seed, team);
  const matches: MatchStats[] = [];
  let cur: MatchStats | null = null;
  let lastMatchActive = false;

  for (let guard = 0; guard < 8000 && state.phase !== "DONE"; guard++) {
    const inMatch = state.phase === "MATCH" && !!state.activeMatch;
    if (inMatch && !lastMatchActive) {
      cur = {
        rounds: 0,
        attackRounds: 0,
        defenseRounds: 0,
        decisionsWithChoice: 0,
        forcedDecisions: 0,
        deadAttackRounds: 0,
        standOffOnly: 0,
        shots: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        shotRolls: [],
        rerolls: 0,
        rolesSum: 0,
        oneRoleRounds: 0,
        highDice: 0,
        highWanters: 0,
        chains: 0,
        passesTotal: 0,
        intercepted: 0,
        oppIntercepted: 0,
        counterGoalsFor: 0,
        counterGoalsAgainst: 0,
        corners: 0,
        rattledConversions: 0,
        rattledPending: false,
      };
    }
    lastMatchActive = inMatch;

    let evs: GameEvent[] = [];
    if (inMatch) {
      const m = state.activeMatch!;
      if (m.phase === "ROUND_ACTIVE" && cur) {
        // sample once per round, at the round's first active decision (fresh dice)
        if (m.dice.every((d) => !d.used)) {
          const n = distinctPlayableCards(m);
          cur.rounds++;
          if (m.possession === "you") cur.attackRounds++;
          else cur.defenseRounds++;
          if (n === 0 && m.possession === "you") cur.deadAttackRounds++;
          else if (n === 0 && m.possession === "them") cur.standOffOnly++;
          else if (n === 1) cur.forcedDecisions++;
          else cur.decisionsWithChoice++;

          const roles = rolesDoable(m);
          cur.rolesSum += roles.size;
          if (roles.size === 1) cur.oneRoleRounds++;

          cur.highDice += m.dice.filter((d) => d.value >= 5).length;
          cur.highWanters += m.hand.filter((c) => {
            const slot = content.defs[c.defId]?.slot;
            const eff = content.defs[c.defId]?.diceEffects ?? [];
            const wantsHigh = slot?.kind === "min" && slot.value >= 5;
            const scalesUp = eff.some((e) => e.kind === "shotQualityFromDie" || e.kind === "progressFromDie");
            return wantsHigh || scalesUp;
          }).length;
        }
      }
      const action = bot.matchAction(content, m);
      const r = applyRunAction(content, state, { type: "MATCH_ACTION", action });
      state = r.state;
      evs = r.events;
    } else {
      const r = applyRunAction(content, state, bot.runAction(content, state));
      state = r.state;
      evs = r.events;
    }

    const c = cur;
    if (c) {
      for (const e of evs) {
        if (e.type === "SHOT_TAKEN") {
          c.shots++;
          c.shotRolls.push({ roll: e.roll, quality: e.quality, dc: e.dc, goal: e.goal });
          if (c.rattledPending && e.goal) c.rattledConversions++;
          c.rattledPending = false;
        }
        if (e.type === "PASS_COMPLETED") {
          if (e.passes === 1) c.chains++;
          c.passesTotal++;
        }
        if (e.type === "CHAIN_INTERCEPTED") {
          if (e.byYou) c.oppIntercepted++;
          else c.intercepted++;
        }
        if (e.type === "COUNTER_SHOT") {
          if (e.byYou) c.shots++;
          if (e.byYou) {
            if (c.rattledPending && e.goal) c.rattledConversions++;
            c.rattledPending = false;
          }
          if (e.goal) {
            if (e.byYou) c.counterGoalsFor++;
            else c.counterGoalsAgainst++;
          }
        }
        if (e.type === "CORNER_EARNED") c.corners++;
        if (e.type === "KEEPER_RATTLED") c.rattledPending = true;
        if (e.type === "DIE_REROLLED") c.rerolls++;
        if (e.type === "MATCH_END") {
          c.goalsFor = e.playerGoals;
          c.goalsAgainst = e.oppGoals;
          matches.push(c);
          cur = null;
        }
      }
    }
  }
  return { matches, result: state.result ?? "?" };
}

function summarize(team: string) {
  const N = 40;
  let totRounds = 0,
    attackRounds = 0,
    defenseRounds = 0,
    choice = 0,
    forced = 0,
    dead = 0,
    standOffOnly = 0,
    shots = 0,
    goals = 0,
    goalsAg = 0,
    rerolls = 0,
    matchCount = 0;
  let nearMiss = 0,
    blowoutShots = 0,
    wins = 0;
  let rolesSum = 0,
    oneRole = 0,
    highDice = 0,
    highWanters = 0,
    chains = 0,
    passesTotal = 0,
    intercepted = 0,
    oppIntercepted = 0,
    counterGoalsFor = 0,
    counterGoalsAgainst = 0,
    corners = 0,
    rattledConversions = 0;
  for (let i = 0; i < N; i++) {
    const { matches, result } = probe(team, `${team}-fun-${i}`);
    if (result === "won") wins++;
    for (const m of matches) {
      matchCount++;
      totRounds += m.rounds;
      attackRounds += m.attackRounds;
      defenseRounds += m.defenseRounds;
      choice += m.decisionsWithChoice;
      forced += m.forcedDecisions;
      dead += m.deadAttackRounds;
      standOffOnly += m.standOffOnly;
      shots += m.shots;
      goals += m.goalsFor;
      goalsAg += m.goalsAgainst;
      rerolls += m.rerolls;
      rolesSum += m.rolesSum;
      oneRole += m.oneRoleRounds;
      highDice += m.highDice;
      highWanters += m.highWanters;
      chains += m.chains;
      passesTotal += m.passesTotal;
      intercepted += m.intercepted;
      oppIntercepted += m.oppIntercepted;
      counterGoalsFor += m.counterGoalsFor;
      counterGoalsAgainst += m.counterGoalsAgainst;
      corners += m.corners;
      rattledConversions += m.rattledConversions;
      for (const s of m.shotRolls) {
        const total = s.roll + s.quality;
        const margin = total - s.dc;
        if (!s.goal && margin >= -2) nearMiss++; // missed by a whisker
        if (s.goal && margin >= 6) blowoutShots++; // never in doubt
      }
    }
  }
  const decisions = choice + forced + dead + standOffOnly;
  return {
    team,
    runWin: `${Math.round((wins / N) * 100)}%`,
    roundsPerMatch: (totRounds / matchCount).toFixed(1),
    // bite: how often the roll forces a single posture, and avg roles available (3 = no pressure)
    avgRolesAvail: (rolesSum / decisions).toFixed(2),
    oneRoleShare: `${Math.round((oneRole / decisions) * 100)}%`,
    passesPerChain: chains ? (passesTotal / chains).toFixed(2) : "0.00",
    interceptedShare: chains ? `${Math.round((intercepted / chains) * 100)}%` : "0%",
    oppInterceptedShare: `${Math.round((oppIntercepted / decisions) * 100)}%`,
    highDiePerRound: (highDice / decisions).toFixed(2),
    highWantersPerRound: (highWanters / decisions).toFixed(2),
    contention: ((highWanters - highDice) / decisions).toFixed(2),
    deadAttackRounds: `${Math.round((dead / attackRounds) * 100)}%`,
    standOffOnly: `${Math.round((standOffOnly / defenseRounds) * 100)}%`,
    shotsPerMatch: (shots / matchCount).toFixed(1),
    goalsPerMatch: (goals / matchCount).toFixed(1),
    oppGoalsPerMatch: (goalsAg / matchCount).toFixed(1),
    counterGoalsFor: (counterGoalsFor / matchCount).toFixed(2),
    counterGoalsAgainst: (counterGoalsAgainst / matchCount).toFixed(2),
    cornersPerMatch: (corners / matchCount).toFixed(2),
    rattledConversions: (rattledConversions / matchCount).toFixed(2),
    nearMissPerMatch: (nearMiss / matchCount).toFixed(2),
  };
}

for (const team of ["bra", "mex", "usa", "can"]) {
  console.log(JSON.stringify(summarize(team)));
}
