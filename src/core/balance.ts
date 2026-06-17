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
  STAMINA_PER_ROUND: number;
  STAMINA_CARRY_CAP: number; // unspent stamina banks up to this (Dawncaster carryover)
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
    drill: number; // imbue a gameplan: permanent for the run, card removed
    rerollScout: number;
    scoutOpponent: number;
  };
  STAFF_OFFER_SIZE: number; // staff hires offered per stage advance
  TRAIN_MAX_LEVEL: number;
  MIN_DECK_SIZE: number; // releases can't shrink the deck below this
  MIN_MATCH_DECK: number; // if fatigue would leave fewer cards, fatigued ones play anyway
  STAGE_CLOCK_MULT: Record<Stage, number>; // difficulty ramp on opponent ratings

  // ---- dice mode (Dicey-Dungeons match loop) ----
  DICE: {
    POOL_SIZE: number; // dice rolled per round
    DIE_FACES: number; // d6
    HAND_SIZE: number;
    ZONES: number; // pitch zones: Build-up(0) -> Midfield -> Final Third -> Box(ZONES-1)
    PROGRESS_PER_ZONE: number; // progress needed to advance one zone
    BOX_ZONE: number; // zone index you can shoot from
    KEEPER_DC_BASE: number; // base goal-roll target
    KEEPER_DC_PER_RATING: number; // + attackRating * this
    SHOT_DIE: number; // d20 goal roll
    OPP_GOAL_THRESHOLD: number; // opponent points per goal
    THREAT_SCALE: number; // intent points are scaled down for the gentler dice meter
    SIT_DEEP_DC_BONUS: number; // their "sit deep" raises the keeper DC
  };
}

export const DEFAULT_BALANCE: BalanceConfig = {
  GOAL_THRESHOLD: 40,
  HAND_SIZE: 5,
  STAMINA_PER_ROUND: 4,
  STAMINA_CARRY_CAP: 6,
  PLAYS_PER_ROUND: 2,
  DISCARDS_PER_ROUND: 2,
  MAX_ATTACK_CARDS: 4,
  MAX_DISCARD_CARDS: 3,
  MAX_DEFEND_CARDS: 2,
  MAX_DEPLOYED: 3,
  FORM_CAP: 10,
  MATCH_ROUNDS: 5,
  CLOCK_FLOOR_RATIO: 0.45,
  EXTRA_TIME_CLOCK_MULT: 2.0,
  MAX_EXTRA_ROUNDS: 2,
  ET_BUDGET_REWARD: 20,
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
    release: 8,
    drill: 25,
    rerollScout: 1,
    scoutOpponent: 1,
  },
  STAFF_OFFER_SIZE: 3,
  TRAIN_MAX_LEVEL: 2,
  MIN_DECK_SIZE: 10,
  MIN_MATCH_DECK: 10,
  // The player now snowballs (staff hires + gameplans), so the ramp climbs
  // steeply after the group stage to keep knockouts honest.
  // Gentler than combat mode: in dice mode this ramp drives both the keeper DC
  // and the opponent's threat, so it compounds. Tuned for ~15-25% greedy wins.
  STAGE_CLOCK_MULT: {
    GROUP: 1.1,
    R32: 1.4,
    R16: 1.6,
    QF: 1.85,
    SF: 2.05,
    FINAL: 2.3,
  },

  DICE: {
    POOL_SIZE: 5,
    DIE_FACES: 6,
    HAND_SIZE: 5,
    ZONES: 4,
    PROGRESS_PER_ZONE: 4,
    BOX_ZONE: 3,
    KEEPER_DC_BASE: 9,
    KEEPER_DC_PER_RATING: 0.14,
    SHOT_DIE: 20,
    OPP_GOAL_THRESHOLD: 26,
    THREAT_SCALE: 0.3,
    SIT_DEEP_DC_BONUS: 4,
  },
};
