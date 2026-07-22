import type { ContentBundle } from "../../core/types";
import { TeamFlag } from "./TeamFlag";

/** Flag + name for a team id, with an optional "(you)" tag. */
export function TeamIdentity({ content, id, you = false }: { content: ContentBundle; id: string; you?: boolean }) {
  const team = content.teams.find((t) => t.id === id);
  const name = team?.name ?? id;
  return (
    <span className="team-identity">
      <TeamFlag team={team} />
      <span>{you ? `${name} (you)` : name}</span>
    </span>
  );
}
