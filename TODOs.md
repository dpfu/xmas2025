- [x] Make gift clickable (raycaster) to open voucher without the HUD button
- [x] Decide on final build path (stay with Vite for dev only vs. pure static) and align README/scripts
- [x] Fine-tune gift position/scale once final assets are chosen
- [x] Tune wobble stiffness/damping/clamp values after visual check on tree and ornaments
- [x] Confirm and document licensing/source for SFX files
- [x] Test interactions on touch devices and with reduced motion preference

## Scene polish
- [x] Rebalance snow readability (sizes/opacity/layers) and monitor performance on low-end devices
- [x] Cut foreground snow flakes, shrink sizes, reduce opacity, add clearer depth layers
- [x] Calibrate lighting to avoid tree hotspot while keeping depth (key/fill/ambient)
- [x] Boost rim/back light for stronger silhouette separation
- [x] Refine ground tint/texture to read as snow without beige cast
- [x] Shrink podium radius slightly and add soft contact shadow under trunk
- [x] Ensure hint placement is unobtrusive and aligned with festive UI styling
- [x] Mobile portrait background framing (bg vars + safe-area sizing)

## Spin Rework (new)
- [x] Replace shake mechanic with spin-up: drag/rotate accelerates the tree
- [x] Track spin velocity/decay and threshold for “tada” event
- [x] Transition camera/scene to center gift reveal with gleam/light effect
- [x] Sync audio: spin SFX ramp + gift reveal whoosh/shine
- [x] Update UI copy/instructions to match spin interaction
- [x] Adjust physics/jiggle to match spin (optional secondary motion)
