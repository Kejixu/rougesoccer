# RogueSoccer Agent Instructions

Before doing any project work, read `CLAUDE.md` and follow its instructions —
especially: read `GAME.md` before reasoning about or changing gameplay, keep
`GAME.md` in sync with mechanic changes, and respect the headless-core purity
rules (`src/core/**` and `src/data/**`: no react/dom/localStorage/Math.random/
Date.now; all randomness through seeded RNG in state).

Verify with:
- `pnpm exec tsc --noEmit`
- `pnpm exec vitest run`
(Node 22 required; on this machine prefix commands with
`PATH=$HOME/.nvm/versions/node/v22.17.0/bin:$PATH`.)
