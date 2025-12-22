import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { TREE_MODEL_URL } from "../config/assets";
import { GLOW, TREE } from "../config/tuning";

export type FlameSprite = {
  sprite: THREE.Sprite;
  baseScale: THREE.Vector2;
  phase: number;
};

export type TreeEffects = {
  starMesh: THREE.Mesh | null;
  starHalo: THREE.Sprite | null;
  starLight: THREE.PointLight | null;
  candleLight: THREE.PointLight | null;
  flameLight: THREE.PointLight | null;
  candleEmissiveMats: THREE.MeshStandardMaterial[];
  flameSprites: FlameSprite[];
};

export type TreeLoadResult = {
  model: THREE.Object3D | null;
  trunkMesh: THREE.Mesh | null;
  effects: TreeEffects;
};

const findByName = (root: THREE.Object3D, name: string): THREE.Object3D | null => {
  let hit: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (o.name === name) hit = o;
  });
  return hit;
};

export const findMeshByName = (root: THREE.Object3D, name: string): THREE.Mesh | null => {
  let hit: THREE.Mesh | null = null;
  root.traverse((o: any) => {
    if (o?.isMesh && o.name === name) hit = o as THREE.Mesh;
  });
  return hit;
};

const createHaloTexture = () => {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const g = ctx.createRadialGradient(32, 32, 6, 32, 32, 30);
  g.addColorStop(0, "rgba(255, 217, 135, 0.95)");
  g.addColorStop(0.5, "rgba(255, 201, 102, 0.45)");
  g.addColorStop(1, "rgba(255, 195, 88, 0.0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return c;
};

const createFlameTexture = () => {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const g = ctx.createRadialGradient(32, 40, 2, 32, 40, 28);
  g.addColorStop(0, "rgba(255, 213, 138, 0.95)");
  g.addColorStop(0.45, "rgba(255, 159, 58, 0.55)");
  g.addColorStop(1, "rgba(255, 159, 58, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return c;
};

const addCandleFlames = (opts: {
  wick: THREE.Mesh;
  target: THREE.Object3D;
  stage: { treeX: number; treeZ: number; groundY: number };
  scene: THREE.Scene;
  bloomLayer: number;
  flameSprites: FlameSprite[];
}): { flameLight: THREE.PointLight | null; candleLight: THREE.PointLight | null } => {
  const { wick, target, stage, scene, bloomLayer, flameSprites } = opts;
  const geom = wick.geometry as THREE.BufferGeometry;
  const posAttr = geom.getAttribute("position") as THREE.BufferAttribute | null;
  if (!posAttr) return { flameLight: null, candleLight: null };

  const worldBox = new THREE.Box3().setFromObject(wick);
  const yMin = worldBox.min.y;
  const yMax = worldBox.max.y;
  const yCut = yMin + (yMax - yMin) * 0.7;
  const point = new THREE.Vector3();
  const buckets = new Map<string, { sum: THREE.Vector3; count: number }>();
  const cell = 0.22;

  for (let i = 0; i < posAttr.count; i++) {
    point.fromBufferAttribute(posAttr, i);
    wick.localToWorld(point);
    if (point.y < yCut) continue;
    const key = `${Math.floor(point.x / cell)}:${Math.floor(point.z / cell)}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.sum.add(point);
      bucket.count += 1;
    } else {
      buckets.set(key, { sum: point.clone(), count: 1 });
    }
  }

  if (buckets.size === 0) return { flameLight: null, candleLight: null };
  const flameTex = new THREE.CanvasTexture(createFlameTexture());
  flameTex.colorSpace = THREE.SRGBColorSpace;
  const flameMat = new THREE.SpriteMaterial({
    map: flameTex,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  for (const bucket of buckets.values()) {
    const center = bucket.sum.multiplyScalar(1 / bucket.count);
    const local = target.worldToLocal(center.clone());
    const sprite = new THREE.Sprite(flameMat.clone());
    sprite.position.copy(local).add(new THREE.Vector3(0, 0.06, 0));
    sprite.scale.set(0.1, 0.16, 1);
    sprite.layers.enable(bloomLayer);
    target.add(sprite);
    flameSprites.push({
      sprite,
      baseScale: new THREE.Vector2(0.1, 0.16),
      phase: Math.random() * Math.PI * 2,
    });
  }

  const flameLight = new THREE.PointLight(0xffb24a, 0.45, 5);
  flameLight.position.set(stage.treeX, stage.groundY + 1.4, stage.treeZ);
  scene.add(flameLight);

  const candleLight = new THREE.PointLight(0xffc36a, GLOW.candleLight, 2.5);
  candleLight.position.set(stage.treeX, stage.groundY + 1.0, stage.treeZ);
  scene.add(candleLight);

  return { flameLight, candleLight };
};

export async function loadTreeModel(opts: {
  loader: GLTFLoader;
  rig: THREE.Group;
  trunkGroup: THREE.Group;
  crownGroup: THREE.Group;
  decoGroup: THREE.Group;
  stage: { treeX: number; treeZ: number; groundY: number };
  scene: THREE.Scene;
  bloomLayer: number;
  haloOffset: THREE.Vector3;
}): Promise<TreeLoadResult> {
  const effects: TreeEffects = {
    starMesh: null,
    starHalo: null,
    starLight: null,
    candleLight: null,
    flameLight: null,
    candleEmissiveMats: [],
    flameSprites: [],
  };

  let model: THREE.Object3D | null = null;
  try {
    const gltf = await opts.loader.loadAsync(TREE_MODEL_URL);
    model = gltf.scene;
  } catch (e) {
    model = null;
  }

  if (!model) return { model: null, trunkMesh: null, effects };

  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);

  model.position.sub(center);
  const scale = TREE.targetHeight / Math.max(size.y, 0.001);
  model.scale.setScalar(scale);

  model.position.y = 0;
  model.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(model);
  model.position.y += -scaledBox.min.y;
  opts.rig.add(model);

  const trunkMesh = findMeshByName(model, "mesh1356770401_1");

  model.traverse((o) => {
    if (!o?.isMesh) return;
    if (o.name === "mesh1356770401_1") return;
    const mesh = o as THREE.Mesh;
    if (!mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const mat = m as THREE.MeshStandardMaterial;
      if ("roughness" in mat) mat.roughness = Math.min(mat.roughness ?? 1, 0.85);
      if ("metalness" in mat) mat.metalness = Math.max(mat.metalness ?? 0, 0.05);
      (mat as any).fog = true;
    }
  });

  if (trunkMesh) {
    const trunkMat = new THREE.MeshStandardMaterial({
      color: "#5b3b2f",
      roughness: 0.9,
      metalness: 0.0,
    });
    trunkMat.fog = false;
    trunkMesh.material = trunkMat;
    trunkMesh.visible = true;
    const mats = Array.isArray(trunkMesh.material) ? trunkMesh.material : [trunkMesh.material];
    for (const mat of mats) {
      (mat as THREE.Material).transparent = false;
      (mat as THREE.Material).opacity = 1;
    }
    trunkMesh.renderOrder = 30;
    trunkMesh.frustumCulled = false;
  }

  const star = findByName(model, "group1533398606") as THREE.Mesh | null;
  if (star && (star as any).isMesh) {
    const mat = star.material as THREE.MeshStandardMaterial;
    if (!("emissive" in mat)) {
      star.material = new THREE.MeshStandardMaterial({ color: 0xffd36a });
    }
    const sm = star.material as THREE.MeshStandardMaterial;
    sm.color.set("#f5d36a");
    sm.emissive.set("#fff2b0");
    sm.emissiveIntensity = GLOW.starEmissive;
    effects.starMesh = star;
    star.layers.enable(opts.bloomLayer);

    const haloTex = new THREE.CanvasTexture(createHaloTexture());
    haloTex.colorSpace = THREE.SRGBColorSpace;
    const haloMat = new THREE.SpriteMaterial({
      map: haloTex,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    effects.starHalo = new THREE.Sprite(haloMat);
    effects.starHalo.scale.setScalar(0.35);
    effects.starHalo.position.copy(opts.haloOffset);
    star.add(effects.starHalo);

    effects.starLight = new THREE.PointLight(0xfff2b0, GLOW.starLight, 3);
    opts.scene.add(effects.starLight);
  }

  const crown = findByName(model, "mesh1356770401_2") as THREE.Mesh | null;
  const wick = findByName(model, "mesh1356770401_17") as THREE.Mesh | null;
  if (wick && wick.material) {
    const mats = Array.isArray(wick.material) ? wick.material : [wick.material];
    for (const m of mats) {
      const mat = m as THREE.MeshStandardMaterial;
      if (!("emissive" in mat)) continue;
      mat.color.setHex(0xffffff);
      mat.emissive.setHex(0xffc36a);
      mat.emissiveIntensity = GLOW.candleEmissive;
      effects.candleEmissiveMats.push(mat);
    }
  }

  opts.rig.updateMatrixWorld(true);
  model.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  model.traverse((o) => {
    if ((o as any).isMesh) meshes.push(o as THREE.Mesh);
  });
  for (const mesh of meshes) {
    if (mesh === trunkMesh) {
      opts.trunkGroup.attach(mesh);
    } else if (mesh === crown || mesh === star) {
      opts.crownGroup.attach(mesh);
    } else {
      opts.decoGroup.attach(mesh);
    }
  }
  opts.rig.remove(model);

  if (wick) {
    const { flameLight, candleLight } = addCandleFlames({
      wick,
      target: opts.decoGroup,
      stage: opts.stage,
      scene: opts.scene,
      bloomLayer: opts.bloomLayer,
      flameSprites: effects.flameSprites,
    });
    effects.flameLight = flameLight;
    effects.candleLight = candleLight;
  }

  return { model, trunkMesh, effects };
}

export function updateTreeEffects(opts: {
  effects: TreeEffects;
  dt: number;
  glow: number;
  camera: THREE.PerspectiveCamera;
  stage: { treeX: number; treeZ: number; groundY: number };
  baseEmissive: { star: number; candle: number };
  basePointLights: { star: number; candle: number };
}) {
  const { effects, dt, glow, camera, stage, baseEmissive, basePointLights } = opts;
  if (effects.starMesh && (effects.starMesh.material as any)?.emissive) {
    const t = performance.now() * 0.001;
    const pulse = 1.0 + Math.sin(t * 1.6) * 0.25;
    (effects.starMesh.material as THREE.MeshStandardMaterial).emissiveIntensity =
      baseEmissive.star * glow * pulse;
  }
  if (effects.starMesh && effects.starHalo) {
    const pulse = 0.8 + Math.sin(performance.now() * 0.0016) * 0.2;
    const starWorldPos = new THREE.Vector3();
    effects.starMesh.getWorldPosition(starWorldPos);
    const dist = camera.position.distanceTo(starWorldPos);
    const scale = THREE.MathUtils.clamp(dist * 0.08, 0.22, 0.55);
    effects.starHalo.scale.setScalar(scale);
    (effects.starHalo.material as THREE.SpriteMaterial).opacity = 0.45 + pulse * 0.25;
    if (effects.starLight) {
      effects.starLight.position.copy(starWorldPos);
      effects.starLight.intensity = basePointLights.star * glow;
    }
  }

  if (effects.candleLight) {
    effects.candleLight.position.set(stage.treeX, stage.groundY + 1.0, stage.treeZ);
    effects.candleLight.intensity = basePointLights.candle * glow;
  }

  if (effects.candleEmissiveMats.length > 0) {
    const t = performance.now() * 0.001;
    for (let i = 0; i < effects.candleEmissiveMats.length; i++) {
      effects.candleEmissiveMats[i].emissiveIntensity =
        baseEmissive.candle * glow + Math.sin(t * 8 + i) * 0.2;
    }
  }

  if (effects.flameSprites.length > 0) {
    const t = performance.now() * 0.001;
    for (const flame of effects.flameSprites) {
      const flicker = Math.sin(t * 7 + flame.phase) * 0.15 + Math.sin(t * 11 + flame.phase) * 0.07;
      const mat = flame.sprite.material as THREE.SpriteMaterial;
      mat.opacity = 0.75 + flicker;
      flame.sprite.scale.set(
        flame.baseScale.x,
        flame.baseScale.y * (0.9 + Math.sin(t * 8 + flame.phase) * 0.12),
        1
      );
    }
  }

  if (effects.flameLight) {
    effects.flameLight.position.set(stage.treeX, stage.groundY + 1.4, stage.treeZ);
  }
}
