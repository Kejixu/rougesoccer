import { useState } from "react";
import { PLAYABLE_TEAM_IDS, TEAM_MAP } from "../../data/teams";

export function TitleScreen({
  hasSave,
  onNewRun,
  onContinue,
}: {
  hasSave: boolean;
  onNewRun: (teamId: string, seed: string) => void;
  onContinue: () => void;
}) {
  const [teamId, setTeamId] = useState<string>(PLAYABLE_TEAM_IDS[0]);
  const [seed, setSeed] = useState<string>("");

  return (
    <main className="screen">
      <h1>RogueSoccer</h1>
      <p style={{ color: "var(--ink-dim)" }}>
        A World Cup 2026 roguelike deckbuilder. Build your squad, beat the clock, lift the trophy.
      </p>

      {hasSave && (
        <p>
          <button type="button" className="btn" data-testid="continue-run" onClick={onContinue}>
            Continue campaign
          </button>
        </p>
      )}

      <h2>New campaign</h2>
      <fieldset style={{ border: "1px solid #444", borderRadius: 8 }}>
        <legend>Pick your nation</legend>
        {PLAYABLE_TEAM_IDS.map((id) => {
          const t = TEAM_MAP[id]!;
          return (
            <label key={id} style={{ display: "block", padding: 4 }}>
              <input
                type="radio"
                name="team"
                checked={teamId === id}
                onChange={() => setTeamId(id)}
                data-testid={`pick-team-${id}`}
              />{" "}
              {t.name} — coach {t.coach}
            </label>
          );
        })}
      </fieldset>
      <p>
        <label>
          Seed (optional):{" "}
          <input
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="random"
            data-testid="seed-input"
          />
        </label>
      </p>
      <button type="button" className="btn"
        data-testid="start-run"
        onClick={() => onNewRun(teamId, seed || `run-${Math.random().toString(36).slice(2, 10)}`)}
      >
        Start the campaign
      </button>
    </main>
  );
}
