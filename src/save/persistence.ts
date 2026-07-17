// Run persistence: the whole RunState is plain JSON, so save = stringify.
// Saved after every applied action; versioned so future migrations can
// either upgrade or discard.

import type { RunState } from "../core/types";

const RUN_KEY = "rougesoccer:run:v9";

export function saveRun(state: RunState | null): void {
  try {
    if (state === null) localStorage.removeItem(RUN_KEY);
    else localStorage.setItem(RUN_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable (private mode etc.) — the game still works, just no resume
  }
}

export function loadRun(): RunState | null {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RunState;
    if (parsed.version !== 9 || parsed.phase === undefined) return null;
    if (parsed.phase === "DONE") return null; // finished runs don't resume
    return parsed;
  } catch {
    return null;
  }
}
