// Every tunable number in the game. The active values live in src/data/balance.ts
// (so the sim harness can sweep them); core only defines the shape and defaults.

import type { Stage, StyleId } from "./types";

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
  FORM_CAP: number; // max formPower a card can accumulate in one match
  MATCH_ROUNDS: number;
  CLOCK_FLOOR_RATIO: number; // opponent always scores at least this share of their rate
  EXTRA_TIME_CLOCK_MULT: number;
  MAX_EXTRA_ROUNDS: number;
  ET_BUDGET_REWARD: number; // per extra-time round survived in the lead
  ET_SCOUT_REWARD: number;
  MAX_SUDDEN_DEATH_ROUNDS: number;
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
    POOL_SIZE: number;
    CARRY_MAX: number;
    DIE_FACES: number;
    HAND_SIZE: number;
    PITCH_LEN: number;          // 0 = your goal, PITCH_LEN = their goal
    MIDFIELD: number;
    ZONE_WIDTH: number;         // 5 zones, for zoneOf + DC penalty
    THEIR_BOX: number;
    YOUR_BOX: number;
    KEEPER_DC_BASE: number;
    KEEPER_DC_PER_RATING: number;
    OWN_KEEPER_DC_BASE: number;
    SHOT_DIE: number;           // d20
    SIT_DEEP_DC_BONUS: number;  // sitDeep posture also hardens their keeper
    CORNER_WINDOW: number;      // missed by this much or less: one corner delivery
    RATTLE_WINDOW: number;      // missed by this much or less: keeper rattled too
    // ---- your chain ----
    RISK_BASE_PRESS: number;    // their press posture: base interception risk
    RISK_BASE_BALANCED: number;
    RISK_BASE_DEEP: number;     // sitDeep posture: easy to keep the ball
    RISK_RAMP: number;          // added per pass beyond the first
    RISK_CAP: number;
    DEVELOPMENT_GAIN: number;   // each chance effect gains +passes * this
    ZONE_DC_PENALTY: number[];  // indexed by zoneOf(ball): [yourBox, yourThird, mid, theirThird, theirBox]
    COUNTER_CHANCE: number;     // your instant-counter shot bonus
    COUNTER_SHALLOW_BONUS: number; // their counter is scarier if you lost it in your half
    // ---- their chain ----
    OPP_RISK_BASE: number;      // their base interception risk per pass
    OPP_RISK_RAMP: number;
    OPP_PASS_ADVANCE: number;   // ball steps toward your goal per completed opp pass
    OPP_CHANCE_PER_RATING: number; // their per-pass chance gain = round(rating * this)
    OPP_CHANCE_CAP: number;     // per-pass gain cap
    OPP_CHAIN_TARGET: Record<StyleId, number>; // passes they want before shooting
  };
}

export const DEFAULT_BALANCE: BalanceConfig = {
  GOAL_THRESHOLD: 40,
  HAND_SIZE: 5,
  STAMINA_PER_ROUND: 4,
  STAMINA_CARRY_CAP: 6,
  FORM_CAP: 10,
  MATCH_ROUNDS: 6,
  CLOCK_FLOOR_RATIO: 0.45,
  EXTRA_TIME_CLOCK_MULT: 2.0,
  MAX_EXTRA_ROUNDS: 2,
  ET_BUDGET_REWARD: 20,
  ET_SCOUT_REWARD: 1,
  MAX_SUDDEN_DEATH_ROUNDS: 3,
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
  // and the opponent's threat, so it compounds. Tuned for the 10-35% greedy-win band.
  STAGE_CLOCK_MULT: {
    GROUP: 1.1,
    R32: 1.45,
    R16: 1.7,
    QF: 1.95,
    SF: 2.15,
    FINAL: 2.4,
  },

  DICE: {
    POOL_SIZE: 5,
    CARRY_MAX: 2,
    DIE_FACES: 6,
    HAND_SIZE: 4,
    PITCH_LEN: 20,
    MIDFIELD: 10,
    ZONE_WIDTH: 4,
    THEIR_BOX: 16,
    YOUR_BOX: 4,
    // Set-piece value refund tune: 10 -> 11 to keep all nations within the 10-35% run-win band.
    KEEPER_DC_BASE: 11,
    KEEPER_DC_PER_RATING: 0.14,
    OWN_KEEPER_DC_BASE: 15,
    SHOT_DIE: 20,
    SIT_DEEP_DC_BONUS: 4,
    CORNER_WINDOW: 4,
    RATTLE_WINDOW: 2,
    RISK_BASE_PRESS: 0.27,
    RISK_BASE_BALANCED: 0.17,
    RISK_BASE_DEEP: 0.1,
    RISK_RAMP: 0.06,
    RISK_CAP: 0.65,
    DEVELOPMENT_GAIN: 1,
    ZONE_DC_PENALTY: [6, 6, 6, 3, 0],
    COUNTER_CHANCE: 1,
    COUNTER_SHALLOW_BONUS: 3,
    OPP_RISK_BASE: 0.08,
    OPP_RISK_RAMP: 0.05,
    OPP_PASS_ADVANCE: 2,
    OPP_CHANCE_PER_RATING: 0.03,
    OPP_CHANCE_CAP: 6,
    OPP_CHAIN_TARGET: { balanced: 3, possession: 4, flair: 4, fortress: 2, counter: 2, highpress: 3 },
  },
};
