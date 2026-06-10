// The campaign state machine: one run = one World Cup. Group stage (3 matches,
// table decides), then sudden-death knockouts to the final. Between matches:
// reward picks and the shop. Same reducer pattern as the match engine.

import { seedRng, nextFloat } from "../rng";
import { applyMatchAction, createMatch } from "../match/engine";
import {
  STAGE_ORDER,
  type ContentBundle,
  type GameEvent,
  type MatchState,
  type OppInfo,
  type RunAction,
  type RunState,
  type RunStep,
  type Stage,
  type TeamDef,
} from "../types";
import { emptyRow, playerGroupRank, recordResult, simulateOtherFixture } from "./group";
import { drawKnockoutOpponent } from "./bracket";
import { rollRewardOffer } from "./rewards";
import { buyCard, generateShop, releaseCard, rerollShop, trainCard } from "./shop";

function rand(draft: RunState): number {
  const [v, next] = nextFloat(draft.rng);
  draft.rng = next;
  return v;
}

function team(content: ContentBundle, id: string): TeamDef {
  const t = content.teams.find((x) => x.id === id);
  if (!t) throw new Error(`unknown team ${id}`);
  return t;
}

function nextStage(stage: Stage): Stage | null {
  const idx = STAGE_ORDER.indexOf(stage);
  return STAGE_ORDER[idx + 1] ?? null;
}

// ---------- run creation ----------

/** Pick 3 group opponents around the player's tier: one seed, one mid, one minnow. */
function pickGroupOpponents(draft: RunState, content: ContentBundle): string[] {
  const pool = content.teams.filter((t) => t.id !== draft.playerTeamId);
  const byTierBand = (tiers: number[]): TeamDef[] =>
    pool.filter((t) => tiers.includes(t.tier) && !draft.groupTeamIds.includes(t.id));
  const bands: number[][] = [
    [1, 2], // a seed
    [2, 3], // a mid
    [3, 4], // a minnow
  ];
  const picked: string[] = [];
  for (const band of bands) {
    let candidates = byTierBand(band).filter((t) => !picked.includes(t.id));
    if (candidates.length === 0)
      candidates = pool.filter((t) => !picked.includes(t.id));
    const choice = candidates[Math.floor(rand(draft) * candidates.length)]!;
    picked.push(choice.id);
  }
  return picked;
}

export function createRun(content: ContentBundle, seed: string, playerTeamId: string): RunState {
  team(content, playerTeamId); // validate
  const state: RunState = {
    version: 1,
    seed,
    playerTeamId,
    stage: "GROUP",
    matchIndexInStage: 0,
    phase: "IDLE",
    groupTeamIds: [],
    groupTable: [],
    groupFixtures: [],
    groupOpponentOrder: [],
    tiebreak: {},
    knockoutHistory: [],
    lastMatch: null,
    nextOppId: null,
    scouted: false,
    deck: [],
    uidCounter: 0,
    resources: {
      budget: content.balance.STARTING_BUDGET,
      scout: content.balance.STARTING_SCOUT,
    },
    activeMatch: null,
    pendingReward: null,
    shop: null,
    usedTeamIds: [],
    result: "active",
    rng: seedRng(seed),
  };

  state.deck = content.startingDeck.map((c) => ({
    uid: `run-${state.uidCounter++}`,
    defId: c.defId,
    level: c.level,
    formPower: 0,
    fatigued: false,
  }));

  state.groupTeamIds = pickGroupOpponents(state, content);
  state.groupTable = [playerTeamId, ...state.groupTeamIds].map(emptyRow);
  for (const id of [playerTeamId, ...state.groupTeamIds]) state.tiebreak[id] = rand(state);

  // shuffle the matchday order of the player's three group games
  const order = [...state.groupTeamIds];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand(state) * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  state.groupOpponentOrder = order;
  state.nextOppId = order[0]!;
  state.shop = generateShop(state, content);
  return state;
}

// ---------- matchup construction ----------

function buildOpp(content: ContentBundle, draft: RunState, teamId: string): OppInfo {
  const t = team(content, teamId);
  const style = content.styles[t.style];
  const stageMult = content.balance.STAGE_CLOCK_MULT[draft.stage];
  return {
    teamId: t.id,
    name: t.name,
    attackRating: Math.max(1, Math.round(t.attackRating * style.clockMult * stageMult)),
    style: t.style,
    tier: t.tier,
  };
}

function startMatch(draft: RunState, content: ContentBundle): GameEvent[] {
  if (draft.phase !== "IDLE") throw new Error("can only start a match between matches");
  if (!draft.nextOppId) throw new Error("no opponent scheduled");

  // fatigued cards sit the match out — unless that would gut the squad
  let matchDeck = draft.deck.filter((c) => !c.fatigued);
  if (matchDeck.length < content.balance.MIN_MATCH_DECK) matchDeck = [...draft.deck];

  const opp = buildOpp(content, draft, draft.nextOppId);
  const style = content.styles[team(content, draft.nextOppId).style];
  const step = createMatch(content.defs, {
    opp,
    styleEffects: style.effects,
    context: draft.stage === "GROUP" ? "group" : "knockout",
    deck: matchDeck.map((c) => ({ ...c, formPower: 0 })),
    rng: draft.rng,
    balance: content.balance,
  });
  // the match engine advances the shared rng; reclaim its post-shuffle state
  draft.rng = step.state.rng;
  draft.activeMatch = step.state;
  draft.phase = "MATCH";
  draft.shop = null;
  return step.events;
}

// ---------- match resolution ----------

function settleMatch(draft: RunState, content: ContentBundle, match: MatchState): void {
  const result = match.result;
  if (result === "pending") throw new Error("match is not finished");

  // sync fatigue back to the run deck; rested cards recover
  const playedUids = new Map<string, boolean>();
  for (const pile of [match.hand, match.drawPile, match.discardPile, match.exile, match.deployed]) {
    for (const inst of pile) playedUids.set(inst.uid, inst.fatigued);
  }
  for (const card of draft.deck) {
    if (playedUids.has(card.uid)) card.fatigued = playedUids.get(card.uid)!;
    else card.fatigued = false; // sat out -> recovered
  }

  // resources earned in-match (extra time bonuses etc.)
  draft.resources.budget += match.earned.budget;
  draft.resources.scout += match.earned.scout;

  const oppId = match.opp.teamId;
  draft.usedTeamIds.push(oppId);
  draft.rng = match.rng;
  draft.activeMatch = null;
  draft.lastMatch = {
    stage: draft.stage,
    oppId,
    playerGoals: match.playerGoals,
    oppGoals: match.oppGoals,
    result: result as "win" | "draw" | "loss",
    pushedRounds: match.extraRoundsPlayed,
  };

  const rewards = content.balance.REWARD_BUDGET;

  if (draft.stage === "GROUP") {
    recordResult(draft.groupTable, draft.playerTeamId, match.playerGoals, match.oppGoals);
    recordResult(draft.groupTable, oppId, match.oppGoals, match.playerGoals);
    simulateOtherFixture(draft, content.teams, draft.matchIndexInStage + 1);
    draft.matchIndexInStage += 1;

    if (result === "win") draft.resources.budget += rewards.groupWin;
    else if (result === "draw") draft.resources.budget += rewards.groupDraw;
    else draft.resources.budget += rewards.groupLoss;

    // beating a flair side pays a scouting bonus
    if (result === "win" && match.opp.style === "flair") draft.resources.scout += 1;

    const groupDone = draft.matchIndexInStage >= 3;
    if (groupDone) {
      const rank = playerGroupRank(draft);
      if (rank <= 2) {
        draft.stage = "R32";
        draft.matchIndexInStage = 0;
        draft.nextOppId = drawKnockoutOpponent(draft, content.teams, "R32");
      } else {
        draft.result = "eliminated";
        draft.phase = "DONE";
        draft.nextOppId = null;
        return;
      }
    } else {
      draft.nextOppId = draft.groupOpponentOrder[draft.matchIndexInStage]!;
    }

    if (result === "win" || result === "draw") {
      draft.pendingReward = rollRewardOffer(
        draft,
        content,
        result === "win" ? content.balance.REWARD_PICKS.win : content.balance.REWARD_PICKS.draw,
      );
      draft.phase = "REWARD";
    } else {
      draft.phase = "IDLE";
      draft.shop = generateShop(draft, content);
    }
  } else {
    // knockout
    draft.knockoutHistory.push({
      stage: draft.stage,
      oppId,
      playerGoals: match.playerGoals,
      oppGoals: match.oppGoals,
      result: result === "win" ? "win" : "loss",
    });
    if (result !== "win") {
      draft.result = "eliminated";
      draft.phase = "DONE";
      draft.nextOppId = null;
      return;
    }
    draft.resources.budget += rewards.knockoutWin;
    if (match.opp.style === "flair") draft.resources.scout += 1;

    if (draft.stage === "FINAL") {
      draft.result = "won";
      draft.phase = "DONE";
      draft.nextOppId = null;
      return;
    }
    const after = nextStage(draft.stage);
    if (after === null) throw new Error("unreachable: stage past FINAL");
    draft.stage = after;
    draft.nextOppId = drawKnockoutOpponent(draft, content.teams, after as Exclude<Stage, "GROUP">);
    draft.pendingReward = rollRewardOffer(draft, content, content.balance.REWARD_PICKS.win);
    draft.phase = "REWARD";
  }
  draft.scouted = false;
}

// ---------- public API ----------

export function applyRunAction(
  content: ContentBundle,
  state: RunState,
  action: RunAction,
): RunStep {
  if (state.phase === "DONE") throw new Error("run is over");
  const draft: RunState = structuredClone(state);
  let events: GameEvent[] = [];

  switch (action.type) {
    case "START_MATCH": {
      events = startMatch(draft, content);
      break;
    }

    case "MATCH_ACTION": {
      if (draft.phase !== "MATCH" || !draft.activeMatch)
        throw new Error("no match in progress");
      const step = applyMatchAction(content.defs, draft.activeMatch, action.action);
      draft.activeMatch = step.state;
      events = step.events;
      if (step.state.phase === "DONE") settleMatch(draft, content, step.state);
      break;
    }

    case "PICK_REWARD": {
      if (draft.phase !== "REWARD" || !draft.pendingReward) throw new Error("no reward pending");
      const defId = draft.pendingReward.defIds[action.index];
      if (!defId) throw new Error(`no reward option ${action.index}`);
      draft.deck.push({
        uid: `run-${draft.uidCounter++}`,
        defId,
        level: 0,
        formPower: 0,
        fatigued: false,
      });
      draft.pendingReward = null;
      draft.phase = "IDLE";
      draft.shop = generateShop(draft, content);
      break;
    }

    case "SKIP_REWARD": {
      if (draft.phase !== "REWARD" || !draft.pendingReward) throw new Error("no reward pending");
      draft.resources.budget += content.balance.REWARD_BUDGET.skipPick;
      draft.pendingReward = null;
      draft.phase = "IDLE";
      draft.shop = generateShop(draft, content);
      break;
    }

    case "BUY_CARD": {
      requireIdle(draft);
      buyCard(draft, content, action.index);
      break;
    }
    case "TRAIN_CARD": {
      requireIdle(draft);
      trainCard(draft, content, action.uid);
      break;
    }
    case "RELEASE_CARD": {
      requireIdle(draft);
      releaseCard(draft, content, action.uid);
      break;
    }
    case "REROLL_SHOP": {
      requireIdle(draft);
      rerollShop(draft, content);
      break;
    }
    case "SCOUT_OPPONENT": {
      requireIdle(draft);
      if (draft.scouted) throw new Error("opponent already scouted");
      const price = content.balance.SHOP_PRICES.scoutOpponent;
      if (draft.resources.scout < price) throw new Error("not enough scout points");
      draft.resources.scout -= price;
      draft.scouted = true;
      break;
    }
  }

  return { state: draft, events };
}

function requireIdle(state: RunState): void {
  if (state.phase !== "IDLE")
    throw new Error(`action requires the between-match phase, run is in ${state.phase}`);
}
