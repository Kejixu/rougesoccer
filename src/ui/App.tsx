import { useState } from "react";
import { applyRunAction, createRun } from "../core/run/run";
import type { RunAction, RunState } from "../core/types";
import { makeContent } from "../data/content";
import { loadRun, saveRun } from "../save/persistence";
import { MatchScreen } from "./screens/MatchScreen";
import { ResultScreen } from "./screens/ResultScreen";
import { RewardScreen } from "./screens/RewardScreen";
import { ShopScreen } from "./screens/ShopScreen";
import { TitleScreen } from "./screens/TitleScreen";
import { TournamentScreen } from "./screens/TournamentScreen";

const content = makeContent();

export function App() {
  const [run, setRun] = useState<RunState | null>(null);
  const [savedRun] = useState<RunState | null>(() => loadRun());
  const [showShop, setShowShop] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dispatch = (action: RunAction) => {
    setRun((current) => {
      if (!current) return current;
      try {
        const step = applyRunAction(content, current, action);
        saveRun(step.state.phase === "DONE" ? null : step.state);
        setError(null);
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
    setShowShop(false);
    setError(null);
  };

  const abandonRun = () => {
    saveRun(null);
    setRun(null);
    setShowShop(false);
  };

  let screen;
  if (!run) {
    screen = (
      <TitleScreen
        hasSave={savedRun !== null}
        onNewRun={startNewRun}
        onContinue={() => savedRun && setRun(savedRun)}
      />
    );
  } else if (run.phase === "DONE") {
    screen = <ResultScreen run={run} content={content} onNewRun={abandonRun} />;
  } else if (run.phase === "MATCH") {
    screen = <MatchScreen run={run} content={content} dispatch={dispatch} />;
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
