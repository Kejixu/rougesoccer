# Two Buttons, One Strip — every possession is "stage dice, choose the ending"

## Problem (playtest, 2026-07-17)

1. Attack rounds show THREE execution controls (Run play / Play & Shoot /
   Recycle) with overlapping meanings. Key insight: banked Chance is fully
   determined at dock time (die values, combos, and card amounts are known
   before running), so "run first, decide the ending after" has zero
   informational value — the standalone Run play button is pure clutter.
2. "Round 2 of 6" text sits beside the numbered possession strip — the same
   fact twice in two visual languages, top-right, confusing.

## Design (UI-only)

### 1. Two buttons per posture — every button runs the dock AND ends the move

**Your ball** (replaces Run play + Shoot + Recycle):
- `⚽ Play & Shoot (N) — 62%` — flush the staged dock through the existing
  runner, then SHOOT (existing fire-time guards: still your round,
  ROUND_ACTIVE, passes ≥ 1). Dock empty = plain shoot (label
  `⚽ Shoot — 62%`, existing pass-first gating). Keep the live % IN the
  label (the tutorial's copy references watching the Shoot %).
- `↩ Play & Recycle (N)` — flush the dock, then END_ROUND (keep field
  position, no shot). Dock empty = plain recycle (label
  `↩ Recycle possession`). Aborts like the runner already does if the
  possession dies mid-flush (tackled → round ended → no END_ROUND dispatch).
- The standalone "▶ Run play" button is REMOVED on your possession.
  Mid-round multi-wave docking goes with it — cards drawn mid-flush (One-Two)
  land in hand for future rounds, which persistence makes valuable.

**Their ball:**
- `🛡 Commit defense (N)` — the existing dock runner, renamed (round
  continues after commits resolve; re-docking in waves stays possible here
  because that's how defense works).
- `Stand off (bank N)` — unchanged.

**Corner:** `▶ Take the corner` / `Clear it` — unchanged.

Tutorial: guided steps use instant clicks and lock intents (playCard /
shoot / endRound) — the plain-shoot and plain-recycle paths through the new
buttons must dispatch identically so every locked step still works.
`src/ui/tutorialScript.ts` and `test/tutorial.test.ts` byte-identical.

### 2. The strip replaces the round text

- Remove the `Round X of 6` text from the match-round-header; the possession
  strip moves into that spot (scoreboard area, not tucked top-right).
- Bigger slots: a pill per round showing JUST the number — filled gold pill =
  your round, outlined red pill = theirs (fill style + color, not color
  alone). Drop the ●/○ markers from slots; the legend becomes matching
  mini-pills (`[1] you  [2] them` style or swatches).
- Current round: enlarged pill + the existing YOUR BALL / THEIR BALL words.
  Past rounds dim. Extra-time rounds append with a visually distinct pill
  (existing extra-time treatment) plus a small "ET" tag so "of 6" being gone
  loses nothing.
- Keep `data-testid="possession-strip"`, `data-owner`, aria labels.

## Constraints

- ZERO engine changes (`src/core/**`, `src/data/**` untouched). SHOOT /
  END_ROUND / ASSIGN_DIE dispatch semantics and rng order unchanged.
- Tutorial files byte-identical; tutorial flow click-verified via tests.
- Update GAME.md verbs + presentation sections in the same change
  (your-ball verbs are now: Play & Shoot · Play & Recycle).

## Tests

- Attack buttons: dock loaded → Play & Shoot flushes then shoots exactly
  once; Play & Recycle flushes then ends the round exactly once; interception
  mid-flush → neither ender fires. Dock empty → plain shoot / plain recycle
  labels and behavior.
- No standalone Run play control on your possession; Commit defense present
  on theirs.
- Strip: number pills with correct owners; no separate "Round X of 6" text
  in the match header; current-round words; extra-time pill tagged.
- Existing suites green (168 currently; update tests that reference removed
  labels/testids and list them in the report); tsc clean.
