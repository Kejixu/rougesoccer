# RogueSoccer - how it actually plays (current build)

This describes the game **as the code plays it today** on the Momentum Duel branch,
not older design intent. It is the shared reference: if something here is wrong or
feels off, that is the thing to change. Source of truth = `src/core/match/dice.ts`,
`src/core/balance.ts` (`DICE`), `src/data/diceCards.ts`, `src/data/content.ts`,
`src/core/run/`.

> Theme: FIFA World Cup 2026, real countries + verified groups, parody player/coach
> names, NO FIFA branding. Inspirations: Slay the Spire, Dawncaster, Balatro, Dicey Dungeons.

---

## 1. The shape of a run

One run = one World Cup campaign with the team you pick.

- **Group stage:** a 3-team mini-group - you play **2 matches**, the other two teams
  play each other once (simulated). Top of the group advances; otherwise the run ends.
- **Knockout:** R32 -> R16 -> QF -> SF -> **Final** (single elimination).
- Between matches: **rewards** (pick a card), a **shop** (buy/upgrade/remove cards),
  and **staff hires** (passive perks) each time you advance a stage.
- Difficulty ramps every stage (`STAGE_CLOCK_MULT`: GROUP 1.1 -> FINAL 2.3), which
  scales each opponent's rating, keeper, and attack threat.

Playable nations today: **Brazil, USA, Mexico, Canada** (each bends the dice rules).

---

## 2. The match - Possession Chains

A match is a **six-round dice-and-card match** on one shared pitch. Odd rounds are
your possession; even rounds are their possession.

```
 YOUR GOAL                    midfield                    THEIR GOAL
   |  Your Box | Your Third |  kickoff  | Their Third | Their Box |
   0 --------------------------- ball ----------------------------> 20
   YOUR_BOX=4                                      THEIR_BOX=16
```

- The ball is a single integer position (0 = your goal, 20 = their goal). Kickoff is
  **midfield (10)**.
- Each round rolls a pool of **5 d6 dice** and draws up to **4 cards**.
- A card needs a die that fits its slot. Slotting the die spends it and resolves the
  pass immediately.
- Your first completed pass in a possession is always safe. Later passes show an
  interception risk before you commit.
- You can **shoot anytime**. Shooting spends your banked Chance against a distance
  penalty based on where the ball is.
- You can **recycle** with `END_ROUND`: end the possession safely with no shot and no
  counter.

Your possession is push-your-luck:

1. Play progress/setup/finish cards as passes.
2. Completed passes move the ball, bank Chance, set up the next finisher, or reduce
   the next pass risk.
3. If a later pass is intercepted, all banked Chance is lost and the opponent gets
   one instant counter shot.
4. Shoot when the current Chance and field position look worth cashing in.

Their possession mirrors the same rhythm:

1. Defensive cards are the only cards you can play.
2. Playing a defender commits interception risk against their next pass.
3. Ending the round is a legal **stand off**: you do not commit a defender, and their
   next pass happens undefended.
4. If you intercept them, you get one instant counter shot.
5. If they complete enough passes for their style, or reach your box, they shoot.

The match UI surfaces this loop with pass chips, current/interception risk, a live
shot estimate, and their-chain defense controls.

---

## 3. Round rhythm

There is no lane duel or delayed resolve step. Each die assignment is the action.

- **Your rounds:** attack cards are playable; defensive cards wait for their
  possession.
- **Their rounds:** defensive cards are playable; attack cards wait for your
  possession.
- **Draw effects** happen immediately.
- **Setup effects** (`setupNext`) bank a bonus for the next Chance-gaining card.
- **Safe-pass effects** reduce your next interception check.
- **Interceptions** immediately end the possession after the counter shot.
- **Shots** immediately end the possession and reset the ball to midfield.

At the end of a possession, remaining hand cards are discarded, dice clear, and the
next round starts unless the match has reached a result, a push decision, sudden
death, or a shootout.

---

## 4. Shooting and conceding

Your shot:

```
d20 + Shot Quality >= their keeper DC + zone penalty + sit-deep bonus
```

Their shot:

```
d20 + Opponent Chance >= your keeper DC + mirrored zone penalty
```

Counter shots are one-roll chances after an interception. Your counter uses
`COUNTER_CHANCE` plus any nation bonus; their counter uses their per-pass Chance gain
and is scarier if you lost the ball in your own half.

Zone penalties:

| Ball zone | Position | Shot DC penalty |
|---|---:|---:|
| Your box | 0-3 | +6 |
| Your third | 4-7 | +6 |
| Midfield | 8-11 | +6 |
| Their third | 12-15 | +3 |
| Their box | 16-20 | +0 |

---

## 5. How a match ends

After round 6 (regulation):

- **Leading ->** push-your-luck: **bank the win**, or **extra time**. Extra-time
  pressure is riskier, but each round survived in the lead pays budget + scout.
- **Tied ->** a **draw** in the group, or **sudden death** in a knockout. After three
  sudden-death rounds, the match goes to a penalty shootout roll.
- **Trailing ->** loss / elimination.

---

## 6. The card pool (dice cards)

Attack cards advance the chain or build Chance during your possession. Defensive
cards raise their interception risk during the opponent possession.

| Card | Slot | Role | Effect |
|---|---|---|---|
| Short Pass | 2+ | progress | Move by the die value |
| Driving Run | 3+ | progress | Move 4 |
| Flank Run | 4+ | progress | Move 3, draw 1 |
| Quick Combo | 4+ | progress/finish | Move 2, +2 Chance |
| Sideways Pass | 3- | safety | Next pass 12% safer, move 1 |
| Through Ball | 5+ | setup/progress | Next finisher +4, move 2 |
| Counter Attack | 3+ | progress/finish | Move 3, +3 Chance |
| Clinical Finish | 5+ | finish | Chance = the die |
| Poacher | even | finish | +5 Chance |
| Whipped Cross | 4+ | setup | Next finisher +5 |
| Screamer from Range | 6 | finish | +8 Chance |
| Last-Ditch Tackle | 2- | defend | +18% to intercept their next pass |
| Clearance | 3- | defend | +12% to intercept their next pass |
| Keeper Claims It | any | defend | +8% to intercept their next pass, draw 1 |

Chance cards gain extra value as the move develops:

```
Chance gained = base card value + setup bonus + completed passes * DEVELOPMENT_GAIN
```

**Starting deck (17 cards):** Short Pass x3, Driving Run x2, Sideways Pass x2,
Through Ball, Clinical Finish x2, Poacher, Tackle x3, Clearance x2, Keeper.

---

## 7. Nation identities

- **Brazil - "Joga Bonito":** 4 dice instead of 5, but reroll one die each round;
  opponent keeper DC +2. Flair over volume.
- **Mexico - "La Ola":** an extra die each round; opponent keeper DC +2. Win on volume.
- **USA - "The Press":** instant counters get +2 to the shot roll. Win the ball and
  the counter is a real threat - counters are the identity, ~0.6 goals/match vs ~0.3
  for others. Sits at the top of the win-rate band (~33%) as an approachable pick.
- **Canada - "Resolute":** opponents have +4% interception risk per pass against you.
  Hard to play through; sits at the top of the win-rate band (~33%) as an approachable pick.

---

## 8. Key numbers (`balance.ts -> DICE`)

Pool 5 dice - d6 - hand 4 - 6 regulation rounds - pitch 0-20 - midfield 10 -
their box 16 - your box 4.

Shot math:

- Their keeper DC: `min(18, 10 + rating * 0.14) + nation keeper delta`
- Your keeper DC: `15`
- Shot die: d20
- Sit-deep bonus to their keeper: +4
- Zone DC penalty: `[6, 6, 6, 3, 0]`

Your chain:

- Risk base: press 25%, balanced 15%, sit deep 8%
- Risk ramp: +6% per completed pass after the first
- Risk cap: 65%
- Development gain: +1 Chance per completed pass
- Counter chance: +0 before nation bonuses
- Opponent shallow counter bonus: +3 if you lose it in your half

Their chain:

- Opponent base interception risk: 12%
- Opponent risk ramp: +5% per completed pass
- Opponent pass advance: 2 steps toward your goal
- Opponent Chance gain: `round(rating * 0.03)`, capped at 6 per pass
- Opponent chain targets: balanced 3, possession 4, flair 4, fortress 2, counter 2,
  highpress 3

Latest probe target readout:

- Run wins: Brazil 23%, Mexico 23%, USA ~33%, Canada ~33% (identity picks ride the ceiling by design)
- Passes per chain: 2.01-2.11
- Intercepted share: 15-20%
- Goals per match: 1.2-1.6 for you, 0.5-0.6 for opponents
- Dead attack rounds: 0-2%
- Stand-off-only defensive rounds: 20-25% (informational; standing off is legal)

---

## 9. Known rough edges

- **USA/Canada ride the win-rate ceiling (~33%):** a deliberate user decision —
  felt nation identities (USA counter threat, Canada interception wall) were chosen
  over strict 15-25% parity. The durable fix is structural identities (like Brazil's
  4-dice reroll) instead of numeric nudges; deferred.

- **Chains still sit near the floor:** passes per chain are just over 2. Attempts to
  lower risk ramp did not meaningfully create 2.5-3 pass chains and pushed win rates
  around, so this ships as a conservative balance.
- **Counters are toned down but still visible:** player counter goals now sit roughly
  0.3-0.5 per match instead of dominating total scoring.
- **Screamer's long-range specialization is not special-cased:** it is currently a
  flat +8 Chance card; distance is handled only by the shared zone penalty table.
