import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  dieFitsSlot,
  pressureOf,
  slotLabel,
  type ContentBundle,
  type DiceMatchAction,
  type DiceMatchState,
  type GameEvent,
  type Intent,
  type RunAction,
  type RunState,
} from "../../core/types";
import { ZONE_NAMES, bestDieFor, comboFor, interceptionRisk, oppInterceptionRisk, oppShotEstimate, playableCards, projectedShotEstimate, shotEstimate, zoneOf } from "../../core/match/dice";
import { ScorePopups } from "../components/ScorePopups";
import {
  CHAIN_GLOSSARY,
  COACH_TIP_KEYS,
  SET_PIECE_COACH_TIP_KEYS,
  coachTipFor,
  describeChainStatus,
  type CoachTipKey,
} from "../diceUx";
import { dieDropInfo } from "../diceDropTargets";
import { stageEvents } from "../eventTimeline";
import { tutorialLockAllows, type TutorialActionIntent, type TutorialStep } from "../tutorialScript";

const PIPS: Record<number, string> = { 1: "⚀", 2: "⚁", 3: "⚂", 4: "⚃", 5: "⚄", 6: "⚅" };

type PossessionOwner = "you" | "them";

export interface PossessionHandover {
  round: number;
  owner: PossessionOwner;
  title: string;
  subtitle: string;
}

function ownerForRound(round: number): PossessionOwner {
  return round % 2 === 1 ? "you" : "them";
}

export function PossessionStrip({
  currentRound,
  matchRounds,
}: {
  currentRound: number;
  matchRounds: number;
}) {
  const rounds = Math.max(matchRounds, currentRound);
  return (
    <div className="possession-strip" data-testid="possession-strip" role="list" aria-label="Possession schedule">
      <div className="possession-slots">
        {Array.from({ length: rounds }, (_, index) => {
          const round = index + 1;
          const owner = ownerForRound(round);
          const timing = round === currentRound ? "current" : round < currentRound ? "past" : "future";
          return (
            <span
              key={round}
              className={`possession-slot ${owner} ${timing}${round > matchRounds ? " extra-time" : ""}`}
              data-owner={owner}
              data-round={round}
              role="listitem"
              aria-label={`Round ${round}: ${owner === "you" ? "your ball" : "their ball"}`}
              aria-current={round === currentRound ? "step" : undefined}
            >
              <span className="possession-pill">{round}</span>
              {round > matchRounds && <span className="possession-extra-time-tag">ET</span>}
              {round === currentRound && (
                <span className="possession-now">{owner === "you" ? "YOUR BALL" : "THEIR BALL"}</span>
              )}
            </span>
          );
        })}
      </div>
      <span className="possession-legend">
        <b><span className="possession-legend-pill you">1</span> you</b>
        <b><span className="possession-legend-pill them">2</span> them</b>
      </span>
    </div>
  );
}

export function handoverForRoundStart(
  events: readonly GameEvent[],
  previousOwner: PossessionOwner,
): PossessionHandover | null {
  const roundStart = [...events].reverse().find(
    (event): event is Extract<GameEvent, { type: "ROUND_START" }> => event.type === "ROUND_START",
  );
  if (!roundStart || roundStart.round <= 1) return null;
  const owner = ownerForRound(roundStart.round);
  if (owner === previousOwner) return null;
  return owner === "them"
    ? {
        round: roundStart.round,
        owner,
        title: `ROUND ${roundStart.round} — THEIR BALL`,
        subtitle: "Commit tackles or stand off",
      }
    : {
        round: roundStart.round,
        owner,
        title: `ROUND ${roundStart.round} — YOUR BALL`,
        subtitle: "Build the chance",
      };
}

export function HandoverBanner({ handover }: { handover: PossessionHandover }) {
  return (
    <div className={`possession-handover ${handover.owner}`} data-testid="possession-handover" aria-live="polite">
      <strong>{handover.title}</strong>
      <span>{handover.subtitle}</span>
    </div>
  );
}

export interface DockedPlay {
  uid: string;
  dieIndex: number;
}

interface RunDockedPlayOptions {
  queue: readonly DockedPlay[];
  initialMatch: DiceMatchState;
  getLatestMatch: () => DiceMatchState | null;
  dispatch: (action: DiceMatchAction) => void;
  thenShoot?: boolean;
  thenEndRound?: boolean;
  isRunning?: () => boolean;
  schedule?: (callback: () => void, delay: number) => unknown;
  onFinish?: () => void;
}

function canShootAfterDockFlush(match: DiceMatchState, startRound: number): boolean {
  return (
    match.phase === "ROUND_ACTIVE" &&
    match.possession === "you" &&
    match.round === startRound &&
    match.passes >= 1
  );
}

function canEndRoundAfterDockFlush(match: DiceMatchState, startRound: number): boolean {
  return (
    match.phase === "ROUND_ACTIVE" &&
    match.possession === "you" &&
    match.round === startRound
  );
}

export function runDockedPlay({
  queue,
  initialMatch,
  getLatestMatch,
  dispatch,
  thenShoot = false,
  thenEndRound = false,
  isRunning = () => true,
  schedule = (callback, delay) => setTimeout(callback, delay),
  onFinish = () => undefined,
}: RunDockedPlayOptions): void {
  const startRound = initialMatch.round;
  let finished = false;

  const finish = (previous: DiceMatchState, allowShot: boolean) => {
    if (finished) return;
    finished = true;
    const current = getLatestMatch() ?? previous;
    if (allowShot && thenShoot && canShootAfterDockFlush(current, startRound)) {
      dispatch({ type: "SHOOT" });
    } else if (allowShot && thenEndRound && canEndRoundAfterDockFlush(current, startRound)) {
      dispatch({ type: "END_ROUND" });
    }
    onFinish();
  };

  const step = (index: number, previous: DiceMatchState) => {
    if (!isRunning()) {
      finish(previous, false);
      return;
    }
    if (index >= queue.length) {
      finish(previous, true);
      return;
    }

    const current = getLatestMatch() ?? previous;
    if (current.round !== startRound || current.phase !== "ROUND_ACTIVE") {
      finish(current, false);
      return;
    }

    const play = queue[index]!;
    const die = current.dice[play.dieIndex];
    const inHand = current.hand.some((card) => card.uid === play.uid);
    if (!die || die.used || !inHand) {
      step(index + 1, current);
      return;
    }

    dispatch({ type: "ASSIGN_DIE", uid: play.uid, dieIndex: play.dieIndex });
    schedule(() => step(index + 1, current), 700);
  };

  step(0, initialMatch);
}

export function shootButtonDisabled(
  match: Pick<DiceMatchState, "corner" | "possession" | "passes">,
  dockedCount: number,
  running: boolean,
  tutorialAllowed: boolean,
): boolean {
  return (
    running ||
    match.corner ||
    match.possession !== "you" ||
    (dockedCount === 0 && match.passes < 1) ||
    !tutorialAllowed
  );
}

export function shootButtonLabel(
  match: Pick<DiceMatchState, "possession" | "passes">,
  dockedCount: number,
  shotProbability: number,
): string {
  if (dockedCount > 0) {
    return `⚽ Play & Shoot (${dockedCount}) — ${Math.round(shotProbability * 100)}%`;
  }
  return `⚽ Shoot — ${Math.round(shotProbability * 100)}%${
    match.possession === "you" && match.passes < 1 ? " — make a pass first" : ""
  }`;
}

export function recycleButtonLabel(
  match: Pick<DiceMatchState, "corner" | "possession">,
  dockedCount: number,
): string {
  if (match.corner) return "Clear it";
  if (match.possession === "you" && dockedCount > 0) return `↩ Play & Recycle (${dockedCount})`;
  return "↩ Recycle possession";
}

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

function GoalFrame() {
  return (
    <svg viewBox="0 0 26 44" aria-hidden="true">
      <path d="M24 2 H6 V42 H24" strokeWidth="2.5" />
      <path d="M6 8 H20 M6 15 H20 M6 22 H20 M6 29 H20 M6 36 H20" strokeWidth="0.8" opacity="0.55" />
      <path d="M10 2 V42 M15 2 V42 M20 2 V42" strokeWidth="0.8" opacity="0.55" />
    </svg>
  );
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
      <div className="goal-end goal-end--yours"><GoalFrame /></div>
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
      <div className="goal-end goal-end--theirs"><GoalFrame /></div>
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
      return `${e.cardName}: pass ${e.passes}, +${e.chanceGained} Chance, pressure ${pressureOf(e.risked)} (${Math.round(e.risked * 100)}%).`;
    }
    case "PASS_CHALLENGED":
      return `Pressure roll: ${e.roll} vs ${e.pressure} — ${e.survived ? "safe" : "TACKLED"}.`;
    case "OPP_PASS_CHALLENGED":
      return `Their pressure roll: ${e.roll} vs ${e.pressure} — ${e.survived ? "safe" : "picked off"}.`;
    case "OPP_PASS":
      return `Their pass ${e.passes}: ${e.oppChance} Chance, pressure ${pressureOf(e.risk)} (${Math.round(e.risk * 100)}%).`;
    case "DEFENSE_COMMITTED":
      return `${e.cardName} (${e.die}): +${Math.round(e.amount * 100)}% defense, total +${Math.round(e.total * 100)}%.`;
    case "CHAIN_INTERCEPTED":
      return e.byYou
        ? `Won the interception after ${e.passes} passes.`
        : `Tackled after ${e.passes} passes; lost ${e.chanceLost} Chance.`;
    case "COUNTER_SHOT":
      return `${e.byYou ? "Your" : "Their"} counter: d20 ${e.roll} + ${e.bonus} vs ${e.dc} = ${e.goal ? "goal" : "saved"}.`;
    case "SHOT_TAKEN":
      return `${e.corner ? "Corner header" : "Shot"}: d20 ${e.roll} + ${e.quality} vs ${e.dc} = ${e.goal ? "goal" : "saved"}.`;
    case "CORNER_EARNED":
      return `Parried out! Corner — missed by ${e.margin}.`;
    case "KEEPER_RATTLED":
      return "The keeper's rattled — -2 DC on your next shot.";
    case "OPP_SHOT":
      return `Their shot: d20 ${e.roll} + ${e.danger} vs ${e.dc} = ${e.goal ? "goal" : "saved"}.`;
    case "GOAL_SCORED":
      return e.goals > 0 ? `Goal for you. Score ${e.total}.` : `They score. Their total ${e.total}.`;
    case "DIE_REROLLED":
      return `Rerolled die ${e.dieIndex + 1}: ${e.from} -> ${e.to}.`;
    case "DICE_CARRIED": {
      const values = e.values.map((value) => `a ${value}`);
      const list = values.length === 1 ? values[0] : `${values.slice(0, -1).join(", ")} and ${values.at(-1)}`;
      return `Fresh legs: carried ${list}.`;
    }
    case "SUDDEN_DEATH_START":
      return "EXTRA TIME — next goal wins.";
    case "MATCH_END":
      return `FULL TIME — ${e.playerGoals}-${e.oppGoals}.`;
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
  return new Set(
    [...COACH_TIP_KEYS, ...SET_PIECE_COACH_TIP_KEYS].filter(
      (key) => localStorage.getItem(coachStorageKey(key)) === "1",
    ),
  );
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
  die?: number; // the die spent on this pass — the receipt
}

interface DraggingDie {
  dieIndex: number;
  value: number;
  pointerId: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  moved: boolean;
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
  const [handover, setHandover] = useState<PossessionHandover | null>(null);
  const [puntPressed, setPuntPressed] = useState(false);
  const [draggingDie, setDraggingDie] = useState<DraggingDie | null>(null);
  const dragRef = useRef<DraggingDie | null>(null);
  const suppressDieClickRef = useRef(false);

  // A fresh roll remounts the dice so they cascade in; a reroll spins the one die.
  const [rollKey, setRollKey] = useState(0);
  const [celebration, setCelebration] = useState<"goal" | "concede" | null>(null);
  // Call the play: dice dock onto cards (pure UI), then RUN executes the sequence.
  const [docked, setDocked] = useState<DockedPlay[]>([]);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const [rerollFx, setRerollFx] = useState<{ i: number; lucky: boolean; n: number } | null>(null);
  const fxNonce = useRef(0);
  const [displayBall, setDisplayBall] = useState(m.ball);
  const ballTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const handoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ballCleanupGenerationRef = useRef(0);
  const lastBatchRef = useRef<GameEvent[] | null>(null);
  const previousPossessionRef = useRef<PossessionOwner>(m.possession);
  const latestMatchRef = useRef<DiceMatchState | null>(null);
  latestMatchRef.current = m;
  useEffect(() => {
    // StrictMode immediately cleans up and re-runs mount effects. Defer the
    // clear so that rehearsal does not cancel the one guarded replay batch.
    const generation = ++ballCleanupGenerationRef.current;
    return () => {
      queueMicrotask(() => {
        if (ballCleanupGenerationRef.current !== generation) return;
        ballTimersRef.current.forEach(clearTimeout);
        ballTimersRef.current = [];
        if (handoverTimerRef.current) clearTimeout(handoverTimerRef.current);
        handoverTimerRef.current = null;
      });
    };
  }, []);
  useEffect(() => {
    // StrictMode double-runs mount effects with the SAME events array; appending
    // twice duplicated ticker/chip entries. Process each event batch exactly once.
    if (lastBatchRef.current === events) return;
    lastBatchRef.current = events;
    ballTimersRef.current.forEach(clearTimeout);
    ballTimersRef.current = [];
    const stagedEvents = stageEvents(events);
    for (const { delay, event } of stagedEvents) {
      if (event.type === "BALL_MOVED") {
        ballTimersRef.current.push(setTimeout(() => setDisplayBall(event.ball), delay));
      } else if (event.type === "COUNTER_SHOT") {
        const counterBall = event.byYou ? m.bal.DICE.THEIR_BOX + 2 : m.bal.DICE.YOUR_BOX - 2;
        ballTimersRef.current.push(setTimeout(() => setDisplayBall(counterBall), delay));
      }
    }
    const finalStage = stagedEvents.at(-1);
    if (finalStage) {
      ballTimersRef.current.push(
        setTimeout(() => {
          const latestMatch = latestMatchRef.current;
          if (latestMatch) setDisplayBall(latestMatch.ball);
        }, finalStage.delay + 800),
      );
    }
    const nextLines = events.map(eventLine).filter((line): line is string => line !== null);
    if (nextLines.length > 0) setTickerLines((prev) => [...nextLines.reverse(), ...prev].slice(0, 8));
    const goalEv = events.find((e): e is Extract<GameEvent, { type: "GOAL_SCORED" }> => e.type === "GOAL_SCORED");
    if (goalEv) {
      setCelebration(goalEv.goals > 0 ? "goal" : "concede");
      setTimeout(() => setCelebration(null), 1800);
    }
    if (events.some((e) => e.type === "DICE_ROLLED")) {
      fxNonce.current += 1;
      setRollKey(fxNonce.current);
      setSelectedDie(null);
    }
    if (events.some((e) => e.type === "ROUND_START")) {
      chainRef.current = [];
      setDocked([]);
    }
    const nextHandover = handoverForRoundStart(events, previousPossessionRef.current);
    previousPossessionRef.current = m.possession;
    if (nextHandover) {
      if (handoverTimerRef.current) clearTimeout(handoverTimerRef.current);
      setHandover(nextHandover);
      handoverTimerRef.current = setTimeout(() => {
        setHandover(null);
        handoverTimerRef.current = null;
      }, 1100);
    }
    if (events.some((e) => e.type === "CORNER_EARNED")) {
      setDocked((prev) => prev.slice(0, 1));
    }
    const completed = events.filter((e): e is Extract<GameEvent, { type: "PASS_COMPLETED" }> => e.type === "PASS_COMPLETED");
    if (completed.length > 0) {
      const dieByUid = new Map(
        events.filter((e): e is Extract<GameEvent, { type: "DIE_ASSIGNED" }> => e.type === "DIE_ASSIGNED").map((e) => [e.uid, e.die]),
      );
      chainRef.current = [
        ...chainRef.current,
        ...completed.map((e) => ({
          uid: e.uid,
          cardName: e.cardName,
          passes: e.passes,
          chanceGained: e.chanceGained,
          risked: e.risked,
          combo: e.combo,
          die: dieByUid.get(e.uid),
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
  const pressureNow = pressureOf(riskNow);
  const theirPressure = pressureOf(theirRisk);
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
  const activeDieIndex = draggingDie?.dieIndex ?? (selectedDie !== null && !m.dice[selectedDie]?.used ? selectedDie : null);
  const dropInfo = activeDieIndex !== null ? dieDropInfo(content.defs, m, activeDieIndex, tutorial?.step.lock) : null;
  const dragTargets = dropInfo
    ? new Set(
        [...dropInfo]
          .filter(([, status]) => status === "ok")
          .map(([uid]) => uid),
      )
    : null;

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
          comboTriggered: events.some((e) => e.type === "PASS_COMPLETED" && Boolean(e.combo)),
          corner: m.corner,
          keeperRattled: m.keeperRattled,
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

  const dockDie = (uid: string, dieIndex: number) => {
    setDocked((d) => {
      const next = [...d.filter((x) => x.uid !== uid && x.dieIndex !== dieIndex), { uid, dieIndex }];
      return m.corner ? next.slice(-1) : next;
    });
    setSelectedDie(null);
  };

  const undock = (uid: string) => setDocked((d) => d.filter((x) => x.uid !== uid));

  const onCardClick = (uid: string, defId: string) => {
    if (running) return;
    if (!tutorialAllows({ kind: "playCard", defId })) return;
    if (docked.some((x) => x.uid === uid)) {
      undock(uid); // tap a docked card to take the die back
      return;
    }
    const slot = content.defs[defId]!.slot!;
    let dieIndex = selectedDie;
    if (dieIndex === null || m.dice[dieIndex]?.used || !dieFitsSlot(m.dice[dieIndex]!.value, slot)) {
      if (!tutorial) return; // dice-first: pick up or select a die before touching a card
      // tutorial keeps the guided instant play so locked steps stay one click
      dieIndex = bestDieFor(content.defs, m, uid);
      if (dieIndex < 0) return;
      act({ type: "ASSIGN_DIE", uid, dieIndex });
      setSelectedDie(null);
      return;
    }
    dockDie(uid, dieIndex);
  };

  // Execute the docked sequence; stop early if the possession/round ends.
  const runPlay = ({
    thenShoot = false,
    thenEndRound = false,
  }: { thenShoot?: boolean; thenEndRound?: boolean } = {}) => {
    if (running || docked.length === 0) return;
    runningRef.current = true;
    setRunning(true);
    const queue = [...docked];
    setDocked([]);
    runDockedPlay({
      queue,
      initialMatch: m,
      getLatestMatch: () => latestMatchRef.current,
      dispatch: (action) => {
        if (action.type === "SHOOT" && (latestMatchRef.current ?? m).shotQuality === 0) {
          setPuntPressed(true);
        }
        act(action);
      },
      thenShoot,
      thenEndRound,
      isRunning: () => runningRef.current,
      onFinish: () => {
        runningRef.current = false;
        setRunning(false);
      },
    });
  };

  const onDiePointerDown = (e: PointerEvent<HTMLButtonElement>, dieIndex: number, value: number) => {
    if (m.dice[dieIndex]?.used) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // synthetic pointers (tests) and some browsers can't capture — dragging
      // still works because move/up handlers live on the die itself
    }
    const next = {
      dieIndex,
      value,
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
    dragRef.current = next;
    setDraggingDie(next);
  };

  const onDiePointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const active = dragRef.current;
    if (!active || active.pointerId !== e.pointerId) return;
    const moved = active.moved || Math.hypot(e.clientX - active.startX, e.clientY - active.startY) > 4;
    const next = { ...active, x: e.clientX, y: e.clientY, moved };
    dragRef.current = next;
    setDraggingDie(next);
  };

  const onDiePointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    const active = dragRef.current;
    if (!active || active.pointerId !== e.pointerId) return;
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const uid = target instanceof HTMLElement ? target.closest<HTMLElement>("[data-uid]")?.dataset.uid : undefined;
    if (uid && dragTargets?.has(uid) && !running) {
      suppressDieClickRef.current = true;
      if (!tutorial) {
        if (docked.some((x) => x.uid === uid)) undock(uid);
        dockDie(uid, active.dieIndex);
      } else {
        act({ type: "ASSIGN_DIE", uid, dieIndex: active.dieIndex });
        setSelectedDie(null);
      }
    } else if (active.moved) {
      suppressDieClickRef.current = true;
      setSelectedDie(null);
    }
    dragRef.current = null;
    setDraggingDie(null);
  };

  const onDiePointerCancel = (e: PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId !== e.pointerId) return;
    suppressDieClickRef.current = dragRef.current.moved;
    dragRef.current = null;
    setDraggingDie(null);
  };

  const shootDisabled = shootButtonDisabled(
    m,
    docked.length,
    running,
    tutorialAllows({ kind: "shoot" }),
  );
  const endRoundDisabled = running || !tutorialAllows({ kind: "endRound" });
  const shotIfPlayed = docked.length > 0 ? projectedShotEstimate(content.defs, m, docked) : shotNow;
  const shootLabel = shootButtonLabel(m, docked.length, shotIfPlayed.p);
  const recycleLabel = recycleButtonLabel(m, docked.length);
  const bankingDice =
    m.possession === "them" ? Math.min(m.bal.DICE.CARRY_MAX, m.dice.filter((die) => !die.used).length) : 0;

  return (
    <main className={`board${m.possession === "them" ? " mode-defending" : ""}`}>
      <ScorePopups events={events} />
      {handover && <HandoverBanner handover={handover} />}
      {celebration === "goal" && (
        <div className="confetti-layer celebration" aria-hidden="true">
          {Array.from({ length: 36 }, (_, i) => (
            <span
              key={i}
              className="confetti"
              style={{
                left: `${(i * 137) % 100}%`,
                background: ["#ffd34d", "#4dd07a", "#f2efe6", "#6ec3ff"][i % 4],
                animationDuration: `${1 + ((i * 7) % 10) / 10}s`,
                animationDelay: `${((i * 13) % 6) / 10}s`,
              }}
            />
          ))}
        </div>
      )}
      {celebration === "concede" && <div className="concede-flash" aria-hidden="true" />}

      <div className="scoreboard panel">
        <div>
          <div className="score" data-testid="scoreline">
            {playerName} {m.playerGoals} — {m.oppGoals} {m.opp.name}
          </div>
          <div className="opp-blurb" data-testid="opp-panel">
            tier {m.opp.tier} · coach {coach} · <strong>{style.name}</strong> · keeper DC {dcNow}
            {m.keeperRattled && (
              <span className="rattled-badge" data-testid="rattled-badge">
                keeper rattled -2
              </span>
            )}
          </div>
        </div>
        <div className="match-round-header">
          {m.phase === "DONE" && <div data-testid="match-status">FULL TIME</div>}
          <PossessionStrip currentRound={m.round} matchRounds={m.bal.MATCH_ROUNDS} />
        </div>
      </div>

      <PitchTrack ball={displayBall} possession={m.possession} bal={m.bal} />

      {m.corner && (
        <div className="corner-banner panel" data-testid="corner-banner">
          <strong>CORNER!</strong> One delivery — make it count
        </div>
      )}

      <div className="dice-stat-row">
        <span className="shotq-badge" data-testid="shot-quality">
          Chance {m.shotQuality}
        </span>
        <span className="shotq-badge" data-testid="passes">
          Passes {m.possession === "you" ? m.passes : m.oppPasses}
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
                  {chip.die !== undefined && <span className="chip-die">{PIPS[chip.die]}</span>}
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
                pressure {pressureNow} ({Math.round(riskNow * 100)}%)
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
          <span className="their-shot-odds" data-testid="their-shot-odds" title="if their chain finished right now">
            their shot ~{Math.round(oppShotEstimate(m).p * 100)}%
          </span>
          <span>Committed +{Math.round(m.defenseCommit * 100)}%</span>
          <span data-testid="fresh-legs-bank">banking {bankingDice} dice</span>
          <span className="risk-badge" data-hot={theirRisk >= 0.3 ? "true" : "false"}>
            pressure {theirPressure} ({Math.round(theirRisk * 100)}%)
          </span>
          <span className="chain-status" data-testid="chain-status">{chainStatus}</span>
        </div>
      )}

      <ChainGlossary />
      <MatchTicker lines={tickerLines} />
      {tutorial && <TutorialOverlay tutorial={tutorial} />}

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
                className={`die${d.used ? " used" : ""}${d.carried ? " carried" : ""}${docked.some((x) => x.dieIndex === i) ? " docked" : ""}${selectedDie === i ? " selected" : ""}${draggingDie?.dieIndex === i ? " dragging" : ""}${rerolled ? " rerolled" : ""}${rerolled && rerollFx.lucky ? " lucky" : ""}`}
                style={{ animationDelay: rerolled ? "0ms" : `${i * 55}ms` }}
                data-testid={`die-${i}`}
                data-value={d.value}
                data-used={d.used ? "true" : "false"}
                data-carried={d.carried ? "true" : "false"}
                disabled={d.used}
                onClick={() => {
                  if (suppressDieClickRef.current) {
                    suppressDieClickRef.current = false;
                    return;
                  }
                  setSelectedDie(selectedDie === i ? null : i);
                }}
                onPointerDown={(e) => onDiePointerDown(e, i, d.value)}
                onPointerMove={onDiePointerMove}
                onPointerUp={onDiePointerUp}
                onPointerCancel={onDiePointerCancel}
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
                  : "pick up a die — it lights the cards it can play. Dock, then choose the ending."}
            </span>
          </div>

          <div className="dice-hand" data-testid="hand">
            {m.hand.map((c) => {
              const def = content.defs[c.defId]!;
              const cardHighlighted = tutorialHighlights({ kind: "playCard", defId: def.id });
              const cardPlayable = canPlay(c.uid) && tutorialAllows({ kind: "playCard", defId: def.id });
              const dropStatus = dropInfo?.get(c.uid);
              const dropClass = dropInfo
                ? dropStatus === "ok"
                  ? " drop-ok"
                  : dropStatus === "locked"
                    ? " drop-locked"
                    : " drop-dim"
                : "";
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
                  className={`dice-card role-${role}${cardPlayable ? "" : " unplayable"}${cardHighlighted ? " tutorial-highlight" : ""}${dropClass}`}
                  data-testid={`card-${def.id}`}
                  data-uid={c.uid}
                  data-rarity={def.rarity}
                  data-playable={cardPlayable ? "true" : "false"}
                  disabled={!cardPlayable}
                  onClick={() => onCardClick(c.uid, def.id)}
                >
                  {(() => {
                    const dock = docked.find((x) => x.uid === c.uid);
                    return dock !== undefined && m.dice[dock.dieIndex] ? (
                      <span className="docked-die" title="tap to take the die back">
                        {PIPS[m.dice[dock.dieIndex]!.value]}
                      </span>
                    ) : null;
                  })()}
                  <span className="dice-card-slot">{def.slot ? slotLabel(def.slot) : "—"}</span>
                  <span className="dice-card-name">{def.name}</span>
                  {liveCombo && <span className="combo-tag card-combo">combo</span>}
                  <span className="dice-card-text">{def.levels[Math.min(c.level, def.levels.length - 1)]!.text}</span>
                  {dropStatus === "locked" && (
                    <span className="drop-lock-badge">
                      {defense ? "🔒 Waits for their possession" : "🔒 Win the ball back first"}
                    </span>
                  )}
                  {/* pressure is per-pass, not per-card — it lives once in the status row */}
                </button>
              );
            })}
          </div>

          {draggingDie && (
            <div
              className="die die-drag-ghost"
              style={{ transform: `translate3d(${draggingDie.x - 24}px, ${draggingDie.y - 24}px, 0)` }}
              aria-hidden="true"
            >
              <span className="die-pip">{PIPS[draggingDie.value]}</span>
              <span className="die-num">{draggingDie.value}</span>
            </div>
          )}

          <div className="action-bar">
            {!tutorial && (m.corner || m.possession === "them") && (
              <button
                type="button"
                className="btn btn--primary dock-runner"
                data-testid={m.corner ? "run-play" : "commit-defense"}
                disabled={docked.length === 0 || running}
                onClick={() => runPlay()}
              >
                {m.corner
                  ? "▶ Take the corner"
                  : running
                  ? "Running…"
                  : `🛡 Commit defense (${docked.length})`}
              </button>
            )}
            {m.possession === "you" && !m.corner && (
              <button
                type="button"
                className={`btn btn--primary${tutorialHighlights({ kind: "shoot" }) ? " tutorial-highlight" : ""}`}
                data-testid="shoot"
                data-hot={!shootDisabled && shotIfPlayed.p >= 0.6 ? "true" : "false"}
                data-cold={!shootDisabled && shotIfPlayed.p < 0.35 ? "true" : "false"}
                disabled={shootDisabled}
                title="Roll a d20 + Chance vs the keeper's DC"
                onClick={() => {
                  if (docked.length > 0) {
                    runPlay({ thenShoot: true });
                    return;
                  }
                  if (m.shotQuality === 0) setPuntPressed(true);
                  act({ type: "SHOOT" });
                }}
              >
                {shootLabel}
              </button>
            )}
            <button
              type="button"
              className={`btn btn--danger${tutorialHighlights({ kind: "endRound" }) ? " tutorial-highlight" : ""}`}
              data-testid="end-round"
              disabled={endRoundDisabled}
              onClick={() => {
                if (m.possession === "you" && !m.corner && docked.length > 0) {
                  runPlay({ thenEndRound: true });
                  return;
                }
                act({ type: "END_ROUND" });
              }}
            >
              {m.possession === "them" ? `Stand off (bank ${bankingDice})` : recycleLabel}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
