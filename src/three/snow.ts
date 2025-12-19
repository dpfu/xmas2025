import * as THREE from "three";

export type SnowLayer = {
  points: THREE.Points;
  update: (dt: number) => void;
};

type SnowOpts = {
  count: number;
  areaRadius: number;
  areaHeight: number;
  fallSpeed: number;
  sizeMin: number;
  sizeMax: number;
  windAmp: number;
  opacity: number;
  zPos: number;
};

/**
 * Simple CPU-updated snow layer: slow fall with gentle sinusoidal drift.
 * Lightweight and stylized (no textures).
 */
export function createSnowLayer(opts: SnowOpts): SnowLayer {
  const positions = new Float32Array(opts.count * 3);
  const phases = new Float32Array(opts.count * 2); // phaseX, phaseZ
  const speeds = new Float32Array(opts.count);
  const sizes = new Float32Array(opts.count);

  const randPos = () => {
    const r = Math.sqrt(Math.random()) * opts.areaRadius;
    const theta = Math.random() * Math.PI * 2;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    const y = Math.random() * opts.areaHeight;
    return { x, y, z };
  };

  for (let i = 0; i < opts.count; i++) {
    const p = randPos();
    positions[i * 3 + 0] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;
    phases[i * 2 + 0] = Math.random() * Math.PI * 2;
    phases[i * 2 + 1] = Math.random() * Math.PI * 2;
    speeds[i] = opts.fallSpeed * (0.8 + Math.random() * 0.4);
    sizes[i] = THREE.MathUtils.lerp(opts.sizeMin, opts.sizeMax, Math.random());
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    uniforms: {
      uOpacity: { value: opts.opacity },
      uWindAmp: { value: opts.windAmp },
      uTime: { value: 0 },
    },
    vertexShader: `
      attribute float size;
      uniform float uTime;
      uniform float uWindAmp;
      varying float vOpacity;
      void main() {
        vec3 p = position;
        // simple wind sway
        p.x += sin(uTime * 0.35 + p.y * 0.12) * uWindAmp;
        p.z += cos(uTime * 0.27 + p.y * 0.18) * uWindAmp;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = size * (1.0 / -mvPosition.z) * 90.0;
        vOpacity = 1.0 - smoothstep(0.0, 0.8, p.y / ${opts.areaHeight.toFixed(2)});
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying float vOpacity;
      void main() {
        vec2 c = gl_PointCoord * 2.0 - 1.0;
        float r = dot(c, c);
        float alpha = smoothstep(1.0, 0.2, r) * uOpacity * vOpacity;
        if (alpha <= 0.001) discard;
        gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  points.position.z = opts.zPos;

  const update = (dt: number) => {
    material.uniforms.uTime.value += dt;
    for (let i = 0; i < opts.count; i++) {
      let y = positions[i * 3 + 1];
      y -= speeds[i] * dt;
      if (y < 0) {
        y = opts.areaHeight;
      }
      positions[i * 3 + 1] = y;
    }
    (geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  };

  return { points, update };
}
