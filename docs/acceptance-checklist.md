# Phase 1 acceptance checklist

## Gameplay

- [ ] Village-to-shrine route can be completed without exploits or unintended jumps.
- [ ] At least one qinggong shortcut is faster than the safe road.
- [ ] Jump buffering and coyote time make edge jumps forgiving.
- [ ] Air dash is available once in the air and recharges only after landing.
- [ ] Wall-run starts only against `traversable_wall` geometry.
- [ ] Wall jump exits cleanly and a failed wall-run returns to falling.
- [ ] Mantle clears the authored village props without clipping.
- [ ] Camera spring arm prevents the camera entering walls and roofs.
- [ ] Falling out of bounds and pressing R restore the latest checkpoint.
- [ ] All three Wind Seals can be collected.
- [ ] Shrine interaction shows the ending and saves completion.

## Persistence and UI

- [ ] Refresh restores checkpoint, collected seal IDs, tutorial flags, and settings.
- [ ] Corrupt or incompatible saves fall back safely.
- [ ] Private browsing or blocked IndexedDB produces a visible persistence warning.
- [ ] Opening screen provides the user gesture needed to start browser audio.
- [ ] Pause stops gameplay while controls and settings remain interactive.
- [ ] Sensitivity, invert-Y, and master volume apply and survive reload.

## Browser release

- [ ] Web Release uses the Compatibility renderer and has thread support disabled.
- [ ] Current Chromium and Firefox load without console errors.
- [ ] Safari smoke result is documented but is non-blocking.
- [ ] Representative route targets 60 FPS at 1080p on the documented machine.
- [ ] Runtime memory remains below 1.5 GB after a 15-minute run.
- [ ] Initial compressed download is below 100 MB.
- [ ] Static host serves `.wasm` as `application/wasm` and `.pck` as `application/octet-stream`.

## Content and licensing

- [ ] Every imported third-party asset has a row in `assets/ASSET_LICENSES.md`.
- [ ] Required attribution is visible in credits before public release.
- [ ] Only runtime-ready assets are included in the web export.

