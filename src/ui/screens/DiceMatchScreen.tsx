import { useEffect, useRef, useState } from "react";
import {
  dieFitsSlot,
  slotLabel,
  type ContentBundle,
  type DiceMatchAction,
  type DiceMatchState,
  type GameEvent,
  type Intent,
  type RunAction,
  type RunState,
} from "../../core/types";
import { ZONE_NAMES, bestDieFor, zoneOf } from "../../core/match/dice";
import { ScorePopups } from "../components/ScorePopups";
import {
  LANE_GLOSSARY,
  describeDecisionCoach,
  describePendingCommit,
  describePressureStatus,
  type PendingCommitSummary,
} from "../diceUx";

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
      return { icon: "⚡", text: `Counter — ${t(intent.points)} threat if they win it back` };
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

function pressureOf(intent: Intent | null): number {
  if (!intent) return 0;
  return intent.kind === "attack" || intent.kind === "counter" ? intent.points : 4;
}

function MovePreview({ m }: { m: DiceMatchState }) {
  if (!m || m.phase !== "ROUND_ACTIVE") return null;
  const pressure = pressureOf(m.intent);
  const absorbed = Math.min(m.cover, pressure);
  const through = Math.max(0, pressure - m.cover);
  const buildUpSteps = Math.round(m.buildUp * m.bal.DICE.BUILD_UP_SCALE);
  const ballAfterBuildUp = Math.min(m.bal.DICE.PITCH_LEN, m.ball + buildUpSteps);
  const oppSteps = Math.max(0, Math.round(through * m.bal.DICE.OPP_ADVANCE_SCALE));
  const finalBall = Math.max(0, ballAfterBuildUp - oppSteps);
  const chanceBanks = m.chance > 0 && zoneOf(ballAfterBuildUp, m.bal) >= 3;
  const pressureText = describePressureStatus({ pressure, cover: m.cover, finalBall });
  return (
    <div className="duel-preview panel" data-testid="duel-preview">
      <span className="duel-preview-step">Ball {m.ball} → {ballAfterBuildUp}</span>
      <span className="duel-preview-step">Chance {chanceBanks ? `+${m.chance} SQ` : m.chance > 0 ? "needs final third" : "+0"}</span>
      <span className="duel-preview-step">Cover {absorbed}/{pressure}</span>
      {oppSteps > 0 && <span className="duel-preview-step danger">They push to {finalBall}</span>}
      <span className={`duel-preview-note${through > 0 ? " danger" : ""}`}>{pressureText}</span>
    </div>
  );
}

function DecisionCoach({ m }: { m: DiceMatchState }) {
  const pressure = pressureOf(m.intent);
  const through = Math.max(0, pressure - m.cover);
  const projectedBall = Math.min(m.bal.DICE.PITCH_LEN, m.ball + Math.round(m.buildUp * m.bal.DICE.BUILD_UP_SCALE));
  const oppSteps = Math.max(0, Math.round(through * m.bal.DICE.OPP_ADVANCE_SCALE));
  const finalBall = Math.max(0, projectedBall - oppSteps);
  const chanceBanks = m.chance > 0 && zoneOf(projectedBall, m.bal) >= 3;
  const coach = describeDecisionCoach({
    ball: m.ball,
    projectedBall,
    finalBall,
    theirBox: m.bal.DICE.THEIR_BOX,
    shotQuality: m.shotQuality,
    pressure,
    cover: m.cover,
    chance: m.chance,
    chanceBanks,
  });
  return (
    <div className={`decision-coach panel state-${coach.state.toLowerCase()}`} data-testid="decision-coach">
      <span className="decision-state">{coach.state}</span>
      <span className="decision-priority">{coach.priority}</span>
      <span className="decision-reason">{coach.reason}</span>
    </div>
  );
}

function eventLine(e: GameEvent): string | null {
  switch (e.type) {
    case "LANE_COMMITTED": {
      const parts = [];
      if (e.buildUp) parts.push(`+${e.buildUp} Build-Up`);
      if (e.chance) parts.push(`+${e.chance} Chance`);
      if (e.cover) parts.push(`+${e.cover} Cover`);
      return `${e.cardName} (${e.die}) committed ${parts.join(", ") || "no lane change"}.`;
    }
    case "DUEL_RESOLVED": {
      const chance = e.shotQualityGained > 0 ? `, +${e.shotQualityGained} Shot Quality` : "";
      const cover = e.pressure > 0 ? ` Cover absorbed ${e.absorbed}/${e.pressure}` : "";
      return `Duel resolved: ball ${e.ballFrom} → ${e.ballAfterBuildUp} → ${e.ballAfterOpponent}${chance}.${cover}`;
    }
    case "SHOT_TAKEN":
      return `Shot: d20 ${e.roll} + ${e.quality} vs ${e.dc} = ${e.goal ? "goal" : "saved"}.`;
    case "OPP_SHOT":
      return `Their shot: d20 ${e.roll} + ${e.danger} vs ${e.dc} = ${e.goal ? "goal" : "saved"}.`;
    case "DIE_REROLLED":
      return `Rerolled die ${e.dieIndex + 1}: ${e.from} → ${e.to}.`;
    default:
      return null;
  }
}

function MatchLog({ events }: { events: GameEvent[] }) {
  const lines = events.map(eventLine).filter((line): line is string => line !== null).slice(-4).reverse();
  if (lines.length === 0) return null;
  return (
    <div className="match-log panel" data-testid="match-log">
      {lines.map((line, i) => (
        <div key={`${i}-${line}`} className="match-log-line">
          {line}
        </div>
      ))}
    </div>
  );
}

function LaneGlossary() {
  return (
    <div className="lane-glossary panel" data-testid="lane-glossary">
      <div><strong>Build-Up</strong><span>{LANE_GLOSSARY.buildUp}</span></div>
      <div><strong>Chance</strong><span>{LANE_GLOSSARY.chance}</span></div>
      <div><strong>Cover</strong><span>{LANE_GLOSSARY.cover}</span></div>
      <div><strong>Shot Quality</strong><span>{LANE_GLOSSARY.shotQuality}</span></div>
      <div><strong>Finish</strong><span>{LANE_GLOSSARY.finish}</span></div>
    </div>
  );
}

function commitSummaryFor(m: DiceMatchState, content: ContentBundle, uid: string, dieIndex: number): PendingCommitSummary | null {
  const card = m.hand.find((c) => c.uid === uid);
  const die = m.dice[dieIndex];
  if (!card || !die || die.used) return null;
  const def = content.defs[card.defId];
  if (!def) return null;
  let buildUp = 0;
  let chance = 0;
  let cover = 0;
  const projectedZone = () =>
    zoneOf(Math.min(m.bal.DICE.PITCH_LEN, m.ball + Math.round((m.buildUp + buildUp) * m.bal.DICE.BUILD_UP_SCALE)), m.bal);
  for (const eff of def.diceEffects ?? []) {
    switch (eff.kind) {
      case "progress":
        buildUp += eff.amount;
        break;
      case "progressFromDie":
        buildUp += die.value;
        break;
      case "advance":
        buildUp += eff.zones * m.bal.DICE.ZONE_WIDTH;
        break;
      case "shotQuality":
        if (projectedZone() >= (eff.minZone ?? 0)) chance += eff.amount;
        break;
      case "shotQualityFromDie":
        if (projectedZone() >= (eff.minZone ?? 0)) chance += die.value;
        break;
      case "winPossession":
        cover += 10 + die.value;
        buildUp += m.mutators.filter((mut) => mut.kind === "counterSpring").reduce((sum, mut) => sum + mut.amount, 0);
        break;
      case "pushBack":
        cover += eff.steps;
        break;
      case "clearance":
        cover += 6;
        break;
      case "draw":
        break;
    }
  }
  return { cardName: def.name, die: die.value, buildUp, chance, cover };
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
  const [pendingCommit, setPendingCommit] = useState<{ uid: string; dieIndex: number } | null>(null);
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
      setPendingCommit(null);
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
  const inBox = m.ball >= m.bal.DICE.THEIR_BOX;
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
    setPendingCommit({ uid, dieIndex });
    setSelectedDie(null);
  };

  const pendingSummary =
    pendingCommit !== null ? commitSummaryFor(m, content, pendingCommit.uid, pendingCommit.dieIndex) : null;

  const commitPending = () => {
    if (!pendingCommit) return;
    act({ type: "ASSIGN_DIE", uid: pendingCommit.uid, dieIndex: pendingCommit.dieIndex });
    setPendingCommit(null);
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
        <span className="shotq-badge" data-testid="build-up">
          Build-Up +{m.buildUp}
        </span>
        <span className="shotq-badge" data-testid="chance">
          Chance +{m.chance}
        </span>
        <span className="shotq-badge" data-testid="cover">
          Cover {m.cover}
        </span>
        <span className={`possession-badge${m.possession === "them" ? " defending" : ""}`} data-testid="possession-badge">
          {m.possession === "you" ? "● Initiative" : "○ Under pressure"}
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

      {m.phase === "ROUND_ACTIVE" && <DecisionCoach m={m} />}
      <MovePreview m={m} />
      <LaneGlossary />
      {pendingSummary && (
        <div className="pending-commit panel" data-testid="pending-commit">
          <span>{describePendingCommit(pendingSummary)}</span>
          <button type="button" className="btn btn--primary" data-testid="confirm-card" onClick={commitPending}>
            Commit
          </button>
          <button type="button" className="btn" data-testid="cancel-card" onClick={() => setPendingCommit(null)}>
            Cancel
          </button>
        </div>
      )}
      <MatchLog events={events} />

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
                  className={`dice-card role-${role}${playable ? "" : " unplayable"}${pendingCommit?.uid === c.uid ? " pending" : ""}`}
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
              Resolve duel — they {m.intent ? intentVerb(m.intent) : "act"}
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
