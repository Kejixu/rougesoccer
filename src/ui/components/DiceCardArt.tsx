import { slotLabel, type DieSlot, type Position } from "../../core/types";

export type DiceCardRole = "progress" | "finish" | "defend";

export function DiceCardRoleArt({ role }: { role: DiceCardRole }) {
  return (
    <svg
      className={`dice-card-art dice-card-art--${role}`}
      viewBox="0 0 150 126"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g className="dice-card-art-pattern">
        <rect x="8" y="8" width="134" height="110" rx="7" />
        <path d="M75 8V118 M8 63H142" />
        <circle cx="75" cy="63" r="17" />
        {role === "progress" && <path d="M18 105 C40 91 42 70 66 57 S106 39 132 18 M123 17 L133 17 L132 27" />}
        {role === "finish" && <path d="M20 102 Q76 102 127 26 M116 29 L129 24 L126 38" />}
        {role === "defend" && <path d="M18 27 L48 47 L72 29 M18 99 L48 79 L72 97" />}
      </g>
      <g className="dice-card-art-glyph">
        {role === "progress" && (
          <>
            <circle cx="23" cy="24" r="4" />
            <path d="M15 42 C19 32 29 34 33 24 M27 31 L37 37 M23 36 L17 47 M33 24 L41 20 M36 18 L42 20 L40 26" />
          </>
        )}
        {role === "finish" && (
          <>
            <path d="M13 43 V20 H39 V43 M13 25 H39 M18 20 V43 M25 20 V43 M32 20 V43" />
            <circle cx="18" cy="45" r="4" />
            <path d="M21 42 Q28 28 39 25" />
          </>
        )}
        {role === "defend" && (
          <>
            <path d="M26 16 L40 21 V31 C40 40 34 46 26 50 C18 46 12 40 12 31 V21 Z" />
            <path d="M18 33 L24 39 L35 25" />
          </>
        )}
      </g>
    </svg>
  );
}

export function DiceSlotGlyph({ slot }: { slot: DieSlot | undefined }) {
  const label = slot ? slotLabel(slot) : "—";
  return (
    <span
      className={`dice-card-slot dice-card-slot--${slot?.kind ?? "none"}`}
      aria-label={slot ? `Requires die ${label}` : "No die requirement"}
    >
      {slot?.kind === "parity" && slot.even && (
        <span className="dice-card-slot-pips" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => <i key={index} />)}
        </span>
      )}
      <span className="dice-card-slot-label">{label}</span>
    </span>
  );
}

const POSITION_DOT: Record<Position, { x: number; y: number }> = {
  GK: { x: 5, y: 12 },
  DF: { x: 12, y: 12 },
  MF: { x: 22, y: 12 },
  WG: { x: 31, y: 5 },
  ST: { x: 39, y: 12 },
};

export function DiceCardPosition({ position }: { position: Position }) {
  const dot = POSITION_DOT[position];
  return (
    <span className="dice-card-position" data-position={position} title={`${position} position`}>
      <svg viewBox="0 0 44 24" aria-hidden="true">
        <rect x="1" y="1" width="42" height="22" rx="2" />
        <path d="M22 1V23" />
        <circle cx="22" cy="12" r="4" />
        <circle className="dice-card-position-dot" cx={dot.x} cy={dot.y} r="2.5" />
      </svg>
      <span>{position}</span>
    </span>
  );
}

export function DiceCardUpgrade({ level }: { level: number }) {
  if (level <= 0) return null;
  return (
    <span className="dice-card-upgrade" data-upgrade-level={level} aria-label={`Upgrade level ${level}`}>
      {Array.from({ length: level }, (_, index) => (
        <span key={index} className="dice-card-upgrade-pip" aria-hidden="true">◆</span>
      ))}
    </span>
  );
}
