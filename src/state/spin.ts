import { SPIN } from "../config/tuning";

export type SpinState = {
  velocity: number;
  charge: number;
  cooldown: number;
};

export function createSpinState(): SpinState {
  return { velocity: 0, charge: 0, cooldown: 0 };
}

export function applySpinImpulse(state: SpinState, dx: number, factor = SPIN.impulse) {
  state.velocity += dx * factor;
  state.charge += Math.abs(dx) * SPIN.chargeFactor;
}

export function updateSpin(state: SpinState, dt: number) {
  state.charge =
    Math.max(0, state.charge * SPIN.chargeDecay - dt * SPIN.chargeDamp) +
    Math.abs(state.velocity) * dt * SPIN.chargeVelocityFactor;
  state.cooldown = Math.max(0, state.cooldown - dt);
  state.velocity *= Math.exp(-dt * SPIN.velocityDecay);
  if (Math.abs(state.velocity) < SPIN.minVelocity) state.velocity = 0;
}

export function shouldTriggerReveal(state: SpinState): boolean {
  return state.cooldown <= 0 && state.charge > SPIN.threshold;
}

export function resetCooldown(state: SpinState) {
  state.cooldown = SPIN.cooldownDuration;
}
