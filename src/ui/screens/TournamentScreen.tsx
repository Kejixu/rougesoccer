import { standings } from "../../core/run/group";
import type { ContentBundle, RunAction, RunState } from "../../core/types";

export function TournamentScreen({
  run,
  content,
  dispatch,
  onOpenShop,
  onAbandon,
}: {
  run: RunState;
  content: ContentBundle;
  dispatch: (a: RunAction) => void;
  onOpenShop: () => void;
  onAbandon: () => void;
}) {
  const teamName = (id: string) =>
    id === run.playerTeamId
      ? `${content.teams.find((t) => t.id === id)?.name ?? id} (you)`
      : (content.teams.find((t) => t.id === id)?.name ?? id);
  const nextOpp = run.nextOppId ? content.teams.find((t) => t.id === run.nextOppId) : null;

  return (
    <main style={{ padding: 24, maxWidth: 760, margin: "0 auto" }}>
      <h1>
        {run.stage === "GROUP"
          ? `Group stage — matchday ${run.matchIndexInStage + 1} of 3`
          : `Knockouts — ${run.stage}`}
      </h1>

      {run.lastMatch && (
        <p data-testid="last-result">
          Last match: {run.lastMatch.result.toUpperCase()} {run.lastMatch.playerGoals}-
          {run.lastMatch.oppGoals} vs {teamName(run.lastMatch.oppId)}
        </p>
      )}

      <p data-testid="resources">
        Budget {run.resources.budget} · Scout points {run.resources.scout} · Squad{" "}
        {run.deck.length} cards
      </p>

      {run.stage === "GROUP" ? (
        <table data-testid="group-table" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Team", "P", "W", "D", "L", "GF", "GA", "Pts"].map((h) => (
                <th key={h} style={{ padding: "2px 8px", textAlign: "left" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {standings(run.groupTable, run.tiebreak).map((row) => (
              <tr key={row.teamId}>
                <td style={{ padding: "2px 8px" }}>{teamName(row.teamId)}</td>
                <td style={{ padding: "2px 8px" }}>{row.w + row.d + row.l}</td>
                <td style={{ padding: "2px 8px" }}>{row.w}</td>
                <td style={{ padding: "2px 8px" }}>{row.d}</td>
                <td style={{ padding: "2px 8px" }}>{row.l}</td>
                <td style={{ padding: "2px 8px" }}>{row.gf}</td>
                <td style={{ padding: "2px 8px" }}>{row.ga}</td>
                <td style={{ padding: "2px 8px" }}>{row.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ol data-testid="knockout-history">
          {run.knockoutHistory.map((k) => (
            <li key={k.stage}>
              {k.stage}: {k.result} {k.playerGoals}-{k.oppGoals} vs {teamName(k.oppId)}
            </li>
          ))}
        </ol>
      )}

      {nextOpp && (
        <section>
          <h2>Next: {nextOpp.name}</h2>
          {run.scouted ? (
            <p data-testid="scout-report">
              Scout report: coach {nextOpp.coach}, style {content.styles[nextOpp.style].name} —{" "}
              {content.styles[nextOpp.style].blurb} Attack rating {nextOpp.attackRating} (tier{" "}
              {nextOpp.tier}).
            </p>
          ) : (
            <button
              type="button"
              data-testid="scout-button"
              disabled={run.resources.scout < content.balance.SHOP_PRICES.scoutOpponent}
              onClick={() => dispatch({ type: "SCOUT_OPPONENT" })}
            >
              Scout them ({content.balance.SHOP_PRICES.scoutOpponent} scout pt)
            </button>
          )}
        </section>
      )}

      <p style={{ display: "flex", gap: 8 }}>
        <button type="button" data-testid="start-match" onClick={() => dispatch({ type: "START_MATCH" })}>
          Kick off
        </button>
        <button type="button" data-testid="open-shop" onClick={onOpenShop}>
          Transfer market
        </button>
        <button type="button" onClick={onAbandon} style={{ marginLeft: "auto" }}>
          Abandon run
        </button>
      </p>
    </main>
  );
}
