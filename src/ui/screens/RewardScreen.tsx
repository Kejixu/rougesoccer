import { useState } from "react";
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
  const [cutting, setCutting] = useState(false);
  const canCut = run.deck.length > content.balance.MIN_DECK_SIZE;

  return (
    <main className="screen">
      <h1>{cutting ? "Trim the squad" : "Scout report: new signing"}</h1>
      {run.lastMatch && !cutting && (
        <p data-testid="last-result">
          {run.lastMatch.result.toUpperCase()} {run.lastMatch.playerGoals}-{run.lastMatch.oppGoals}{" "}
          — pick one card for the squad:
        </p>
      )}

      {!cutting ? (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }} data-testid="reward-options">
            {offer.defIds.map((defId, i) => (
              <div key={`${defId}-${i}`}>
                <StickerCard def={content.defs[defId]!} />
                <button
                  type="button"
                  className="btn"
                  data-testid={`pick-reward-${i}`}
                  onClick={() => dispatch({ type: "PICK_REWARD", index: i })}
                >
                  Sign
                </button>
              </div>
            ))}
          </div>
          <p style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn"
              data-testid="start-cut"
              disabled={!canCut}
              onClick={() => setCutting(true)}
            >
              ✂ Cut a player instead — smaller squads draw their stars more often
            </button>
            <button type="button" className="btn" data-testid="skip-reward" onClick={() => dispatch({ type: "SKIP_REWARD" })}>
              Skip (+{content.balance.REWARD_BUDGET.skipPick} budget)
            </button>
          </p>
        </>
      ) : (
        <>
          <p style={{ color: "var(--ink-dim)" }}>
            Click a card to cut it from the squad permanently (instead of signing anyone).
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} data-testid="cut-options">
            {run.deck.map((c) => (
              <StickerCard
                key={c.uid}
                def={content.defs[c.defId]!}
                inst={c}
                onClick={() => dispatch({ type: "CUT_CARD", uid: c.uid })}
              />
            ))}
          </div>
          <p>
            <button type="button" className="btn" data-testid="cancel-cut" onClick={() => setCutting(false)}>
              Back to signings
            </button>
          </p>
        </>
      )}
    </main>
  );
}
