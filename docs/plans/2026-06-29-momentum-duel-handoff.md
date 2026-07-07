# Momentum Duel Handoff

Branch: `feature/momentum-duel`

Worktree: `/Users/kejixu/Projects/rougesoccer/.worktrees/momentum-duel`

Base commit: `4254477 Ignore local worktrees`

## Why this branch exists

The old dice-mode match had a clear structure but did not feel fun. The player was
often just checking which card was legal, with many wrong-phase or dead-hand moments.
The redesign replaces phase-locked attack/defense turns with a lane-allocation loop
called **Momentum Duel**.

The goal is that every round has a readable tactical question:

- Do I need territory? Add **Build-Up**.
- Am I deep enough to threaten? Add **Chance**.
- Is the opponent pressure dangerous? Add **Cover**.
- Am I in the box with Shot Quality? **Shoot**.

## What changed

### Core match loop

Files:

- `src/core/types.ts`
- `src/core/match/dice.ts`
- `src/core/balance.ts`
- `test/dice.test.ts`

`DiceMatchState` now has three current-round lane totals:

- `buildUp`
- `chance`
- `cover`

Cards are no longer gated by possession phase. `ASSIGN_DIE` commits the card into
one or more lanes. `END_ROUND` resolves the duel:

1. Build-Up converts to pitch movement using `DICE.BUILD_UP_SCALE`.
2. Chance becomes Shot Quality if the projected ball is in the final third or box.
3. Opponent pressure is reduced by Cover.
4. Remaining pressure pushes the ball toward your goal.
5. If the ball reaches your box, the opponent shoots.

Important tuning values:

- `BUILD_UP_SCALE: 0.65`
- `OPP_ADVANCE_SCALE: 0.2`

These were tuned after play feedback:

- Earlier Build-Up was 1:1 movement and made the ball jump straight to boxes.
- Then opponent pressure only moved the ball when `possession === "them"`, so your
  third/box barely appeared.
- Current tuning lets the ball visit the whole pitch without making every play an
  instant box state.

Current sampled zone distribution with greedy bot, USA:

- Your box: 3%
- Your third: 5%
- Midfield: 59%
- Their third: 17%
- Their box: 16%

### Card pool copy and semantics

Files:

- `src/data/diceCards.ts`
- `GAME.md`

Card text now describes lane effects instead of immediate old-loop actions.

Key semantics:

- Build-Up is territory pressure, not raw pitch movement.
- Chance becomes Shot Quality only when the ball is projected deep enough.
- Cover cancels opponent pressure.
- Finish cards are Chance cards. They do not help early build-up unless the card also
  has a Build-Up effect.

### UI clarity pass

Files:

- `src/ui/screens/DiceMatchScreen.tsx`
- `src/ui/components/ScorePopups.tsx`
- `src/ui/styles/board.css`
- `src/ui/diceUx.ts`
- `test/diceUi.test.ts`

Several clarity layers were added because the player still felt like they were
clicking randomly:

- A **decision coach** labels the current tactical state:
  - `Danger`
  - `Building`
  - `Chance`
  - `Ready`
- Clicking a card now stages a pending play first. The user must click **Commit** or
  **Cancel** after seeing the die and lane changes.
- A **duel preview** shows projected ball movement, Chance banking, Cover, and
  pressure.
- A compact **match log** translates recent card commits and duel resolutions into
  plain language.
- A **lane glossary** defines Build-Up, Chance, Cover, Shot Quality, and Finish.

### Bot and simulation

Files:

- `src/sim/strategies.ts`
- `src/sim/funProbe.ts` was not structurally changed, but it remains the main feel
  probe.

The greedy bot now evaluates lanes rather than old possession phases:

- Cover when pressure is dangerous.
- Chance when the projected ball is deep enough.
- Build-Up while still short of the box.
- Shoot when in the box with enough Shot Quality.

## Current verification

Use Node 22 in this environment. Node 18.16 cannot run the current Vitest/Rolldown
stack.

Commands used:

```bash
PATH=/Users/kejixu/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec tsc --noEmit
PATH=/Users/kejixu/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec vitest run
PATH=/Users/kejixu/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec vite build
PATH=/Users/kejixu/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec tsx src/sim/funProbe.ts
```

Latest passing test result:

- 11 test files passed
- 88 tests passed

Latest fun-probe notes:

- Dead rounds remain `0%`.
- Tactical roles available stay around `2.3-2.4`.
- Run win rates dropped after making opponent pressure real. This is acceptable for
  the feel/legibility pass, but likely needs the next balance pass.

Latest sampled fun-probe output before commit:

```text
Brazil: runWin 13%, shots/match 0.9, goals/match 0.5, opp goals/match 0.2
Mexico: runWin 13%, shots/match 1.1, goals/match 0.7, opp goals/match 0.2
USA: runWin 5%, shots/match 1.1, goals/match 0.8, opp goals/match 0.2
Canada: runWin 10%, shots/match 1.1, goals/match 0.8, opp goals/match 0.2
```

## Known follow-ups

1. **Balance scoring/win rate.** The loop is clearer, but run wins are probably too
   low. Look at shot frequency, keeper DC, rewards, and stage ramp.
2. **Decide whether the glossary should be collapsible.** It is useful while learning,
   but may be too much once the loop is familiar.
3. **Review card roles.** Some finishers are dead until deep. That is intentional, but
   some cards may need small Build-Up fallback effects if it still feels bad.
4. **Clean old naming.** Internal `possession` still exists as a compatibility field,
   but player-facing text now calls it initiative/pressure.
5. **Consider moving UX projection math to a shared pure helper.** Some projection
   logic is duplicated between core, bot, and UI.

## Files changed at handoff

Major behavior/docs:

- `GAME.md`
- `src/core/balance.ts`
- `src/core/match/dice.ts`
- `src/core/types.ts`
- `src/data/diceCards.ts`
- `src/sim/strategies.ts`

UI/UX:

- `src/ui/components/ScorePopups.tsx`
- `src/ui/screens/DiceMatchScreen.tsx`
- `src/ui/screens/TitleScreen.tsx`
- `src/ui/styles/board.css`
- `src/ui/diceUx.ts`

Tests/docs:

- `test/dice.test.ts`
- `test/diceUi.test.ts`
- `docs/plans/2026-06-29-momentum-duel.md`
- `docs/plans/2026-06-29-momentum-duel-handoff.md`
