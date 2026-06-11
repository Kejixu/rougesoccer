// Backroom hire pick: shown when the player advances a stage. The relic layer —
// permanent run-wide passives, pick 1 of 3.

import type { ContentBundle, RunAction, RunState } from "../../core/types";

export function StaffScreen({
  run,
  content,
  dispatch,
}: {
  run: RunState;
  content: ContentBundle;
  dispatch: (a: RunAction) => void;
}) {
  const offer = run.pendingStaff!;
  const stageName =
    run.stage === "R32" ? "the knockouts" : `the ${run.stage}`;

  return (
    <main className="screen">
      <h1>You're through to {stageName}!</h1>
      <p>
        The federation funds one backroom hire. Their effect is permanent for the
        rest of the run.
      </p>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }} data-testid="staff-offer">
        {offer.staffIds.map((id, i) => {
          const s = content.staffPool.find((x) => x.id === id)!;
          return (
            <button
              type="button"
              key={id}
              className="staff-card"
              data-rarity={s.rarity}
              data-testid={`pick-staff-${i}`}
              onClick={() => dispatch({ type: "PICK_STAFF", index: i })}
            >
              <div className="staff-role">{s.role}</div>
              <div className="staff-name">{s.name}</div>
              <div className="staff-text">{s.text}</div>
              {s.rarity !== "common" && <div className="staff-rarity">{s.rarity}</div>}
            </button>
          );
        })}
      </div>

      <p>
        <button
          type="button"
          className="btn"
          data-testid="skip-staff"
          onClick={() => dispatch({ type: "SKIP_STAFF" })}
        >
          Hire nobody
        </button>
      </p>

      {run.staff.length > 0 && (
        <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>
          Current staff:{" "}
          {run.staff
            .map((id) => content.staffPool.find((s) => s.id === id)?.role ?? id)
            .join(" · ")}
        </p>
      )}
    </main>
  );
}
