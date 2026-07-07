import { DEFAULT_BALANCE } from "../core/balance";
import { createDiceMatch } from "../core/match/dice";
import { seedRng } from "../core/rng";
import type { DiceMatchState, DiceMatchStep, OppInfo } from "../core/types";
import { DICE_CARD_MAP, makeDiceStartingDeck } from "../data/diceCards";
import type { CoachTipKey } from "./diceUx";

export type TutorialLock =
  | { kind: "playCard"; defId: string }
  | { kind: "shoot" }
  | { kind: "endRound" }
  | { kind: "takeWin" }
  | { kind: "next" }
  | { kind: "standOffUntilRoundEnds" };

export type TutorialActionIntent =
  | { kind: "playCard"; defId: string }
  | { kind: "shoot" }
  | { kind: "endRound" }
  | { kind: "takeWin" }
  | { kind: "next" }
  | { kind: "extraTime" }
  | { kind: "rerollDie" };

export interface TutorialStep {
  id: string;
  lock: TutorialLock;
  title: string;
  what?: string;
  why: string;
}

export const COACH_TIP_KEYS: CoachTipKey[] = ["possession", "risk", "chance", "punt", "defense", "push"];

export const TUTORIAL_OPP: OppInfo = {
  teamId: "qat",
  name: "Qatar",
  attackRating: 13,
  style: "balanced",
  tier: 4,
};

export const TUTORIAL_SEED = "tutorial-109";

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    lock: { kind: "next" },
    title: "Welcome.",
    what: "Your dice are this round's player quality; cards are the actions they can attempt; the pitch is one shared ball.",
    why: "Every round you'll spend dice on cards - the whole game is choosing which action deserves your best dice.",
  },
  {
    id: "make-pass",
    lock: { kind: "playCard", defId: "d_shortpass" },
    title: "Make a pass.",
    what: "Slotting a die plays the card instantly - Short Pass moves the ball by the die's value.",
    why: "Your FIRST pass is always safe; defenses aren't set yet.",
  },
  {
    id: "one-more",
    lock: { kind: "playCard", defId: "d_throughball" },
    title: "One more - a special one.",
    what: "See the risk % - the chance they steal your NEXT pass. Through Ball is a SETUP: it moves the ball and makes your next finisher +4.",
    why: "Risk climbs the longer you hold it; combos are how big chances get built.",
  },
  {
    id: "recycle",
    lock: { kind: "endRound" },
    title: "Recycle.",
    what: "Ends your possession safely - no shot, no risk.",
    why: "No finisher in hand to spend that +4 on, and banked bonuses DIE with the possession. But TERRITORY CARRIES - their attack now starts deep in their own half.",
  },
  {
    id: "stand-off",
    lock: { kind: "endRound" },
    title: "Their ball. Stand off.",
    what: "They chain passes just like you; watch their Chance grow.",
    why: "Standing off costs nothing - but each completed pass makes their eventual shot stronger. You decide when it's worth spending dice to stop them.",
  },
  {
    id: "commit-keeper",
    lock: { kind: "playCard", defId: "d_keeper" },
    title: "Commit your keeper.",
    what: "Defensive cards raise the interception % on their NEXT pass (+8%, and you draw a card).",
    why: "Dice you can't attack with still buy defense. This one wins the ball - and the counter goes in!",
  },
  {
    id: "drive-forward",
    lock: { kind: "playCard", defId: "d_drivingrun" },
    title: "You scored on the break - counters are instant shots. That's why defense pays.",
    what: "Driving Run carries the ball 4.",
    why: "Position first - finishers hit harder deep, and distance makes shots worse.",
  },
  {
    id: "bank-chance",
    lock: { kind: "playCard", defId: "d_poacher" },
    title: "Bank the Chance.",
    what: "Finishers convert into Chance - shot power. Notice the development bonus: later passes in a move are worth more.",
    why: "Watch the Shoot % jump. THIS is what you've been building toward.",
  },
  {
    id: "cash-it-in",
    lock: { kind: "shoot" },
    title: "Cash it in.",
    what: "d20 + Chance vs their keeper (distance makes it harder).",
    why: "At 60%+ the odds favor you - and one more greedy pass could lose the whole chance to a tackle. GOAL.",
  },
  {
    id: "weather-it",
    lock: { kind: "standOffUntilRoundEnds" },
    title: "Weather it.",
    why: "They're far from your goal and must gamble. Sometimes the best defense is patience - save your dice when the threat is small.",
  },
  {
    id: "bank-it-again",
    lock: { kind: "playCard", defId: "d_finish" },
    title: "Bank it again.",
    what: "Clinical Finish converts the die itself - high dice make big chances.",
    why: "Chances don't wait; bank while the dice are good.",
  },
  {
    id: "safety-valve",
    lock: { kind: "playCard", defId: "d_sideways" },
    title: "The safety valve.",
    what: "Sideways Pass adds little, but your next pass is 12% safer.",
    why: "When you want to keep a move alive without gambling, recycle possession like a real team.",
  },
  {
    id: "kill-the-ball",
    lock: { kind: "endRound" },
    title: "Kill the ball.",
    what: "Banked Chance DIES with the possession.",
    why: "You're 2-0 up and the shot from here is poor - protecting a lead is also a play. Game management wins cups.",
  },
  {
    id: "see-it-out",
    lock: { kind: "standOffUntilRoundEnds" },
    title: "See it out.",
    why: "Last round; they need two. Let them waste it.",
  },
  {
    id: "whistle-question",
    lock: { kind: "takeWin" },
    title: "The whistle question.",
    what: "Push-your-luck - bank the win, or extra time for bonus budget with their threat doubled.",
    why: "Budget buys cards later, but a lead is worth 3 points NOW. Take the win.",
  },
  {
    id: "loop",
    lock: { kind: "next" },
    title: "That's the loop.",
    what: "Build with passes, gamble on risk, cash Chance into goals, break up theirs.",
    why: "Now play the Cup - every nation bends these rules differently.",
  },
];

export function tutorialLockAllows(lock: TutorialLock, action: TutorialActionIntent): boolean {
  if (lock.kind === "playCard") return action.kind === "playCard" && action.defId === lock.defId;
  if (lock.kind === "standOffUntilRoundEnds") return action.kind === "endRound";
  return action.kind === lock.kind;
}

export function createTutorialMatch(): DiceMatchStep {
  return createDiceMatch(DICE_CARD_MAP, {
    opp: TUTORIAL_OPP,
    styleEffects: [],
    plays: [],
    context: "group",
    deck: makeDiceStartingDeck(),
    mutators: [],
    rng: seedRng(TUTORIAL_SEED),
    balance: DEFAULT_BALANCE,
  });
}

export function isTutorialComplete(state: DiceMatchState): boolean {
  return state.phase === "DONE";
}
