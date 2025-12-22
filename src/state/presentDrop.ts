import * as THREE from "three";
import { DROP } from "../config/tuning";

export type TreeMetrics = {
  treeBounds: { center: { x: number; y: number; z: number }; size: { x: number; y: number; z: number } };
  stage: { groundY: number; treeX: number; treeZ: number };
};

export type DropController = {
  start: (metrics: TreeMetrics | null | undefined) => void;
  update: (dt: number) => boolean;
  isLanded: () => boolean;
  getLanding: () => THREE.Vector3;
};

export function computeLanding(metrics: TreeMetrics): { x: number; y: number; z: number } {
  const { center, size } = metrics.treeBounds;
  return {
    x: center.x + size.x * DROP.landingOffset.x,
    y: metrics.stage.groundY + DROP.landingYOffset,
    z: center.z + size.z * DROP.landingOffset.z,
  };
}

export function createDropController(opts: {
  giftGroup: THREE.Object3D;
  showGift: () => void;
  camera: THREE.Camera;
}): DropController {
  const landing = new THREE.Vector3();
  let present: THREE.Object3D | null = null;
  let velocityY = 0;
  let landed = false;

  const start = (metrics: TreeMetrics | null | undefined) => {
    if (!metrics) return;
    const landingPoint = computeLanding(metrics);
    landing.set(landingPoint.x, landingPoint.y, landingPoint.z);

    present = opts.giftGroup;
    opts.showGift();
    present.visible = true;
    present.position.copy(landing).add(new THREE.Vector3(0, DROP.startHeight, 0));
    present.rotation.set(0, Math.random() * Math.PI * 2, 0);
    present.scale.setScalar(DROP.scale);
    velocityY = 0;
    landed = false;

    present.position.clone().project(opts.camera);
  };

  const update = (dt: number) => {
    if (!present || landed) return landed;
    velocityY += DROP.gravity * dt;
    present.position.y -= velocityY * dt;
    present.rotation.y += dt * DROP.spinSpeed;
    if (present.position.y <= landing.y) {
      present.position.y = landing.y + DROP.landBounce;
      landed = true;
    }
    return landed;
  };

  return {
    start,
    update,
    isLanded: () => landed,
    getLanding: () => landing.clone(),
  };
}
