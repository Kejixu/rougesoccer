# Full Time — remove the go-for-glory gamble; align match end with real soccer

Status: APPROVED. User's reasoning (the fiction test): extra time never happens when
you're WINNING — it exists for ties, in knockouts. The leading-at-full-time
"Bank the win / Go for glory" choice breaks the sport's logic and dies today.

## The new (soccer-true) match end

After the final regulation round (6):

- **Leading → full-time whistle, you WIN.** No modal, no gamble. A clean
  "FULL TIME" beat (popup + ticker line) then the match result.
- **Tied, group stage → draw** (unchanged).
- **Tied, knockout → EXTRA TIME (golden goal)** — this is the existing
  sudden-death flow, RENAMED to match the fiction: up to 3 alternating
  possessions where the first goal wins; still tied after → **penalty shootout**
  (unchanged mechanics).
- **Trailing → loss** (unchanged).

## What gets deleted (dice mode only — the combat engine keeps its own types)

- The PUSH_DECISION phase entry from the dice engine: `concludeRound`'s leading
  branch calls `finish(draft, "win", events)` directly.
- The `extratime` flow in dice: `TAKE_WIN` and `EXTRA_TIME` removed from
  `DiceMatchAction`; the action-switch cases removed; `EXTRA_TIME_CLOCK_MULT` /
  ET reward code paths in dice.ts removed (balance fields stay — combat uses them).
  `extraRoundsPlayed` STAYS on DiceMatchState (frozen run-layer contract; always 0).
- UI: the push-decision modal, `data-testid="take-win"` / `"extra-time"`, the
  `PUSH_DECISION` ticker line and popups branch; the `push` coach tip (key removed
  from COACH_TIP_KEYS; seen-key harmless if lingering in localStorage).
- Bots: `pushLead` option + PUSH_DECISION branch in strategies (greedy/defensive/
  pushlucky keep their other params; makeRandomBot's branch too). funProbe: any
  push metrics dropped.
- MatchPhase/GameEvent shared types: leave `PUSH_DECISION` variants in place if the
  combat engine references them; dice simply never emits/enters them. Remove
  dice-side dead handling only.

## Renames (copy only, mechanics unchanged)

- Match status line: `SUDDEN DEATH N` → `EXTRA TIME — golden goal (N)`.
- `SUDDEN_DEATH_START` popup/ticker copy: "EXTRA TIME — next goal wins."
- GAME.md §5 rewritten to the new flow; §8/§9 scrubbed of push/ET-gamble refs.

## Tutorial (golden seed tutorial-109 — the beats must survive)

The rng stream is unchanged; the only flow change is at the very end: R6 concludes
and the match now ENDS in the 2-0 win immediately (no PUSH_DECISION, no TAKE_WIN).

- Step 14 (`takeWin` lock) becomes a `next`-locked step: title "Full time!",
  WHAT: "You held the lead to the whistle — that's the win.", WHY: "Ties in the
  knockouts go to extra time and penalties; in the groups a draw shares the
  points. Win in regulation and none of that can hurt you."
  (The `takeWin` lock kind is removed from the tutorial lock union.)
- Step 15 unchanged. Regression test: replace the TAKE_WIN action/assertions with
  asserting MATCH_END result "win", playerGoals 2, oppGoals 0 fires at R6's
  conclusion. All other beats identical. If any earlier beat shifts, STOP/BLOCKED.

## Balance

Removing the ET gamble removes a small budget/scout income source and a small
loss risk — expect near-zero drift. Re-run the probe; retune ONLY if a band
breaks (same bands as before). Save version 6 -> 7 (three files).

## Acceptance

- TDD: engine tests updated — leading after round 6 finishes "win" with no
  PUSH_DECISION event; knockout tie still enters the (renamed) golden-goal flow
  and shootout. tsc clean; vitest green incl. tutorial; build ok; probe in bands.
- Browser (controller): win a match in regulation → clean FULL TIME beat, no modal.
