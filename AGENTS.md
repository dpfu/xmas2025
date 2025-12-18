# AGENTS

Digital holiday greeting: low-poly tree you can rotate/shake to reveal curated academic vouchers; warm, not grindy. Keep it tiny and GitHub Pages–friendly.

## Product / Creative
- Sets the tone to cozy/academic-chic and keeps the experience calm and playful
- Curates the voucher list (12–24 items) with gentle academic humor
- Reminds that this is a greeting, not a game loop (no grind, no metrics)

## Engineering
- Pure client-side (GitHub Pages compatible). Minimal stack; Vite allowed for dev convenience, but ship as lean static assets.
- Keep dependencies minimal (e.g., Three.js + tiny helpers only)
- Spin-up interaction triggers gift reveal; keep animations lightweight (no heavy physics libs)
- Prioritize stable performance on desktop + mobile; fast initial load
- Keep UI minimal: avoid HUD/buttons; rely on in-scene cues and subtle hints
- Use git for all changes; keep commits focused and small to enable safe iteration

## Art / Assets
- Chooses and integrates low-poly assets (tree, gift) in GLB/GLTF
- Ensures model licensing is compatible and credited in `CREDITS.md`
- Keeps textures light (or even untextured) for fast loading

## QA / Accessibility
- Tests mouse + touch interactions
- Ensures readable typography and decent contrast
- Checks “reduced motion” preferences and provides a calmer mode
