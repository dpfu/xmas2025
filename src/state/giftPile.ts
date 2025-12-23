import * as THREE from "three";
import { DROP } from "../config/tuning";

export type TreeMetrics = {
  treeBounds: { center: { x: number; y: number; z: number }; size: { x: number; y: number; z: number } };
  stage: { groundY: number; treeX: number; treeZ: number };
};

type GiftBody = {
  object: THREE.Object3D;
  velocity: THREE.Vector3;
  size: THREE.Vector3;
  radius: number;
  spin: number;
  settled: boolean;
  hovered: boolean;
  opening: boolean;
  baseScale: number;
  openTime: number;
  openStartY: number;
  openSpin: number;
};

export type GiftPileController = {
  dropGift: (metrics: TreeMetrics | null | undefined, greetingIndex?: number) => void;
  update: (dt: number) => void;
  lastDropSettled: () => boolean;
  findGreetingIndex: (target: THREE.Object3D) => number | null;
  setHovered: (target: THREE.Object3D | null) => void;
  openGift: (target: THREE.Object3D) => number | null;
};

const DROP_ATTEMPTS = 12;

// TODO: replace with full engine via https://github.com/lo-th/phy and physx-js-webidl.
export function createGiftPileController(opts: {
  scene: THREE.Scene;
  createGiftInstance: () => { object: THREE.Object3D; size: THREE.Vector3 } | null;
}): GiftPileController {
  const pileGroup = new THREE.Group();
  opts.scene.add(pileGroup);
  const bodies: GiftBody[] = [];
  let lastDropped: GiftBody | null = null;
  let groundY = -0.28;

  const pickDropPoint = (metrics: TreeMetrics) => {
    const size = metrics.treeBounds.size;
    const baseRadius = Math.max(size.x, size.z) * 0.45 + 0.2;
    const minRadius = Math.max(size.x, size.z) * 0.25 + 0.1;
    const frontBias = Math.max(size.z, 0.6) * 0.18;
    for (let attempt = 0; attempt < DROP_ATTEMPTS; attempt += 1) {
      const angle = (Math.random() * 0.9 - 0.45) * Math.PI;
      const radius = minRadius + Math.random() * (baseRadius - minRadius);
      const x = metrics.stage.treeX + Math.sin(angle) * radius;
      const z = metrics.stage.treeZ + Math.cos(angle) * radius + frontBias;
      let ok = true;
      for (const body of bodies) {
        const dx = x - body.object.position.x;
        const dz = z - body.object.position.z;
        if (dx * dx + dz * dz < (body.radius * 1.8) ** 2) {
          ok = false;
          break;
        }
      }
      if (ok) return { x, z };
    }
    return { x: metrics.stage.treeX, z: metrics.stage.treeZ + baseRadius + 0.2 };
  };

  const dropGift = (metrics: TreeMetrics | null | undefined, greetingIndex?: number) => {
    if (!metrics) return;
    const instance = opts.createGiftInstance();
    if (!instance) return;

    groundY = metrics.stage.groundY;
    const size = instance.size.clone().multiplyScalar(DROP.scale);
    const radius = Math.max(size.x, size.z) * 0.5;
    const pos = pickDropPoint(metrics);

    instance.object.position.set(pos.x, groundY + DROP.startHeight + size.y, pos.z);
    instance.object.rotation.set(0, Math.random() * Math.PI * 2, 0);
    instance.object.scale.multiplyScalar(DROP.scale);
    instance.object.visible = true;
    if (typeof greetingIndex === "number") {
      instance.object.userData.greetingIndex = greetingIndex;
    }

    const body: GiftBody = {
      object: instance.object,
      velocity: new THREE.Vector3(0, 0, 0),
      size,
      radius,
      spin: (Math.random() - 0.5) * 1.2,
      settled: false,
      hovered: false,
      opening: false,
      baseScale: instance.object.scale.x,
      openTime: 0,
      openStartY: instance.object.position.y,
      openSpin: (Math.random() * 0.6 + 0.4) * (Math.random() > 0.5 ? 1 : -1),
    };

    pileGroup.add(instance.object);
    bodies.push(body);
    lastDropped = body;
  };

  const resolveStacking = () => {
    const sorted = [...bodies].sort((a, b) => a.object.position.y - b.object.position.y);
    for (const body of sorted) {
      let supportY = groundY;
      for (const other of sorted) {
        if (other === body) continue;
        const dx = body.object.position.x - other.object.position.x;
        const dz = body.object.position.z - other.object.position.z;
        const minDist = body.radius + other.radius;
        if (dx * dx + dz * dz > minDist * minDist) continue;
        const topY = other.object.position.y + other.size.y;
        if (topY > supportY && body.object.position.y - body.size.y <= topY + 0.02) {
          supportY = topY;
        }
      }
      const minY = supportY + body.size.y;
      if (body.object.position.y < minY) {
        body.object.position.y = minY;
        body.velocity.y = 0;
        body.settled = true;
      }
    }
  };

  const update = (dt: number) => {
    const toRemove: GiftBody[] = [];
    for (const body of bodies) {
      if (body.opening) {
        body.openTime += dt;
        const t = Math.min(body.openTime / 0.32, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        const scale = body.baseScale * (1 - ease);
        body.object.scale.setScalar(Math.max(scale, 0.001));
        body.object.position.y = body.openStartY + 0.18 * ease;
        body.object.rotation.y += body.openSpin * dt * 6;
        body.object.rotation.x += body.openSpin * dt * 3;
        if (t >= 1) {
          pileGroup.remove(body.object);
          toRemove.push(body);
        }
        continue;
      }
      body.velocity.y -= DROP.gravity * dt;
      body.object.position.y += body.velocity.y * dt;
      body.object.rotation.y += body.spin * dt;
      const targetScale = body.hovered ? body.baseScale * 1.08 : body.baseScale;
      const currentScale = body.object.scale.x;
      if (Math.abs(currentScale - targetScale) > 0.001) {
        const nextScale = THREE.MathUtils.lerp(currentScale, targetScale, dt * 8);
        body.object.scale.setScalar(nextScale);
      }
      if (body.object.position.y < groundY + body.size.y - DROP.landBounce) {
        body.object.position.y = groundY + body.size.y;
        body.velocity.y = 0;
        body.settled = true;
      } else if (Math.abs(body.velocity.y) > 0.2) {
        body.settled = false;
      }
    }

    resolveStacking();
    if (toRemove.length) {
      for (const body of toRemove) {
        const idx = bodies.indexOf(body);
        if (idx >= 0) bodies.splice(idx, 1);
      }
    }
  };

  const lastDropSettled = () => {
    if (!lastDropped) return false;
    return lastDropped.settled;
  };

  const findGreetingIndex = (target: THREE.Object3D) => {
    let node: THREE.Object3D | null = target;
    while (node) {
      const idx = node.userData?.greetingIndex;
      if (typeof idx === "number") return idx;
      node = node.parent;
    }
    return null;
  };

  const setHovered = (target: THREE.Object3D | null) => {
    const resolveRoot = (node: THREE.Object3D | null) => {
      let current = node;
      while (current) {
        if (bodies.some((body) => body.object === current)) return current;
        current = current.parent;
      }
      return null;
    };
    const root = resolveRoot(target);
    for (const body of bodies) {
      const shouldHover = root ? body.object === root : false;
      body.hovered = shouldHover;
      if (!body.object.userData.__emissiveSet) {
        body.object.traverse((child) => {
          const material = (child as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
          if (material && "emissive" in material) {
            child.userData.__baseEmissive = material.emissive?.clone?.() ?? new THREE.Color(0x000000);
          }
        });
        body.object.userData.__emissiveSet = true;
      }
      body.object.traverse((child) => {
        const material = (child as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (material && "emissive" in material) {
          const base = child.userData.__baseEmissive as THREE.Color | undefined;
          if (base) material.emissive.copy(base);
          if (shouldHover) material.emissive.addScalar(0.15);
        }
      });
    }
  };

  const openGift = (target: THREE.Object3D) => {
    let node: THREE.Object3D | null = target;
    let body: GiftBody | undefined;
    while (node && !body) {
      body = bodies.find((entry) => entry.object === node);
      node = node.parent;
    }
    if (!body || body.opening) return null;
    body.opening = true;
    body.hovered = false;
    body.openTime = 0;
    body.openStartY = body.object.position.y;
    return findGreetingIndex(body.object);
  };

  return { dropGift, update, lastDropSettled, findGreetingIndex, setHovered, openGift };
}
