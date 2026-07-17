// Event-driven juice: turns the engine's event log into staged popups —
// the Balatro "power × mult = value → GOAL!" moment.

import { useEffect, useRef, useState } from "react";
import type { GameEvent } from "../../core/types";
import { stageEvents } from "../eventTimeline";

interface Popup {
  id: number;
  kind: "shot" | "goal" | "concede" | "info";
  text: string;
}

function CountUpValue({ base, mult, value }: { base: number; mult: number; value: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const D = 450;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / D);
      setShown(Math.round(value * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <>
      {base} × {mult.toFixed(2).replace(/\.?0+$/, "")} = {shown}
    </>
  );
}

// The shot is the climax: a d20 that spins like a slot reel, lands on the roll,
// then reveals roll + quality vs the keeper's DC.
function ShotRoll({ roll, quality, dc }: { roll: number; quality: number; dc: number }) {
  const [shown, setShown] = useState(1);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const D = 650;
    let lastSwap = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / D);
      if (k < 1) {
        // slow the reel as it settles
        const gap = 45 + 120 * k * k;
        if (t - lastSwap >= gap) {
          setShown(1 + Math.floor((t * 9301 + 49297) % 20));
          lastSwap = t;
        }
        raf = requestAnimationFrame(tick);
      } else {
        setShown(roll);
        setSettled(true);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [roll]);
  const total = roll + quality;
  const beat = total >= dc;
  return (
    <span className={settled ? (beat ? "shot-hit" : "shot-miss") : "shot-spin"}>
      🎲 {shown}
      {settled && (
        <>
          {" "}
          + {quality} = <strong>{total}</strong> vs {dc}
        </>
      )}
    </span>
  );
}

function PressureRoll({ roll, pressure, survived }: { roll: number; pressure: number; survived: boolean }) {
  const [shown, setShown] = useState(1);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const D = 450;
    let lastSwap = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / D);
      if (k < 1) {
        const gap = 35 + 80 * k * k;
        if (t - lastSwap >= gap) {
          setShown(1 + Math.floor((t * 9301 + 49297) % 20));
          lastSwap = t;
        }
        raf = requestAnimationFrame(tick);
      } else {
        setShown(roll);
        setSettled(true);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [roll]);
  return (
    <span className={settled ? (survived ? "shot-hit" : "shot-miss") : "shot-spin"}>
      🎲 {shown}
      {settled && (
        <>
          {" "}
          vs pressure {pressure} — {survived ? "held off" : "tackled"}
        </>
      )}
    </span>
  );
}

let nextId = 1;

export function ScorePopups({ events }: { events: GameEvent[] }) {
  const [popups, setPopups] = useState<(Popup & { node?: React.ReactNode })[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const staged: { delay: number; popup: Popup & { node?: React.ReactNode } }[] = [];
    for (const { delay, event: e } of stageEvents(events)) {
      if (e.type === "SHOT_VALUE") {
        staged.push({
          delay,
          popup: { id: nextId++, kind: "info", text: `${e.playName}!` },
        });
        staged.push({
          delay: delay + 450,
          popup: {
            id: nextId++,
            kind: "shot",
            text: "",
            node: <CountUpValue base={e.basePower} mult={e.mult} value={e.value} />,
          },
        });
      } else if (e.type === "SHOT_TAKEN") {
        staged.push({
          delay,
          popup: {
            id: nextId++,
            kind: "shot",
            text: "",
            node: <ShotRoll roll={e.roll} quality={e.quality} dc={e.dc} />,
          },
        });
        if (!e.goal) {
          staged.push({
            delay: delay + 900,
            popup: { id: nextId++, kind: "concede", text: "🧤 SAVED" },
          });
        }
      } else if (e.type === "PASS_CHALLENGED" || e.type === "OPP_PASS_CHALLENGED") {
        staged.push({
          delay,
          popup: {
            id: nextId++,
            kind: e.survived ? "info" : "concede",
            text: "",
            node: <PressureRoll roll={e.roll} pressure={e.pressure} survived={e.survived} />,
          },
        });
      } else if (e.type === "CORNER_EARNED") {
        staged.push({
          delay,
          popup: { id: nextId++, kind: "info", text: "CORNER!" },
        });
      } else if (e.type === "KEEPER_RATTLED") {
        staged.push({
          delay,
          popup: { id: nextId++, kind: "info", text: "The keeper's rattled!" },
        });
      } else if (e.type === "OPP_SHOT") {
        staged.push({
          delay,
          popup: {
            id: nextId++,
            kind: e.goal ? "concede" : "info",
            text: "",
            node: <ShotRoll roll={e.roll} quality={e.danger} dc={e.dc} />,
          },
        });
        staged.push({
          delay: delay + 900,
          popup: { id: nextId++, kind: e.goal ? "concede" : "info", text: e.goal ? "⚽ CONCEDED" : "🧤 SAVED!" },
        });
      } else if (e.type === "GOAL_SCORED" && e.goals > 0) {
        staged.push({
          delay,
          popup: { id: nextId++, kind: "goal", text: e.goals > 1 ? `⚽ ${e.goals} GOALS!` : "⚽ GOAL!" },
        });
      } else if (e.type === "CHAIN_INTERCEPTED") {
        staged.push({
          delay,
          popup: { id: nextId++, kind: e.byYou ? "info" : "concede", text: e.byYou ? "🎯 WON IT!" : "🚫 TACKLED!" },
        });
      } else if (e.type === "COUNTER_SHOT") {
        staged.push({
          delay,
          popup: {
            id: nextId++,
            kind: e.byYou ? "shot" : "concede",
            text: "",
            node: <ShotRoll roll={e.roll} quality={e.bonus} dc={e.dc} />,
          },
        });
        staged.push({
          delay: delay + 900,
          popup: {
            id: nextId++,
            kind: e.goal ? (e.byYou ? "goal" : "concede") : "info",
            text: e.goal ? "⚡ COUNTER GOAL" : "🧤 SAVED",
          },
        });
      } else if (e.type === "SUDDEN_DEATH_START") {
        staged.push({
          delay,
          popup: { id: nextId++, kind: "info", text: "EXTRA TIME — next goal wins." },
        });
      } else if (e.type === "MATCH_END") {
        staged.push({
          delay,
          popup: { id: nextId++, kind: e.result === "win" ? "goal" : e.result === "loss" ? "concede" : "info", text: "FULL TIME" },
        });
      } else if (e.type === "SHOOTOUT") {
        staged.push({
          delay,
          popup: {
            id: nextId++,
            kind: e.won ? "goal" : "concede",
            text: `Shootout ${e.playerRoll}-${e.oppRoll}: ${e.won ? "WON!" : "lost"}`,
          },
        });
      }
    }
    for (const { delay: d, popup } of staged) {
      timers.current.push(
        setTimeout(() => {
          setPopups((p) => [...p, popup]);
          timers.current.push(
            setTimeout(() => setPopups((p) => p.filter((x) => x.id !== popup.id)), 1600),
          );
        }, d),
      );
    }
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [events]);

  if (popups.length === 0) return null;
  return (
    <div className="popup-layer" data-testid="popups">
      {popups.map((p) => (
        <div key={p.id} className={`popup ${p.kind}`}>
          {p.node ?? p.text}
        </div>
      ))}
    </div>
  );
}
