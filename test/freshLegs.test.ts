import { describe, expect, it } from "vitest";
import { DEFAULT_BALANCE, type BalanceConfig } from "../src/core/balance";
import { applyDiceAction, createDiceMatch } from "../src/core/match/dice";
import { seedRng } from "../src/core/rng";
import type { DiceMatchState, Die, GameEvent } from "../src/core/types";
import { DICE_CARD_MAP, makeDiceStartingDeck } from "../src/data/diceCards";

type FreshLegsState = DiceMatchState & { carriedDice: number[] };

function freshLegsBalance(): BalanceConfig {
  const balance = structuredClone(DEFAULT_BALANCE);
  balance.DICE.OPP_CHAIN_TARGET = { ...balance.DICE.OPP_CHAIN_TARGET, balanced: 1 };
  return balance;
}

function matchState(seed: string): FreshLegsState {
  const step = createDiceMatch(DICE_CARD_MAP, {
    opp: {
      teamId: "qat",
      name: "Qatar",
      attackRating: 13,
      style: "balanced",
      tier: 4,
    },
    styleEffects: [],
    plays: [],
    context: "group",
    deck: makeDiceStartingDeck(),
    mutators: [],
    rng: seedRng(seed),
    balance: freshLegsBalance(),
  });
  return structuredClone(step.state) as FreshLegsState;
}

function opponentPossession(seed: string, dice: Die[]): FreshLegsState {
  const state = matchState(seed);
  state.round = 2;
  state.possession = "them";
  state.phase = "ROUND_ACTIVE";
  state.ball = state.bal.DICE.MIDFIELD;
  state.hand = [];
  state.drawPile = [];
  state.discardPile = [];
  state.dice = dice;
  state.carriedDice = [];
  return state;
}

function carriedEvent(events: GameEvent[]): Extract<GameEvent, { type: "DICE_CARRIED" }> | undefined {
  return events.find((event): event is Extract<GameEvent, { type: "DICE_CARRIED" }> => event.type === "DICE_CARRIED");
}

describe("Fresh Legs dice carry", () => {
  it("defines a carry cap of two dice", () => {
    expect((DEFAULT_BALANCE.DICE as { CARRY_MAX?: number }).CARRY_MAX).toBe(2);
  });

  it("carries the highest unused defensive dice into your next attack, capped and marked", () => {
    const withCarry = opponentPossession("fresh-legs-capture", [
      { value: 2, used: false },
      { value: 6, used: false },
      { value: 5, used: true },
      { value: 4, used: false },
      { value: 1, used: false },
    ]);

    const step = applyDiceAction(DICE_CARD_MAP, withCarry, { type: "END_ROUND" });

    expect(step.state.round).toBe(3);
    expect(step.state.possession).toBe("you");
    expect((step.state as FreshLegsState).carriedDice).toEqual([]);
    expect(step.state.dice.slice(-2)).toEqual([
      { value: 6, used: false, carried: true },
      { value: 4, used: false, carried: true },
    ]);
    expect(carriedEvent(step.events)?.values).toEqual([6, 4]);
  });

  it("does not spend extra RNG when carried dice are appended after the normal roll", () => {
    const withCarry = opponentPossession("fresh-legs-rng", [
      { value: 6, used: false },
      { value: 4, used: false },
      { value: 3, used: true },
      { value: 2, used: true },
      { value: 1, used: true },
    ]);
    const withoutCarry = opponentPossession("fresh-legs-rng", [
      { value: 6, used: true },
      { value: 4, used: true },
      { value: 3, used: true },
      { value: 2, used: true },
      { value: 1, used: true },
    ]);

    const withStep = applyDiceAction(DICE_CARD_MAP, withCarry, { type: "END_ROUND" });
    const withoutStep = applyDiceAction(DICE_CARD_MAP, withoutCarry, { type: "END_ROUND" });
    const normalPoolSize = withCarry.bal.DICE.POOL_SIZE;

    expect(withStep.state.rng).toEqual(withoutStep.state.rng);
    expect(withStep.state.dice.slice(0, normalPoolSize)).toEqual(withoutStep.state.dice);
    expect(withStep.state.dice.slice(normalPoolSize).map((die) => die.value)).toEqual([6, 4]);
  });

  it("clears carried dice when your own possession ends instead of banking them again", () => {
    const state = matchState("fresh-legs-clear");
    state.round = 1;
    state.possession = "you";
    state.phase = "ROUND_ACTIVE";
    state.hand = [];
    state.drawPile = [];
    state.discardPile = [];
    state.dice = [
      { value: 6, used: false },
      { value: 5, used: false },
    ];
    state.carriedDice = [6, 4];

    const step = applyDiceAction(DICE_CARD_MAP, state, { type: "END_ROUND" });

    expect(step.state.round).toBe(2);
    expect(step.state.possession).toBe("them");
    expect((step.state as FreshLegsState).carriedDice).toEqual([]);
    expect(step.state.dice).toHaveLength(state.bal.DICE.POOL_SIZE);
    expect(step.state.dice.some((die) => die.carried)).toBe(false);
    expect(carriedEvent(step.events)).toBeUndefined();
  });
});
