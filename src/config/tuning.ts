export const REVEAL = {
  durationMs: 900,
  bgYOffsetEnd: -8,
  bgScaleOffsetEnd: 0.04,
} as const;

export const SPIN = {
  impulse: 0.08,
  chargeFactor: 0.002,
  chargeDecay: 0.96,
  chargeDamp: 0.15,
  chargeVelocityFactor: 0.8,
  velocityDecay: 1.8,
  minVelocity: 0.02,
  hoverSpin: 0.08,
  threshold: 1.25,
  cooldownDuration: 1.2,
  sfxMinDelta: 12,
  sfxCooldownMs: 260,
} as const;

export const DROP = {
  landingOffset: { x: -0.6, y: -0.45, z: 0.1 },
  landingYOffset: 0.12,
  startHeight: 1.8,
  gravity: 6.5,
  spinSpeed: 1.2,
  landBounce: 0.03,
  scale: 0.9,
} as const;

export const CAMERA = {
  fovPortrait: 36,
  fovLandscape: 32,
  paddingPortrait: 1.35,
  paddingLandscape: 1.2,
  minDistPortrait: 4.2,
  minDistLandscape: 4.0,
  maxDist: 6.2,
  revealZoomOffset: { x: 0.1, y: 0.2, z: 0.7 },
  lookTargetYOffset: 0.32,
} as const;

export const TREE = {
  targetHeight: 1.65,
} as const;

export const GIFT = {
  targetHeight: 0.7,
} as const;

export const GLOW = {
  base: 0.35,
  scale: 0.9,
  starEmissive: 1.8,
  candleEmissive: 1.6,
  candleLight: 0.8,
  starLight: 0.6,
} as const;

export const BLOOM = {
  strength: 0.4,
  radius: 0.4,
  threshold: 0.85,
} as const;
