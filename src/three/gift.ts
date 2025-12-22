import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GIFT_MODEL_URL } from "../config/assets";
import { GIFT } from "../config/tuning";

export async function loadGiftModel(loader: GLTFLoader, giftGroup: THREE.Group): Promise<number> {
  let giftHalfHeight = 0.35;
  try {
    const gltfGift = await loader.loadAsync(GIFT_MODEL_URL);
    const gift = gltfGift.scene;

    const box = new THREE.Box3().setFromObject(gift);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    gift.position.sub(center);

    const s = GIFT.targetHeight / Math.max(size.y, 0.001);
    gift.scale.setScalar(s);

    giftGroup.add(gift);

    const gBox = new THREE.Box3().setFromObject(gift);
    const gSize = new THREE.Vector3();
    gBox.getSize(gSize);
    giftHalfHeight = gSize.y / 2;
  } catch (e) {
    const ph = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.6, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x44aa55, roughness: 0.9 })
    );
    giftGroup.add(ph);
  }

  return giftHalfHeight;
}
