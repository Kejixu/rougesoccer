import { useEffect, useRef, useState } from "react";
import { defenseRating } from "../../core/match/engine";
import { computeAttack } from "../../core/match/scoring";
import {
  levelStats,
  type ContentBundle,
  type GameEvent,
  type MatchAction,
  type RunAction,
  type RunState,
} from "../../core/types";
import { useFlip } from "../anim/flip";
import { ClockBar } from "../components/ClockBar";
import { ScorePopups } from "../components/ScorePopups";
import { StickerCard } from "../components/StickerCard";

function RoundPips({ current, total, extraRounds }: { current: number; total: number; extraRounds: number }) {
  const pips = [];
  for (let r = 1; r <= total; r++) {
    pips.push(
      <span
        key={r}
        className={`pip${r < current ? " done" : ""}${r === current ? " current" : ""}`}
      />,
    );
  }
  for (let e = 1; e <= extraRounds; e++) {
    const r = total + e;
    pips.push(
      <span key={`et-${e}`} className={`pip et${r === current ? " current" : ""}`} />,
    );
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
  const [sel, setSel] = useState<string[]>([]);
  const handRef = useRef<HTMLDivElement>(null);
  useFlip(handRef, m.hand.map((c) => c.uid).join(","));

  const act = (action: MatchAction) => {
    dispatch({ type: "MATCH_ACTION", action });
    setSel([]);
  };
  const toggle = (uid: string) =>
    setSel((s) => (s.includes(uid) ? s.filter((x) => x !== uid) : [...s, uid]));

  const defNow = defenseRating(content.defs, m);
  const selPower = sel.some((uid) => {
    const c = m.hand.find((x) => x.uid === uid);
    if (!c) return false;
    return (levelStats(content.defs[c.defId]!, c.level).power ?? 0) + c.formPower > 0;
  });
  const selDefense = sel.every((uid) => {
    const c = m.hand.find((x) => x.uid === uid);
    if (!c) return false;
    return (levelStats(content.defs[c.defId]!, c.level).defense ?? 0) > 0;
  });

  // live attack preview: the Balatro moment — watch the play form as you select
  const selCards = sel
    .map((uid) => m.hand.find((c) => c.uid === uid))
    .filter((c): c is NonNullable<typeof c> => !!c)
    .map((inst) => ({ inst, def: content.defs[inst.defId]! }));
  const preview =
    selCards.length > 0
      ? computeAttack(selCards, {
          handSizeAfter: m.hand.length - selCards.length,
          leading: m.playerGoals > m.oppGoals,
          trailing: m.playerGoals < m.oppGoals,
          multCap: m.multCap,
          goalThreshold: m.bal.GOAL_THRESHOLD,
          plays: m.plays,
        })
      : null;
  const toNextGoal = preview ? m.bal.GOAL_THRESHOLD * (preview.goals + 1) - preview.value : 0;
  const fmtMult = (x: number) => `×${x.toFixed(2).replace(/\.?0+$/, "")}`;
  const style = content.styles[m.opp.style];
  const coach = content.teams.find((t) => t.id === m.opp.teamId)?.coach;
  const playerName = content.teams.find((t) => t.id === run.playerTeamId)?.name ?? "You";

  return (
    <main className="board">
      <ScorePopups events={events} />

      <div className="scoreboard panel">
        <div>
          <div className="score" data-testid="scoreline">
            {playerName} <GoalCounter value={m.playerGoals} /> —{" "}
            <GoalCounter value={m.oppGoals} /> {m.opp.name}
          </div>
          <div className="opp-blurb" data-testid="opp-panel">
            tier {m.opp.tier} · coach {coach} · <strong>{style.name}:</strong> {style.blurb}
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
            {" · "}plays {m.playsLeft} · discards {m.discardsLeft}
          </div>
        </div>
      </div>

      <ClockBar match={m} defense={defNow} />

      {m.phase === "PUSH_DECISION" && (
        <div className="push-modal-backdrop" data-testid="push-decision">
          <div className="push-modal">
            <h2>
              You have the win ({m.playerGoals}–{m.oppGoals})
            </h2>
            <p>
              Play extra time: their clock runs {m.bal.EXTRA_TIME_CLOCK_MULT}× faster and the
              cards you use will be <em>tired</em> next match — but every extra round you survive
              in the lead pays <strong>+{m.bal.ET_BUDGET_REWARD} budget</strong> and{" "}
              <strong>+{m.bal.ET_SCOUT_REWARD} scout</strong>.
            </p>
            <p style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button type="button" className="btn" data-testid="take-win" onClick={() => act({ type: "TAKE_WIN" })}>
                Bank the win
              </button>
              <button
                type="button"
                className="btn btn--primary"
                data-testid="extra-time"
                onClick={() => act({ type: "EXTRA_TIME" })}
              >
                Go for glory
              </button>
            </p>
          </div>
        </div>
      )}

      {m.phase === "ROUND_ACTIVE" && (
        <>
          <div className="attack-preview panel" data-testid="attack-preview">
            {preview ? (
              <>
                <span className={`play-name${preview.playMult > 1 ? " good" : ""}`}>
                  {preview.playName} {fmtMult(preview.playMult)}
                </span>
                <span className="preview-math">
                  {preview.basePower} power {fmtMult(preview.totalMult)} ={" "}
                  <strong>{preview.value}</strong>
                </span>
                <span className="preview-goals">
                  {preview.goals > 0 ? `⚽ ${preview.goals}` : "no goal"}
                  {" · "}
                  {toNextGoal} short of {preview.goals + 1}
                  {preview.goals === 0 ? "st" : preview.goals === 1 ? "nd" : preview.goals === 2 ? "rd" : "th"} goal
                </span>
                <span className="preview-count">{sel.length}/{m.bal.MAX_ATTACK_CARDS} cards</span>
              </>
            ) : (
              <span style={{ color: "var(--ink-dim)" }}>
                Select up to {m.bal.MAX_ATTACK_CARDS} cards to build a play — combos of positions
                multiply your score. Every {m.bal.GOAL_THRESHOLD} points = 1 goal.
              </span>
            )}
          </div>

          {m.deployed.length > 0 && (
            <div className="deployed-row panel">
              <strong style={{ fontFamily: "var(--font-display)" }}>BACK LINE</strong>
              {m.deployed.map((c) => (
                <StickerCard key={c.uid} def={content.defs[c.defId]!} inst={c} />
              ))}
            </div>
          )}

          <div className="hand-fan" data-testid="hand" ref={handRef}>
            {m.hand.map((c, i) => {
              const mid = (m.hand.length - 1) / 2;
              const angle = (i - mid) * 3;
              const lift = Math.abs(i - mid) * 6;
              return (
                <div
                  key={c.uid}
                  style={{ "--fan-angle": `${angle}deg`, "--fan-lift": `${lift}px` } as React.CSSProperties}
                >
                  <StickerCard
                    def={content.defs[c.defId]!}
                    inst={c}
                    selected={sel.includes(c.uid)}
                    onClick={() => toggle(c.uid)}
                  />
                </div>
              );
            })}
          </div>

          <div className="action-bar">
            <button
              type="button"
              className="btn btn--primary"
              data-testid="attack"
              disabled={
                sel.length === 0 ||
                sel.length > m.bal.MAX_ATTACK_CARDS ||
                m.playsLeft === 0 ||
                !selPower
              }
              onClick={() => act({ type: "ATTACK", cardUids: sel })}
            >
              Attack ({sel.length})
            </button>
            <button
              type="button"
              className="btn"
              data-testid="defend"
              disabled={
                sel.length === 0 ||
                m.playsLeft === 0 ||
                !selDefense ||
                sel.length > m.bal.MAX_DEFEND_CARDS ||
                m.deployed.length + sel.length > m.bal.MAX_DEPLOYED
              }
              onClick={() => act({ type: "DEFEND", cardUids: sel })}
            >
              Deploy defense
            </button>
            <button
              type="button"
              className="btn"
              data-testid="discard"
              disabled={sel.length === 0 || m.discardsLeft === 0}
              onClick={() => act({ type: "DISCARD", cardUids: sel })}
            >
              Discard
            </button>
            <button type="button" className="btn btn--danger" data-testid="end-round" onClick={() => act({ type: "END_ROUND" })}>
              End round
            </button>
            <span style={{ fontSize: 12, color: "var(--ink-dim)" }}>
              draw {m.drawPile.length} · discard {m.discardPile.length}
            </span>
          </div>

          <details className="plays-legend panel" data-testid="plays-legend">
            <summary>The plays — combine positions for bigger multipliers</summary>
            <table>
              <tbody>
                {[...m.plays]
                  .sort((a, b) => a.baseMult - b.baseMult)
                  .map((p) => (
                    <tr key={p.id}>
                      <td className="play-name good">{p.name}</td>
                      <td>{fmtMult(p.baseMult)}</td>
                      <td style={{ color: "var(--ink-dim)" }}>{p.blurb}</td>
                    </tr>
                  ))}
                <tr>
                  <td className="play-name">Hopeful Punt</td>
                  <td>×1</td>
                  <td style={{ color: "var(--ink-dim)" }}>Anything that isn't a real play.</td>
                </tr>
              </tbody>
            </table>
          </details>
        </>
      )}
    </main>
  );
}
