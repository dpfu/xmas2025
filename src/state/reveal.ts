import { REVEAL } from "../config/tuning";

export type RevealController = {
  start: (nowMs: number) => void;
  update: (nowMs: number) => boolean;
  isActive: () => boolean;
  getProgress: () => number;
};

const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export function createRevealController(apply: (e: number) => void): RevealController {
  let active = false;
  let startTime = 0;
  let progress = 0;

  const start = (nowMs: number) => {
    active = true;
    startTime = nowMs;
    progress = 0;
  };

  const update = (nowMs: number) => {
    if (!active) return false;
    const t = (nowMs - startTime) / REVEAL.durationMs;
    progress = Math.max(0, Math.min(1, t));
    const eased = easeInOutCubic(progress);
    apply(eased);
    if (progress >= 1) {
      active = false;
      return true;
    }
    return false;
  };

  return {
    start,
    update,
    isActive: () => active,
    getProgress: () => progress,
  };
}
