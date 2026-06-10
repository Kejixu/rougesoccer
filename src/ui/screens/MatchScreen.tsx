import { useEffect, useRef, useState } from "react";
import {
  cardCost,
  type ContentBundle,
  type GameEvent,
  type Intent,
  type MatchAction,
  type RunAction,
  type RunState,
} from "../../core/types";
import { useFlip } from "../anim/flip";
import { ScorePopups } from "../components/ScorePopups";
import { StickerCard } from "../components/StickerCard";

function RoundPips({ current, total, extraRounds }: { current: number; total: number; extraRounds: number }) {
  const pips = [];
  for (let r = 1; r <= total; r++) {
    pips.push(
      <span key={r} className={`pip${r < current ? " done" : ""}${r === current ? " current" : ""}`} />,
    );
  }
  for (let e = 1; e <= extraRounds; e++) {
    const r = total + e;
    pips.push(<span key={`et-${e}`} className={`pip et${r === current ? " current" : ""}`} />);
  }
  return <div className="round-pips">{pips}</div>;
}

function GoalCounter({ value }: { value: number }) {
  const [bump, setBump] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (value !== prev.current) {
      prev.current = value;
      setBump(true);
      const t = setTimeout(() => setBump(false), 520);
      return () => clearTimeout(t);
    }
  }, [value]);
  return <span className={`goals${bump ? " bump" : ""}`}>{value}</span>;
}

function GoalMeter({ label, points, threshold, danger }: { label: string; points: number; threshold: number; danger?: boolean }) {
  const pct = Math.min(100, (points / threshold) * 100);
  return (
    <div className="clockbar-wrap">
      <span style={{ minWidth: 130 }}>{label}</span>
      <div className="clockbar">
        <div
          className="clockbar-fill"
          style={{ width: `${pct}%`, background: danger ? undefined : "linear-gradient(90deg, #3d8a55, var(--accent-2))" }}
        />
      </div>
      <span>
        {points}/{threshold}
      </span>
    </div>
  );
}

function intentText(intent: Intent, etMult: number): { icon: string; text: string } {
  const x = (n: number) => Math.round(n * etMult);
  switch (intent.kind) {
    case "attack":
      return {
        icon: intent.big ? "🔥" : "⚔",
        text: `${intent.big ? "ALL-OUT ATTACK" : "Attack"} — ${x(intent.points)} toward their next goal`,
      };
    case "sitDeep":
      return { icon: "🧱", text: `Sit Deep — absorbs your first ${intent.amount} shot points this round` };
    case "press":
      return { icon: "✋", text: "High Press — you draw 1 fewer card next round" };
    case "counter":
      return {
        icon: "⚡",
        text: `Counter trap — ${x(intent.points)} damage unless you play 2+ attack cards this round`,
      };
  }
}

export function MatchScreen({
  run,
  content,
  events,
  dispatch,
}: {
  run: RunState;
  content: ContentBundle;
  events: GameEvent[];
  dispatch: (a: RunAction) => void;
}) {
  const m = run.activeMatch!;
  const handRef = useRef<HTMLDivElement>(null);
  useFlip(handRef, m.hand.map((c) => c.uid).join(","));

  const act = (action: MatchAction) => dispatch({ type: "MATCH_ACTION", action });

  const style = content.styles[m.opp.style];
  const coach = content.teams.find((t) => t.id === m.opp.teamId)?.coach;
  const playerName = content.teams.find((t) => t.id === run.playerTeamId)?.name ?? "You";
  const etMult = m.mode === "extratime" ? m.bal.EXTRA_TIME_CLOCK_MULT : 1;
  const intent = m.intent ? intentText(m.intent, etMult) : null;
  const threat =
    m.intent?.kind === "attack" || m.intent?.kind === "counter"
      ? Math.max(0, Math.round(m.intent.points * etMult) - m.block)
      : 0;

  return (
    <main className="board">
      <ScorePopups events={events} />

      <div className="scoreboard panel">
        <div>
          <div className="score" data-testid="scoreline">
            {playerName} <GoalCounter value={m.playerGoals} /> — <GoalCounter value={m.oppGoals} />{" "}
            {m.opp.name}
          </div>
          <div className="opp-blurb" data-testid="opp-panel">
            tier {m.opp.tier} · coach {coach} · <strong>{style.name}</strong>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <RoundPips current={m.round} total={m.bal.MATCH_ROUNDS} extraRounds={m.extraRoundsPlayed} />
          <div data-testid="match-status" style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 6 }}>
            {m.mode === "regulation"
              ? `Round ${m.round} of ${m.bal.MATCH_ROUNDS}`
              : m.mode === "extratime"
                ? `EXTRA TIME — round ${m.round}`
                : `SUDDEN DEATH ${m.suddenDeathRoundsPlayed + 1}`}
          </div>
        </div>
      </div>

      <GoalMeter label={`${playerName} build-up`} points={m.playerShotPoints} threshold={m.bal.GOAL_THRESHOLD} />
      <GoalMeter label={`${m.opp.name} build-up`} points={m.oppClockPoints} threshold={m.bal.GOAL_THRESHOLD} danger />

      {intent && m.phase === "ROUND_ACTIVE" && (
        <div className="intent-panel panel" data-testid="intent">
          <span className="intent-icon">{intent.icon}</span>
          <span>
            <strong>{m.opp.name}:</strong> {intent.text}
          </span>
          {threat > 0 && (
            <span className="intent-threat" data-testid="threat">
              {m.block > 0 ? `${m.block} blocked · ` : ""}
              {threat} will get through
            </span>
          )}
          {m.intent?.kind !== "sitDeep" && m.block > 0 && threat === 0 && (
            <span className="intent-threat safe">fully blocked 🛡</span>
          )}
        </div>
      )}

      {m.phase === "PUSH_DECISION" && (
        <div className="push-modal-backdrop" data-testid="push-decision">
          <div className="push-modal">
            <h2>
              You have the win ({m.playerGoals}–{m.oppGoals})
            </h2>
            <p>
              Extra time: their attacks hit {m.bal.EXTRA_TIME_CLOCK_MULT}× harder, and a second
              extra round tires the cards you use — but each round you survive in the lead pays{" "}
              <strong>+{m.bal.ET_BUDGET_REWARD} budget</strong> and{" "}
              <strong>+{m.bal.ET_SCOUT_REWARD} scout</strong>.
            </p>
            <p style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button type="button" className="btn" data-testid="take-win" onClick={() => act({ type: "TAKE_WIN" })}>
                Bank the win
              </button>
              <button type="button" className="btn btn--primary" data-testid="extra-time" onClick={() => act({ type: "EXTRA_TIME" })}>
                Go for glory
              </button>
            </p>
          </div>
        </div>
      )}

      {m.phase === "ROUND_ACTIVE" && (
        <>
          <div className="stamina-bar" data-testid="stamina">
            <span className="stamina-label">STAMINA</span>
            {Array.from({ length: Math.max(m.bal.STAMINA_PER_ROUND, m.stamina) }, (_, i) => (
              <span key={i} className={`stamina-pip${i < m.stamina ? " full" : ""}`} />
            ))}
            {m.block > 0 && <span className="block-badge">🛡 {m.block}</span>}
            {m.pendingMult > 1 || m.pendingFlat > 0 ? (
              <span className="buff-badge">
                next shot{m.pendingFlat > 0 ? ` +${m.pendingFlat}` : ""}
                {m.pendingMult > 1 ? ` ×${m.pendingMult.toFixed(2).replace(/\.?0+$/, "")}` : ""}
              </span>
            ) : null}
            <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink-dim)" }}>
              draw {m.drawPile.length} · discard {m.discardPile.length} · hand discards at round end
            </span>
          </div>

          <div className="hand-fan" data-testid="hand" ref={handRef}>
            {m.hand.map((c, i) => {
              const def = content.defs[c.defId]!;
              const price = cardCost(def);
              const playable = price <= m.stamina;
              const mid = (m.hand.length - 1) / 2;
              return (
                <div
                  key={c.uid}
                  style={{
                    "--fan-angle": `${(i - mid) * 3}deg`,
                    "--fan-lift": `${Math.abs(i - mid) * 6}px`,
                    opacity: playable ? 1 : 0.55,
                  } as React.CSSProperties}
                >
                  <StickerCard
                    def={def}
                    inst={c}
                    cost={price}
                    onClick={playable ? () => act({ type: "PLAY_CARD", uid: c.uid }) : undefined}
                  />
                </div>
              );
            })}
          </div>

          <div className="action-bar">
            <span style={{ fontSize: 13, color: "var(--ink-dim)" }}>
              Click a card to play it ({levelLabel(m)})
            </span>
            <button type="button" className="btn btn--danger" data-testid="end-round" onClick={() => act({ type: "END_ROUND" })}>
              End round — they {m.intent ? intentVerb(m.intent) : "act"}
            </button>
          </div>
        </>
      )}
    </main>
  );
}

function levelLabel(m: { stamina: number }): string {
  return `${m.stamina} stamina left`;
}

function intentVerb(intent: Intent): string {
  switch (intent.kind) {
    case "attack":
      return intent.big ? "unleash the big attack" : "attack";
    case "sitDeep":
      return "stay compact";
    case "press":
      return "press you";
    case "counter":
      return "spring the trap";
  }
}
