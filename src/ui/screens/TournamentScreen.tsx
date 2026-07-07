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
    <main className="screen">
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

      {(run.staff.length > 0 || run.drilled.length > 0) && (
        <div className="passive-strip" data-testid="staff-roster">
          {run.staff.map((id) => {
            const s = content.staffPool.find((x) => x.id === id);
            return s ? (
              <span key={id} className="passive-chip staff" title={s.text}>
                👔 {s.role} — {s.name}
              </span>
            ) : null;
          })}
          {run.drilled.map((defId) => (
            <span key={defId} className="passive-chip drilled" title={content.defs[defId]?.levels[0]?.text}>
              📋 {content.defs[defId]?.name ?? defId} (drilled in)
            </span>
          ))}
        </div>
      )}

      {run.stage === "GROUP" ? (
        <div className="panel">
          <table data-testid="group-table" className="standings">
            <thead>
              <tr>
                {["Team", "P", "W", "D", "L", "GF", "GA", "Pts"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {standings(run.groupTable, run.tiebreak).map((row) => (
                <tr key={row.teamId} className={row.teamId === run.playerTeamId ? "you" : undefined}>
                  <td>{teamName(row.teamId)}</td>
                  <td>{row.w + row.d + row.l}</td>
                  <td>{row.w}</td>
                  <td>{row.d}</td>
                  <td>{row.l}</td>
                  <td>{row.gf}</td>
                  <td>{row.ga}</td>
                  <td>{row.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
            <button type="button" className="btn"
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
        <button type="button" className="btn" data-testid="start-match" onClick={() => dispatch({ type: "START_MATCH" })}>
          Kick off
        </button>
        <button type="button" className="btn" data-testid="open-shop" onClick={onOpenShop}>
          Transfer market
        </button>
        <button type="button" className="btn" onClick={onAbandon} style={{ marginLeft: "auto" }}>
          Abandon run
        </button>
      </p>
    </main>
  );
}
