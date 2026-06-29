# Momentum Duel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current phase-locked tug-of-war match decisions with a lane-allocation loop where every die can create build-up, chance, or defensive cover.

**Architecture:** Keep the existing `DiceMatchState`, run reducer, deck/reward/shop systems, and public actions. Reinterpret `ASSIGN_DIE` as assigning a die/card into a lane for this round; `END_ROUND` resolves player lanes against the opponent intent into ball movement, shot quality, danger, and goals. Preserve deterministic seeded RNG.

**Tech Stack:** TypeScript, Vite/React 19, strict core/data boundaries, vitest tests, pnpm.

### Task 1: Core Lane Model

**Files:**
- Modify: `src/core/types.ts`
- Modify: `src/core/match/dice.ts`
- Test: `test/dice.test.ts`

**Steps:**
1. Write failing tests for assigning progress/chance/defense lanes in one round.
2. Run the focused dice tests and confirm the new tests fail because lane state does not exist.
3. Add lane fields to `DiceMatchState` and populate them from card effects.
4. Resolve lanes on `END_ROUND`: build-up moves the ball, chance banks shot quality, defense reduces opponent pressure.
5. Run focused dice tests and typecheck.

### Task 2: Remove Phase-Locked Dead Hands

**Files:**
- Modify: `src/core/match/dice.ts`
- Modify: `src/data/diceCards.ts`
- Test: `test/dice.test.ts`

**Steps:**
1. Write failing tests showing attack and defense cards can both be played in any possession.
2. Run the focused tests and confirm wrong-phase rejection still fails them.
3. Replace role-gating with lane assignment: defense cards add cover, progress cards add build-up, finish cards add chance.
4. Update starter card text to explain lane values.
5. Run focused dice tests and typecheck.

### Task 3: UI/Bot/Docs Integration

**Files:**
- Modify: `src/ui/screens/DiceMatchScreen.tsx`
- Modify: `src/sim/strategies.ts`
- Modify: `src/sim/funProbe.ts`
- Modify: `GAME.md`

**Steps:**
1. Update UI labels from possession legality to lane totals and round resolution.
2. Update bot strategy to spend cards into build-up/chance/cover, shoot when chance is ready, and end round otherwise.
3. Update `GAME.md` to describe Momentum Duel as the current build.
4. Run typecheck, focused tests, and the fun probe.
