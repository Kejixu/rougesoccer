import type { ContentBundle, RunState } from "../../core/types";
import { ThirdsVerdictPanel } from "../components/ThirdsVerdictPanel";
import { TeamIdentity } from "../components/TeamIdentity";
import { Confetti } from "../components/Confetti";

export function ResultScreen({
  run,
  content,
  onNewRun,
}: {
  run: RunState;
  content: ContentBundle;
  onNewRun: () => void;
}) {
  const teamIdentity = (id: string) => <TeamIdentity content={content} id={id} />;
  const won = run.result === "won";

  return (
    <main style={{ padding: 24, maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
      {won && <Confetti />}
      <h1 data-testid="run-result">
        {won ? "🏆 CHAMPIONS OF THE WORLD" : "Eliminated"}
      </h1>
      <p>
        {teamIdentity(run.playerTeamId)}{" "}
        {won
          ? "lift the trophy!"
          : run.stage === "GROUP"
            ? "crashed out in the group stage."
            : `fell in the ${run.stage}.`}
      </p>

      {run.thirdsVerdict && <ThirdsVerdictPanel verdict={run.thirdsVerdict} />}

      <section style={{ textAlign: "left" }}>
        <h2>Campaign</h2>
        <p>
          Group: {run.groupTable.find((r) => r.teamId === run.playerTeamId)?.pts ?? 0} pts
        </p>
        <ol data-testid="campaign-history">
          {run.knockoutHistory.map((k) => (
            <li key={k.stage}>
              {k.stage}: {k.result} {k.playerGoals}-{k.oppGoals} vs {teamIdentity(k.oppId)}
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
