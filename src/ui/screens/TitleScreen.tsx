import { useState } from "react";
import { NATION_DICE_KITS } from "../../data/content";
import { PLAYABLE_TEAM_IDS, TEAM_MAP } from "../../data/teams";
import { TeamFlag } from "../components/TeamFlag";

export function isFreshProfile(storedKeys: readonly string[]): boolean {
  return !storedKeys.some(
    (key) => key.startsWith("coach.") || key.startsWith("ui."),
  );
}

function readFreshProfile(): boolean {
  if (typeof localStorage === "undefined") return true;
  const storedKeys = Array.from(
    { length: localStorage.length },
    (_, index) => localStorage.key(index),
  ).filter((key): key is string => key !== null);
  return isFreshProfile(storedKeys);
}

export function TitleScreen({
  hasSave,
  onNewRun,
  onContinue,
  onTutorial,
}: {
  hasSave: boolean;
  onNewRun: (teamId: string, seed: string) => void;
  onContinue: () => void;
  onTutorial: () => void;
}) {
  const [teamId, setTeamId] = useState<string>(PLAYABLE_TEAM_IDS[0]);
  const [seed, setSeed] = useState<string>("");
  const [freshProfile] = useState(readFreshProfile);
  const campaignButton = (
    <button type="button" className={freshProfile ? "btn" : "btn btn--primary"}
      data-testid="start-run"
      onClick={() => onNewRun(teamId, seed || `run-${Math.random().toString(36).slice(2, 10)}`)}
    >
      Start the campaign
    </button>
  );
  const tutorialButton = (
    <button type="button" className="btn btn--primary" data-testid="start-tutorial" onClick={onTutorial}>
      Learn the game (5 min)
    </button>
  );

  return (
    <main className="screen">
      <h1>RogueSoccer</h1>
      <p style={{ color: "var(--ink-dim)" }}>
        An international tournament roguelike deckbuilder. Build your squad, beat the clock, lift the trophy.
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
        Possession chains: your dice are the energy — drag them onto passes, build a
        chance, and shoot before the defense takes it off you.
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
              data-team={id}
              data-selected={teamId === id ? "true" : undefined}
              data-testid={`pick-team-${id}`}
              onClick={() => setTeamId(id)}
            >
              <div className="kit-nation"><TeamFlag team={t} /> <span>{t.name}</span></div>
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
      <p style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {freshProfile ? tutorialButton : campaignButton}
        {freshProfile ? campaignButton : tutorialButton}
      </p>
    </main>
  );
}
