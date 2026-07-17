# Persistent Hand — one stable system to grip, plus cards that cycle

## Problem (design session, 2026-07-17)

Both randomizers churn 100% every round: dice reroll AND the whole unplayed
hand is dumped to discard at round end (`endRound` → `discardPile.push(...hand)`).
No plan survives a round boundary; players re-read four new cards every round.
The greats keep ONE volatile input against ONE stable structure (StS: random
cards / fixed energy; Dicey Dungeons: random dice / fixed equipment). Dice are
this game's identity — so the hand becomes the stable half.

## Design

### 1. The hand persists

- Unplayed cards STAY in hand across rounds (played/exiled cards leave as
  today). No round-end dump.
- Round start: draw up to `HAND_SIZE`, **and always at least 1** (fresh blood
  every round), with a hard cap of `HAND_SIZE + 1` (a held hand can't grow
  unbounded; if the hand is full at cap, the minimum-1 draw is skipped).
  Existing `drawBonus` passives keep working relative to `HAND_SIZE`.
- No new state fields (hand/draw/discard/exile shapes unchanged) — NO save
  version bump.
- Strategic intent this unlocks (say it in GAME.md): holding a finisher for
  the round you reach their box; holding tackles for their possession (the
  possession strip shows exactly when that is).

### 2. Two cycling cards join the pool (14 → 16)

Follow diceCards.ts conventions (levels L0/L1/L2, existing effect kinds —
`draw` already exists and is applied in `applyDiceEffect`):

- **"One-Two"** — attack, position MF, slot min 2.
  L0: progress 2, draw 1. L1: progress 3, draw 1. L2: progress 3, draw 1,
  shotQuality +1. The cantrip pass: keeps the move alive AND cycles.
- **"Sweeper Keeper"** — defense, slot max 3.
  L0: defend +12%, draw 1. L1: defend +16%, draw 1. L2: defend +16%, draw 2.
  Cheap die in, defense committed, hand refreshed.

Amounts may be nudged ±1 (or ±4% for defend) by probe evidence — note any
change in the status report.

### 3. Tutorial seed re-hunt

Hand persistence changes what's in hand each round, so seed `tutorial-109`
will no longer produce the scripted story. The tutorial SCRIPT and BEATS are
untouchable: same step structure, same locks, same story (R2 interception +
counter goal, R3 shot goal, quiet R4/R6, exact 2-0 final). Write a throwaway
hunt harness (tsx, seeded runs replaying the scripted action sequence) that
searches seeds `tutorial-<n>` until one satisfies every beat AND every step
lock (each locked step's required card must be in hand with a fitting die at
that step). The ONLY permitted edits to tutorial files: the seed string
constant in `tutorialScript.ts` and the same literal in `test/tutorial.test.ts`.
Every assertion in the tutorial test must pass unmodified otherwise. Keep the
hunt harness in scratch (do not commit it); record the winning seed + how many
candidates were tried in the status report.

## Constraints

- Bots (`src/sim/strategies.ts`) need no new smarts — persistence changes
  what's in their hand, not the action space. Do not add hold/discard logic.
- `src/core/match/engine.ts` untouched. Boundaries test stays green.
- Update GAME.md in the same change (card flow section + the two new cards
  in the pool table + the planning-across-rounds intent).

## Probe gates (report, tune only if breached)

Run funProbe after GREEN. Required bands:

- `deadAttackRounds` ≤ 4% for every nation (the min-1 draw is the guard —
  if breached, first check the cap logic before touching any balance knob)
- `runWin` within [10%, 35%] per nation
- `oppGoalsPerMatch` within [0.3, 0.7]

If a band is breached, the ONLY knobs you may touch are the two new cards'
amounts. Anything else: report BLOCKED with the numbers instead.

## Tests

- Persistence: unplayed cards remain in hand after `endRound`; played cards
  discard; exile still exiles.
- Draw rule: refill to HAND_SIZE; minimum 1 draw when hand ≥ HAND_SIZE but
  below cap; no draw at cap; drawBonus interacts sanely.
- Cycling cards: One-Two progresses and draws; Sweeper Keeper commits defense
  and draws; levels apply.
- Tutorial: full beat suite green on the new seed.
- All existing tests green (156 currently, minus any that assert the old
  round-end dump — update those to assert persistence instead and call them
  out in the report); tsc clean.
