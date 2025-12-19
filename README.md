# Academic Tree Gifts 🎄 (Mini-Experience)

A tiny, client-side web mini-experience for a digital holiday greeting:
- Hover to gently rotate a low-poly 3D Christmas tree
- Click + drag to “shake” it
- A gift appears → open it → reveal a humorous academic “voucher”
- Download the voucher as a PNG (generated locally)

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

Debug:
- Add `?debug=1` to the URL to enable the debug panel and persist it in localStorage.
- Press `i` to toggle the info panel, `d` to toggle in-scene helpers.

## Add your 3D tree model
Put a GLB/GLTF model here:
```
public/assets/tree-ed.glb
```

Then edit `src/config/assets.ts` if you change the filename.

## GitHub Pages deploy
This repo includes a GitHub Actions workflow that builds and deploys to GitHub Pages on every push to `main`.

## Credits / Licenses
You must ensure the 3D model license is compatible with your use (CC0/CC-BY/etc.) and include attribution if required.
See `CREDITS.md`.
