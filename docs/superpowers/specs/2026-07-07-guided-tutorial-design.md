# Guided Tutorial — "Learn the game" (locked steps)

Status: APPROVED. User decisions: opt-in tutorial mode alongside regular play;
fully guided with locked steps (only the prescribed action is enabled); every step
explains WHAT the thing is and WHY you'd do it — the why is the point.

## Entry & shell

- Title screen gains a second primary action next to the campaign start:
  **"Learn the game (5 min)"**.
- The tutorial is a standalone exhibition match — NOT a campaign run. It never
  touches the run layer or saves. Quitting/skipping returns to the title.
- On finish (or skip), mark ALL coach-tip keys as seen (`coach.*` in localStorage)
  so the light-touch tips don't re-teach what the tutorial covered.

## The golden seed (deterministic story)

The tutorial match is `createDiceMatch` with EXACTLY:

```ts
opp: { teamId: "qat", name: "Qatar", attackRating: 13, style: "balanced", tier: 4 }
deck: makeDiceStartingDeck()
mutators: []            // neutral team — no nation rules during teaching
context: "group"
rng: seedRng("tutorial-109")
balance: DEFAULT_BALANCE
```

With the locked script below this produces, deterministically: R1 Short Pass +
Through Ball + recycle → R2 their pass completes, Keeper commit, INTERCEPTION →
counter GOAL → R3 Driving Run → Poacher → shot GOAL → R4 quiet defense → R5 Finish +
Sideways + recycle → R6 quiet → push decision at exactly 2–0 → bank the win. A regression test must
replay the script headlessly and assert those beats (goal counts, interception, push),
so any future balance change that breaks the story fails CI loudly.

## The locked steps

Step data lives in a pure module (recommend `src/ui/tutorialScript.ts`): an ordered
array of `{ id, lock, title, what, why }` where `lock` is one of
`{ kind: "playCard", defId }`, `{ kind: "shoot" }`, `{ kind: "endRound" }` (covers
Recycle/Stand off by possession), `{ kind: "takeWin" }`, `{ kind: "next" }` (overlay
advance only), `{ kind: "standOffUntilRoundEnds" }` (repeated endRound allowed until
the round index changes). The UI enables ONLY the locked action; everything else is
visually disabled. A "Skip tutorial" link is always visible.

| # | lock | title / WHAT / WHY (ship this copy, light edits allowed) |
|---|---|---|
| 0 | next | **Welcome.** WHAT: your dice are this round's player quality; cards are the actions they can attempt; the pitch is one shared ball. WHY: every round you'll spend dice on cards — the whole game is choosing which action deserves your best dice. |
| 1 | playCard d_shortpass | **Make a pass.** WHAT: slotting a die plays the card instantly — Short Pass moves the ball by the die's value. WHY: your FIRST pass is always safe; defenses aren't set yet. |
| 2 | playCard d_throughball | **One more — a special one.** WHAT: see the risk % — the chance they steal your NEXT pass. Through Ball is a SETUP: it moves the ball and makes your next finisher +4. WHY: risk climbs the longer you hold it; combos are how big chances get built. |
| 3 | endRound | **Recycle.** WHAT: ends your possession safely — no shot, no risk. WHY: no finisher in hand to spend that +4 on, and banked bonuses DIE with the possession. But TERRITORY CARRIES — their attack now starts deep in their own half. |
| 4 | endRound | **Their ball. Stand off.** WHAT: they chain passes just like you; watch their Chance grow. WHY: standing off costs nothing — but each completed pass makes their eventual shot stronger. You decide when to spend dice stopping them. |
| 5 | playCard d_keeper | **Commit your keeper.** WHAT: defensive cards raise the interception % on their NEXT pass (+8%, and you draw a card). WHY: dice you can't attack with still buy defense. *(This one wins the ball — and the counter goes in!)* |
| 6 | playCard d_drivingrun | **You scored on the break — counters are instant shots. That's why defense pays.** Now build again: WHAT: Driving Run carries the ball 4. WHY: position first — finishers hit harder deep, and distance makes shots worse. |
| 7 | playCard d_poacher | **Bank the Chance.** WHAT: finishers convert into Chance — shot power. Notice the development bonus: later passes in a move are worth more. WHY: watch the Shoot % jump. THIS is what you've been building toward. |
| 8 | shoot | **Cash it in.** WHAT: d20 + Chance vs their keeper (distance makes it harder). WHY: at these odds one more greedy pass could lose the whole chance to a tackle. GOAL. |
| 9 | standOffUntilRoundEnds | **Weather it.** WHY: they're far from your goal and must gamble. Sometimes the best defense is patience — save your dice when the threat is small. |
| 10 | playCard d_finish | **Bank it again.** WHAT: Clinical Finish converts the die itself — high dice make big chances. WHY: chances don't wait; bank while the dice are good. |
| 11 | playCard d_sideways | **The safety valve.** WHAT: Sideways Pass adds little, but your next pass is 12% safer. WHY: when you want to keep a move alive without gambling, recycle possession like a real team. |
| 12 | endRound | **Kill the ball.** WHAT: banked Chance DIES with the possession. WHY: you're 2–0 up and the shot from here is poor — protecting a lead is also a play. Game management wins cups. |
| 13 | standOffUntilRoundEnds | **See it out.** WHY: last round; they need two. Let them waste it. |
| 14 | takeWin | **The whistle question.** WHAT: push-your-luck — bank the win, or extra time for bonus budget with their threat doubled. WHY: budget buys cards later, but a lead is worth 3 points NOW. Take the win. |
| 15 | next | **That's the loop.** Build with passes, gamble on risk, cash Chance into goals, break up theirs. Now play the Cup — every nation bends these rules differently. [Finish → title] |

## UI

- Overlay panel (bottom or side, `data-testid="tutorial-step"`) with title, WHAT,
  WHY, and a subtle pointer/highlight on the locked control (e.g. outline class on
  the matching card/button). `next`-locked steps show a Continue button.
- Locked-out controls get `disabled` + a dimmed style; the locked control gets a
  pulse/highlight class.
- "Skip tutorial" (`data-testid="tutorial-skip"`) always visible → title.
- Match events still animate (popups/ticker) — the tutorial narrates a REAL match.

## Testing

- Unit: the step script replayed against the engine headlessly (same helper style as
  test/dice.test.ts) asserting the beats: R2 interception byYou + counter goal, R3 SHOT_TAKEN goal, quiet R4/R6 (no goals),
  final playerGoals 2 / oppGoals 0 win via TAKE_WIN. This is the golden-seed regression test.
- Unit: lock matching (a `tutorialLockAllows(lock, action)`-style pure helper).
- Browser (controller does it): full click-through start→finish; a non-locked card
  is genuinely unclickable; skip returns to title; coach keys set after finish.

## Out of scope

Adaptive/free-play tutorial, multiple tutorial chapters, nation-specific tutorials.
