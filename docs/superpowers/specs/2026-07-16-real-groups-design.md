# Real Groups — 4-team groups, top 2 advance, best-thirds drama

## Problem (playtest, 2026-07-16)

The group stage doesn't reflect 2026 and is nearly unlosable: a 3-team
mini-group with tier-picked opponents where top 2 of 3 advance. (GAME.md's
"top of the group advances" line is stale vs the code — fix it either way.)
The real format: 12 groups of 4, you play 3 matches, top 2 advance, and the
8 best third-placed teams of 12 also reach the Round of 32.

## Design

### Data — complete the playable nations' real groups

Add 8 teams to `src/data/teams.ts` (pool 18 → 26), using the verified draw in
the file header. Parody coach names (NO real names), style/rating caricatures:

| id | name | confed | group | tier | rating | style | coach (parody) |
|---|---|---|---|---|---|---|---|
| cze | Czechia | UEFA | A | 3 | 12 | balanced | e.g. "Ivan Hasheck" |
| bih | Bosnia and Herzegovina | UEFA | B | 4 | 10 | counter | invent |
| sui | Switzerland | UEFA | B | 3 | 13 | fortress | invent |
| hai | Haiti | CONCACAF | C | 4 | 8 | counter | invent |
| sco | Scotland | UEFA | C | 3 | 12 | highpress | invent |
| par | Paraguay | CONMEBOL | D | 3 | 12 | fortress | invent |
| aus | Australia | AFC | D | 3 | 11 | balanced | invent |
| tur | Türkiye | UEFA | D | 2 | 14 | flair | invent |

Every playable nation (bra, usa, mex, can) must end up with its full real
group of 4 in the pool. Add a data test asserting that.

### Run layer — real 4-team group, round-robin schedule

- `createRun`: `groupTeamIds` = the player's 3 REAL groupmates (same `group`
  letter). Delete/bypass tier-picking for the group. (Knockout draw logic
  unchanged.)
- Schedule: 3 matchdays, classic round-robin. MD1: player vs a, b vs c.
  MD2: player vs b, a vs c. MD3: player vs c, a vs b. Keep the existing
  shuffle of the player's opponent order; derive the AI fixture per matchday
  as "the other two".
- After each player match records, simulate that matchday's AI fixture and
  record it too (generalize `simulateGroupDecider` into a per-fixture sim,
  same RNG discipline — all randomness through the run's seeded rng). The
  table visibly evolves between matchdays.
- The group now ends after the player's **3rd** match (matchdays 0, 1, 2),
  not the 2nd — adjust the `groupDone` check in `run.ts` accordingly.

### Advancement

After matchday 3, rank the 4-team table (existing points/GD/tiebreak logic):

- **Rank 1–2** → R32, as today.
- **Rank 3** → **best-thirds verdict**: generate the other 11 groups'
  third-place records from the run rng — for each: points drawn from a
  plausible spread (weights roughly: 2pts×2, 3pts×3, 4pts×4, 5pts×2, 6pts×1
  across the 11), GD in [-3, +2]. Rank the 12 thirds by points, then GD,
  then rng tiebreak. Top 8 advance. Store the outcome on RunState
  (`thirdsVerdict: { points, gd, rank, through } | null`) and emit a run
  event `THIRDS_VERDICT` with the same payload. Through → R32; out →
  eliminated. NO new phase — resolve synchronously during advancement so
  bots/funProbe need no new action.
- **Rank 4** → eliminated.

### Save/version

RunState version 8 → **9** in all three places (types.ts literal,
run.ts createRun, persistence.ts guard). New fields: `thirdsVerdict` (and
whatever the fixture schedule needs persisted).

### UI

- `TournamentScreen`: group table shows 4 rows; show the 3 matchdays as
  fixtures with results filling in (yours + the simulated pair).
- Verdict moment: when `thirdsVerdict` exists, show a banner/panel before the
  R32 bracket or the elimination screen: "Best thirds: 4 pts, GD -1 — ranked
  6th of 12. **Through.**" (or "…ranked 9th of 12. Out.") Make it a beat,
  not a footnote.
- GAME.md run-structure section rewritten to match all of the above
  (including fixing the stale "top of the group advances" line).

## Constraints

- All randomness through the seeded run rng (`rand(state)`) — boundaries test
  must stay green.
- Do NOT touch the dice match engine (`src/core/match/dice.ts`), the tutorial
  (seed tutorial-109 creates a match directly, not a run — it must remain
  byte-identical), or `src/core/match/engine.ts`.
- Keep `STAGE_CLOCK_MULT` and match balance untouched; group difficulty now
  comes from the real draw (per-nation identity is intended flavor).

## Tests

- Data: each playable nation's group has exactly 4 teams in the pool; the 8
  new ids exist with real group letters.
- Schedule: round-robin correctness — every pair plays exactly once across
  the 3 matchdays; player plays all 3 groupmates.
- Advancement: rank 1 and 2 → R32; rank 3 → verdict (seeded cases covering
  both through and out); rank 4 → eliminated; verdict is deterministic for a
  fixed seed and emits THIRDS_VERDICT.
- Persistence: v8 saves are discarded, v9 round-trips.
- funProbe still runs (run length is now up to 8 matches); report the win
  bands per nation in the status file — flag if any nation leaves
  [10%, 35%], but do NOT tune balance knobs in this slice.
