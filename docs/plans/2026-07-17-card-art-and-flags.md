# Card Art & Flags Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development to implement this plan task-by-task.

**Goal:** Give every nation a visible flag and every dice card a scannable football role, slot, position, and upgrade treatment without changing gameplay or interaction behavior.

**Architecture:** Add the optional plain-string flag field explicitly allowed by the spec to `TeamDef`, populate it for all 26 content teams, and render it through one UI-only `TeamFlag` primitive. Keep the load-bearing dice-card button and its existing classes/test IDs intact while adding small presentational child components and CSS for three role families.

**Tech Stack:** React 19, strict TypeScript, inline SVG, CSS, Vitest server-rendered markup tests.

### Task 1: Establish RED coverage

**Files:**
- Create: `test/cardArtFlags.test.ts`

1. Assert all 26 `TEAMS` entries expose a non-empty flag and spot-check Brazil, Mexico, USA, Canada, and Scotland.
2. Server-render a controlled hand containing progress, finish, and defense cards; assert each retains its `role-*` class and gains its matching SVG motif.
3. Assert the slot die exposes the exact requirement text, positioned cards expose a mini-pitch badge, and upgraded cards expose the correct pip count.
4. Server-render the title, match, tournament, and result surfaces and assert team flags occur beside their nation identities.
5. Run `env -u NODE_OPTIONS PATH=/Users/kejixu/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec vitest run test/cardArtFlags.test.ts` and retain the expected assertion failures as RED evidence.

### Task 2: Add complete flag content

**Files:**
- Modify: `src/core/types.ts`
- Modify: `src/data/teams.ts`
- Create: `src/ui/components/TeamFlag.tsx`
- Modify: `src/ui/screens/TitleScreen.tsx`
- Modify: `src/ui/screens/DiceMatchScreen.tsx`
- Modify: `src/ui/screens/TournamentScreen.tsx`
- Modify: `src/ui/screens/ResultScreen.tsx`
- Modify: `src/ui/styles/board.css`

1. Add only `flag?: string` to `TeamDef` in core.
2. Populate every team with its Unicode flag string, using the Scotland subdivision tag sequence.
3. Build a presentational `TeamFlag` span with accessible context and an explicit Scotland `SCO` fallback label.
4. Place flags on team-select cards, both scoreboard sides, group rows, matchday fixtures, last/knockout results, next-opponent heading, and the result/campaign history screen.

### Task 3: Add football card visuals

**Files:**
- Create: `src/ui/components/DiceCardArt.tsx`
- Modify: `src/ui/screens/DiceMatchScreen.tsx`
- Modify: `src/ui/styles/board.css`

1. Add a role-art component whose progress, finish, and defend variants each render one thin-line inline SVG with a crest glyph and faint pitch-scale pattern.
2. Add a die-outline slot component that preserves the exact `slotLabel`, includes a parity pip motif, and inverts max slots.
3. Add a mini-pitch position badge with MF/WG/ST dot placement and L1/L2 upgrade marks.
4. Keep all existing button classes, test IDs, attributes, disabled behavior, tutorial highlighting, drop classes/lock badge, and docked die markup unchanged.
5. Layer CSS so role art sits behind content while lock/drop/docked overlays retain strong contrast.

### Task 4: Verify and document

**Files:**
- Modify: `GAME.md`
- Create: `CODEX_STATUS.md`

1. Run the focused visual test until GREEN.
2. Run `env -u NODE_OPTIONS PATH=/Users/kejixu/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec tsc --noEmit`.
3. Run `env -u NODE_OPTIONS PATH=/Users/kejixu/.nvm/versions/node/v22.17.0/bin:$PATH pnpm exec vitest run`.
4. Recompute hashes for `src/ui/tutorialScript.ts` and `test/tutorial.test.ts` and compare them with the recorded baseline.
5. Add a brief presentation note to `GAME.md` and record RED evidence, final counts, hashes, and any deviations in `CODEX_STATUS.md`.
