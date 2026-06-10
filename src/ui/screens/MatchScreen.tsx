import { useState } from "react";
import { defenseRating } from "../../core/match/engine";
import type { ContentBundle, MatchAction, RunAction, RunState } from "../../core/types";
import { CardView } from "../components/CardView";

export function MatchScreen({
  run,
  content,
  dispatch,
}: {
  run: RunState;
  content: ContentBundle;
  dispatch: (a: RunAction) => void;
}) {
  const m = run.activeMatch!;
  const [sel, setSel] = useState<string[]>([]);

  const act = (action: MatchAction) => {
    dispatch({ type: "MATCH_ACTION", action });
    setSel([]);
  };
  const toggle = (uid: string) =>
    setSel((s) => (s.includes(uid) ? s.filter((x) => x !== uid) : [...s, uid]));

  const defNow = defenseRating(content.defs, m);
  const style = content.styles[m.opp.style];
  const coach = content.teams.find((t) => t.id === m.opp.teamId)?.coach;

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 data-testid="scoreline">
        You {m.playerGoals} — {m.oppGoals} {m.opp.name}
      </h1>
      <p data-testid="opp-panel">
        {m.opp.name} (tier {m.opp.tier}) · coach {coach} · {style.name}: {style.blurb}
      </p>
      <p data-testid="match-status">
        {m.mode === "regulation"
          ? `Round ${m.round} of ${m.bal.MATCH_ROUNDS}`
          : m.mode === "extratime"
            ? `EXTRA TIME (round ${m.round})`
            : `SUDDEN DEATH (${m.suddenDeathRoundsPlayed + 1})`}{" "}
        · plays {m.playsLeft} · discards {m.discardsLeft}
      </p>
      <p data-testid="clock">
        Their clock: {m.oppClockPoints}/{m.bal.GOAL_THRESHOLD} pts (+
        {Math.max(
          m.opp.attackRating - defNow,
          Math.ceil(m.opp.attackRating * m.bal.CLOCK_FLOOR_RATIO),
        )}
        /round) · your defense {defNow}
      </p>

      {m.phase === "PUSH_DECISION" && (
        <section
          data-testid="push-decision"
          style={{ border: "2px solid var(--accent)", padding: 12, borderRadius: 8 }}
        >
          <h2>You have the win ({m.playerGoals}-{m.oppGoals}). Push for glory?</h2>
          <p>
            Extra time: their clock runs {m.bal.EXTRA_TIME_CLOCK_MULT}x faster, cards you use get
            tired for the next match — but each round you survive in the lead pays{" "}
            {m.bal.ET_BUDGET_REWARD} budget and {m.bal.ET_SCOUT_REWARD} scout point.
          </p>
          <button type="button" data-testid="take-win" onClick={() => act({ type: "TAKE_WIN" })}>
            Bank the win
          </button>{" "}
          <button type="button" data-testid="extra-time" onClick={() => act({ type: "EXTRA_TIME" })}>
            Go for glory
          </button>
        </section>
      )}

      {m.phase === "ROUND_ACTIVE" && (
        <>
          {m.deployed.length > 0 && (
            <section>
              <h3>Deployed defense</h3>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {m.deployed.map((c) => (
                  <CardView key={c.uid} def={content.defs[c.defId]!} inst={c} />
                ))}
              </div>
            </section>
          )}

          <section>
            <h3>
              Hand ({m.hand.length}) — draw pile {m.drawPile.length}, discard{" "}
              {m.discardPile.length}
            </h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} data-testid="hand">
              {m.hand.map((c) => (
                <CardView
                  key={c.uid}
                  def={content.defs[c.defId]!}
                  inst={c}
                  selected={sel.includes(c.uid)}
                  onClick={() => toggle(c.uid)}
                />
              ))}
            </div>
          </section>

          <p style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              data-testid="attack"
              disabled={sel.length === 0 || m.playsLeft === 0}
              onClick={() => act({ type: "ATTACK", cardUids: sel })}
            >
              Attack ({sel.length})
            </button>
            <button
              type="button"
              data-testid="defend"
              disabled={sel.length === 0 || m.playsLeft === 0}
              onClick={() => act({ type: "DEFEND", cardUids: sel })}
            >
              Deploy defense
            </button>
            <button
              type="button"
              data-testid="discard"
              disabled={sel.length === 0 || m.discardsLeft === 0}
              onClick={() => act({ type: "DISCARD", cardUids: sel })}
            >
              Discard
            </button>
            <button type="button" data-testid="end-round" onClick={() => act({ type: "END_ROUND" })}>
              End round
            </button>
          </p>
        </>
      )}
    </main>
  );
}
