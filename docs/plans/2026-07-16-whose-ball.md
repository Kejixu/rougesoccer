# Whose Ball Is It Implementation Plan

> **For Codex:** Execute this plan task-by-task with the test-driven-development workflow. Do not run git commands in this worktree.

**Goal:** Make the fixed alternating possession schedule immediately legible through a round strip, handover banner, defending-mode treatment, and one-time schedule tip.

**Architecture:** Add small presentational possession components and pure derivation helpers under `src/ui/**`, then integrate them into `DiceMatchScreen` using its existing event-batch guard. Derive the strip and defending mode from match state; use state only for the timed handover banner. Keep `src/core/**`, `src/data/**`, and both protected tutorial files byte-identical.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, React server rendering for UI markup assertions.

### Task 1: Specify possession UI behavior

**Files:**
- Create: `test/possessionUx.test.tsx`
- Modify: `test/diceUi.test.ts`

1. Add a strip test asserting six scheduled slots, alternating `data-owner` values, and the current-round marker.
2. Add an extra-time test asserting a seventh slot is appended when round 7 is reached.
3. Add handover tests asserting a flipped `ROUND_START` produces the correct banner copy and a non-flip produces no banner.
4. Add a root-class test asserting `mode-defending` only for their possession.
5. Add schedule-tip and possession-glossary assertions.
6. Run the two targeted test files with the mandated Node 22 prefix and confirm failures caused by the missing feature.

### Task 2: Implement the presentation components and derivations

**Files:**
- Create: `src/ui/components/PossessionUi.tsx`

1. Implement a six-round schedule helper that extends to the current round in extra time.
2. Render a single primary strip with slot ownership, past/current/future classes, and `aria-current` on the current slot.
3. Implement handover derivation for `ROUND_START` batches and a pointer-transparent banner component.
4. Implement the root-class derivation for defending mode.

### Task 3: Integrate the round transition UI

**Files:**
- Modify: `src/ui/screens/DiceMatchScreen.tsx`

1. Add banner state, previous-possession tracking, and one cleanup-safe timer.
2. Trigger the banner only inside the existing `lastBatchRef`-guarded effect when a `ROUND_START` flips possession; do not show it at round 1.
3. Add `mode-defending` to the board root from `m.possession`.
4. Place the strip next to the round status, render the banner below the tutorial z-index, and remove the old possession badge.
5. Run the targeted UI tests until green.

### Task 4: Teach the schedule once

**Files:**
- Modify: `src/ui/diceUx.ts`
- Modify: `src/ui/screens/DiceMatchScreen.tsx`
- Modify if needed: `src/ui/App.tsx`
- Modify: `test/diceUi.test.ts`

1. Extend `CoachTipKey` and the UI-owned persisted-key list with `schedule`, without editing `tutorialScript.ts`.
2. Give `schedule` priority on the first their-possession and rely on the existing dismissal persistence.
3. Add a `Possession` glossary entry explaining the alternating innings-like schedule and within-round fight.
4. Run targeted tests until green.

### Task 5: Style and document

**Files:**
- Modify: `src/ui/styles/tokens.css`
- Modify: `src/ui/styles/board.css`
- Modify: `GAME.md`

1. Extend the existing defending palette tokens and add strip, current/past slot, handover, and defending-mode styles.
2. Keep the handover banner at `pointer-events: none` and below the tutorial overlay's z-index 60.
3. Update the match presentation section in `GAME.md` with the possession strip, transition banner, defending mode, and one-time schedule tip.

### Task 6: Verify and report

**Files:**
- Create: `CODEX_STATUS.md`

1. Load and follow `superpowers:verification-before-completion`.
2. Run `env -u NODE_OPTIONS PATH=/Users/kejixu/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec tsc --noEmit`.
3. Run `env -u NODE_OPTIONS PATH=/Users/kejixu/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec vitest run`.
4. Record RED evidence, final command output/counts, protected-file compliance, and any deviations in `CODEX_STATUS.md`.
