# AGENTS.md

Tanrıçam & Kaju: Ionic React + Phaser 3.90 + Capacitor platformer.
React (`src/pages/GamePage.tsx`) only mounts Phaser and owns native lifecycle;
game code is plain TS under `src/game/`.

## Monorepo

This app is a git submodule at `apps/tanricam-kaju` inside `~/Documents/saru-nx`.
Install and run from the monorepo root:

- `pnpm install`
- `pnpm nx run tanricam-kaju:serve` / `build` / `check`
- `pnpm nx run tanricam-kaju:android-release` (JDK 21 + local keystore)
- `pnpm --filter tanricam-kaju run <script>` also works.

Commit inside the submodule first, push it, then update the parent gitlink in a
separate parent commit. Never commit `android/keystore.properties`,
`android/keystore/`, `.env`, `work/`, `dist/` or `node_modules/`.

## Workflow (three agents)

New development always starts with the Plan agent; never skip planning.

1. **Plan** (`plan`, DeepSeek V4 Pro) — plans the work, writes the plan into
   `docs/GDD.md` as a new "Plan — <title>" section, and waits for the user's
   approval. It does not implement and edits nothing but `docs/**`.
2. **User approves** — the user reads the plan in GDD and switches to the Build tab.
3. **Build** (`build`, DeepSeek V4.1 Flash) — implements only the approved plan,
   follows the rules above, runs `pnpm run check`, and ends with
   "Uygulama tamam. Review'e geç." when done.
4. **Review** (`review`, Qwen3.8 Flash, mode `all`) — the user switches to the
   Review tab. It checks the implementation against the GDD plan section and
   repo invariants, may use shell freely (checks, builds, dev server, git), and
   reports **GEÇTİ** or **KALDI** without editing files.
   - GEÇTİ → the user prompts the next development (back to step 1).
   - KALDI → the listed shortcomings go back to Build and are fixed.

Agent models and permissions live in `.opencode/opencode.json` and
`.opencode/agents/review.md`; keep them in sync with this section.

## Commands

- `pnpm run dev` — Vite. Configured port is 5173; if busy Vite silently uses 5174+.
- `pnpm run assets` — regenerate sprites/manifest from the PNGs in `assets/`. Run before `check` when art or frame config changes.
- `pnpm run check` — `validate:assets` -> `validate:levels` -> `tsc --noEmit`. Run before handoff; it does not build.
- `pnpm run validate:levels` — parse all 39 matrices and enforce floor/raised/entity rules.
- `pnpm run preview:levels` — render `work/level-previews/01.png..39.png` for eyeballing layouts.
- `pnpm run build` — tsc + Vite to `dist/`.
- Android: `pnpm run build && pnpm exec cap sync android`, then
  `cd android && JAVA_HOME=<jdk21> ./gradlew assembleDebug`.
  **JDK 21 is required** (Capacitor 8); the installed JDK 17 fails with
  `invalid source release: 21`. Use Android Studio's JBR 21 or a local JDK 21.
- APK: `android/app/build/outputs/apk/debug/app-debug.apk`; package `com.tanricam.kaju`.
  Test AVD: `Medium_Phone_API_36.0`.

No unit-test runner. `pnpm run check` + manual browser/emulator play are the verification path.
For a quick level jump, the dev global is exposed:
`window.__game.scene.getScene('Menu').startLevel(i)` or
`window.__game.scene.getScene('Game').goToLevel(i)` (0-based).

## Read first

- `docs/GDD.md` — current design.
- `README.md` — asset/build details.
- `assets/levels/README.md` — matrix legend and editing rules.
- `src/game/config.ts`, `src/game/scenes/GameScene.ts`,
  `src/game/data/levelParser.ts`, `tools/validate-levels.ts`.

## Level data and floor rules (R1/R2 implemented)

- Levels are ASCII matrices in `assets/levels/01.txt..39.txt`, parsed by
  `src/game/data/levelParser.ts`; `levels.ts` only globs/parses them. Edit the
  matrices, not TS coordinates.
- **R1:** ground is only full 1942px `floor-strip.png` tiles. `GROUND` `#` = one
  whole tile, `.` = 202px gap. Never crop/tile-stretch the floor; the validator
  rejects non-whole runs.
- **R2:** upper routes use whole `high_floor.png` sprites, scaled (never
  cropped): RAISED1 (`y=360`) a 0.38 / b 0.48 / e 0.42; RAISED2 (`y=252`)
  b 0.39 / e 0.35. They **float over gaps**, not on the floor; their bodies
  clear the floor. Reachability is "adjacent platform within 180px and
  ≤245px rise". RAISED2 is a side staircase next to a RAISED1 (not directly
  above it). Upper colliders are one-way. `c` wheeled cart goes in gaps at
  ground level (0.72), `d` O2 rack is floor decor (0.85); both non-colliding.
  The old `floor-ledge` asset is gone.
- Entity rows `E0/E1/E2` are 96 proportional slots (ground / y=360 / y=252);
  see `assets/levels/README.md` for the letters. `k` marks the rescue animal;
  put sushi on `E1/E2` so upper routes have a reward.
- After editing matrices: `pnpm run validate:levels` and `pnpm run preview:levels`.
- Layout lives in `src/game/layout.ts`: `U = 720/10`, ground `8U = 576`,
  step `1.5U = 108`, gap `2.8U = 202`. Don't hardcode 560/440/340 again.

## Invariants

- 1280x720, `Scale.FIT`, fixed camera Y. Ground collider top is `y=576`
  (mattress line), never the floor sprite's top edge; IV poles/monitors are decor.
- 39 levels, 39 unique rescue animals from `helpless.png` (`animal-00..38`);
  boss is level 39 and must die before its animal can be rescued.
- Save clamps completed levels to 1–39; XP thresholds are 0/6/15/28/45.
- Enemy combat tiers (strongest → weakest): doctor > nurse > microbe > pus.
  Base HP 6/5/4(+1 for skin 3+)/3; contact damage doctor 2, others 1. Every 10
  level tier adds +20% HP and +10% speed. Keep this data-driven in `Enemy.ts`.
- At max attack level, sushi heals +1 heart instead of granting XP.
- Weapons are species-locked: domestos -> microbe, sarma -> human. Wrong weapon
  does 0 damage; don't casually add a third damage type.
- Sprites are normalized per character; hero sheets share 134x201 cells,
  doctor 77x115, nurse 71x114. Don't switch to fixed raw-sheet grids.
- Scene flow: Boot -> Preload -> Menu -> Game + UI. Game owns the world; UI owns
  HUD/overlays and communicates via `game.events`. Clean up listeners on scene
  shutdown; level restart/menu uses `goToLevel` / `goToMenu`.
- Menu level select is 8x5; final overlay is 13x3 (39 animals).
- Mobile touch layout: movement ◀/▶ on the **right**, ZIPLA + both attack
  icon-cards stacked vertically on the **left**, inset from the edge. The
  future joystick replaces the right-side movement buttons.
- UI copy is Turkish; code identifiers are English.

## Assets / audio

- `assets/*.png` are original read-only pipeline inputs; do not edit them.
  `assets/levels/*.txt` are authored level data and are meant to be edited.
- `tools/build-assets.mjs` extracts `helpless.png` by connected components (all
  39 animals, no grid cuts) and crops the five `high_floor.png` platforms.
- Generated: `public/assets/game/` and `src/game/data/manifest.json`; debug
  contact sheets/previews: `work/` (gitignored). Never hand-edit generated output.
- New frames: edit `FRAME_CONFIG` / `MANUAL_CROPS` in `tools/build-assets.mjs`,
  then `pnpm run assets`.
- `assets/logo.png` is cleaned by `build-assets.mjs` into `logo` and shown on
  the loading/menu screens. `pnpm run mobile:art` reuses the same cleaned logo
  for Android splash screens and launcher icons (`tools/build-mobile-art.mjs`).
- Release signing: `android/keystore.properties` + `android/keystore/` are
  local, gitignored, and must be kept for update installs. `versionName` is in
  `android/app/build.gradle`; bump `versionCode` for every shared update.
- Background removal is local flood-fill, not FAL. `.env` holds `FAL_KEY`; never
  import it into `src/` or ship it. FAL is only for optional `tools/` art work.
- Asset mapping: `zemin.png` = floor (there is no `floor.png`), `tanricam.png` =
  hero, `helpless.png` = 39 rescue animals, `susi.png` = sushi (keys `sushi-*`),
  `dolma.png` = sarma, `high_floor.png` = raised platforms + decor cart.
- SFX/music are synthesized in `src/game/audio.ts`; there are no audio files.

## Gotchas

- Large UI panels are CanvasTextures in `src/game/ui/widgets.ts` on purpose;
  reverting them to Graphics rounded rects causes Android WebView fill cracks.
- `src/pages/GamePage.tsx` owns native landscape lock, status-bar hide, Android
  back and background pause. Don't duplicate lifecycle handlers in scenes.
- The matrix parser maps `E*` slots proportionally; moving an entity by one
  character shifts it by `levelWidth / 96`. Use previews to sanity-check.
- Touch controls are hidden on mouse-only desktops on purpose. Append
  `?touch=1` to the URL to force-show them for visual inspection.
- `dist/` and Android build outputs are gitignored. This workspace is currently
  not a git repo; don't rely on `git diff`/`git status`.
- `part1.html`..`part10.html` are old Phaser tutorial references, not the app.
