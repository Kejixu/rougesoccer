# RogueSoccer — project guide for Claude

RogueSoccer is an international-tournament roguelike deckbuilder: pure TypeScript
browser game (Vite + React 19 + strict TS, pnpm, vitest). Real countries + verified
groups (the real 2026 draw as data), parody player/coach names, NO FIFA branding,
and no "World Cup"/"2026" in player-facing copy — the theme is evergreen.

## Read this first

**Before reasoning about or changing how the game plays, read [GAME.md](GAME.md).**
It is the living source of truth for the *current* mechanics (the dice tug-of-war
match, possession, scoring, the card pool, nation identities, the run structure, and
the known rough edges). The design specs under `docs/superpowers/specs/` are *intent*
and can drift from the code — `GAME.md` reflects what the code actually does.

**When you change a mechanic, update `GAME.md` in the same change** so it never drifts.
If the code and `GAME.md` disagree, that is a bug in one of them — surface it.

## Architecture (the hard constraint)

Headless, deterministic core. `src/core/**` and `src/data/**` must NOT import
`react`, `document`, `window`, `localStorage`, `Math.random`, or `Date.now` — all
randomness flows through seeded RNG in state. `test/boundaries.test.ts` enforces this.
The active match is dice mode (`src/core/match/dice.ts`); a separate combat engine
(`src/core/match/engine.ts`, `MatchState`) still exists for its own tests — don't
conflate them.

- `src/core/` engine + run layer (pure) · `src/data/` content (cards, teams, balance,
  nation kits) · `src/sim/` headless bots + balance probe (`funProbe.ts`) ·
  `src/ui/` React screens.
- Verify with `pnpm exec tsc --noEmit` and `pnpm exec vitest run`.
- Balance feel is measured with `pnpm exec tsx src/sim/funProbe.ts`.

## Working style on this project

The recurring goal has been *fun*, and the recurring trap has been rebuilding the
match verb instead of clarifying the loop. Prefer making the existing loop coherent
and legible over adding new mechanics. When the user says "not fun," treat it as a
clarity/rhythm problem first.
