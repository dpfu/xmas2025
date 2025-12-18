import type { Voucher } from "../config/vouchers";

/**
 * Render a voucher as an SVG string (easy to export to PNG locally).
 * Keep it simple: text + shapes. You can later add textures/patterns.
 */
export function voucherToSVG(v: Voucher, opts?: { width?: number; height?: number }) {
  const width = opts?.width ?? 1200;
  const height = opts?.height ?? 675;

  // Perforated edge effect via clipPath-ish rectangles
  const holes = Array.from({ length: 44 }).map((_, i) => {
    const x = 18 + i * ((width - 36) / 43);
    return `<circle cx="${x}" cy="18" r="6" fill="white" opacity="0.9" />
            <circle cx="${x}" cy="${height-18}" r="6" fill="white" opacity="0.9" />`;
  }).join("");

  const safe = (s: string) => s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <pattern id="paperGrain" width="22" height="22" patternUnits="userSpaceOnUse">
      <circle cx="4" cy="5" r="0.8" fill="#6E5C3A" opacity="0.035"/>
      <circle cx="15" cy="9" r="0.7" fill="#6E5C3A" opacity="0.03"/>
      <circle cx="9" cy="17" r="0.6" fill="#6E5C3A" opacity="0.03"/>
    </pattern>
    <pattern id="lines" width="6" height="6" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="6" y2="0" stroke="#000" opacity="0.015"/>
    </pattern>
    <linearGradient id="paper" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#FBFAF6"/>
      <stop offset="100%" stop-color="#F0ECE3"/>
    </linearGradient>
    <linearGradient id="foil" x1="0" x2="1">
      <stop offset="0%" stop-color="#6a4b0f"/>
      <stop offset="18%" stop-color="#c79f40"/>
      <stop offset="32%" stop-color="#ffefc0"/>
      <stop offset="55%" stop-color="#b88f30"/>
      <stop offset="80%" stop-color="#f5df9f"/>
      <stop offset="100%" stop-color="#6a4b0f"/>
    </linearGradient>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#f7f7fb"/>
      <stop offset="100%" stop-color="#ffffff"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000" flood-opacity="0.18"/>
    </filter>
    <filter id="ink" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.8"/>
    </filter>
    <filter id="softTitleShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity="0.08"/>
    </filter>
    <style>
      text { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; }
    </style>
  </defs>

  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#bg)"/>
  <g filter="url(#shadow)">
    <rect x="50" y="50" rx="28" ry="28" width="${width-100}" height="${height-100}" fill="url(#paper)" stroke="#d8cdbb" stroke-width="2"/>
    <rect x="62" y="62" rx="22" ry="22" width="${width-124}" height="${height-124}" fill="none" stroke="#CFC6B6" stroke-width="2" opacity="0.8"/>
    <rect x="62" y="62" rx="22" ry="22" width="${width-124}" height="${height-124}" fill="none" stroke="#0f5132" stroke-opacity="0.12" stroke-width="2"/>
    <rect x="50" y="50" rx="28" ry="28" width="${width-100}" height="${height-100}" fill="url(#paperGrain)" opacity="0.55"/>
    <rect x="50" y="50" rx="28" ry="28" width="${width-100}" height="${height-100}" fill="url(#lines)" opacity="0.35"/>
  </g>

  <!-- perforation -->
  <g>${holes}</g>

  <!-- watermark -->
  <text x="${width * 0.68}" y="${height * 0.6}" font-size="300" fill="#0f5132" opacity="0.035" text-anchor="middle">✻</text>

  <!-- ribbon band -->
  <rect x="80" y="${height - 210}" width="${width - 160}" height="18" rx="9" fill="#0f5132" opacity="0.14"/>

  <!-- header -->
  <text x="90" y="150" font-size="54" font-weight="700" fill="url(#foil)" filter="url(#softTitleShadow)">${safe(v.title)}</text>
  <text x="90" y="210" font-size="30" fill="#333">${safe(v.subtitle)}</text>
  <line x1="90" y1="240" x2="${width-90}" y2="240" stroke="#0f5132" stroke-width="2" opacity="0.35"/>

  <!-- stamp -->
  <g filter="url(#ink)" transform="translate(${width-380}, 120) rotate(-10)">
    <rect x="0" y="0" width="280" height="84" rx="14" fill="#7a1f2b"/>
    <text x="140" y="55" text-anchor="middle" font-size="34" font-weight="700" fill="#fff">${safe(v.stamp)}</text>
  </g>

  <!-- fine print -->
  <text x="90" y="${height-170}" font-size="22" fill="#444">
    ${safe(v.fineprint)}
  </text>

  <text x="90" y="${height-110}" font-size="18" fill="#777">
    Generated locally • No tracking • Happy holidays
  </text>

  <!-- corner snowflakes -->
  <text x="86" y="110" font-size="22" fill="#0f5132" opacity="0.18">✻</text>
  <text x="${width-110}" y="110" font-size="22" fill="#0f5132" opacity="0.18">✻</text>
  <text x="86" y="${height-90}" font-size="22" fill="#0f5132" opacity="0.18">✻</text>
  <text x="${width-110}" y="${height-90}" font-size="22" fill="#0f5132" opacity="0.18">✻</text>
</svg>`;
}

export async function svgToPngBlob(svg: string, width: number, height: number): Promise<Blob> {
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode();

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");

  ctx.drawImage(img, 0, 0, width, height);
  URL.revokeObjectURL(url);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed"))), "image/png");
  });
}
