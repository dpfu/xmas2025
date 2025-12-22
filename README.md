# Academic Tree Gifts 🎄 (Mini-Experience)

A tiny, client-side web mini-experience for a digital holiday greeting:
- Drag to spin the low-poly tree
- Reveal sequence: camera + background parallax
- A present drops, lands, and can be opened
- Vouchers render locally and can be downloaded as PNGs

## Tech
- Three.js (3D)
- Vite (dev server + build)
- Pure client-side (works on GitHub Pages)

## Quickstart
```bash
npm install
npm run dev
```

Build:
```bash
npm run build
npm run preview
```

Tests:
```bash
npm test
npm run test:watch
```

## Assets
Main assets live in `public/assets`:
- `tree-ed.glb` — tree model
- `gift.glb` — present model
- `bg.jpg` — default background
- `bg-portrait.jpg` — portrait background
- `o-christmas-tree.mp3` — music
- `sfx_axe_tree_leaves.mp3`, `sfx_christmas-whoosh.mp3` — SFX

Unused/legacy assets are moved to `public/assets/_unused` to keep the active set lean.

## Add your 3D tree model
Put a GLB/GLTF model here:
```
public/assets/tree-ed.glb
```

Then edit `src/config/assets.ts` if you change the filename.

## GitHub Pages deploy
This repo includes a GitHub Actions workflow that builds and deploys to GitHub Pages on every push to `main`.
Set `GITHUB_PAGES_BASE` to `/<repo-name>/` in repo variables (or override in the workflow) when using project pages.

## Credits / Licenses
You must ensure the 3D model license is compatible with your use (CC0/CC-BY/etc.) and include attribution if required.
See `CREDITS.md`.
