import { useEffect, useState } from "react";
import { applyDiceAction } from "../core/match/dice";
import { applyRunAction, createRun } from "../core/run/run";
import type { DiceMatchAction, DiceMatchState, GameEvent, RunAction, RunState } from "../core/types";
import { makeContent } from "../data/content";
import { loadRun, saveRun } from "../save/persistence";
import { DiceMatchScreen } from "./screens/DiceMatchScreen";
import { ResultScreen } from "./screens/ResultScreen";
import { RewardScreen } from "./screens/RewardScreen";
import { ShopScreen } from "./screens/ShopScreen";
import { StaffScreen } from "./screens/StaffScreen";
import { TitleScreen } from "./screens/TitleScreen";
import { TournamentScreen } from "./screens/TournamentScreen";
import {
  COACH_TIP_KEYS,
  TUTORIAL_STEPS,
  createTutorialMatch,
  tutorialLockAllows,
  type TutorialActionIntent,
} from "./tutorialScript";

const content = makeContent();

function coachStorageKey(key: string): string {
  return `coach.${key}`;
}

function markCoachTipsSeen(): void {
  if (typeof localStorage === "undefined") return;
  for (const key of COACH_TIP_KEYS) localStorage.setItem(coachStorageKey(key), "1");
}

function tutorialIntentForAction(state: DiceMatchState, action: DiceMatchAction): TutorialActionIntent {
  switch (action.type) {
    case "ASSIGN_DIE": {
      const card = state.hand.find((c) => c.uid === action.uid);
      return { kind: "playCard", defId: card?.defId ?? "" };
    }
    case "SHOOT":
      return { kind: "shoot" };
    case "END_ROUND":
      return { kind: "endRound" };
    case "TAKE_WIN":
      return { kind: "takeWin" };
    case "EXTRA_TIME":
      return { kind: "extraTime" };
    case "REROLL_DIE":
      return { kind: "rerollDie" };
  }
}

function shouldAdvanceTutorialStep(
  stepIndex: number,
  before: DiceMatchState,
  after: DiceMatchState,
  action: DiceMatchAction,
): boolean {
  const step = TUTORIAL_STEPS[stepIndex];
  if (!step) return false;
  const intent = tutorialIntentForAction(before, action);
  if (!tutorialLockAllows(step.lock, intent)) return false;
  // A stand-off phase ends when the round advances OR the match leaves
  // ROUND_ACTIVE (round 6 flows into PUSH_DECISION without a round change).
  if (step.lock.kind === "standOffUntilRoundEnds") return after.round !== before.round || after.phase !== before.phase;
  return step.lock.kind !== "next";
}

export function App() {
  const [run, setRun] = useState<RunState | null>(null);
  const [savedRun] = useState<RunState | null>(() => loadRun());
  const [showShop, setShowShop] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [tutorialMatch, setTutorialMatch] = useState<DiceMatchState | null>(null);
  const [tutorialEvents, setTutorialEvents] = useState<GameEvent[]>([]);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const dispatch = (action: RunAction) => {
    setRun((current) => {
      if (!current) return current;
      try {
        const step = applyRunAction(content, current, action);
        saveRun(step.state.phase === "DONE" ? null : step.state);
        setError(null);
        setEvents(step.events);
        return step.state;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return current;
      }
    });
  };

  const startNewRun = (teamId: string, seed: string) => {
    const state = createRun(content, seed, teamId);
    saveRun(state);
    setRun(state);
    setTutorialMatch(null);
    setShowShop(false);
    setError(null);
  };

  const startTutorial = () => {
    const step = createTutorialMatch();
    setTutorialMatch(step.state);
    setTutorialEvents(step.events);
    setTutorialStepIndex(0);
    setShowShop(false);
    setError(null);
  };

  const finishTutorial = () => {
    markCoachTipsSeen();
    setTutorialMatch(null);
    setTutorialEvents([]);
    setTutorialStepIndex(0);
    setError(null);
  };

  const continueTutorial = () => {
    if (tutorialStepIndex >= TUTORIAL_STEPS.length - 1) {
      finishTutorial();
      return;
    }
    setTutorialStepIndex((i) => Math.min(i + 1, TUTORIAL_STEPS.length - 1));
  };

  const tutorialAct = (action: DiceMatchAction) => {
    // No side effects inside setState updaters: StrictMode double-invokes them,
    // which double-advanced the tutorial step and desynced the locked script.
    if (!tutorialMatch) return;
    try {
      const step = TUTORIAL_STEPS[tutorialStepIndex];
      const intent = tutorialIntentForAction(tutorialMatch, action);
      if (!step || !tutorialLockAllows(step.lock, intent)) throw new Error("that action is locked in the tutorial");
      const next = applyDiceAction(content.defs, tutorialMatch, action);
      setTutorialMatch(next.state);
      setTutorialEvents(next.events);
      if (shouldAdvanceTutorialStep(tutorialStepIndex, tutorialMatch, next.state, action)) {
        setTutorialStepIndex((i) => Math.min(i + 1, TUTORIAL_STEPS.length - 1));
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const abandonRun = () => {
    saveRun(null);
    setRun(null);
    setShowShop(false);
  };

  let screen;
  if (tutorialMatch) {
    screen = (
      <DiceMatchScreen
        match={tutorialMatch}
        playerName="You"
        content={content}
        events={tutorialEvents}
        onMatchAction={tutorialAct}
        tutorial={{
          step: TUTORIAL_STEPS[tutorialStepIndex]!,
          stepIndex: tutorialStepIndex,
          totalSteps: TUTORIAL_STEPS.length,
          onContinue: continueTutorial,
          onSkip: finishTutorial,
        }}
      />
    );
  } else if (!run) {
    screen = (
      <TitleScreen
        hasSave={savedRun !== null}
        onNewRun={startNewRun}
        onContinue={() => savedRun && setRun(savedRun)}
        onTutorial={startTutorial}
      />
    );
  } else if (run.phase === "DONE") {
    screen = <ResultScreen run={run} content={content} onNewRun={abandonRun} />;
  } else if (run.phase === "MATCH") {
    screen = <DiceMatchScreen run={run} content={content} events={events} dispatch={dispatch} />;
  } else if (run.phase === "STAFF") {
    screen = <StaffScreen run={run} content={content} dispatch={dispatch} />;
  } else if (run.phase === "REWARD") {
    screen = <RewardScreen run={run} content={content} dispatch={dispatch} />;
  } else if (showShop) {
    screen = (
      <ShopScreen run={run} content={content} dispatch={dispatch} onBack={() => setShowShop(false)} />
    );
  } else {
    screen = (
      <TournamentScreen
        run={run}
        content={content}
        dispatch={dispatch}
        onOpenShop={() => setShowShop(true)}
        onAbandon={abandonRun}
      />
    );
  }

  return (
    <>
      {error && (
        <div
          data-testid="error-banner"
          style={{ background: "var(--danger)", color: "#fff", padding: "4px 12px" }}
        >
          {error}
        </div>
      )}
      {screen}
    </>
  );
}
