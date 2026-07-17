# Whose Ball Is It — making the possession schedule legible

## Problem (playtest, 2026-07-16)

"It's not clear who has possession… or that we have to fight for it."
Possession is a fixed schedule (odd rounds yours, even theirs — like innings),
and the fight happens *within* a round (tackles, interceptions, counters,
field position). The UI communicates this with one small badge that flips.
Players never learn the rule; the mode change between rounds is invisible.

## Design — three pieces, UI-only

### 1. The possession strip

A horizontal strip of the match's six rounds near the round header:

```
  ① ●   ② ○   ③ ●   ④ ○   ⑤ ●   ⑥ ○        ● you  ○ them
```

- One slot per round: filled marker = your ball, hollow = theirs; use the
  existing you/them colors (attack gold vs defending red family from
  tokens.css), not just shape.
- Current round clearly lit (ring/glow), past rounds dimmed with their
  result hinted if cheap to do (goal ⚽ on a round where someone scored is a
  nice-to-have, not required).
- Extra time appends slots as extra rounds happen.
- `data-testid="possession-strip"`; slots expose `data-owner="you"|"them"`.
- One glance answers: whose ball now, whose next, how many attacks I have left.

### 2. The handover beat

When a new round starts and possession flips:

- A centered overlay banner, ~1.1s, then fades: "ROUND 4 — THEIR BALL" with a
  subline "Commit tackles or stand off" (their ball) / "ROUND 5 — YOUR BALL"
  with "Build the chance" (yours). `pointer-events: none` — it must never
  block clicks (tutorial's guided instant clicks included).
- The match root gets a `mode-defending` class during their possession:
  shift the pitch/panel accent toward the existing defending palette so the
  whole screen reads "defending" (tokens.css already has defending hues —
  extend, don't invent a new palette).
- Trigger from the existing lastBatchRef-guarded effect on ROUND_START
  events (StrictMode discipline: no double-processing, no side effects in
  setState updaters).

### 3. Say the rule once

- New coach tip key `schedule` (extend `CoachTipKey` + `COACH_TIP_KEYS`),
  shown the FIRST time possession flips to them in a run:
  "Possessions alternate like innings — three attacks, three defenses.
  You fight for the ball within a round: tackles, interceptions, counters."
- Reword the "How this works" glossary entry for possession accordingly
  (CHAIN_GLOSSARY in diceUx.ts) if one exists; add one if not.

## Constraints

- ZERO engine changes: `src/core/**`, `src/data/**` untouched.
- Tutorial: `src/ui/tutorialScript.ts` and `test/tutorial.test.ts` untouched
  and byte-identical; the banner must not intercept pointer events; the
  tutorial's own overlay stays on top (z-index below TutorialOverlay).
- The old possession badge can stay or merge into the strip — implementer's
  call, but there must be exactly ONE primary possession indicator after
  this change (no duplicated signals saying the same thing in two styles).
- Update GAME.md (presentation section) in the same change.

## Tests

- Strip: renders one slot per round played/scheduled with correct
  `data-owner` alternation; current round marked; extra-time slot appends.
- Handover: ROUND_START with possession flip → banner element appears and
  carries the right text; no banner when possession doesn't flip
  (round 1 kickoff may show "YOUR BALL" — implementer's call, but test
  whichever behavior is chosen).
- `mode-defending` class present on the match root exactly during their
  possession.
- Coach tip `schedule` fires once, first their-possession, and never again
  (existing one-time tip machinery).
- All existing tests green (144 currently); tsc clean.
