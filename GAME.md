# RogueSoccer — how it actually plays (current build)

This describes the game **as the code plays it today** (branch `dice-mode`), not the
design intent. It is the shared reference: if something here is wrong or feels off,
that's the thing to change. Source of truth = `src/core/match/dice.ts`,
`src/core/balance.ts` (`DICE`), `src/data/diceCards.ts`, `src/data/content.ts`,
`src/core/run/`.

> Theme: FIFA World Cup 2026, real countries + verified groups, parody player/coach
> names, NO FIFA branding. Inspirations: Slay the Spire, Dawncaster, Balatro, Dicey Dungeons.

---

## 1. The shape of a run

One run = one World Cup campaign with the team you pick.

- **Group stage:** a 3-team mini-group — you play **2 matches**, the other two teams
  play each other once (simulated). Top of the group advances; otherwise the run ends.
- **Knockout:** R32 → R16 → QF → SF → **Final** (single elimination).
- Between matches: **rewards** (pick a card), a **shop** (buy/upgrade/remove cards),
  and **staff hires** (passive perks) each time you advance a stage.
- Difficulty ramps every stage (`STAGE_CLOCK_MULT`: GROUP 1.1 → FINAL 2.3), which
  scales each opponent's rating, which drives both their keeper and their threat.

Playable nations today: **Brazil, USA, Mexico, Canada** (each plays differently — see §6).

---

## 2. The match — the core loop

A match is a **tug-of-war over one ball on a shared pitch**.

```
 YOUR GOAL                    midfield                    THEIR GOAL
   │  Your Box │ Your Third │  ◯ kickoff  │ Their Third │ Their Box │
   0 ─────────────────────────── ball ───────────────────────────► 20
   YOUR_BOX=4        STEAL_LINE=12        THEIR_BOX=16
```

- A single integer **ball** position (0 = your goal, 20 = their goal). Kickoff at
  **midfield (10)**, you start with **possession**.
- A match is **5 rounds** (regulation). Each round you roll a **pool of 5 dice (d6)**
  and draw up to a **hand of 4 cards**.
- **One round = one possession.** You play cards by slotting a die that fits the card's
  requirement; the card fires its effect and the die is spent.

**When you have the ball (attacking):**
- Only attack cards are playable. They push the ball toward their goal and bank
  **Shot Quality**.
- Reach **their box (ball ≥ 16)** with Shot Quality > 0 → you can **SHOOT**.

**When they have the ball (defending):**
- Only defensive cards are playable: **Tackle** (win the ball back where it is),
  **Keeper** (shove them back up the pitch, they keep it), **Clearance** (boot it to
  midfield, they keep it).
- If you can't stop them and the round ends, they advance toward your goal; reach
  **your box (ball ≤ 4)** → they shoot on your keeper.

**Ending a round:**
- **SHOOT ends your possession** (this is the recent rhythm fix): the shot resolves,
  the whistle blows, and the next round starts with a fresh roll + kickoff. You do NOT
  keep rolling after a shot.
- **END ROUND** (you didn't shoot): the opponent acts on their telegraphed **intent**
  — if you're attacking, a press/attack steals the ball unless you got it past the
  steal line (12); if you're defending, they advance (and maybe shoot).
- Winning the ball mid-round via a **Tackle** lets you attack with your remaining dice
  that same round (the counter).

---

## 3. Scoring and conceding (they mirror)

- **You shoot:** `d20 + Shot Quality ≥ their keeper DC` → GOAL, else SAVED.
  Their keeper DC = `min(18, 9 + round(rating × 0.14))` + nation delta. Sit-deep adds +4.
- **They shoot:** `d20 + their danger ≥ your keeper DC` → they score, else your keeper saves.
  Their danger = `min(6, round(rating × 0.08))`. Your keeper DC = 14 (+ defensive staff).
- Either way the ball resets to **midfield** and possession goes to the other side
  (conceding team kicks off / keeper restarts).

---

## 4. How a match ends

After round 5 (regulation):
- **Leading →** push-your-luck: **bank the win**, or **extra time** (their threat hits
  2× harder, but each round survived in the lead pays budget + scout; up to 2 rounds).
- **Tied →** a **draw** in the group, or **sudden death** in a knockout (up to 3
  one-possession rounds, then a **penalty shootout** roll).
- **Trailing →** loss / elimination.

---

## 5. The card pool (dice cards)

Each card needs a die matching its **slot**. Low dice defend, mid dice progress, high
dice finish. Effects that scale "from die" want a high die; flat effects don't.

| Card | Slot | Role | Effect |
|---|---|---|---|
| Short Pass | 2+ | progress | Progress = die value |
| Driving Run | 3+ | progress | +4 progress |
| Flank Run | 4+ | progress | +3 progress, draw 1 |
| Quick Combo | 4+ | progress | +2 progress, draw 1 |
| Overlapping Run | =4 | progress | +4 progress, draw 1 |
| Through Ball | 5+ | progress/finish | jump a zone, +2 Shot Quality (their third+) |
| Counter Attack | 3+ | progress/finish | jump a zone, +3 Shot Quality (their box) |
| Clinical Finish | 5+ | finish | Shot Quality = die value (their box) |
| Poacher | even | finish | +5 Shot Quality (their box) |
| Whipped Cross | 4+ | finish | +4 Shot Quality (their third+) |
| Screamer | 6 | finish | +8 Shot Quality (their third+) |
| Last-Ditch Tackle | 2− | defend | **win possession** (counter) |
| Clearance | 3− | defend | boot ball to **midfield** (they keep it) |
| Keeper Claims It | any | defend | **push them back 4**, draw 1 |

**Starting deck (16 cards, ~40% defense):** Short Pass ×3, Driving Run ×2, Flank Run,
Through Ball, Clinical Finish ×2, Poacher · Tackle ×3, Clearance ×2, Keeper.

---

## 6. Nation identities (the variety hook)

- **Brazil — "Joga Bonito":** 4 dice instead of 5, but reroll one die each round;
  harder opponent keeper. Flair over volume.
- **Mexico — "La Ola":** an extra die each round; slightly harder keeper. Win on volume.
- **USA — "The Press":** win a tackle and the ball springs 4 forward — steal-to-counter.
- **Canada — "Resolute":** opponents advance 2 fewer steps against you. Hard to break down.

---

## 7. Key numbers (`balance.ts → DICE`)

Pool 5 dice · d6 · hand 4 · 5 rounds · pitch 0–20, midfield 10, their box 16, your box 4,
steal line 12 · their keeper DC 9 + rating×0.14 (cap 18) · your keeper DC 14 · shot d20 ·
opp danger rating×0.08 (cap 6) · opp advance rating×0.35.

---

## 8. Known rough edges (honest list)

- **Dead rounds (~10%):** you can still draw a hand with no card usable in your current
  phase, so you concede the round doing nothing. Lever: bigger hand or a guaranteed
  fallback action.
- **Balance:** greedy-bot run wins run high (~35–50%) and vary by nation (USA/Canada
  strongest) — a tuning pass, not a feel fix.
- **Defending-phase telegraph copy** still reads as if you have the ball.
- **"Not quite right" feel:** the rhythm now has a clean beat (shoot → whistle → reset),
  but the moment-to-moment fun is still unsettled — this is the open question.
