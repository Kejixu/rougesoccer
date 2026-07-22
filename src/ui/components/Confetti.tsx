/** Deterministic confetti (no rng — index math keeps renders stable).
 * "celebration" is the fast in-match goal burst; default is the slow
 * trophy-screen drift. */
export function Confetti({ variant }: { variant?: "celebration" }) {
  const fast = variant === "celebration";
  const colors = fast
    ? ["#ffd34d", "#4dd07a", "#f2efe6", "#6ec3ff"]
    : ["#ffd34d", "#4dd07a", "#6ec3ff", "#ff5d5d", "#f5f1e3"];
  const count = fast ? 36 : 60;
  return (
    <div className={`confetti-layer${fast ? " celebration" : ""}`} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="confetti"
          style={{
            left: `${(i * (fast ? 137 : 137.5)) % 100}%`,
            background: colors[i % colors.length],
            animationDelay: fast ? `${((i * 13) % 6) / 10}s` : `${(i % 12) * 0.28}s`,
            animationDuration: fast ? `${1 + ((i * 7) % 10) / 10}s` : `${2.4 + ((i * 7) % 10) / 6}s`,
          }}
        />
      ))}
    </div>
  );
}
