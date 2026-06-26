import { useEffect, useRef, useState } from "react";
import {
  dieFitsSlot,
  slotLabel,
  type ContentBundle,
  type DiceMatchAction,
  type GameEvent,
  type Intent,
  type RunAction,
  type RunState,
} from "../../core/types";
import { ZONE_NAMES, bestDieFor, zoneOf } from "../../core/match/dice";
import { ScorePopups } from "../components/ScorePopups";

const PIPS: Record<number, string> = { 1: "⚀", 2: "⚁", 3: "⚂", 4: "⚃", 5: "⚄", 6: "⚅" };

function intentText(intent: Intent, scale: number): { icon: string; text: string } {
  const t = (n: number) => Math.round(n * scale);
  switch (intent.kind) {
    case "attack":
      return { icon: intent.big ? "🔥" : "⚔", text: `${intent.big ? "ALL-OUT ATTACK" : "Attack"} — ${t(intent.points)} threat` };
    case "sitDeep":
      return { icon: "🧱", text: "Sit Deep — the keeper is harder to beat this round" };
    case "press":
      return { icon: "✋", text: "High Press — fewer dice and cards next round" };
    case "counter":
      return { icon: "⚡", text: `Counter — ${t(intent.points)} threat unless you take Cover` };
  }
}

function PitchTrack({
  ball,
  possession,
  bal,
}: {
  ball: number;
  possession: "you" | "them";
  bal: import("../../core/types").DiceMatchState["bal"];
}) {
  const ballZone = zoneOf(ball, bal);
  return (
    <div className="pitch-track" data-testid="pitch">
      <div className="goal-end goal-end--yours">🥅</div>
      {ZONE_NAMES.map((name, i) => (
        <div
          key={name}
          className={`pitch-zone${i === ballZone ? " current" : ""}${i === ballZone && possession === "them" ? " theirs" : ""}`}
        >
          <span className="pitch-zone-name">{name}</span>
          {i === ballZone && (
            <span className={`ball-token${possession === "them" ? " theirs" : ""}`} data-testid="ball-token">
              ⚽
            </span>
          )}
        </div>
      ))}
      <div className="goal-end goal-end--theirs">🥅</div>
    </div>
  );
}

export function DiceMatchScreen({
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
  const [selectedDie, setSelectedDie] = useState<number | null>(null);
  const act = (action: DiceMatchAction) => dispatch({ type: "MATCH_ACTION", action });

  // A fresh roll remounts the dice so they cascade in; a reroll spins the one die.
  const [rollKey, setRollKey] = useState(0);
  const [rerollFx, setRerollFx] = useState<{ i: number; lucky: boolean; n: number } | null>(null);
  const fxNonce = useRef(0);
  useEffect(() => {
    if (events.some((e) => e.type === "DICE_ROLLED")) {
      fxNonce.current += 1;
      setRollKey(fxNonce.current);
      setSelectedDie(null);
    }
    const re = [...events].reverse().find((e) => e.type === "DIE_REROLLED");
    if (re && re.type === "DIE_REROLLED") {
      fxNonce.current += 1;
      setRerollFx({ i: re.dieIndex, lucky: re.to >= 5, n: fxNonce.current });
    }
  }, [events]);

  const style = content.styles[m.opp.style];
  const coach = content.teams.find((t) => t.id === m.opp.teamId)?.coach;
  const playerName = content.teams.find((t) => t.id === run.playerTeamId)?.name ?? "You";
  const scale = (m.mode === "extratime" ? m.bal.EXTRA_TIME_CLOCK_MULT : 1);
  const intent = m.intent ? intentText(m.intent, scale) : null;
  const inBox = m.possession === "you" && m.ball >= m.bal.DICE.THEIR_BOX;
  const dcNow = m.keeperDC + (m.intent?.kind === "sitDeep" ? m.bal.DICE.SIT_DEEP_DC_BONUS : 0);

  const freeDice = m.dice.map((d, i) => ({ ...d, i })).filter((d) => !d.used);
  const selVal = selectedDie !== null ? m.dice[selectedDie]?.value : undefined;

  const canPlay = (defId: string): boolean => {
    const slot = content.defs[defId]?.slot;
    if (!slot) return false;
    if (selVal !== undefined) return dieFitsSlot(selVal, slot);
    return freeDice.some((d) => dieFitsSlot(d.value, slot));
  };

  const onCardClick = (uid: string, defId: string) => {
    const slot = content.defs[defId]!.slot!;
    let dieIndex = selectedDie;
    if (dieIndex === null || m.dice[dieIndex]?.used || !dieFitsSlot(m.dice[dieIndex]!.value, slot)) {
      // auto-pick the smart die: scaling cards take the highest, flat cards the
      // lowest fitting die so your 5s and 6s stay free for finishing
      dieIndex = bestDieFor(content.defs, m, uid);
      if (dieIndex < 0) return;
    }
    act({ type: "ASSIGN_DIE", uid, dieIndex });
    setSelectedDie(null);
  };

  return (
    <main className="board">
      <ScorePopups events={events} />

      <div className="scoreboard panel">
        <div>
          <div className="score" data-testid="scoreline">
            {playerName} {m.playerGoals} — {m.oppGoals} {m.opp.name}
          </div>
          <div className="opp-blurb" data-testid="opp-panel">
            tier {m.opp.tier} · coach {coach} · <strong>{style.name}</strong> · keeper DC {dcNow}
          </div>
        </div>
        <div style={{ textAlign: "right" }} data-testid="match-status">
          {m.mode === "regulation"
            ? `Round ${m.round} of ${m.bal.MATCH_ROUNDS}`
            : m.mode === "extratime"
              ? `EXTRA TIME — round ${m.round}`
              : `SUDDEN DEATH ${m.suddenDeathRoundsPlayed + 1}`}
        </div>
      </div>

      <PitchTrack ball={m.ball} possession={m.possession} bal={m.bal} />

      <div className="dice-stat-row">
        <span className="shotq-badge" data-testid="shot-quality">
          ⚽ Shot Quality {m.shotQuality}
        </span>
        <span className={`possession-badge${m.possession === "them" ? " defending" : ""}`} data-testid="possession-badge">
          {m.possession === "you" ? "● You on the ball" : "○ Defending"}
        </span>
        <span className="pitch-arrow" data-testid="pitch-arrow">
          {m.possession === "you" ? "→" : "←"}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink-dim)" }}>
          draw {m.drawPile.length} · discard {m.discardPile.length}
        </span>
      </div>

      {intent && m.phase === "ROUND_ACTIVE" && (
        <div className="intent-panel panel" data-testid="intent">
          <span className="intent-icon">{intent.icon}</span>
          <span>
            <strong>{m.opp.name}:</strong> {intent.text}
          </span>
        </div>
      )}

      {m.phase === "PUSH_DECISION" && (
        <div className="push-modal-backdrop" data-testid="push-decision">
          <div className="push-modal">
            <h2>
              You have the win ({m.playerGoals}–{m.oppGoals})
            </h2>
            <p>
              Extra time: their threat hits {m.bal.EXTRA_TIME_CLOCK_MULT}× harder, but each round you
              survive in the lead pays <strong>+{m.bal.ET_BUDGET_REWARD} budget</strong>.
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
          <div className="dice-tray" data-testid="dice-tray">
            <span className="dice-label">YOUR ROLL</span>
            {m.dice.map((d, i) => {
              const rerolled = rerollFx?.i === i;
              return (
              <button
                key={`${i}-${rollKey}-${rerolled ? rerollFx.n : 0}`}
                type="button"
                className={`die${d.used ? " used" : ""}${selectedDie === i ? " selected" : ""}${rerolled ? " rerolled" : ""}${rerolled && rerollFx.lucky ? " lucky" : ""}`}
                style={{ animationDelay: rerolled ? "0ms" : `${i * 55}ms` }}
                data-testid={`die-${i}`}
                data-value={d.value}
                data-used={d.used ? "true" : "false"}
                disabled={d.used}
                onClick={() => setSelectedDie(selectedDie === i ? null : i)}
              >
                <span className="die-pip">{PIPS[d.value]}</span>
                <span className="die-num">{d.value}</span>
              </button>
              );
            })}
            {m.rerollDieLeft > 0 && (
              <button
                type="button"
                className="btn reroll-btn"
                data-testid="reroll-die"
                disabled={selectedDie === null || m.dice[selectedDie]?.used}
                title="Joga Bonito: reroll the selected die"
                onClick={() => {
                  if (selectedDie !== null) act({ type: "REROLL_DIE", dieIndex: selectedDie });
                }}
              >
                🎲 Reroll ({m.rerollDieLeft})
              </button>
            )}
            <span className="dice-hint">
              {m.rerollDieLeft > 0 && selectedDie === null
                ? "select a die to reroll it, or click a card to play"
                : selectedDie !== null
                  ? `die ${selVal} selected — reroll it or click a card`
                  : "click a die, then a card (or just click a card)"}
            </span>
          </div>

          <div className="dice-hand" data-testid="hand">
            {m.hand.map((c) => {
              const def = content.defs[c.defId]!;
              const playable = canPlay(c.defId);
              const role = (def.diceEffects ?? []).some((e) => e.kind === "winPossession" || e.kind === "pushBack" || e.kind === "clearance")
                ? "defend"
                : (def.diceEffects ?? []).some((e) => e.kind.startsWith("shotQuality"))
                  ? "finish"
                  : "progress";
              return (
                <button
                  key={c.uid}
                  type="button"
                  className={`dice-card role-${role}${playable ? "" : " unplayable"}`}
                  data-testid={`card-${def.id}`}
                  data-uid={c.uid}
                  data-playable={playable ? "true" : "false"}
                  disabled={!playable}
                  onClick={() => onCardClick(c.uid, def.id)}
                >
                  <span className="dice-card-slot">{def.slot ? slotLabel(def.slot) : "—"}</span>
                  <span className="dice-card-name">{def.name}</span>
                  <span className="dice-card-text">{def.levels[Math.min(c.level, def.levels.length - 1)]!.text}</span>
                </button>
              );
            })}
          </div>

          <div className="action-bar">
            <button
              type="button"
              className="btn btn--primary"
              data-testid="shoot"
              disabled={!inBox || m.shotQuality <= 0}
              title={inBox ? "Roll a d20 + shot quality vs the keeper's DC" : "Reach the box first"}
              onClick={() => act({ type: "SHOOT" })}
            >
              ⚽ Shoot ({m.shotQuality} + d20 ≥ {dcNow})
            </button>
            <button type="button" className="btn btn--danger" data-testid="end-round" onClick={() => act({ type: "END_ROUND" })}>
              {m.possession === "them"
                ? m.ball <= m.bal.DICE.YOUR_BOX
                  ? "End round — they shoot"
                  : "End round — they advance"
                : `End round — they ${m.intent ? intentVerb(m.intent) : "act"}`}
            </button>
          </div>
        </>
      )}
    </main>
  );
}

function intentVerb(intent: Intent): string {
  switch (intent.kind) {
    case "attack":
      return intent.big ? "unleash the big attack" : "attack";
    case "sitDeep":
      return "park the bus";
    case "press":
      return "press you";
    case "counter":
      return "spring the counter";
  }
}
