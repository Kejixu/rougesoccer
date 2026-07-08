# Fresh Legs — unused defensive dice carry into your attack

Status: APPROVED. One rule that gives BOTH defensive actions a real cost/benefit:

> When a round ends while THEY had possession, up to `CARRY_MAX` (2) of your unused
> dice carry into your next round, keeping their values.

Why (user-diagnosed): standing off currently costs nothing (unused dice evaporate
anyway), so the commit-vs-stand-off decision is empty and defense feels like button
mashing. With carryover: stand off = bank energy for the counter; commit a defender
= spend tomorrow's attack on safety now. Also directly attacks passesPerChain
sitting at the 2.0 floor — 7-dice attacking rounds are where 3-4 pass moves live.

## Engine

- New state: `carriedDice: number[]` (values only; max length CARRY_MAX).
- On `concludeRound` of a round where `possession === "them"`: set `carriedDice` to
  the HIGHEST `min(CARRY_MAX, unused)` unused dice values (player-favorable, no new
  decision UI). All other conclusions (your possession ends) clear it to [].
- In `startRound`: roll the normal pool EXACTLY as today (same number of `rollDie`
  calls — THE RNG STREAM LENGTH MUST NOT CHANGE), then append the carried dice as
  additional unused dice (marked), then clear `carriedDice`.
- Balance: `CARRY_MAX: 2` in the DICE block.
- Event: `DICE_CARRIED { values: number[] }` emitted in startRound when any carry
  (ticker: "Fresh legs: carried a 6 and a 4.").
- `Die` gains optional `carried?: boolean` for UI marking.
- Applies in all modes (regulation/ET/sudden death). Nation pools stack naturally
  (Mexico can reach 8 dice; probe will judge).
- Save version 5 -> 6 (three files as usual).

## UI

- Their-possession panel shows a live banking hint: "banking N dice" where
  N = min(CARRY_MAX, unused dice) — updates as you commit defenders. This IS the
  tradeoff made visible.
- Carried dice in the tray get a subtle marker (small tag or tinted pip,
  `data-carried="true"`), and the cascade animation still plays for rolled dice.
- Stand off button label may append the bank: "Stand off (bank 2)".
- Copy updates in the same change: defense coach tip gains the why ("Unused dice
  carry to your attack — up to 2. Standing off banks energy; committing spends it.");
  tutorial steps 4/9/13 (stand off steps) get one added sentence teaching the bank;
  glossary "Stand off" entry updated; GAME.md.

## Guards

- **Tutorial golden seed:** rng stream is unchanged, so all rolls/checks/shots are
  identical. Carried dice add extra known dice to R3/R5 trays; locked cards in R3
  are flat-valued (Driving Run, Poacher) so all beat assertions (R2 interception +
  counter goal, R3 shot GOAL, quiet R4/R6, final exactly 2-0, TAKE_WIN) MUST still
  pass unchanged. R5's Clinical Finish converts the die and bestDieFor may now pick
  a carried die — exact shotQuality-VALUE assertions for R5 may be updated to the
  new deterministic value; beat assertions may NOT be touched. If a BEAT breaks,
  STOP and report BLOCKED.
- Balance: attack strengthens. Re-run probe; retune to bands (no nation > 35% or
  < 10%, deadAttackRounds <= 2%, oppGoals 0.3-0.7, passesPerChain 2-4 — expect it
  to finally lift off the 2.0 floor). One knob at a time with a log.
- Bots need no policy change to benefit; if greedy overshoots the ceiling, prefer
  retuning RISK_* before touching bot logic.

## Acceptance

- Unit (TDD): carry set from their-possession conclusions (highest-first, capped);
  cleared after consumption and after your possessions; startRound appends carried
  values with rng untouched (assert rng state advances identically with and without
  carry for the same seed prefix); DICE_CARRIED emitted.
- Full: tsc clean; vitest green (tutorial beats intact); build ok; probe in bands.
- Browser (controller): stand off with dice in hand, see "banking N", next round
  shows marked carried dice and a ticker line; commit a defender and watch N drop.
