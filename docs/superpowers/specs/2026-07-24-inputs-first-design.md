# Inputs first + dice economics legibility

Playtest feedback (2026-07-24): "put the inputs on top and the outputs on the
bottom — the dice and the cards should be one of the first things we see." And:
"what's the downside of using more dice? Can I use more than one die on a card,
or dice on more than one card? I just want to know that stuff."

Two problems, one screen:

1. **Layout inverted.** The match column today reads scoreboard → pitch → stats →
   intent → tips → chain → glossary → ticker → *then* dice, hand, buttons. The
   things you touch are the last things you see; on smaller windows they start
   below the fold.
2. **Dice economics are taught nowhere.** The rules are simple — one die plays
   one card, once; spending dice on attack costs nothing (risk lives in the pass
   ramp, not the dice); on defense, unspent dice bank forward (max 2) — but no
   surface states them.

## A. Reorder the match column (JSX-only, no logic changes)

New order inside `<main className="board">` in `DiceMatchScreen.tsx`:

1. Overlays unchanged: `ScorePopups`, `HandoverBanner`, `Confetti`, concede flash.
2. `scoreboard panel` (thin frame: score + possession strip — stays first).
3. `corner-banner` (urgent, must sit above the inputs it gates).
4. Coach tip (`coach-tip`) — stays high so one-time teaching is seen.
5. **Inputs (the `ROUND_ACTIVE` fragment): `dice-tray`, `dice-hand`,
   `action-bar`** — moved up wholesale.
6. `chain-panel` / `their-chain` (decision context, directly under the buttons).
7. `dice-stat-row` (Chance / passes / arrow / draw·discard).
8. `PitchTrack` (the ball story — first *output*).
9. `intent-panel`.
10. `ChainGlossary`, `MatchTicker` (bottom).
11. `draggingDie` ghost and `TutorialOverlay` are positioned overlays — leave at
    the end of the fragment/main as convenient.

Verified: `board.css` has no sibling/nth-child selectors spanning these blocks
(`.match-log-line:first-child` and `.pitch-zone:nth-child(odd)` are internal to
their own components), so the move is visually safe.

## B. Teach the dice economy

- **Tray microcopy:** a persistent dim rule next to the `YOUR ROLL` label:
  `<span className="dice-rule">1 die plays 1 card</span>` (small, `--ink-dim`,
  never changes). The dynamic `dice-hint` line stays as-is.
- **Glossary entry:** add `Dice` to `CHAIN_GLOSSARY`: each die plays one card,
  once; spending dice is free — risk comes from each extra pass; on defense,
  unused dice bank into your next attack (max 2).
- **One-time coach tip** `dice` in `diceUx.ts`: fires on your possession once
  `passes >= 2` (the moment the "should I keep spending dice?" question is
  live). Text: spending dice has no downside on attack — one die, one card; the
  cost is pressure, each extra pass is riskier; on defense unused dice bank
  forward (max 2). Add `"dice"` to `CoachTipKey` and `COACH_TIP_KEYS`
  (additive — persisted seen-keys stay compatible). Place it in the `ordered`
  trigger list after `risk` so risk still teaches first.
- **Do NOT touch `src/ui/tutorialScript.ts`** (byte-stable golden file).

## Non-goals

- No change to dice mechanics, hand refill, Fresh Legs, or any engine code.
- No scoreboard redesign; no mobile-specific layout work.
