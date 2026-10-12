# Asset pipeline

The playable prototype intentionally uses project-authored primitive meshes and procedural audio. External art can replace these placeholders without changing gameplay scenes.

- Prefer optimized `.glb` files with embedded materials.
- Keep character and animation source files outside runtime folders; export only the clips used by the game.
- Add every imported asset to `ASSET_LICENSES.md` before committing it.
- Treat Mixamo, Meshy, and community downloads according to their individual licenses; their presence in `resource.md` does not imply CC0.
- Target a complete compressed web download below 100 MB.

