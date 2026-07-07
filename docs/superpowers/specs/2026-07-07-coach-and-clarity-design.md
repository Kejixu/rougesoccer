# Coach & Clarity — teach the chain game, fix what misleads

Status: APPROVED. One cohesive slice; no new match mechanics. (Explicitly rejected:
any "last stand" pause when the opponent breaks through — it contradicts the fiction.)

## Why

A controller playthrough (2026-07-07) confirmed the chain loop's fun spine works when
it activates, but the game misleads and under-teaches:

1. Dud possessions: no finisher in hand → no Chance → nothing to push luck for.
2. Shoot shows a % while disabled with no reason (Chance 0 blocks all shots).
3. Opponent intent panel shows dead combat-era copy ("Attack — 17 threat").
4. The "keeper DC" number silently changes with ball position (zone penalty baked in).
5. All drama lives in 1.6s popups; matches have no memory; their possession leaves no trace.
6. Non-USA counters roll d20+0 after "WON IT!" — heroic steal, hollow reward.

## Changes

### 1. Allow the punt (engine, tiny)
`SHOOT` requires `possession === "you"` and `passes >= 1` but NO LONGER requires
`shotQuality > 0`. A 0-Chance punt is already priced by the estimate (5% floor from
distance/DC). This gives dud hands a release valve and makes the button honest.
Update the "shot with no quality is rejected" test to assert the punt is allowed.
Bots: greedy/defensive unchanged (their thresholds already skip bad punts); no bot
may punt at < 15% estimate.

### 2. Counter dignity (balance, one value)
`COUNTER_CHANCE: 0 -> 2` (universal). USA's `counterSpring 2` stacks on top (=4) and
stays the counter identity. Re-run the probe; accept drift within the documented
bands (no nation > 35% or < 10%); if breached, trim `COUNTER_CHANCE` to 1 before
touching anything else.

### 3. Honest copy (UI)
- Opponent intent line rewritten for chain mode — it describes YOUR passing risk
  posture: press → "They press high — every pass is riskier (25% base)";
  sitDeep → "They sit deep — easy to keep the ball (8% base), harder to finish (+4 DC)";
  attack/counter → "They play it balanced — 15% base risk".
- One DC story: the opponent panel shows the CONSTANT `keeper DC` (no zone penalty).
  Distance lives only in the Shoot button's live % (already correct).
- Shoot button, when disabled (now only `passes === 0`): label suffix "— make a pass first".

### 4. Match ticker (UI)
A persistent, visible running log (newest first, last ~8 entries, `data-testid="ticker"`)
fed by the same events as the popups: passes (yours AND theirs), interceptions,
counters, shots with roll math, goals/saves, possession changes. The popups stay;
the ticker is the memory. Their possession must leave evidence a player can read
after the fact.

### 5. First-match coach (the tutorial, UI-only)
Contextual one-time tips (small dismissible callout anchored near the relevant UI,
`data-testid="coach-tip"`), each shown once per profile, keyed in localStorage
(`coach.<key>`), all suppressed after each is dismissed. Triggers and copy:

| key | trigger (first time) | tip |
|---|---|---|
| possession | your possession, passes 0 | "Cards are passes. Each die you slot plays one — your first pass is always free." |
| risk | interceptionRisk > 0 shown | "That % is the chance they take the ball on your NEXT pass. Lose it and you lose all banked Chance — and they counter." |
| chance | first Chance banked | "Chance is your shot's power. Shoot spends it: d20 + Chance vs their keeper. Build it with finishers." |
| punt | Shoot pressed with Chance 0 | "A punt! Long shots are priced in — work the ball closer and bank Chance for better odds." |
| defense | first their-possession | "Their turn. Slot defenders to raise the interception % on their next pass — or stand off and let them play." |
| push | first push decision | "You have the win. Bank it, or gamble extra time for budget — their attacks hit 2× harder." |

localStorage access happens only in `src/ui/**` (core stays pure).

### 6. GAME.md sync (same change)
Punt rule, COUNTER_CHANCE 2, honest-intent copy, ticker, coach — all reflected.

## Acceptance

- tsc clean, vitest green (with the punt test updated), vite build ok, probe within bands.
- Browser: dud hand can punt; intent line reads as posture; ticker records a full
  round including their passes; each coach tip appears once and never again after
  dismissal (verify via localStorage keys).
