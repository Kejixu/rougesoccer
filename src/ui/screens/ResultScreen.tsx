import type { ContentBundle, RunState } from "../../core/types";

function Confetti() {
  const COLORS = ["#ffd34d", "#4dd07a", "#6ec3ff", "#ff5d5d", "#f5f1e3"];
  return (
    <div className="confetti-layer" aria-hidden>
      {Array.from({ length: 60 }, (_, i) => (
        <span
          key={i}
          className="confetti"
          style={{
            left: `${(i * 137.5) % 100}%`,
            background: COLORS[i % COLORS.length],
            animationDelay: `${(i % 12) * 0.28}s`,
            animationDuration: `${2.4 + ((i * 7) % 10) / 6}s`,
          }}
        />
      ))}
    </div>
  );
}

export function ResultScreen({
  run,
  content,
  onNewRun,
}: {
  run: RunState;
  content: ContentBundle;
  onNewRun: () => void;
}) {
  const teamName = (id: string) => content.teams.find((t) => t.id === id)?.name ?? id;
  const won = run.result === "won";

  return (
    <main style={{ padding: 24, maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
      {won && <Confetti />}
      <h1 data-testid="run-result">
        {won ? "🏆 CHAMPIONS OF THE WORLD" : "Eliminated"}
      </h1>
      <p>
        {won
          ? `${teamName(run.playerTeamId)} win the 2026 World Cup!`
          : run.stage === "GROUP"
            ? `${teamName(run.playerTeamId)} crashed out in the group stage.`
            : `${teamName(run.playerTeamId)} fell in the ${run.stage}.`}
      </p>

      <section style={{ textAlign: "left" }}>
        <h2>Campaign</h2>
        <p>
          Group: {run.groupTable.find((r) => r.teamId === run.playerTeamId)?.pts ?? 0} pts
        </p>
        <ol data-testid="campaign-history">
          {run.knockoutHistory.map((k) => (
            <li key={k.stage}>
              {k.stage}: {k.result} {k.playerGoals}-{k.oppGoals} vs {teamName(k.oppId)}
            </li>
          ))}
        </ol>
        <p>Final squad: {run.deck.length} cards</p>
      </section>

      <button type="button" className="btn" data-testid="new-run" onClick={onNewRun}>
        New campaign
      </button>
    </main>
  );
}
