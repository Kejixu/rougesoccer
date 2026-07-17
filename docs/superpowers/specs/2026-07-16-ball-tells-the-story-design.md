# The Ball Tells the Story — event-replay ball + locked cards that say why

## Problem (from playtest, 2026-07-16)

Two legibility failures, both UI-only — the rules are correct but invisible:

1. **"How do we concede when the ball is on the middle line?"** The opponent's
   whole possession resolves inside one state update, and the engine snaps the
   ball back to `MIDFIELD` before React renders. The staged popups narrate a
   shot 500–900ms later, but the pitch shows the ball at center the entire time.
   Counter shots are worse: `chainIntercepted` takes an instant one-roll shot
   with no ball movement at all — you get tackled at the halfway line and
   concede "from nowhere."

2. **"I have a 6 and can't put it on the shooting card."** Every shot card
   accepts a 6. The block is possession gating (attack cards locked during
   their possession). The UI just dims the card with no reason, so a correct
   rule reads as a bug.

## Design

### Part A — replay ball movement from the event log

The engine already emits `BALL_MOVED { ball, toward }` for every advance
(yours and theirs). The UI should *replay* those in sync with the popups
instead of rendering raw `state.ball`.

1. **Shared staging helper.** Extract the delay-assignment logic from
   `ScorePopups` into `src/ui/eventTimeline.ts`:
   `stageEvents(events: GameEvent[]): { delay: number; event: GameEvent }[]`.
   Every event gets a delay; popup-worthy events advance the clock exactly as
   `ScorePopups` does today (450/520/550/600/650/800/900ms beats — timing must
   not change visibly). Non-popup events (`BALL_MOVED`, `DIE_ASSIGNED`, …) get
   the current clock position without advancing it. `ScorePopups` is rewritten
   to consume this helper (pure refactor of its timing).

2. **`displayBall` in `DiceMatchScreen`.** New state, passed to `PitchTrack`
   instead of `m.ball`. In the existing `lastBatchRef`-guarded effect (do NOT
   add a second event-consuming effect — StrictMode), schedule from
   `stageEvents(events)`:
   - each `BALL_MOVED` → `setDisplayBall(e.ball)` at its delay;
   - each `COUNTER_SHOT` → dash: `byYou` → `THEIR_BOX + 2` (18), `!byYou` →
     `YOUR_BOX - 2` (2), at the counter's staged delay (ball arrives as the
     reel spins);
   - after the final staged delay + 800ms → sync `displayBall` to the real
     `m.ball` (this is the visible "reset to center for the next round").
   - New batch cancels all pending ball timers first (keep timer refs; also
     clear on unmount).

3. **Zone stepping is enough.** The ball token re-parents across zone cells;
   full tweening is a separate backlog item. Required: the token appears in
   the correct zone at each staged beat. Nice-to-have: a brief CSS pulse on
   the token when it moves (`ball-step` keyframe, ~250ms).

### Part B — locked cards say why

1. Extend `src/ui/diceDropTargets.ts` with
   `dieDropInfo(defs, state, dieIndex, tutorialLock?): Map<string, "ok" | "locked">`
   — same walk as `dieDropTargets`, but a card whose slot FITS the die while
   possession blocks it maps to `"locked"` instead of being omitted.
   (`dieDropTargets` can become a thin wrapper filtering `"ok"`.)

2. In `DiceMatchScreen`, while a die is active: `"locked"` cards get class
   `drop-locked` (not `drop-dim`) plus a small badge overlay:
   - attack card during their possession → `🔒 Win the ball back first`
   - defense card during your possession → `🔒 Waits for their possession`

3. CSS in `board.css`: `drop-locked` keeps the card visibly present (slightly
   dimmed, desaturated) with the badge centered; must not shift layout.
   Tutorial-locked cards keep today's behavior (plain dim, no badge — the
   overlay already directs the player).

## Constraints

- **Zero engine changes.** `src/core/**` and `src/data/**` untouched. No
  balance changes. Tutorial script and `test/tutorial.test.ts` byte-identical.
- Popup timing as experienced today must not change (the staging refactor is
  behavior-preserving for popups).
- Update `GAME.md` (presentation section): the pitch replays passes/counters
  event-by-event; possession-locked cards show a reason while dragging.

## Tests

- `stageEvents`: delays are monotonic non-decreasing; popup-worthy events
  advance the clock; `BALL_MOVED` inherits the clock without advancing;
  a representative opp-possession batch (challenge → BALL_MOVED → OPP_PASS →
  OPP_SHOT) stages the ball move before the shot.
- `dieDropInfo`: fitting attack card during their possession → `"locked"`;
  fitting defense card during your possession → `"locked"`; fitting card in
  correct possession → `"ok"`; non-fitting card absent; tutorial-locked
  card absent.
- Existing suites all green (126 tests); tsc clean.
