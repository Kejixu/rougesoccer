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
      } else if (e.type === "GOAL_SCORED") {
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
