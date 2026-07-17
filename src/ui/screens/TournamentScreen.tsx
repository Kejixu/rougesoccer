import { standings } from "../../core/run/group";
import type { ContentBundle, RunAction, RunState } from "../../core/types";
import { ThirdsVerdictPanel } from "../components/ThirdsVerdictPanel";
import { TeamFlag } from "../components/TeamFlag";

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
  const teamIdentity = (id: string) => {
    const team = content.teams.find((candidate) => candidate.id === id);
    return (
      <span className="team-identity">
        <TeamFlag team={team} />
        <span>{teamName(id)}</span>
      </span>
    );
  };
  const nextOpp = run.nextOppId ? content.teams.find((t) => t.id === run.nextOppId) : null;
  const groupSchedule = run.groupOpponentOrder.flatMap((oppId, index) => {
    const matchday = index + 1;
    const others = run.groupTeamIds.filter((id) => id !== oppId);
    return [
      { matchday, homeId: run.playerTeamId, awayId: oppId },
      { matchday, homeId: others[0]!, awayId: others[1]! },
    ];
  });
  const fixtureScore = (matchday: number, homeId: string, awayId: string) =>
    run.groupFixtures.find(
      (fixture) =>
        fixture.matchday === matchday && fixture.homeId === homeId && fixture.awayId === awayId,
    );

  return (
    <main className="screen">
      <h1>
        {run.stage === "GROUP"
          ? `Group stage — matchday ${run.matchIndexInStage + 1} of 3`
          : `Knockouts — ${run.stage}`}
      </h1>

      {run.thirdsVerdict && <ThirdsVerdictPanel verdict={run.thirdsVerdict} />}

      {run.lastMatch && (
        <p data-testid="last-result">
          Last match: {run.lastMatch.result.toUpperCase()} {run.lastMatch.playerGoals}-
          {run.lastMatch.oppGoals} vs {teamIdentity(run.lastMatch.oppId)}
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
        <div className="group-stage-grid">
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
                    <td>{teamIdentity(row.teamId)}</td>
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
          <section className="panel group-fixtures" data-testid="group-fixtures">
            <h2>Matchdays</h2>
            {[1, 2, 3].map((matchday) => (
              <div key={matchday} className="fixture-day">
                <h3>Matchday {matchday}</h3>
                {groupSchedule
                  .filter((fixture) => fixture.matchday === matchday)
                  .map((fixture) => {
                    const result = fixtureScore(matchday, fixture.homeId, fixture.awayId);
                    return (
                      <p key={`${fixture.homeId}-${fixture.awayId}`}>
                        <span>{teamIdentity(fixture.homeId)}</span>
                        <strong>
                          {result ? `${result.homeGoals}–${result.awayGoals}` : "vs"}
                        </strong>
                        <span>{teamIdentity(fixture.awayId)}</span>
                      </p>
                    );
                  })}
              </div>
            ))}
          </section>
        </div>
      ) : (
        <ol data-testid="knockout-history">
          {run.knockoutHistory.map((k) => (
            <li key={k.stage}>
              {k.stage}: {k.result} {k.playerGoals}-{k.oppGoals} vs {teamIdentity(k.oppId)}
            </li>
          ))}
        </ol>
      )}

      {nextOpp && (
        <section>
          <h2>Next: <TeamFlag team={nextOpp} /> <span>{nextOpp.name}</span></h2>
          {(() => {
            const heat = content.balance.STAGE_CLOCK_MULT[run.stage];
            const effRating = Math.round(nextOpp.attackRating * content.styles[nextOpp.style].clockMult * heat);
            const keeperDC = Math.min(18, 10 + Math.round(effRating * content.balance.DICE.KEEPER_DC_PER_RATING));
            const stars = "★".repeat(5 - nextOpp.tier) + "☆".repeat(nextOpp.tier - 1);
            return (
              <p className="threat-line" data-testid="threat-line">
                <span className="threat-stars" title={`tier ${nextOpp.tier}`}>{stars}</span>
                {" "}attack {effRating} · keeper DC {keeperDC} ·{" "}
                <strong>{run.stage === "GROUP" ? "group stage" : run.stage} heat ×{heat}</strong>
                {" "}— every round they play {run.stage === "GROUP" ? "near club level" : "harder than the last"}
              </p>
            );
          })()}
          {run.scouted ? (
            <p data-testid="scout-report">
              Scout report: coach {nextOpp.coach}, style {content.styles[nextOpp.style].name} —{" "}
              {content.styles[nextOpp.style].blurb}
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
