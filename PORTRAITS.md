# Portrait generation guide

Drop a file named `<cardDefId>.png` (or `.jpg`/`.webp`) into
`src/ui/assets/portraits/` and that card picks it up automatically — no code
changes. Cards without a file keep their position-tinted silhouette, so you can
generate art incrementally, starting with the legendaries.

## Spec

- **Size:** 512×512 is fine (the slot is ~3:2 landscape with `object-fit: cover`,
  so center the subject and keep the head in the upper two-thirds).
- **Framing:** head and shoulders, facing slightly off-center, looking past the
  camera. No text in the image — the name bar and stat chips are rendered by
  the game.
- **Background:** flat or simple gradient. The sticker frame, foil shine, and
  rarity treatment are CSS layers on top; busy backgrounds fight them.

## Master style prompt

Use the same base prompt for every portrait so the set stays coherent:

> Retro 1990s World Cup sticker album portrait, head and shoulders of a soccer
> player, bold flat illustration with screen-print texture, slightly grainy,
> warm paper tone, flat [BG COLOR] background, confident expression, no text,
> no logos

Background colors by position (matches the in-game silhouette tints):
ST `#c75450` · WG `#9254c7` · MF `#54a06b` · DF `#5470c7` · GK `#c79a54`

**Important:** describe archetypes, not real people. The parody is in the names
the game renders, not the faces — keeping generated faces generic avoids
likeness issues entirely.

## Per-card subject prompts (append to the master prompt)

### Legendaries (do these first — foil makes them shine)
- `st_messy.png` — short Argentine forward, low center of gravity, calm
  half-smile, sky-blue and white striped shirt
- `st_mbappy.png` — young French striker mid-sprint glance, arms-crossed pose
  hint, dark blue shirt
- `wg_vinny.png` — joyful Brazilian winger laughing, yellow shirt with green
  trim
- `st_goalnaldo.png` — chiseled Portuguese veteran striker, jaw set, deep red
  shirt with green collar

### Rares
- `mf_bellingjam.png` — tall young English midfielder, arms spread celebration,
  white shirt
- `wg_yummal.png` — teenage Spanish winger, playful grin, red and yellow trim
- `mf_musicala.png` — slight German playmaker mid-feint, white shirt with black
  trim
- `df_hakimmy.png` — Moroccan full-back charging forward, red and green shirt
- `st_heunggoal.png` — smiling Korean forward, red shirt
- `wg_pulisick.png` — American winger, stars-and-stripes trim, determined
- `st_golmenez.png` — Mexican target man, green shirt
- `df_vandike.png` — towering Dutch center-back, serene, orange shirt
- `gk_martinangel.png` — Argentine goalkeeper, gloves up, mischievous grin
- `wg_drivies.png` — Canadian winger at full speed, red shirt
- `mf_valgrinder.png` — grizzled Uruguayan midfielder, sky-blue shirt
- `mf_kuboom.png` — Japanese playmaker, blue shirt

### Commons (generic archetypes — one each)
- `st_clinical.png` / `st_poacher.png` — anonymous striker archetypes, neutral
  dark kits, faces partly shadowed
- `wg_flash.png` — blurred-motion winger
- `mf_engine.png` / `mf_metronome.png` — midfield archetypes
- `df_stopper.png` / `df_sweeper.png` — defender archetypes
- `gk_wall.png` — keeper filling the frame

### Tactics & moments (illustrations, not faces)
- `tac_through.png` — chalkboard arrow splitting two X marks
- `tac_longball.png` — high arcing ball over a tiny pitch
- `tac_switch.png` — diagonal chalk arrow across a pitch
- `tac_tikitaka.png` — triangle of passing arrows
- `tac_parkbus.png` — a literal bus parked in a goalmouth
- `tac_counterpress.png` — swarm of arrows converging on a ball
- `tac_setpiece.png` — clipboard with a corner-kick diagram
- `mom_screamer.png` — ball ripping into the top corner, net bulging
- `mom_bicycle.png` — silhouetted overhead kick against floodlights
- `mom_rocket.png` — ball with a flame trail
- `mom_panenka.png` — chipped ball floating over a diving keeper
