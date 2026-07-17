import type { TeamDef } from "../../core/types";

export function TeamFlag({ team }: { team: Pick<TeamDef, "id" | "name" | "flag"> | undefined }) {
  if (!team?.flag) return null;
  return (
    <span
      className={`team-flag${team.id === "sco" ? " team-flag--scotland" : ""}`}
      data-team-flag={team.id}
      role="img"
      aria-label={`${team.name} flag`}
    >
      <span className="team-flag-emoji" aria-hidden="true">{team.flag}</span>
      {team.id === "sco" && <span className="team-flag-fallback" aria-hidden="true">SCO</span>}
    </span>
  );
}
