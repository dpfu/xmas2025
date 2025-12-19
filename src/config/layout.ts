export type LayoutMode = "landscape" | "portrait";

export function getLayoutMode(): LayoutMode {
  return window.innerHeight > window.innerWidth ? "portrait" : "landscape";
}

export const STAGE = {
  groundY: 0.22,
  targetY: 1.15,
  desktop: { treeX: 0.42, treeZ: 0 },
  mobile: { treeX: 0.2, treeZ: 0 },
  giftOffset: { x: 0.6, y: 0.18, z: 0.45 },
};
