# Set Pieces & the Rattled Keeper — near-misses become strategy

Status: APPROVED (user picked this from the mechanics menu). Design principle: no
new resources to track — both mechanics recycle EXISTING dead moments (the saved
shot, the near-miss) into temporary states with clear soccer fiction.

## The nested triggers (on YOUR missed SHOOT only)

Let `margin = dc - (roll + quality)` for a missed shot (margin >= 1):

- **margin <= CORNER_WINDOW (4): CORNER.** The keeper parries it out — the
  possession does NOT end. You get exactly ONE corner play (below).
- **margin <= RATTLE_WINDOW (2): also RATTLED.** The keeper is shaken:
  `keeperRattled = true` — YOUR next shot (SHOOT or your counter shot) gets
  **-2 DC**, then the flag clears (hit or miss). One stack, boolean, persists
  across possessions within the match.
- Misses by more than CORNER_WINDOW: possession ends as today.
- Counters' misses trigger NEITHER (breakaways go wide). Their shots trigger
  nothing (player-side only for now; note symmetric version as future work).

## The corner (one bonus play, then the header)

On CORNER: `corner = true`; shotQuality resets to 0; the ball stays where it is
(their box). The player plays EXACTLY ONE attack card (a fitting unused die
required, dock-and-run UI caps docking at 1 during a corner) — its chance effects
bank as normal (development/setup included) — and then an AUTOMATIC shot fires
immediately with the banked Chance (the headed attempt; `SHOT_TAKEN` gains
`corner?: true` for copy). Then the possession concludes normally (a second
corner CANNOT chain off the corner shot — one bite).

If no card/die can be played (or the player chooses), "Clear it" (`END_ROUND`)
concludes the possession — the corner fizzles.

The rattled check applies to the corner shot too (a margin<=2 corner header that
misses re-rattles: fine, it's the same boolean).

## Engine

- State: `keeperRattled: boolean`, `corner: boolean` (reset both in `resetChain`;
  `keeperRattled` does NOT reset per possession — clear it only when a your-shot
  resolves with it active; `corner` resets per possession).
- `shotEstimate` subtracts 2 from dc when `keeperRattled` (single source of truth
  for UI/bots/engine). Your counter-shot path applies the same -2 and clears it.
- `shoot()`: on miss, compute margin; set corner/rattled per windows; when
  `corner` was just earned, do NOT concludeRound. When shooting FROM a corner
  (`corner === true` at entry), resolve then always concludeRound and clear corner.
- `assignDie` during `corner`: allow exactly one attack play then immediately call
  `shoot()` (the automatic header) after effects apply.
- Balance: `CORNER_WINDOW: 4`, `RATTLE_WINDOW: 2` in DICE. Save version +1.
- Events: `CORNER_EARNED { margin }`, `KEEPER_RATTLED`, `SHOT_TAKEN.corner?: true`.
- RNG: no extra draws except the corner's own play/shot (which only exist after a
  missed player shot). The tutorial's golden seed has NO missed player shots, so
  its stream and beats are untouched — verify the tutorial test stays green
  unchanged; if it doesn't, STOP/BLOCKED.

## UI

- CORNER: banner state ("CORNER! One delivery — make it count"), dock cap 1,
  run button label "▶ Take the corner", END_ROUND label "Clear it".
  Popup "CORNER!" + ticker line with margin ("Parried out! Corner — missed by 2").
- RATTLED: badge on the opp panel ("keeper rattled -2") that the shot estimate
  visibly includes; popup "The keeper's rattled!"; ticker line. Clears visibly.
- Coach tips (one-time): `corner` ("A save close to the mark goes out for a
  corner — one delivery, then the header. Bank Chance with your best card.") and
  `rattled` ("You hit him hard — the keeper's shaken. Your next shot gets -2 DC:
  shoot again while he's down."). Glossary entries for both. GAME.md same change.

## Bots + probe

- Greedy bot: during `corner`, play the best chance card (existing finish
  preference); if none playable, END_ROUND. When `keeperRattled`, lower the shoot
  threshold slightly (est.p >= greed - 0.05) to exploit the window.
- funProbe: add `cornersPerMatch` and `rattledConversions` (goals scored while
  rattled) so tuning sees the mechanics.
- Balance: misses now refund value, so expect win rates to climb — retune to the
  standing bands (keeper DC base or risk bases first, one knob at a time, log).

## Acceptance

- TDD: margin windows (5=nothing, 4/3=corner only, 2/1=corner+rattled); corner
  allows exactly one play then auto-shot then conclusion; corner fizzle path;
  rattled -2 applied once then cleared; rattled applies to counters; tutorial
  regression untouched. tsc/vitest/build/probe green with knob log.
- Browser (controller): force a near-miss, see CORNER banner -> one dock -> Take
  the corner -> header resolves; rattled badge appears and the next shot's % is
  visibly higher.
