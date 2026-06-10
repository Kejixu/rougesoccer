import type { ContentBundle, RunAction, RunState } from "../../core/types";
import { StickerCard } from "../components/StickerCard";

export function RewardScreen({
  run,
  content,
  dispatch,
}: {
  run: RunState;
  content: ContentBundle;
  dispatch: (a: RunAction) => void;
}) {
  const offer = run.pendingReward!;
  return (
    <main className="screen">
      <h1>Scout report: new signing</h1>
      {run.lastMatch && (
        <p data-testid="last-result">
          {run.lastMatch.result.toUpperCase()} {run.lastMatch.playerGoals}-{run.lastMatch.oppGoals}{" "}
          — pick one card for the squad:
        </p>
      )}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }} data-testid="reward-options">
        {offer.defIds.map((defId, i) => (
          <div key={`${defId}-${i}`}>
            <StickerCard def={content.defs[defId]!} />
            <button type="button" className="btn"
              data-testid={`pick-reward-${i}`}
              onClick={() => dispatch({ type: "PICK_REWARD", index: i })}
            >
              Sign
            </button>
          </div>
        ))}
      </div>
      <p>
        <button type="button" className="btn" data-testid="skip-reward" onClick={() => dispatch({ type: "SKIP_REWARD" })}>
          Skip (+{content.balance.REWARD_BUDGET.skipPick} budget)
        </button>
      </p>
    </main>
  );
}
