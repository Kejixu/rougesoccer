// Every tunable number in the game. The active values live in src/data/balance.ts
// (so the sim harness can sweep them); core only defines the shape and defaults.

import type { Stage } from "./types";

export interface RarityWeights {
  common: number;
  rare: number;
  legendary: number;
}

export interface BalanceConfig {
  GOAL_THRESHOLD: number; // shot-value points per goal
  HAND_SIZE: number;
  PLAYS_PER_ROUND: number;
  DISCARDS_PER_ROUND: number;
  MAX_ATTACK_CARDS: number;
  MAX_DISCARD_CARDS: number;
  MAX_DEFEND_CARDS: number; // per DEFEND play
  MAX_DEPLOYED: number; // total defender slots — defense cannot stack forever
  FORM_CAP: number; // max formPower a card can accumulate in one match
  MATCH_ROUNDS: number;
  CLOCK_FLOOR_RATIO: number; // opponent always scores at least this share of their rate
  EXTRA_TIME_CLOCK_MULT: number;
  MAX_EXTRA_ROUNDS: number;
  ET_BUDGET_REWARD: number; // per extra-time round survived in the lead
  ET_SCOUT_REWARD: number;
  MAX_SUDDEN_DEATH_ROUNDS: number;
  COUNTER_BURST_POINTS: number; // "counter" style: clock burst when an attack scores 0
  SHOOTOUT_RNG: number; // shootout roll is base + 0..SHOOTOUT_RNG

  // ---- run / meta layer ----
  STARTING_BUDGET: number;
  STARTING_SCOUT: number;
  REWARD_BUDGET: {
    groupWin: number;
    groupDraw: number;
    groupLoss: number;
    knockoutWin: number;
    skipPick: number; // consolation for skipping a card reward
  };
  REWARD_PICKS: { win: number; draw: number }; // cards offered after a result
  REWARD_RARITY_WEIGHTS: Record<Stage, RarityWeights>;
  SHOP_CARD_COUNT: number;
  SHOP_PRICES: {
    common: number;
    rare: number;
    legendary: number;
    train: number;
    release: number;
    rerollScout: number;
    scoutOpponent: number;
  };
  TRAIN_MAX_LEVEL: number;
  MIN_DECK_SIZE: number; // releases can't shrink the deck below this
  MIN_MATCH_DECK: number; // if fatigue would leave fewer cards, fatigued ones play anyway
  STAGE_CLOCK_MULT: Record<Stage, number>; // difficulty ramp on opponent ratings
}

export const DEFAULT_BALANCE: BalanceConfig = {
  GOAL_THRESHOLD: 25,
  HAND_SIZE: 7,
  PLAYS_PER_ROUND: 2,
  DISCARDS_PER_ROUND: 2,
  MAX_ATTACK_CARDS: 4,
  MAX_DISCARD_CARDS: 3,
  MAX_DEFEND_CARDS: 2,
  MAX_DEPLOYED: 3,
  FORM_CAP: 15,
  MATCH_ROUNDS: 5,
  CLOCK_FLOOR_RATIO: 0.3,
  EXTRA_TIME_CLOCK_MULT: 1.5,
  MAX_EXTRA_ROUNDS: 2,
  ET_BUDGET_REWARD: 15,
  ET_SCOUT_REWARD: 1,
  MAX_SUDDEN_DEATH_ROUNDS: 3,
  COUNTER_BURST_POINTS: 8,
  SHOOTOUT_RNG: 10,

  STARTING_BUDGET: 10,
  STARTING_SCOUT: 1,
  REWARD_BUDGET: {
    groupWin: 20,
    groupDraw: 10,
    groupLoss: 10,
    knockoutWin: 30,
    skipPick: 5,
  },
  REWARD_PICKS: { win: 3, draw: 2 },
  REWARD_RARITY_WEIGHTS: {
    GROUP: { common: 70, rare: 27, legendary: 3 },
    R32: { common: 55, rare: 38, legendary: 7 },
    R16: { common: 55, rare: 38, legendary: 7 },
    QF: { common: 40, rare: 48, legendary: 12 },
    SF: { common: 40, rare: 48, legendary: 12 },
    FINAL: { common: 30, rare: 55, legendary: 15 },
  },
  SHOP_CARD_COUNT: 3,
  SHOP_PRICES: {
    common: 15,
    rare: 30,
    legendary: 60,
    train: 25,
    release: 15,
    rerollScout: 1,
    scoutOpponent: 1,
  },
  TRAIN_MAX_LEVEL: 2,
  MIN_DECK_SIZE: 10,
  MIN_MATCH_DECK: 10,
  STAGE_CLOCK_MULT: {
    GROUP: 0.9,
    R32: 1.2,
    R16: 1.35,
    QF: 1.65,
    SF: 1.8,
    FINAL: 2.0,
  },
};
