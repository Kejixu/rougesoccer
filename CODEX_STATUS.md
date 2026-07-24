# Recycle advice + unspent attack dice fizzle

## What changed

- Added pure exported `recycleAdvice(defs, state)` in
  `src/ui/screens/DiceMatchScreen.tsx`. It endorses Recycle at 30%+ next-pass
  risk, warns when a legal low-risk attack play and unused dice remain, handles
  singular/plural copy, and otherwise stays neutral.
- Applied that advice only to the empty-dock player-attack Recycle button via
  the existing `data-hot` / `data-cold` grammar and a
  `data-testid="recycle-advice"` subline. Stand off, corners, and loaded
  Play & Recycle remain neutral.
- Added pure exported `unspentAttackDice(prevState)` and a guarded possession-end
  effect. Unused player-attack dice render as keyed ghost dice with
  `data-testid="unspent-fizzle"`, then clear after 650ms through a ref-backed,
  unmount-cleaned timer. Defensive dice never use the waste framing.
- Added modest Recycle hot/cold, subline, and 600ms fizzle styles. Reduced-motion
  mode disables the fizzle animation.
- Updated section 2 of `GAME.md` with the Recycle advice and attack-fizzle versus
  defensive-banking presentation.
- Added eight focused tests in `test/possessionUi.test.ts`.

## RED evidence

Focused command before production changes:

```text
PATH=$HOME/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec vitest run test/possessionUi.test.ts
```

Expected failing output:

```text
Test Files  1 failed (1)
Tests       7 failed | 23 passed (30)

× marks empty-dock Recycle cold when a cheap legal attack play remains
  expected the end-round button to contain data-cold="true"
× recycleAdvice hot / singular cold / plural cold / neutral cases (4)
  expected undefined to be type of "function"
× unspentAttackDice player / defense-and-all-used cases (2)
  expected undefined to be type of "function"
```

The separate Stand off markup assertion already passed in RED, confirming the
existing defense control had neither advice attribute.

## GREEN evidence

The same focused command after implementation:

```text
Test Files  1 passed (1)
Tests       30 passed (30)
```

## Full verification

```text
PATH=$HOME/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec tsc --noEmit
exit 0
```

```text
PATH=$HOME/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec vitest run
Test Files  18 passed (18)
Tests       198 passed (198)
exit 0
```

## Skipped / constraints

- No required verification was skipped.
- `pnpm exec tsx` was not run, per the sandbox note.
- No git commands were run.
- No engine files, tutorial files, or `agents/openai.yaml` were changed.
