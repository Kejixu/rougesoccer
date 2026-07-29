# Rookie staging — progressive match-screen disclosure

## What changed

- Added the exported pure `rookieReveals(state)` helper and the five persisted
  reveal flags: `ui.chain`, `ui.stats`, `ui.intent`, `ui.theirchain`, and
  `ui.glossary`.
- Added `initialRevealedUi` for deterministic rendering tests. Visibility is
  computed inline from stored flags plus current triggers, so a trigger reveals
  immediately; an idempotent effect persists newly triggered flags without
  setting state during render.
- Staged the player chain, stat row, opponent intent, opponent chain, and
  glossary. Tutorial matches bypass staging and continue to render everything.
- Added the always-visible active-round objective line above the dice tray with
  the specified corner, your-ball, and their-ball copy.
- Updated tutorial completion so `markCoachTipsSeen()` also writes every
  `ui.*` reveal flag.
- Added the pure `isFreshProfile(storedKeys)` helper. Fresh title screens put
  the primary **Learn the game (5 min)** action before a plain campaign action;
  profiles with any `coach.*` or `ui.*` key retain the previous order/emphasis.
- Added focused coverage in `test/rookieStaging.test.ts`, objective-line styling
  in `src/ui/styles/board.css`, and the rookie-staging behavior in `GAME.md`
  section 2.

## RED evidence

Focused command before production changes:

```text
PATH=$HOME/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec vitest run test/rookieStaging.test.ts
```

Expected failing output:

```text
Test Files  1 failed (1)
Tests       12 failed | 3 passed (15)
```

The failures identified the missing reveal and fresh-profile helpers, unstaged
panels, absent objective line/copy, and old title order/emphasis. The three
already-green checks covered immediate current-state visibility, all-key parity,
and tutorial parity.

## GREEN evidence

The same focused command after implementation:

```text
Test Files  1 passed (1)
Tests       15 passed (15)
```

## Full verification

```text
PATH=$HOME/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec tsc --noEmit
exit 0
```

```text
PATH=$HOME/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec vitest run
Test Files  19 passed (19)
Tests       213 passed (213)
exit 0
```

## Skipped / constraints

- No required verification was skipped.
- No existing non-tutorial rendered test asserted one of the staged panels, so
  no existing fixture needed `initialRevealedUi`; tutorial rendering already
  bypasses staging.
- `pnpm exec tsx` was not run.
- No git commands were run.
- No files under `src/core/**` or `src/data/**` were changed.
- `src/ui/tutorialScript.ts`, `test/tutorial.test.ts`, and
  `agents/openai.yaml` were not changed.
