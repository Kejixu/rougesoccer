# RogueSoccer ⚽

An international tournament roguelike deckbuilder. Balatro-style card scoring meets
Retro Bowl's "you only play offense" — build a squad of parody stars, outscore
the opponent's clock, and survive seven matches from the group stage to the final.

## How it plays

- **A run = one tournament campaign** using the real 2026 groups: 3 group matches
  (the table decides), then sudden-death knockouts to the final.
- **A match is a scoring puzzle.** Each round you draw to 7 and get 2 plays + 2
  discards. ATTACK commits up to 4 cards: `(Σ power) × mults`, every 40 points
  is a goal. DEFEND deploys defenders (max 3) that slow the opponent.
- **The opponent never takes turns** — their score climbs automatically each
  round (the clock). Defense slows it; nothing stops it.
- **Push your luck:** leading after round 5? Bank the win, or play extra time at
  2× clock speed for bonus rewards. The first push is free; the second tires
  your cards for the next match.
- **Between matches:** sign new cards, buy/train/release in the transfer market,
  spend scout points to preview opponents.

Each opposing nation has a style: possession (forces discards), flair (faster
clock), fortress (caps your multiplier), counter (failed attacks feed their
clock), high press (smaller hand).

## Run it

```bash
pnpm install
pnpm dev        # play at localhost:5173
pnpm check      # typecheck + 45 tests
pnpm sim --runs 500 --strategy greedy   # balance simulation report
```

## Architecture

- `src/core/` — pure, deterministic, headless game engine (no DOM, no ambient
  randomness; seeded RNG lives in state). Reducer + event log:
  `applyMatchAction(defs, state, action) -> { state, events }`.
- `src/data/` — all content (34 cards, 18 real teams with parody coaches,
  styles) and every tunable number (`balance.ts` + `core/balance.ts`).
- `src/sim/` — bot strategies + CLI harness that plays thousands of runs and
  reports win rates, near-loss tension, and per-card win-rate deltas.
- `src/ui/` — React screens; Panini sticker cards with CSS foil, FLIP hand
  animation, event-driven score popups. Portraits are a slot — generated art
  drops in without UI changes.
- `test/` — engine tables, full-run integration, determinism replay, module
  boundary enforcement, edge cases.

Balance status (800-run sim): greedy bot wins ~26% of runs (target 15–25%),
defensive ~20%, push-lucky ~26%. Known gaps: near-loss rate 26% vs 40–50%
target; minnows are still nearly free wins.

## Licensing posture

Real country names and the real 2026 draw (verified against Wikipedia + BBC,
sources in `src/data/teams.ts`); no FIFA marks, logos, or trophy imagery;
players and coaches are parody names ("Lionel Messy") kept in data files.
