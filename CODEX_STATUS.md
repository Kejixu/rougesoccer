# Inputs first + dice economics legibility

## What changed

- Reordered `DiceMatchScreen` so the active dice tray, hand, and action bar appear
  before chain context, stats, pitch output, intent, glossary, and ticker.
- Added persistent tray microcopy: `1 die plays 1 card`, with a small dim
  `.dice-rule` style.
- Added the Dice glossary copy and one-time `coach.dice` tip. The trigger becomes
  active on the player's possession at two completed passes and is ordered after
  `risk`, so the risk lesson still wins when both tips are unseen.
- Extended rendered-screen and pure coach-tip tests.
- Updated section 2 of `GAME.md` with the inputs-first presentation order and the
  `coach.dice` persisted key.

## RED evidence

Focused command:

```text
PATH=$HOME/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec vitest run test/possessionUi.test.ts test/diceUi.test.ts
```

Expected failing output before production changes:

```text
Test Files  2 failed (2)
Tests       4 failed | 36 passed (40)

× defines the chain glossary terms
  expected CHAIN_GLOSSARY to include "Dice"
× teaches dice economics after two passes without repeating
  expected COACH_TIP_KEYS to include "dice"
× renders match inputs before pitch output and ticker
  received ["pitch", "dice-tray", "hand"]
× renders the one-die-per-card rule inside the dice tray
  expected tray markup to contain "1 die plays 1 card"
```

## GREEN evidence

The same focused command after the implementation:

```text
Test Files  2 passed (2)
Tests       40 passed (40)
```

The repository uses Vitest's Node environment and has no DOM runtime dependency.
The rendered static-markup assertion therefore checks `dice-tray` → `hand` →
`pitch`; the same test checks the component's JSX order for `PitchTrack` before
`MatchTicker`, whose event-populating effect does not execute during server render.

## Full verification

```text
PATH=$HOME/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec tsc --noEmit
exit 0
```

```text
PATH=$HOME/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec vitest run
Test Files  18 passed (18)
Tests       190 passed (190)
exit 0
```

## Skipped / constraints

- No required verification was skipped.
- `pnpm exec tsx` was not run, per the sandbox note.
- No git commands were run.
- No engine files, tutorial golden files, or `agents/openai.yaml` were changed.
