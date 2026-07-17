# Real Groups Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development and superpowers:verification-before-completion to implement this plan task-by-task.

**Goal:** Replace tier-picked mini-groups with the playable nations' real four-team groups, a three-matchday round robin, and deterministic best-third advancement.

**Architecture:** Keep group scheduling, AI fixture simulation, standings, and best-thirds ranking in the deterministic run core. Persist completed fixtures and the verdict on `RunState`; have `run.ts` resolve advancement synchronously and emit the verdict through the existing event channel. Derive the full fixture list in the tournament UI from the persisted opponent order and fill scores from persisted results.

**Tech Stack:** TypeScript 6, React 19, Vitest 4, pnpm, seeded core RNG.

### Task 1: Add RED coverage for the complete groups and schedule

**Files:**
- Create: `test/realGroups.test.ts`
- Read: `src/data/teams.ts`
- Read: `src/core/run/group.ts`

1. Add tests that every playable nation's letter maps to exactly four pooled teams and that `cze`, `bih`, `sui`, `hai`, `sco`, `par`, `aus`, and `tur` have the specified letters.
2. Add a schedule test asserting six unique pairs over three matchdays, with the player facing each groupmate once and one AI fixture per matchday.
3. Run `env -u NODE_OPTIONS PATH=/Users/kejixu/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec vitest run test/realGroups.test.ts` and retain the expected failures as RED evidence.

### Task 2: Add RED coverage for advancement and persistence

**Files:**
- Modify: `test/realGroups.test.ts`
- Create: `test/persistence.test.ts`
- Read: `src/save/persistence.ts`

1. Add rank 1 and rank 2 advancement tests expecting R32.
2. Add rank 3 tests for deterministic fixed-seed best-thirds verdicts, one through and one out, including `THIRDS_VERDICT` payload equality.
3. Add a rank 4 elimination test.
4. Add a storage stub and assert v8 data is discarded while a resumable v9 run round-trips.
5. Re-run both new test files and retain failures caused by missing v9/real-group behavior.

### Task 3: Complete team data and construct the round robin

**Files:**
- Modify: `src/data/teams.ts`
- Modify: `src/core/run/group.ts`
- Modify: `src/core/run/run.ts`
- Modify: `src/core/types.ts`

1. Add the eight specified teams with parody coaches and update the pool comment.
2. Replace tier selection with same-letter groupmates, preserving a seeded shuffle of the player's opponent order.
3. Provide a deterministic schedule helper for three matchdays.
4. Record the player fixture and simulate/record the corresponding AI fixture after each player match.
5. End the group after match index 3 and keep knockout opponent selection unchanged.
6. Run the real-groups tests until data and schedule cases pass.

### Task 4: Implement best-thirds resolution and v9 saves

**Files:**
- Modify: `src/core/types.ts`
- Modify: `src/core/run/group.ts`
- Modify: `src/core/run/run.ts`
- Modify: `src/save/persistence.ts`

1. Add `ThirdsVerdict`, `RunState.thirdsVerdict`, and the `THIRDS_VERDICT` game event.
2. Generate 11 seeded comparison records using the weighted 2–6 point spread, goal differences from -3 through +2, and seeded final tiebreaks.
3. Resolve ranks 1–2 to R32, rank 3 through the verdict, and rank 4 to elimination; return the verdict event from the action that settles matchday 3.
4. Change the state literal, creation stamp, persistence namespace/guard to v9.
5. Run the new test files until all cases pass.

### Task 5: Present fixtures and verdict in the tournament UI

**Files:**
- Modify: `src/ui/screens/TournamentScreen.tsx`
- Modify or create: a focused UI test only if needed for regressions

1. Render all three matchdays with both fixtures and fill completed scores from `groupFixtures`.
2. Render the four-row group table as supplied by state.
3. Show a prominent best-thirds panel in knockout and eliminated tournament states using the exact points/GD/rank/outcome copy.
4. Keep existing opponent threat presentation behavior intact.

### Task 6: Synchronize docs and existing campaign expectations

**Files:**
- Modify: `GAME.md`
- Modify: `test/fullRun.test.ts`

1. Rewrite the group-stage run structure to describe four teams, three matches, per-matchday AI fixtures, top-two advancement, and eight best thirds.
2. Change save version documentation to 9 and update maximum/required match counts from 7/2 to 8/3.
3. Run the focused campaign and boundary tests.

### Task 7: Verify and report

**Files:**
- Create: `CODEX_STATUS.md`

1. Load and follow `superpowers:verification-before-completion`.
2. Run `env -u NODE_OPTIONS PATH=/Users/kejixu/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec tsc --noEmit`.
3. Run `env -u NODE_OPTIONS PATH=/Users/kejixu/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec vitest run` and capture file/test counts.
4. Run `env -u NODE_OPTIONS PATH=/Users/kejixu/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec tsx src/sim/funProbe.ts`, record every nation's `runWin`, and flag values outside 10%–35% without tuning.
5. Write `CODEX_STATUS.md` with changes, RED evidence, final command outputs, probe lines, and any deviations.
6. Re-run typecheck and the full suite after writing the status file if code changed during final cleanup.
