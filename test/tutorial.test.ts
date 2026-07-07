import { describe, expect, it } from "vitest";
import { applyDiceAction, bestDieFor } from "../src/core/match/dice";
import type { DiceMatchAction, DiceMatchState, GameEvent } from "../src/core/types";
import { DICE_CARD_MAP } from "../src/data/diceCards";
import {
  COACH_TIP_KEYS,
  TUTORIAL_STEPS,
  createTutorialMatch,
  tutorialLockAllows,
  type TutorialActionIntent,
} from "../src/ui/tutorialScript";

function startTutorialMatch(): DiceMatchState {
  return createTutorialMatch().state;
}

function playCard(state: DiceMatchState, defId: string): { state: DiceMatchState; events: GameEvent[] } {
  const card = state.hand.find((c) => c.defId === defId);
  if (!card) {
    throw new Error(`${defId} not in hand. Hand: ${state.hand.map((c) => c.defId).join(", ")}`);
  }
  const dieIndex = bestDieFor(DICE_CARD_MAP, state, card.uid);
  if (dieIndex < 0) {
    throw new Error(`${defId} has no fitting die. Dice: ${state.dice.map((d) => `${d.value}:${d.used}`).join(", ")}`);
  }
  return applyDiceAction(DICE_CARD_MAP, state, { type: "ASSIGN_DIE", uid: card.uid, dieIndex });
}

function act(state: DiceMatchState, action: DiceMatchAction): { state: DiceMatchState; events: GameEvent[] } {
  return applyDiceAction(DICE_CARD_MAP, state, action);
}

function matchingEvents<T extends GameEvent["type"]>(
  events: GameEvent[],
  type: T,
): Extract<GameEvent, { type: T }>[] {
  return events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
}

describe("guided tutorial lock matching", () => {
  it("ships the locked sixteen-step script in order", () => {
    expect(TUTORIAL_STEPS.map((step) => [step.id, step.lock])).toEqual([
      ["welcome", { kind: "next" }],
      ["make-pass", { kind: "playCard", defId: "d_shortpass" }],
      ["one-more", { kind: "playCard", defId: "d_throughball" }],
      ["recycle", { kind: "endRound" }],
      ["stand-off", { kind: "endRound" }],
      ["commit-keeper", { kind: "playCard", defId: "d_keeper" }],
      ["drive-forward", { kind: "playCard", defId: "d_drivingrun" }],
      ["bank-chance", { kind: "playCard", defId: "d_poacher" }],
      ["cash-it-in", { kind: "shoot" }],
      ["weather-it", { kind: "standOffUntilRoundEnds" }],
      ["bank-it-again", { kind: "playCard", defId: "d_finish" }],
      ["safety-valve", { kind: "playCard", defId: "d_sideways" }],
      ["kill-the-ball", { kind: "endRound" }],
      ["see-it-out", { kind: "standOffUntilRoundEnds" }],
      ["whistle-question", { kind: "takeWin" }],
      ["loop", { kind: "next" }],
    ]);
  });

  it("allows only the action described by the active lock", () => {
    const playShort: TutorialActionIntent = { kind: "playCard", defId: "d_shortpass" };
    const playFinish: TutorialActionIntent = { kind: "playCard", defId: "d_finish" };

    expect(tutorialLockAllows({ kind: "playCard", defId: "d_shortpass" }, playShort)).toBe(true);
    expect(tutorialLockAllows({ kind: "playCard", defId: "d_shortpass" }, playFinish)).toBe(false);
    expect(tutorialLockAllows({ kind: "shoot" }, { kind: "shoot" })).toBe(true);
    expect(tutorialLockAllows({ kind: "shoot" }, { kind: "endRound" })).toBe(false);
    expect(tutorialLockAllows({ kind: "endRound" }, { kind: "endRound" })).toBe(true);
    expect(tutorialLockAllows({ kind: "endRound" }, { kind: "shoot" })).toBe(false);
    expect(tutorialLockAllows({ kind: "takeWin" }, { kind: "takeWin" })).toBe(true);
    expect(tutorialLockAllows({ kind: "takeWin" }, { kind: "extraTime" })).toBe(false);
    expect(tutorialLockAllows({ kind: "next" }, { kind: "next" })).toBe(true);
    expect(tutorialLockAllows({ kind: "next" }, { kind: "endRound" })).toBe(false);
    expect(tutorialLockAllows({ kind: "standOffUntilRoundEnds" }, { kind: "endRound" })).toBe(true);
    expect(tutorialLockAllows({ kind: "standOffUntilRoundEnds" }, { kind: "playCard", defId: "d_clearance" })).toBe(false);
  });

  it("lists all regular coach-tip keys for completion and skip marking", () => {
    expect(COACH_TIP_KEYS).toEqual(["possession", "risk", "chance", "punt", "defense", "push"]);
  });
});

describe("guided tutorial golden seed", () => {
  it("replays the locked tutorial beats deterministically", () => {
    let state = startTutorialMatch();
    const beats: GameEvent[] = [];

    let step = playCard(state, "d_shortpass");
    state = step.state;
    beats.push(...step.events);
    expect(matchingEvents(step.events, "PASS_COMPLETED")[0]).toMatchObject({ passes: 1, risked: 0 });

    step = playCard(state, "d_throughball");
    state = step.state;
    beats.push(...step.events);
    expect(matchingEvents(step.events, "PASS_COMPLETED")[0]).toMatchObject({ passes: 2 });
    expect(state.nextChanceBonus).toBe(4);

    step = act(state, { type: "END_ROUND" });
    state = step.state;
    beats.push(...step.events);
    expect(state.round).toBe(2);
    expect(state.possession).toBe("them");

    step = act(state, { type: "END_ROUND" });
    state = step.state;
    beats.push(...step.events);
    expect(matchingEvents(step.events, "OPP_PASS")[0]).toMatchObject({ passes: 1 });
    expect(state.round).toBe(2);

    step = playCard(state, "d_keeper");
    state = step.state;
    beats.push(...step.events);
    expect(matchingEvents(step.events, "CHAIN_INTERCEPTED")[0]).toMatchObject({ byYou: true });
    expect(matchingEvents(step.events, "COUNTER_SHOT")[0]).toMatchObject({ byYou: true, goal: true });
    expect(state.playerGoals).toBe(1);
    expect(state.round).toBe(3);

    step = playCard(state, "d_drivingrun");
    state = step.state;
    beats.push(...step.events);
    expect(matchingEvents(step.events, "PASS_COMPLETED")[0]).toMatchObject({ passes: 1, risked: 0 });

    step = playCard(state, "d_poacher");
    state = step.state;
    beats.push(...step.events);
    expect(state.shotQuality).toBe(6);

    step = act(state, { type: "SHOOT" });
    state = step.state;
    beats.push(...step.events);
    expect(matchingEvents(step.events, "SHOT_TAKEN")[0]).toMatchObject({ goal: true });
    expect(state.playerGoals).toBe(2);
    expect(state.round).toBe(4);

    const beforeRound4Goals = { player: state.playerGoals, opp: state.oppGoals };
    while (state.round === 4) {
      step = act(state, { type: "END_ROUND" });
      state = step.state;
      beats.push(...step.events);
    }
    expect(state.round).toBe(5);
    expect(state.playerGoals).toBe(beforeRound4Goals.player);
    expect(state.oppGoals).toBe(beforeRound4Goals.opp);
    expect(state.oppGoals).toBe(0);

    step = playCard(state, "d_finish");
    state = step.state;
    beats.push(...step.events);
    expect(state.shotQuality).toBeGreaterThan(0);

    step = playCard(state, "d_sideways");
    state = step.state;
    beats.push(...step.events);
    expect(state.nextRiskDelta).toBeLessThan(0);

    step = act(state, { type: "END_ROUND" });
    state = step.state;
    beats.push(...step.events);
    expect(state.shotQuality).toBe(0);
    expect(state.round).toBe(6);

    const beforeRound6Goals = { player: state.playerGoals, opp: state.oppGoals };
    while (state.round === 6 && state.phase === "ROUND_ACTIVE") {
      step = act(state, { type: "END_ROUND" });
      state = step.state;
      beats.push(...step.events);
    }
    expect(state.playerGoals).toBe(beforeRound6Goals.player);
    expect(state.oppGoals).toBe(beforeRound6Goals.opp);
    expect(state.phase).toBe("PUSH_DECISION");
    expect(state.playerGoals).toBe(2);
    expect(state.oppGoals).toBe(0);
    expect(beats.some((e) => e.type === "PUSH_DECISION" && e.playerGoals === 2 && e.oppGoals === 0)).toBe(true);

    step = act(state, { type: "TAKE_WIN" });
    state = step.state;
    beats.push(...step.events);
    expect(state.phase).toBe("DONE");
    expect(state.result).toBe("win");
    expect(state.playerGoals).toBe(2);
    expect(state.oppGoals).toBe(0);
    expect(matchingEvents(step.events, "MATCH_END")[0]).toMatchObject({ result: "win", playerGoals: 2, oppGoals: 0 });
  });
});
