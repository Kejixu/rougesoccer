import type { ThirdsVerdict } from "../../core/types";

export function ThirdsVerdictPanel({ verdict }: { verdict: ThirdsVerdict }) {
  const gd = verdict.gd > 0 ? `+${verdict.gd}` : String(verdict.gd);
  const rankSuffix = verdict.rank === 1 ? "st" : verdict.rank === 2 ? "nd" : verdict.rank === 3 ? "rd" : "th";
  return (
    <section
      className={`panel thirds-verdict ${verdict.through ? "through" : "out"}`}
      data-testid="thirds-verdict"
    >
      <span>Best thirds:</span> {verdict.points} pts, GD {gd} — ranked {verdict.rank}{rankSuffix} of 12. {" "}
      <strong>{verdict.through ? "Through." : "Out."}</strong>
    </section>
  );
}
