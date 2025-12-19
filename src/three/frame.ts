import * as THREE from "three";

type FrameOpts = {
  camera: THREE.PerspectiveCamera;
  object: THREE.Object3D;
  target: THREE.Vector3;
  fov: number;
  padding: number;
  minDist: number;
  maxDist: number;
};

/**
 * Position camera so that object fits vertically with padding.
 * Keeps camera looking at target; stable, aspect-aware framing.
 */
export function frameObjectToCamera(opts: FrameOpts) {
  const { camera, object, target, fov, padding, minDist, maxDist } = opts;
  camera.fov = fov;
  camera.updateProjectionMatrix();

  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  box.getSize(size);

  const height = size.y * padding;
  const width = size.x * padding;
  const vFov = (camera.fov * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const distV = (height / 2) / Math.tan(vFov / 2);
  const distH = (width / 2) / Math.tan(hFov / 2);
  const dist = Math.max(distV, distH, minDist);
  const clamped = THREE.MathUtils.clamp(dist, minDist, maxDist);

  camera.position.set(target.x, target.y + size.y * 0.1, target.z + clamped);
  camera.lookAt(target);
}
