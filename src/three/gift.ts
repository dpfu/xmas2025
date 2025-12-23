import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GIFT_MODEL_URLS } from "../config/assets";
import { GIFT } from "../config/tuning";

export type GiftPrototype = {
  root: THREE.Object3D;
  size: THREE.Vector3;
};

function normalizeGiftModel(root: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);
  root.position.sub(center);

  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const s = GIFT.targetHeight / maxDim;
  root.scale.setScalar(s);

  const finalBox = new THREE.Box3().setFromObject(root);
  const finalSize = new THREE.Vector3();
  finalBox.getSize(finalSize);

  return finalSize;
}

export async function loadGiftPrototypes(loader: GLTFLoader): Promise<GiftPrototype[]> {
  const prototypes: GiftPrototype[] = [];
  for (const url of GIFT_MODEL_URLS) {
    try {
      const gltfGift = await loader.loadAsync(url);
      const gift = gltfGift.scene;
      const size = normalizeGiftModel(gift);
      prototypes.push({ root: gift, size });
    } catch (e) {
      const ph = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.6, 0.6),
        new THREE.MeshStandardMaterial({ color: 0x44aa55, roughness: 0.9 })
      );
      const size = normalizeGiftModel(ph);
      prototypes.push({ root: ph, size });
    }
  }

  return prototypes;
}
