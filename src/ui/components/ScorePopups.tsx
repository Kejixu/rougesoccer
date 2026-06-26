// Event-driven juice: turns the engine's event log into staged popups —
// the Balatro "power × mult = value → GOAL!" moment.

import { useEffect, useRef, useState } from "react";
import type { GameEvent } from "../../core/types";

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

let nextId = 1;

export function ScorePopups({ events }: { events: GameEvent[] }) {
  const [popups, setPopups] = useState<(Popup & { node?: React.ReactNode })[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const staged: { delay: number; popup: Popup & { node?: React.ReactNode } }[] = [];
    let delay = 0;
    for (const e of events) {
      if (e.type === "SHOT_VALUE") {
        staged.push({
          delay,
          popup: { id: nextId++, kind: "info", text: `${e.playName}!` },
        });
        delay += 450;
        staged.push({
          delay,
          popup: {
            id: nextId++,
            kind: "shot",
            text: "",
            node: <CountUpValue base={e.basePower} mult={e.mult} value={e.value} />,
          },
        });
        delay += 550;
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
        delay += 900;
        if (!e.goal) {
          staged.push({
            delay,
            popup: { id: nextId++, kind: "concede", text: "🧤 SAVED" },
          });
          delay += 600;
        }
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
        delay += 900;
        staged.push({
          delay,
          popup: { id: nextId++, kind: e.goal ? "concede" : "info", text: e.goal ? "⚽ CONCEDED" : "🧤 SAVED!" },
        });
        delay += 600;
      } else if (e.type === "GOAL_SCORED" && e.goals > 0) {
        staged.push({
          delay,
          popup: { id: nextId++, kind: "goal", text: e.goals > 1 ? `⚽ ${e.goals} GOALS!` : "⚽ GOAL!" },
        });
        delay += 650;
      } else if (e.type === "INTENT_EXECUTED") {
        if (e.blocked > 0 && e.points === 0) {
          staged.push({
            delay,
            popup: { id: nextId++, kind: "info", text: `Blocked! 🛡 ${e.blocked}` },
          });
          delay += 500;
        } else if (e.points > 0) {
          staged.push({
            delay,
            popup: {
              id: nextId++,
              kind: "concede",
              text: e.intent.kind === "counter" ? `Countered! +${e.points}` : `They push +${e.points}`,
            },
          });
          delay += 500;
        }
      } else if (e.type === "ET_SURVIVED") {
        staged.push({
          delay,
          popup: { id: nextId++, kind: "info", text: `Survived! +${e.budget} budget, +${e.scout} scout` },
        });
        delay += 600;
      } else if (e.type === "SHOOTOUT") {
        staged.push({
          delay,
          popup: {
            id: nextId++,
            kind: e.won ? "goal" : "concede",
            text: `Shootout ${e.playerRoll}-${e.oppRoll}: ${e.won ? "WON!" : "lost"}`,
          },
        });
        delay += 800;
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
