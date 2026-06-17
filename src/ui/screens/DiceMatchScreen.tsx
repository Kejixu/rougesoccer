import { useState } from "react";
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
import { ZONE_NAMES } from "../../core/match/dice";
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

function PitchTrack({ zone, progress, perZone, boxZone }: { zone: number; progress: number; perZone: number; boxZone: number }) {
  return (
    <div className="pitch-track" data-testid="pitch">
      {ZONE_NAMES.map((name, i) => (
        <div key={name} className={`pitch-zone${i === zone ? " current" : ""}${i < zone ? " passed" : ""}${i === boxZone ? " box" : ""}`}>
          <span className="pitch-zone-name">{name}</span>
          {i === zone && i < boxZone && (
            <span className="pitch-progress" data-testid="progress">
              {progress}/{perZone}
            </span>
          )}
          {i === zone && i === boxZone && <span className="pitch-progress">⚽ box</span>}
        </div>
      ))}
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

  const style = content.styles[m.opp.style];
  const coach = content.teams.find((t) => t.id === m.opp.teamId)?.coach;
  const playerName = content.teams.find((t) => t.id === run.playerTeamId)?.name ?? "You";
  const scale = (m.mode === "extratime" ? m.bal.EXTRA_TIME_CLOCK_MULT : 1) * m.bal.DICE.THREAT_SCALE;
  const intent = m.intent ? intentText(m.intent, scale) : null;
  const inBox = m.zone >= m.bal.DICE.BOX_ZONE;
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
      // auto-pick the highest fitting die
      const fit = freeDice.filter((d) => dieFitsSlot(d.value, slot)).sort((a, b) => b.value - a.value)[0];
      if (!fit) return;
      dieIndex = fit.i;
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

      <PitchTrack zone={m.zone} progress={m.progress} perZone={m.bal.DICE.PROGRESS_PER_ZONE} boxZone={m.bal.DICE.BOX_ZONE} />

      <div className="dice-stat-row">
        <span className="shotq-badge" data-testid="shot-quality">
          ⚽ Shot Quality {m.shotQuality}
        </span>
        {m.cover > 0 && <span className="cover-badge" data-testid="cover">🛡 Cover {m.cover}</span>}
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
            {m.dice.map((d, i) => (
              <button
                key={i}
                type="button"
                className={`die${d.used ? " used" : ""}${selectedDie === i ? " selected" : ""}`}
                data-testid={`die-${i}`}
                data-value={d.value}
                data-used={d.used ? "true" : "false"}
                disabled={d.used}
                onClick={() => setSelectedDie(selectedDie === i ? null : i)}
              >
                <span className="die-pip">{PIPS[d.value]}</span>
                <span className="die-num">{d.value}</span>
              </button>
            ))}
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
              const role = (def.diceEffects ?? []).some((e) => e.kind === "cover" || e.kind === "coverFromDie")
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
              End round — they {m.intent ? intentVerb(m.intent) : "act"}
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
