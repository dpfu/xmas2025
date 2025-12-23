import * as THREE from "three";

export type TreeMetrics = {
  treeBounds: { center: { x: number; y: number; z: number }; size: { x: number; y: number; z: number } };
  stage: { groundY: number; treeX: number; treeZ: number };
};

export type AnvilDropController = {
  start: (metrics: TreeMetrics | null | undefined) => void;
  update: (dt: number) => boolean;
  isActive: () => boolean;
};

const ANVIL_GRAVITY = 11;
const ANVIL_START_HEIGHT = 3.6;
const ANVIL_SETTLE_GRAVITY = 6;

export function createAnvilDropController(opts: {
  scene: THREE.Scene;
  createAnvilInstance: () => { object: THREE.Object3D; size: THREE.Vector3 } | null;
  onImpact: () => void;
}): AnvilDropController {
  let anvil: THREE.Object3D | null = null;
  let velocityY = 0;
  let landingY = 0;
  let groundY = 0;
  let impactHandled = false;
  let settling = false;
  let active = false;

  const start = (metrics: TreeMetrics | null | undefined) => {
    if (!metrics) return;
    const instance = opts.createAnvilInstance();
    if (!instance) return;

    const { center, size } = metrics.treeBounds;
    landingY = center.y + size.y * 0.4 + instance.size.y * 0.5;
    groundY = metrics.stage.groundY + instance.size.y * 0.5;
    anvil = instance.object;
    anvil.position.set(center.x, landingY + ANVIL_START_HEIGHT, center.z);
    anvil.rotation.set(-0.08, Math.PI * 0.55, 0);
    anvil.visible = true;
    opts.scene.add(anvil);
    velocityY = 0;
    impactHandled = false;
    settling = false;
    active = true;
  };

  const update = (dt: number) => {
    if (!anvil || !active) return false;
    const gravity = settling ? ANVIL_SETTLE_GRAVITY : ANVIL_GRAVITY;
    velocityY += gravity * dt;
    anvil.position.y -= velocityY * dt;
    if (!settling && anvil.position.y <= landingY) {
      anvil.position.y = landingY;
      settling = true;
      if (!impactHandled) {
        impactHandled = true;
        opts.onImpact();
      }
      velocityY = 0.4;
    }
    if (settling && anvil.position.y <= groundY) {
      anvil.position.y = groundY;
      active = false;
      return true;
    }
    return false;
  };

  return {
    start,
    update,
    isActive: () => active,
  };
}
