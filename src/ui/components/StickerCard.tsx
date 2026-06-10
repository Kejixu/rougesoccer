// The Panini sticker card. Portrait is a slot: an <img> when CardDef.portrait
// exists, otherwise a position-tinted silhouette — generated art drops in
// later with zero layout changes. Foil shine follows the pointer via --px/--py.

import { useCallback, useRef } from "react";
import { levelStats, type CardDef, type CardInstance, type Position } from "../../core/types";

const POSITION_TINTS: Record<Position | "tactic" | "moment", [string, string]> = {
  ST: ["#7e2c2c", "#c75450"],
  WG: ["#5a2c7e", "#9254c7"],
  MF: ["#2c5e3c", "#54a06b"],
  DF: ["#2c3f7e", "#5470c7"],
  GK: ["#7e5a2c", "#c79a54"],
  tactic: ["#3c4a44", "#6a7a72"],
  moment: ["#7e6a1c", "#d9b832"],
};

function Silhouette({ kind }: { kind: Position | "tactic" | "moment" }) {
  const [from, to] = POSITION_TINTS[kind];
  return (
    <svg viewBox="0 0 100 74" style={{ width: "100%", height: "100%" }} aria-hidden>
      <defs>
        <linearGradient id={`bg-${kind}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={to} />
          <stop offset="100%" stopColor={from} />
        </linearGradient>
      </defs>
      <rect width="100" height="74" fill={`url(#bg-${kind})`} />
      {kind === "tactic" ? (
        // chalkboard X's and O's
        <g stroke="#f5f1e3" strokeWidth="2.4" fill="none" opacity="0.85">
          <path d="M22 24 l12 12 M34 24 l-12 12" />
          <circle cx="62" cy="30" r="8" />
          <path d="M30 56 C 42 40, 58 60, 74 44" strokeDasharray="4 4" />
        </g>
      ) : kind === "moment" ? (
        <path
          d="M50 12 l8.5 17.2 19 2.8 -13.7 13.4 3.2 18.9 -17 -8.9 -17 8.9 3.2 -18.9 -13.7 -13.4 19 -2.8 z"
          fill="#f5f1e3"
          opacity="0.9"
        />
      ) : (
        // head and shoulders
        <g fill="#1c2520" opacity="0.88">
          <circle cx="50" cy="26" r="14" />
          <path d="M22 74 C 24 50, 40 44, 50 44 C 60 44, 76 50, 78 74 Z" />
        </g>
      )}
    </svg>
  );
}

export function StickerCard({
  def,
  inst,
  selected,
  disabled,
  onClick,
}: {
  def: CardDef;
  inst?: CardInstance;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const level = inst?.level ?? 0;
  const stats = levelStats(def, level);
  const power = (stats.power ?? 0) + (inst?.formPower ?? 0);
  const kind = def.position ?? (def.kind === "moment" ? "moment" : "tactic");

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--px", `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
    el.style.setProperty("--py", `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
  }, []);

  return (
    <button
      type="button"
      ref={ref}
      className="sticker"
      onClick={onClick}
      onPointerMove={onPointerMove}
      disabled={disabled}
      data-testid={`card-${def.id}`}
      data-rarity={def.rarity}
      data-selected={selected ? "true" : undefined}
      data-uid={inst?.uid}
      data-power={power}
      data-defense={stats.defense ?? 0}
    >
      <div className="sticker-frame">
        <div className="portrait-slot">
          {def.portrait ? <img src={def.portrait} alt="" /> : <Silhouette kind={kind} />}
        </div>
        <div className="name-bar">{def.name}</div>
        <div className="meta-row">
          <span className="position-badge">{def.position ?? def.kind}</span>
          {level > 0 && <span className="level-pips">{"★".repeat(level)}</span>}
        </div>
        <div className="stat-chips">
          {power > 0 && <span className="chip-power">⚽ {power}</span>}
          {(stats.defense ?? 0) > 0 && <span className="chip-defense">🛡 {stats.defense}</span>}
        </div>
        <div className="rules-text">{stats.text}</div>
        {inst?.fatigued && <div className="fatigue-strip">Tired</div>}
      </div>
      {def.rarity === "legendary" && <div className="legend-badge">★</div>}
      <div className="foil-layer" />
    </button>
  );
}
