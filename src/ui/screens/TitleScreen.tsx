import { useState } from "react";
import { NATION_DICE_KITS } from "../../data/content";
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
        Momentum Duel: each round you slot dice into Build-Up, Chance, and Cover.
        Resolve the duel, reach the box, then shoot.
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {PLAYABLE_TEAM_IDS.map((id) => {
          const t = TEAM_MAP[id]!;
          const kit = NATION_DICE_KITS[id];
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
              {kit && (
                <>
                  <div className="kit-identity">“{kit.identity}”</div>
                  <div className="kit-blurb">{kit.blurb}</div>
                </>
              )}
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
