import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { frameObjectToCamera } from "./frame";

describe("frameObjectToCamera", () => {
  it("uses horizontal fov to fit wide objects", () => {
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    const obj = new THREE.Group();
    obj.add(new THREE.Mesh(new THREE.BoxGeometry(10, 1, 1)));
    const target = new THREE.Vector3(0, 0, 0);

    frameObjectToCamera({
      camera,
      object: obj,
      target,
      fov: 32,
      padding: 1,
      minDist: 0,
      maxDist: 100,
    });

    const vFov = (camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const distH = (10 / 2) / Math.tan(hFov / 2);

    expect(camera.position.z).toBeCloseTo(distH, 4);
  });

  it("respects minimum distance", () => {
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    const obj = new THREE.Group();
    obj.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1)));
    const target = new THREE.Vector3(0, 0, 0);

    frameObjectToCamera({
      camera,
      object: obj,
      target,
      fov: 32,
      padding: 1,
      minDist: 5,
      maxDist: 100,
    });

    expect(camera.position.z).toBeCloseTo(5, 4);
  });
});
