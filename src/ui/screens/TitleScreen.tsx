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
      <p style={{ color: "var(--ink-dim)", fontSize: 13 }}>
        Dice mode: each round you roll a pool of dice and slot them into cards — low dice
        defend, mid dice move the ball up the pitch, high dice finish. Reach the box, then
        shoot.
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {PLAYABLE_TEAM_IDS.map((id) => {
          const t = TEAM_MAP[id]!;
          return (
            <button
              type="button"
              key={id}
              className="kit-card"
              data-selected={teamId === id ? "true" : undefined}
              data-testid={`pick-team-${id}`}
              onClick={() => setTeamId(id)}
            >
              <div className="kit-nation">{t.name}</div>
              <div className="kit-coach">coach {t.coach}</div>
            </button>
          );
        })}
      </div>
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
