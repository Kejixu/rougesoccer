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
import { ZONE_NAMES, bestDieFor, comboFor, interceptionRisk, oppInterceptionRisk, playableCards, shotEstimate, zoneOf } from "../../core/match/dice";
import { ScorePopups } from "../components/ScorePopups";
import { CHAIN_GLOSSARY, coachTipFor, describeChainStatus, type CoachTipKey } from "../diceUx";
import { COACH_TIP_KEYS, tutorialLockAllows, type TutorialActionIntent, type TutorialStep } from "../tutorialScript";

const PIPS: Record<number, string> = { 1: "⚀", 2: "⚁", 3: "⚂", 4: "⚃", 5: "⚄", 6: "⚅" };

function intentText(intent: Intent): { icon: string; text: string } {
  switch (intent.kind) {
    case "attack":
      return { icon: intent.big ? "🔥" : "⚔", text: "They play it balanced — 17% base risk" };
    case "sitDeep":
      return { icon: "🧱", text: "They sit deep — easy to keep the ball (10% base), harder to finish (+4 DC)" };
    case "press":
      return { icon: "✋", text: "They press high — every pass is riskier (27% base)" };
    case "counter":
      return { icon: "⚡", text: "They play it balanced — 17% base risk" };
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

function eventLine(e: GameEvent): string | null {
  switch (e.type) {
    case "ROUND_START":
      return `Round ${e.round}: ${e.round % 2 === 1 ? "your" : "their"} possession.`;
    case "PASS_COMPLETED": {
      if (e.combo === "Switch of play") return "Switch of play! next pass -8%.";
      if (e.combo) return `${e.combo}! ${e.cardName}: pass ${e.passes}, +${e.chanceGained} Chance.`;
      return `${e.cardName}: pass ${e.passes}, +${e.chanceGained} Chance, ${Math.round(e.risked * 100)}% risk.`;
    }
    case "OPP_PASS":
      return `Their pass ${e.passes}: ${e.oppChance} Chance, ${Math.round(e.risk * 100)}% risk.`;
    case "DEFENSE_COMMITTED":
      return `${e.cardName} (${e.die}): +${Math.round(e.amount * 100)}% defense, total +${Math.round(e.total * 100)}%.`;
    case "CHAIN_INTERCEPTED":
      return e.byYou
        ? `Won the interception after ${e.passes} passes.`
        : `Tackled after ${e.passes} passes; lost ${e.chanceLost} Chance.`;
    case "COUNTER_SHOT":
      return `${e.byYou ? "Your" : "Their"} counter: d20 ${e.roll} + ${e.bonus} vs ${e.dc} = ${e.goal ? "goal" : "saved"}.`;
    case "SHOT_TAKEN":
      return `Shot: d20 ${e.roll} + ${e.quality} vs ${e.dc} = ${e.goal ? "goal" : "saved"}.`;
    case "OPP_SHOT":
      return `Their shot: d20 ${e.roll} + ${e.danger} vs ${e.dc} = ${e.goal ? "goal" : "saved"}.`;
    case "GOAL_SCORED":
      return e.goals > 0 ? `Goal for you. Score ${e.total}.` : `They score. Their total ${e.total}.`;
    case "DIE_REROLLED":
      return `Rerolled die ${e.dieIndex + 1}: ${e.from} -> ${e.to}.`;
    case "PUSH_DECISION":
      return `Full time: you lead ${e.playerGoals}-${e.oppGoals}. Bank it or push.`;
    default:
      return null;
  }
}

function MatchTicker({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <div className="match-log panel" data-testid="ticker">
      {lines.map((line, i) => (
        <div key={`${i}-${line}`} className="match-log-line">
          {line}
        </div>
      ))}
    </div>
  );
}

function coachStorageKey(key: CoachTipKey): string {
  return `coach.${key}`;
}

function readSeenCoachKeys(): Set<CoachTipKey> {
  if (typeof localStorage === "undefined") return new Set();
  return new Set(COACH_TIP_KEYS.filter((key) => localStorage.getItem(coachStorageKey(key)) === "1"));
}

function persistCoachKey(key: CoachTipKey): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(coachStorageKey(key), "1");
}

function ChainGlossary() {
  return (
    <details className="glossary panel" data-testid="chain-glossary">
      <summary>How this works</summary>
      {Object.entries(CHAIN_GLOSSARY).map(([term, copy]) => (
        <div key={term}>
          <strong>{term}</strong>
          <span>{copy}</span>
        </div>
      ))}
    </details>
  );
}

function isDefenseCard(def: ContentBundle["defs"][string] | undefined): boolean {
  return (def?.diceEffects ?? []).some((e) => e.kind === "defend");
}

interface ChainChip {
  uid: string;
  cardName: string;
  passes: number;
  chanceGained: number;
  risked: number;
  combo?: string;
}

interface TutorialScreenProps {
  step: TutorialStep;
  stepIndex: number;
  totalSteps: number;
  onContinue: () => void;
  onSkip: () => void;
}

type DiceMatchScreenProps = {
  content: ContentBundle;
  events: GameEvent[];
} & (
  | {
      run: RunState;
      dispatch: (a: RunAction) => void;
      match?: never;
      playerName?: never;
      onMatchAction?: never;
      tutorial?: never;
    }
  | {
      match: DiceMatchState;
      playerName: string;
      onMatchAction: (a: DiceMatchAction) => void;
      tutorial: TutorialScreenProps;
      run?: never;
      dispatch?: never;
    }
);

function TutorialOverlay({ tutorial }: { tutorial: TutorialScreenProps }) {
  const lastStep = tutorial.stepIndex >= tutorial.totalSteps - 1;
  return (
    <aside className="tutorial-overlay panel" data-testid="tutorial-step">
      <div className="tutorial-kicker">
        Step {tutorial.stepIndex + 1} of {tutorial.totalSteps}
      </div>
      <h2>{tutorial.step.title}</h2>
      {tutorial.step.what && (
        <p>
          <strong>WHAT:</strong> {tutorial.step.what}
        </p>
      )}
      <p>
        <strong>WHY:</strong> {tutorial.step.why}
      </p>
      <div className="tutorial-actions">
        {tutorial.step.lock.kind === "next" && (
          <button type="button" className="btn btn--primary" data-testid="tutorial-continue" onClick={tutorial.onContinue}>
            {lastStep ? "Finish" : "Continue"}
          </button>
        )}
        <button type="button" className="tutorial-skip" data-testid="tutorial-skip" onClick={tutorial.onSkip}>
          Skip tutorial
        </button>
      </div>
    </aside>
  );
}

export function DiceMatchScreen(props: DiceMatchScreenProps) {
  const { content, events } = props;
  const tutorial = props.tutorial;
  const m = tutorial ? props.match : props.run.activeMatch!;
  const [selectedDie, setSelectedDie] = useState<number | null>(null);
  const act = (action: DiceMatchAction) => {
    if (tutorial) props.onMatchAction(action);
    else props.dispatch({ type: "MATCH_ACTION", action });
  };
  const chainRef = useRef<ChainChip[]>([]);
  const [chainEntries, setChainEntries] = useState<ChainChip[]>([]);
  const [tickerLines, setTickerLines] = useState<string[]>([]);
  const [seenCoachKeys, setSeenCoachKeys] = useState<Set<CoachTipKey>>(() => readSeenCoachKeys());
  const [puntPressed, setPuntPressed] = useState(false);

  // A fresh roll remounts the dice so they cascade in; a reroll spins the one die.
  const [rollKey, setRollKey] = useState(0);
  const [rerollFx, setRerollFx] = useState<{ i: number; lucky: boolean; n: number } | null>(null);
  const fxNonce = useRef(0);
  const lastBatchRef = useRef<GameEvent[] | null>(null);
  useEffect(() => {
    // StrictMode double-runs mount effects with the SAME events array; appending
    // twice duplicated ticker/chip entries. Process each event batch exactly once.
    if (lastBatchRef.current === events) return;
    lastBatchRef.current = events;
    const nextLines = events.map(eventLine).filter((line): line is string => line !== null);
    if (nextLines.length > 0) setTickerLines((prev) => [...nextLines.reverse(), ...prev].slice(0, 8));
    if (events.some((e) => e.type === "DICE_ROLLED")) {
      fxNonce.current += 1;
      setRollKey(fxNonce.current);
      setSelectedDie(null);
    }
    if (events.some((e) => e.type === "ROUND_START")) chainRef.current = [];
    const completed = events.filter((e): e is Extract<GameEvent, { type: "PASS_COMPLETED" }> => e.type === "PASS_COMPLETED");
    if (completed.length > 0) {
      chainRef.current = [
        ...chainRef.current,
        ...completed.map((e) => ({
          uid: e.uid,
          cardName: e.cardName,
          passes: e.passes,
          chanceGained: e.chanceGained,
          risked: e.risked,
          combo: e.combo,
        })),
      ];
    }
    if (events.some((e) => e.type === "ROUND_START") || completed.length > 0) setChainEntries([...chainRef.current]);
    const re = [...events].reverse().find((e) => e.type === "DIE_REROLLED");
    if (re && re.type === "DIE_REROLLED") {
      fxNonce.current += 1;
      setRerollFx({ i: re.dieIndex, lucky: re.to >= 5, n: fxNonce.current });
    }
  }, [events]);

  const style = content.styles[m.opp.style];
  const coach = content.teams.find((t) => t.id === m.opp.teamId)?.coach;
  const playerName =
    tutorial
      ? props.playerName
      : content.teams.find((t) => t.id === props.run.playerTeamId)?.name ?? "You";
  const tutorialAllows = (intent: TutorialActionIntent): boolean =>
    !tutorial || tutorialLockAllows(tutorial.step.lock, intent);
  const tutorialHighlights = (intent: TutorialActionIntent): boolean =>
    Boolean(tutorial && tutorialLockAllows(tutorial.step.lock, intent));
  const intent = m.intent ? intentText(m.intent) : null;
  const shotNow = shotEstimate(m);
  const dcNow = m.keeperDC;
  const riskNow = interceptionRisk(m);
  const theirRisk = oppInterceptionRisk(m);
  const chainStatus = describeChainStatus({
    possession: m.possession,
    passes: m.passes,
    shotQuality: m.shotQuality,
    riskPct: riskNow,
    oppPasses: m.oppPasses,
    oppChance: m.oppChance,
    shootPct: shotNow.p,
  });
  const playable = playableCards(content.defs, m);

  const selVal = selectedDie !== null ? m.dice[selectedDie]?.value : undefined;
  const coachTip = tutorial
    ? null
    : coachTipFor(
        {
          possession: m.possession,
          passes: m.passes,
          shotQuality: m.shotQuality,
          interceptionRisk: riskNow,
          puntPressed,
          phase: m.phase as DiceMatchState["phase"],
          comboTriggered: events.some((e) => e.type === "PASS_COMPLETED" && Boolean(e.combo)),
        },
        seenCoachKeys,
      );
  const dismissCoachTip = (key: CoachTipKey) => {
    persistCoachKey(key);
    setSeenCoachKeys((prev) => new Set([...prev, key]));
    if (key === "punt") setPuntPressed(false);
  };

  const canPlay = (uid: string): boolean => {
    return playable.has(uid);
  };

  const onCardClick = (uid: string, defId: string) => {
    if (!tutorialAllows({ kind: "playCard", defId })) return;
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

  const shootDisabled = m.possession !== "you" || m.passes < 1 || !tutorialAllows({ kind: "shoot" });
  const endRoundDisabled = !tutorialAllows({ kind: "endRound" });
  const shootLabel = `⚽ Shoot (${Math.round(shotNow.p * 100)}%)${m.possession === "you" && m.passes < 1 ? " — make a pass first" : ""}`;

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
          Chance {m.shotQuality}
        </span>
        <span className="shotq-badge" data-testid="passes">
          Passes {m.possession === "you" ? m.passes : m.oppPasses}
        </span>
        <span className={`possession-badge${m.possession === "them" ? " defending" : ""}`} data-testid="possession-badge">
          {m.possession === "you" ? "● Your possession" : "○ Their possession"}
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

      {coachTip && (
        <div className={`coach-tip coach-tip--${coachTip.key}`} data-testid="coach-tip">
          <span>{coachTip.text}</span>
          <button type="button" aria-label="Dismiss coach tip" onClick={() => dismissCoachTip(coachTip.key)}>
            ×
          </button>
        </div>
      )}

      {m.phase === "ROUND_ACTIVE" && m.possession === "you" && (
        <div className="chain-panel panel" data-testid="chain-panel">
          <div className="chain-strip" data-testid="chain-strip">
            {chainEntries.length === 0 ? (
              <span className="chain-chip empty">First pass safe</span>
            ) : (
              chainEntries.map((chip, i) => (
                <span key={`${chip.uid}-${i}`} className="chain-chip">
                  {chip.passes}. {chip.cardName}
                  {chip.chanceGained > 0 && <strong>+{chip.chanceGained}</strong>}
                  {chip.combo && <em className="combo-tag">{chip.combo}</em>}
                </span>
              ))
            )}
          </div>
          <div className="chain-summary">
            <span className="shotq-badge">Chance {m.shotQuality}</span>
            {riskNow > 0 && (
              <span className="risk-badge" data-testid="chain-risk" data-hot={riskNow >= 0.3 ? "true" : "false"}>
                {Math.round(riskNow * 100)}% risk
              </span>
            )}
            <span className="chain-status" data-testid="chain-status">{chainStatus}</span>
          </div>
        </div>
      )}

      {m.phase === "ROUND_ACTIVE" && m.possession === "them" && (
        <div className="their-chain panel" data-testid="their-chain">
          <span>Their pass {m.oppPasses}</span>
          <span>Chance {m.oppChance}</span>
          <span>Committed +{Math.round(m.defenseCommit * 100)}%</span>
          <span className="risk-badge" data-hot={theirRisk >= 0.3 ? "true" : "false"}>
            {Math.round(theirRisk * 100)}% interception
          </span>
          <span className="chain-status" data-testid="chain-status">{chainStatus}</span>
        </div>
      )}

      <ChainGlossary />
      <MatchTicker lines={tickerLines} />
      {tutorial && <TutorialOverlay tutorial={tutorial} />}

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
              <button
                type="button"
                className={`btn${tutorialHighlights({ kind: "takeWin" }) ? " tutorial-highlight" : ""}`}
                data-testid="take-win"
                disabled={!tutorialAllows({ kind: "takeWin" })}
                onClick={() => act({ type: "TAKE_WIN" })}
              >
                Bank the win
              </button>
              <button
                type="button"
                className="btn btn--primary"
                data-testid="extra-time"
                disabled={Boolean(tutorial)}
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
                disabled={d.used || Boolean(tutorial)}
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
                disabled={Boolean(tutorial) || selectedDie === null || m.dice[selectedDie]?.used}
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
              const cardHighlighted = tutorialHighlights({ kind: "playCard", defId: def.id });
              const cardPlayable = canPlay(c.uid) && tutorialAllows({ kind: "playCard", defId: def.id });
              const defense = isDefenseCard(def);
              const liveCombo = !defense && m.possession === "you" && def.position ? comboFor(m.lastPassPosition, def.position) : null;
              const role = defense
                ? "defend"
                : (def.diceEffects ?? []).some((e) => e.kind.startsWith("shotQuality"))
                  ? "finish"
                  : "progress";
              return (
                <button
                  key={c.uid}
                  type="button"
                  className={`dice-card role-${role}${cardPlayable ? "" : " unplayable"}${cardHighlighted ? " tutorial-highlight" : ""}`}
                  data-testid={`card-${def.id}`}
                  data-uid={c.uid}
                  data-playable={cardPlayable ? "true" : "false"}
                  disabled={!cardPlayable}
                  onClick={() => onCardClick(c.uid, def.id)}
                >
                  <span className="dice-card-slot">{def.slot ? slotLabel(def.slot) : "—"}</span>
                  <span className="dice-card-name">{def.name}</span>
                  {liveCombo && <span className="combo-tag card-combo">combo</span>}
                  <span className="dice-card-text">{def.levels[Math.min(c.level, def.levels.length - 1)]!.text}</span>
                  {!defense && m.passes >= 1 && (
                    <span className="risk-badge card-risk" data-hot={riskNow >= 0.3 ? "true" : "false"}>
                      {Math.round(riskNow * 100)}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="action-bar">
            <button
              type="button"
              className={`btn btn--primary${tutorialHighlights({ kind: "shoot" }) ? " tutorial-highlight" : ""}`}
              data-testid="shoot"
              disabled={shootDisabled}
              title="Roll a d20 + Chance vs the keeper's DC"
              onClick={() => {
                if (m.shotQuality === 0) setPuntPressed(true);
                act({ type: "SHOOT" });
              }}
            >
              {shootLabel}
            </button>
            <button
              type="button"
              className={`btn btn--danger${tutorialHighlights({ kind: "endRound" }) ? " tutorial-highlight" : ""}`}
              data-testid="end-round"
              disabled={endRoundDisabled}
              onClick={() => act({ type: "END_ROUND" })}
            >
              {m.possession === "you" ? "Recycle possession" : "Stand off"}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
