// Skeleton card display — becomes StickerCard in M4. The portrait slot and
// layout contract are already in place so the sticker styling drops in.

import { levelStats, type CardDef, type CardInstance } from "../../core/types";

export function CardView({
  def,
  inst,
  selected,
  onClick,
}: {
  def: CardDef;
  inst?: CardInstance;
  selected?: boolean;
  onClick?: () => void;
}) {
  const level = inst?.level ?? 0;
  const stats = levelStats(def, level);
  const power = (stats.power ?? 0) + (inst?.formPower ?? 0);
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`card-${def.id}`}
      data-rarity={def.rarity}
      data-uid={inst?.uid}
      data-power={power}
      data-defense={stats.defense ?? 0}
      style={{
        border: selected ? "2px solid var(--accent)" : "1px solid #444",
        background: "var(--surface)",
        color: "var(--ink)",
        borderRadius: 8,
        padding: 8,
        width: 130,
        textAlign: "left",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={{ fontWeight: 700 }}>
        {def.name}
        {level > 0 ? ` ${"★".repeat(level)}` : ""}
      </div>
      <div style={{ fontSize: 11, color: "var(--ink-dim)" }}>
        {def.position ?? def.kind} · {def.rarity}
        {inst?.fatigued ? " · tired" : ""}
      </div>
      <div style={{ fontSize: 12 }}>
        {power > 0 ? `⚽ ${power} ` : ""}
        {stats.defense ? `🛡 ${stats.defense}` : ""}
      </div>
      <div style={{ fontSize: 11, color: "var(--ink-dim)" }}>{stats.text}</div>
    </button>
  );
}
