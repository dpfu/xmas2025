import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ANVIL_MODEL_URL } from "../config/assets";

export type AnvilPrototype = {
  root: THREE.Object3D;
  size: THREE.Vector3;
};

const ANVIL_TARGET_HEIGHT = 1.05;

function normalizeModel(root: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);
  root.position.sub(center);

  const s = ANVIL_TARGET_HEIGHT / Math.max(size.y, 0.001);
  root.scale.setScalar(s);

  const finalBox = new THREE.Box3().setFromObject(root);
  const finalSize = new THREE.Vector3();
  finalBox.getSize(finalSize);

  return finalSize;
}

export async function loadAnvilPrototype(loader: GLTFLoader): Promise<AnvilPrototype> {
  try {
    const gltf = await loader.loadAsync(ANVIL_MODEL_URL);
    const anvil = gltf.scene;
    const size = normalizeModel(anvil);
    return { root: anvil, size };
  } catch (e) {
    const ph = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.6, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x2f2f2f, roughness: 0.6 })
    );
    const size = normalizeModel(ph);
    return { root: ph, size };
  }
}
