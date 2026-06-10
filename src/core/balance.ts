// Every tunable number in the game. The active values live in src/data/balance.ts
// (so the sim harness can sweep them); core only defines the shape and defaults.

export interface BalanceConfig {
  GOAL_THRESHOLD: number; // shot-value points per goal
  HAND_SIZE: number;
  PLAYS_PER_ROUND: number;
  DISCARDS_PER_ROUND: number;
  MAX_ATTACK_CARDS: number;
  MAX_DISCARD_CARDS: number;
  MAX_DEFEND_CARDS: number; // per DEFEND play
  MATCH_ROUNDS: number;
  CLOCK_FLOOR_RATIO: number; // opponent always scores at least this share of their rate
  EXTRA_TIME_CLOCK_MULT: number;
  MAX_EXTRA_ROUNDS: number;
  ET_BUDGET_REWARD: number; // per extra-time round survived in the lead
  ET_SCOUT_REWARD: number;
  MAX_SUDDEN_DEATH_ROUNDS: number;
  COUNTER_BURST_POINTS: number; // "counter" style: clock burst when an attack scores 0
  SHOOTOUT_RNG: number; // shootout roll is base + 0..SHOOTOUT_RNG
}

export const DEFAULT_BALANCE: BalanceConfig = {
  GOAL_THRESHOLD: 25,
  HAND_SIZE: 7,
  PLAYS_PER_ROUND: 2,
  DISCARDS_PER_ROUND: 2,
  MAX_ATTACK_CARDS: 4,
  MAX_DISCARD_CARDS: 3,
  MAX_DEFEND_CARDS: 2,
  MATCH_ROUNDS: 5,
  CLOCK_FLOOR_RATIO: 0.2,
  EXTRA_TIME_CLOCK_MULT: 1.5,
  MAX_EXTRA_ROUNDS: 2,
  ET_BUDGET_REWARD: 15,
  ET_SCOUT_REWARD: 1,
  MAX_SUDDEN_DEATH_ROUNDS: 3,
  COUNTER_BURST_POINTS: 8,
  SHOOTOUT_RNG: 10,
};
