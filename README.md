# Wuxia Valley

A browser-first, single-player wuxia exploration prototype built with Godot 4.7.2 and GDScript. Phase 1 focuses on a fixed swordsman, third-person movement, qinggong traversal, a dense 300 m valley, local saving, and a short journey from Mistveil Village to the Shrine of Returning Wind.

The current build is self-contained: geometry, the placeholder character, effects, and audio are generated from Godot resources, so no external asset license is required to run it.

## Play

1. Install Godot 4.7.2 Standard and its export templates.
2. Open this folder in Godot and run `scenes/main.tscn`, or press **F6/F5**.
3. For a browser build, export the **Web Release** preset, then run `npm run serve` and open <http://127.0.0.1:8080>.

### Controls

| Action | Input |
| --- | --- |
| Move | W A S D |
| Look | Mouse |
| Sprint | Left Shift |
| Jump / mantle / wall jump | Space |
| Air dash | Q |
| Interact | E |
| Return to checkpoint | R |
| Pause / settings | Escape |

Air dash can be used once before touching the ground. Wall-running only activates on jade-colored, explicitly marked traversal walls. Low ledges can be mantled by pressing jump while moving toward them.

## Slice content

- One seamless route of roughly 300 m through four landmarks.
- A safe road and two optional qinggong shortcuts.
- Three optional Wind Seals: rooftop, bamboo grove, and cliff route.
- Three persistent checkpoints using stable IDs rather than world coordinates.
- A non-branching NPC exchange and interactive shrine finale.
- Sensitivity, invert-Y, and volume settings stored with progress.
- Procedural ambient wind and traversal feedback audio that starts after user interaction.

## Project structure

```text
assets/                 Asset policy and license registry
resources/              Tunable gameplay resources
scenes/                  Main, player, and HUD scenes
scripts/autoload/        Save state and audio services
scripts/player/          Movement state machine and procedural animation
scripts/world/           Valley generation and world interactions
scripts/ui/              HUD, settings, pause, and ending flow
tests/                   Headless structural smoke test
tools/                   Dependency-free local web server
```

## Validation

Run the structural smoke test with the pinned editor:

```sh
godot --headless --path . res://tests/smoke_test.tscn
```

The release gate additionally requires a manual traversal pass in current Chromium and Firefox at 1080p, recording frame rate, memory after 15 minutes, compressed transfer size, save restoration after refresh, and browser-console errors. Safari is a best-effort smoke target.

See [`docs/acceptance-checklist.md`](docs/acceptance-checklist.md) for the full release checklist and [`assets/ASSET_LICENSES.md`](assets/ASSET_LICENSES.md) before importing any third-party content.

