import { REVEAL } from "../config/tuning";

export type BackgroundController = {
  applyReveal: (e: number) => void;
};

export function initBackground(bgEl: HTMLElement | null, baseUrl: string): BackgroundController {
  if (bgEl) {
    bgEl.style.setProperty("--bgImage", `url("${baseUrl}assets/bg-with-floor.jpg")`);
    bgEl.style.setProperty("--bgImagePortrait", `url("${baseUrl}assets/bg-with-floor.jpg")`);
  }

  const applyReveal = (e: number) => {
    const yOffset = REVEAL.bgYOffsetEnd * e;
    const scaleOffset = REVEAL.bgScaleOffsetEnd * e;
    document.documentElement.style.setProperty("--bg-y-offset", `${yOffset}%`);
    document.documentElement.style.setProperty("--bg-scale-offset", `${scaleOffset}`);
  };

  return { applyReveal };
}
