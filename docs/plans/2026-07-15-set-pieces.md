# Set Pieces Implementation Plan

> **For Codex:** Use `superpowers:test-driven-development` task-by-task and `superpowers:verification-before-completion` before reporting success.

**Goal:** Turn narrowly missed player shots into a one-play corner and a one-shot rattled-keeper advantage without changing tutorial RNG or the combat engine.

**Architecture:** Extend the deterministic dice-match state and events, keeping `shotEstimate` authoritative for the rattled DC. Resolve corner delivery and its automatic header entirely in `src/core/match/dice.ts`; UI and bots only consume state/estimates. Keep the existing run-layer actions unchanged and bump the persisted run schema from 7 to 8.

**Tech stack:** TypeScript 6, Vitest, React 19, Vite, seeded core RNG.

### Task 1: Engine contract and RED tests

**Files:**
- Modify: `test/dice.test.ts`
- Modify: `src/core/types.ts`
- Modify: `src/core/balance.ts`

1. Add tests that force shot margins 5, 4, 3, 2, and 1 and assert the nested corner/rattled windows and events.
2. Add tests for one corner play followed by an automatic `SHOT_TAKEN { corner: true }`, the `END_ROUND` fizzle, one-use rattled DC on regular and counter shots, and no corner chaining from a header.
3. Run the focused tests with the required Node 22 environment and confirm failures are caused by the absent mechanics.
4. Add the minimal state, balance, and event type fields required to compile the desired test API.

### Task 2: Engine GREEN

**Files:**
- Modify: `src/core/match/dice.ts`

1. Make `shotEstimate` subtract the rattled penalty from keeper DC.
2. Preserve `keeperRattled` across possessions while resetting `corner` per possession.
3. Resolve missed-shot margins, nested events, and corner state without consuming extra RNG outside new corner sequences.
4. During a corner, accept exactly one legal attacking card, apply its normal effects, and immediately shoot; always conclude after that header and never chain another corner.
5. Apply and clear rattled on the player's counter-shot path.
6. Run focused engine tests until green, then rerun the unchanged tutorial golden-seed test and stop if it changes.

### Task 3: UI and UX coverage

**Files:**
- Modify: `test/diceUi.test.ts`
- Modify: `src/ui/diceUx.ts`
- Modify: `src/ui/tutorialScript.ts`
- Modify: `src/ui/screens/DiceMatchScreen.tsx`
- Modify: `src/ui/components/ScorePopups.tsx`
- Modify: `src/ui/styles/board.css`

1. Add failing UX tests for Corner/Rattled glossary and coach-tip triggers.
2. Add one-time `corner` and `rattled` coach tips and storage keys.
3. Render the corner banner, rattled badge, corner ticker/popup copy, dock cap of one, `▶ Take the corner`, disabled manual shoot during a corner, and `Clear it` fizzle action.
4. Keep event processing behind `lastBatchRef`; do not add side effects to state updaters.

### Task 4: Bot and probe instrumentation

**Files:**
- Modify: `src/sim/strategies.ts`
- Modify: `src/sim/funProbe.ts`

1. During corners, choose a playable finisher/chance card or fizzle.
2. Reduce the greedy shot threshold by 0.05 while the keeper is rattled.
3. Count `CORNER_EARNED` per match and goals from shot/counter events whose DC used the rattled modifier; print `cornersPerMatch` and `rattledConversions`.
4. Run the probe command and tune only one documented balance knob at a time if any nation or structural metric is outside the required bands.

### Task 5: Save schema and living documentation

**Files:**
- Modify: `src/core/types.ts`
- Modify: `src/core/run/run.ts`
- Modify: `src/save/persistence.ts`
- Modify: `GAME.md`

1. Bump `RunState.version`, new-run initialization, save key, and load guard from 7 to 8.
2. Document corner and rattled mechanics, balance constants, coach keys, probe metrics, and symmetric opponent set pieces as future work.

### Task 6: Verification

1. Run `pnpm exec tsc --noEmit` with the required environment.
2. Run all Vitest tests and confirm the unchanged tutorial test remains green.
3. Run `pnpm exec vite build` with the required environment.
4. Run `node --import tsx src/sim/funProbe.ts` with the required environment and record every nation's results plus the new metrics.
5. Review every acceptance item and report changed files, RED/GREEN evidence, probe numbers, knob log, and deviations.
