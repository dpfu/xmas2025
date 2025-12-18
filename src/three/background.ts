import * as THREE from "three";

export function makeGradientTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context not available for gradient texture");
  }

  const g = ctx.createRadialGradient(260, 180, 40, 256, 256, 420);
  g.addColorStop(0.0, "#5a1820");
  g.addColorStop(0.35, "#2b0c12");
  g.addColorStop(1.0, "#0b0407");

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);

  ctx.globalAlpha = 0.08;
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * c.width;
    const y = Math.random() * c.height;
    const r = Math.random() * 1.2;
    ctx.fillStyle = Math.random() > 0.5 ? "#000" : "#fff";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  return tex;
}
