# Card Art & Flags — cards that look like football, nations that look like nations

## Problem (playtest, 2026-07-17)

Cards are text rectangles — name, slot chip, rules text. Nothing on a card
says "this is a run", "this is a finish", "this is a tackle" at a glance.
Countries are bare names everywhere (team select, match header, group table,
bracket) — no identity at a glance.

## Design

### 1. Flags — emoji, zero assets

- Add a `flag` field (or a `flagFor(teamId)` util in `src/ui/`) mapping every
  team in the pool (26) to its Unicode flag emoji (🇧🇷 🇲🇽 🇺🇸 🇨🇦 🇭🇹 🏴󠁧󢁢󠁳󠁣󠁴󠁿 …).
  NOTE Scotland: use the ISO subdivision tag sequence for the Scottish flag
  (🏴 + gbsct tags); if it renders poorly, fall back to 🏴 + "SCO" text.
- Show the flag beside the nation name in: team select cards, the match
  scoreboard header (both teams), the group table rows, the matchday fixture
  list, knockout/next-opponent panels, and the result screen.
- Emoji only — no image assets, no external requests. Platforms that render
  flags as letter pairs (Windows) degrade acceptably.
- Data lives with content: if adding a field to teams.ts, keep it a plain
  string (headless core stays render-agnostic — a string field is fine, but
  a UI-side lookup util is equally acceptable; pick one, be consistent).

### 2. Card design — role identity + pitch language

Keep the existing card DOM structure (testids, dock/drag/lock behaviors are
load-bearing) — this is a visual layer, mostly CSS + small markup additions
inside the card button.

- **Role identity, readable at arm's length.** Three visual families using
  the existing role classes (role-progress / role-finish / role-defend —
  verify actual class names in DiceMatchScreen):
  - progress/pass: cool green family, motif = a forward run line
  - finish/chance: gold family, motif = goal + ball trajectory
  - defense: the defending red family, motif = a block/shield line
- **Motifs are inline SVG line art**, one small `<svg>` per family (a
  crest-sized glyph in a corner + a faint full-card background line pattern
  like pitch markings/run arrows at ~6-8% opacity). No external images.
  Reuse the existing GoalFrame SVG aesthetic (thin lines, flat colors).
- **Position badge**: cards with a position (MF/WG/ST) get a small pitch-spot
  badge (mini pitch rectangle with a dot where that position lives) instead
  of/alongside the text tag — combos become visually scannable.
- **Slot as a die face**: render the slot requirement as a styled die glyph
  ("3+" inside a die outline; "even" as a die showing 2/4/6 pips motif; "max"
  inverted color) — same info, dice language.
- **Upgrade level**: L1/L2 cards get a subtle star/chevron pip row.
- Keep hover/drag/dock/locked states visually distinct on top of the new
  look (drop-ok glow, drop-locked badge, docked die chip must all remain
  clearly visible — do not reduce their contrast).

### 3. Scoreboard flags tie-in

Match header becomes: 🇧🇷 Brazil 1 — 0 Haiti 🇭🇹 (flag outside each name).
Kit color accents already exist per nation — don't fight them.

## Constraints

- UI-only. `src/core/**` untouched; `src/data/teams.ts` may gain ONLY the
  optional `flag` string field (type updated in core/types.ts TeamDef if the
  field route is chosen — a pure data field, no logic).
- Tutorial files byte-identical. All existing testids/classes preserved.
- No external assets or network fetches; inline SVG and emoji only.
- Update GAME.md presentation notes briefly.

## Tests

- flagFor/flag field: every team in the pool has a non-empty flag; spot-check
  bra/mex/usa/can/sco mappings.
- Card render: role family class present per card role; slot die glyph
  renders the right text; position badge for positioned cards; existing
  dock/drag/lock tests still green.
- tsc clean; full suite green.
