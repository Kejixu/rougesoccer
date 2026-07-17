# Play & Shoot — the shot is the last item of the play you call

## Problem (playtest, 2026-07-16)

With dice docked (e.g. a Clinical Finish staged), BOTH "▶ Run play" and
"⚽ Shoot" are clickable, and pressing Shoot fires immediately WITHOUT the
docked plays — the staged finisher is silently discarded at round end. The
player loses banked Chance and never learns why. Button order is a hidden
rule; `shootDisabled` (DiceMatchScreen.tsx:665) ignores the dock entirely.

## Design (UI-only)

1. **Shoot flushes the dock.** Pressing Shoot with `docked.length > 0` runs
   the remaining staged plays through the existing sequential runner (same
   700ms beats, same re-validation per step), then dispatches `SHOOT`
   automatically at the end — IF the possession survived: same round, still
   `ROUND_ACTIVE`, still your ball, `passes >= 1`. An interception mid-flush
   means the shot never happens (the runner already aborts; just don't
   shoot).
2. **The label says which verb it is.**
   - Dock empty: `⚽ Shoot (62%)` — unchanged, including the
     "make a pass first" suffix when passes < 1.
   - Dock loaded: `⚽ Play & Shoot (3)` where 3 = docked count. Keep the
     live % out of the loaded label — the % climbing pass-by-pass during
     the flush IS the drama; it's already shown in the status row.
3. **Enablement:** with dice docked, Shoot is enabled even at `passes === 0`
   (the flush will create the passes; validate `passes >= 1` at fire time
   before dispatching SHOOT). With the dock empty, gating is unchanged.
   While a run is executing (`running`), both buttons stay disabled.
4. **Run play is unchanged** — it remains "advance the move without
   shooting yet."
5. **Corner rounds unchanged** (shoot is already disabled; the corner has
   its own one-play-then-header flow).

## Constraints

- ZERO engine changes; `SHOOT` action, engine order, and rng stream
  untouched — this is button/runner logic only.
- Tutorial: `src/ui/tutorialScript.ts` + `test/tutorial.test.ts`
  byte-identical. The tutorial's guided clicks never stage a dock before
  shooting (instant assigns), so plain-Shoot behavior there is unchanged;
  `tutorialAllows({ kind: "shoot" })` still gates.
- Update GAME.md (the possession verbs / presentation section) in the same
  change: your-ball verbs are Run play · Play & Shoot · Recycle.

## Tests

- Docked queue + Shoot → all staged plays resolve (PASS_COMPLETED events in
  order), then exactly one SHOOT dispatch.
- Interception during the flush → NO shot dispatched.
- Round/phase change during the flush (e.g. tackle ends the possession) →
  runner stops, no shot.
- Label: `Play & Shoot (N)` iff docked, plain `Shoot (%)` otherwise.
- Enablement: passes 0 + dock empty → disabled; passes 0 + dock loaded →
  enabled; fire-time guard means SHOOT is not dispatched if the flush ends
  with passes still 0.
- All existing tests green (150 currently); tsc clean.
