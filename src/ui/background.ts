import { REVEAL } from "../config/tuning";

export type BackgroundController = {
  applyReveal: (e: number) => void;
  setFinalScene: () => void;
};

export function initBackground(bgEl: HTMLElement | null, baseUrl: string): BackgroundController {
  const setBackground = (name: string) => {
    if (!bgEl) return;
    bgEl.style.setProperty("--bgImage", `url("${baseUrl}assets/${name}")`);
    bgEl.style.setProperty("--bgImagePortrait", `url("${baseUrl}assets/${name}")`);
  };

  if (bgEl) {
    setBackground("bg-with-floor.jpg");
  }

  const applyReveal = (e: number) => {
    const yOffset = REVEAL.bgYOffsetEnd * e;
    const scaleOffset = REVEAL.bgScaleOffsetEnd * e;
    document.documentElement.style.setProperty("--bg-y-offset", `${yOffset}%`);
    document.documentElement.style.setProperty("--bg-scale-offset", `${scaleOffset}`);
  };

  const setFinalScene = () => {
    setBackground("bg-with-floor-cracked.jpg");
  };

  return { applyReveal, setFinalScene };
}
