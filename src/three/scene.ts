import * as THREE from "three";
import { TREE_MODEL_URL, GIFT_MODEL_URL } from "../config/assets";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { createSnowLayer, type SnowLayer } from "./snow";
import { STAGE, getLayoutMode } from "../config/layout";
import { frameObjectToCamera } from "./frame";

export type SceneHandles = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  treeGroup: THREE.Group;
  giftGroup: THREE.Group;
  render: () => void;
  setSpinVelocity: (v: number) => void;
  showGift: () => void;
  hideGift: () => void;
  setSize: (w: number, h: number) => void;
  toggleDebug?: (on: boolean) => void;
  toggleTrunkDoubleSide?: () => void;
  toggleTrunkDepthTest?: () => void;
  toggleEnv?: () => void;
  setRevealFactor?: (t: number) => void;
  getDebugState?: () => {
    camera: { x: number; y: number; z: number; fov: number; aspect: number };
    target: { x: number; y: number; z: number };
    treeBounds: { center: { x: number; y: number; z: number }; size: { x: number; y: number; z: number } };
    stage: { groundY: number; treeX: number; treeZ: number };
  };
  update: (dt: number) => void;
};

export function findMeshByName(root: THREE.Object3D, name: string): THREE.Mesh | null {
  let hit: THREE.Mesh | null = null;
  root.traverse((o: any) => {
    if (o?.isMesh && o.name === name) hit = o as THREE.Mesh;
  });
  return hit;
}

export async function createScene(canvas: HTMLCanvasElement): Promise<SceneHandles> {
  const BLOOM_LAYER = 1;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.setClearAlpha(0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xbcc9d9, 2.8, 10.0);
  const snowLayers: SnowLayer[] = [];
  const debugHelpers: THREE.Object3D[] = [];
  let debugVisible = false;
  const treeBounds = {
    box: new THREE.Box3(),
    size: new THREE.Vector3(),
    center: new THREE.Vector3(),
  };
  type LabelHandle = {
    sprite: THREE.Sprite;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D | null;
    texture: THREE.CanvasTexture;
  };
  let debugHandles: {
    cross: THREE.LineSegments;
    crossLabel: LabelHandle;
    groundLine: THREE.Line;
    groundLabel: LabelHandle;
    safeFrame: THREE.Line;
    safeLabel: LabelHandle;
    boxHelper: THREE.BoxHelper;
  } | null = null;

  let mode = getLayoutMode();
  const isPortrait = () => mode === "portrait";
  const stage = {
    groundY: STAGE.groundY,
    targetY: STAGE.targetY,
    treeX: isPortrait() ? STAGE.mobile.treeX : STAGE.desktop.treeX,
    treeZ: isPortrait() ? STAGE.mobile.treeZ : STAGE.desktop.treeZ,
  };

  const camera = new THREE.PerspectiveCamera(isPortrait() ? 36 : 32, 1, 0.1, 100);
  camera.position.set(0, 1.2, 4.2);
  camera.layers.enable(BLOOM_LAYER);

  const key = new THREE.DirectionalLight(0xffffff, 1.05);
  key.position.set(3.5, 5.5, 2.5);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x9db7ff, 0.25);
  fill.position.set(-3, 2.5, 2);
  scene.add(fill);

  const amb = new THREE.AmbientLight(0xffffff, 0.22);
  scene.add(amb);

  const spot = new THREE.PointLight(0xffe7d6, 0.25, 18);
  spot.position.set(0, 2.2, -3.5);
  scene.add(spot);

  const rimLight = new THREE.DirectionalLight(0xffe2a8, 0.95);
  rimLight.position.set(-3.5, 2.2, -3.0);
  scene.add(rimLight);

  const trunkWarm = new THREE.PointLight(0xffc28a, 0.25, 2.5);
  trunkWarm.position.set(stage.treeX, stage.groundY + 0.6, stage.treeZ + 0.3);
  scene.add(trunkWarm);
  const baseLightLevels = {
    key: key.intensity,
    fill: fill.intensity,
    amb: amb.intensity,
    rim: rimLight.intensity,
    trunkWarm: trunkWarm.intensity,
  };

  // Snow ground
  const groundGeo = new THREE.PlaneGeometry(20, 20, 128, 128);
  const gPos = groundGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < gPos.count; i++) {
    const x = gPos.getX(i);
    const y = gPos.getY(i);
    const r2 = x * x + y * y;
    const hill = 0.42 * Math.exp(-r2 / 18);
    const mound = 0.07 * Math.exp(-r2 / 0.6);
    const noise = (Math.sin(x * 0.7) + Math.cos(y * 0.6)) * 0.01;
    gPos.setZ(i, hill + mound + noise);
  }
  gPos.needsUpdate = true;
  groundGeo.computeVertexNormals();
  function makeGroundAlphaFadeTexture() {
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 256;
    const ctx = c.getContext("2d");
    if (!ctx) return c;
    const g = ctx.createLinearGradient(0, 255, 0, 0);
    g.addColorStop(0.0, "rgb(255,255,255)");
    g.addColorStop(0.55, "rgb(255,255,255)");
    g.addColorStop(1.0, "rgb(0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    (tex as any).colorSpace = THREE.NoColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  const groundFade = makeGroundAlphaFadeTexture();
  groundFade.colorSpace = THREE.SRGBColorSpace;
  const groundColorMap = new THREE.CanvasTexture((() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext("2d");
    if (!ctx) return c;
    const g = ctx.createLinearGradient(0, 256, 0, 0);
    g.addColorStop(0, "#e9efff");
    g.addColorStop(1, "#f7faff");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    return c;
  })());
  groundColorMap.colorSpace = THREE.SRGBColorSpace;
  const groundMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#f4f7ff"),
    roughness: 0.98,
    metalness: 0.0,
    transparent: true,
    opacity: 1.0,
  });
  groundMat.alphaMap = groundFade;
  groundMat.depthWrite = false;
  groundMat.depthTest = true;
  groundMat.needsUpdate = true;
  groundMat.map = groundColorMap;

  const ground = new THREE.Mesh(
    groundGeo,
    groundMat
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(stage.treeX, stage.groundY - 0.36, stage.treeZ - 0.6);
  ground.renderOrder = 10;
  scene.add(ground);
  console.log("[GROUND]", {
    hasUV: !!ground.geometry.attributes.uv,
    transparent: (ground.material as any).transparent,
    depthWrite: (ground.material as any).depthWrite,
    hasAlphaMap: !!(ground.material as any).alphaMap,
  });
  console.log("[GROUND alphaMap test] expected: bottom white, top black");

  const treeGroup = new THREE.Group();
  treeGroup.position.set(stage.treeX, stage.groundY, stage.treeZ);
  treeGroup.scale.setScalar(1.0);
  treeGroup.renderOrder = 20;
  scene.add(treeGroup);
  treeGroup.visible = true;

  const rig = new THREE.Group();
  const trunkGroup = new THREE.Group();
  const crownGroup = new THREE.Group();
  const decoGroup = new THREE.Group();
  rig.add(trunkGroup, crownGroup, decoGroup);
  rig.renderOrder = 1;
  treeGroup.add(rig);

  const shadowTex = new THREE.CanvasTexture((() => {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 256;
    const ctx = c.getContext("2d");
    if (!ctx) return c;
    const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 120);
    g.addColorStop(0, "rgba(0,0,0,0.22)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    return c;
  })());
  shadowTex.colorSpace = THREE.SRGBColorSpace;
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 2.6),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.38 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(stage.treeX, stage.groundY + 0.002, stage.treeZ);
  scene.add(shadow);

  const contactShadowTex = new THREE.CanvasTexture((() => {
    const c = document.createElement("canvas");
    c.width = 128; c.height = 128;
    const ctx = c.getContext("2d");
    if (!ctx) return c;
    const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 56);
    g.addColorStop(0, "rgba(0,0,0,0.28)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return c;
  })());
  contactShadowTex.colorSpace = THREE.SRGBColorSpace;
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.7),
    new THREE.MeshBasicMaterial({ map: contactShadowTex, transparent: true, depthWrite: false, opacity: 0.28 })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.set(stage.treeX, stage.groundY + 0.003, stage.treeZ);
  scene.add(contactShadow);
  const envObjects: THREE.Object3D[] = [ground, shadow, contactShadow];
  let envVisible = true;
  const toggleEnv = () => {
    envVisible = !envVisible;
    for (const obj of envObjects) obj.visible = envVisible;
    console.log("[ENV] visible", envVisible);
  };

  const loader = new GLTFLoader();
  const bloomLayer = new THREE.Layers();
  bloomLayer.set(BLOOM_LAYER);
  const bloomComposer = new EffectComposer(renderer);
  const bloomRenderPass = new RenderPass(scene, camera);
  bloomRenderPass.clearColor = new THREE.Color(0x000000);
  bloomRenderPass.clearAlpha = 0;
  bloomComposer.renderToScreen = false;
  bloomComposer.addPass(bloomRenderPass);
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.4, 0.4, 0.85);
  const baseBloomStrength = bloomPass.strength;
  bloomComposer.addPass(bloomPass);

  const finalComposer = new EffectComposer(renderer);
  const finalRenderPass = new RenderPass(scene, camera);
  finalRenderPass.clearColor = new THREE.Color(0x000000);
  finalRenderPass.clearAlpha = 0;
  finalComposer.addPass(finalRenderPass);
  const finalPass = new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: {
        baseTexture: { value: null },
        bloomTexture: { value: bloomComposer.renderTarget2.texture },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D baseTexture;
        uniform sampler2D bloomTexture;
        varying vec2 vUv;
        void main() {
          vec4 base = texture2D(baseTexture, vUv);
          vec4 bloom = texture2D(bloomTexture, vUv);
          gl_FragColor = vec4(base.rgb + bloom.rgb, base.a);
        }
      `,
      transparent: true,
    }),
    "baseTexture"
  );
  finalComposer.addPass(finalPass);
  const baseCamPos = camera.position.clone();
  const revealZoomPos = baseCamPos.clone().add(new THREE.Vector3(0.1, 0.2, 0.7));
  const LOOK_TARGET_Y_OFFSET = -0.08;
  const lookTarget = new THREE.Vector3(stage.treeX, STAGE.targetY + LOOK_TARGET_Y_OFFSET, stage.treeZ);
  let starMesh: THREE.Mesh | null = null;
  let starHalo: THREE.Sprite | null = null;
  let starPulse = 0;
  const starWorldPos = new THREE.Vector3();
  const haloOffset = new THREE.Vector3(0, 0.05, 0.06);
  const flameSprites: { sprite: THREE.Sprite; baseScale: THREE.Vector2; phase: number }[] = [];
  const candleEmissiveMats: THREE.MeshStandardMaterial[] = [];
  let flameLight: THREE.PointLight | null = null;
  let candleLight: THREE.PointLight | null = null;
  let starLight: THREE.PointLight | null = null;
  const baseEmissive = {
    candle: 1.6,
    star: 1.8,
  };
  const basePointLights = {
    candle: 0.8,
    star: 0.6,
  };
  let yaw = 0;
  let yawVel = 0;
  let swayX = 0;
  let swayZ = 0;
  let swayVelX = 0;
  let swayVelZ = 0;
  let decoYaw = 0;
  let decoYawVel = 0;
  let revealFactor = 0;
  let trunkHelper: THREE.BoxHelper | null = null;
  let trunkMarker: THREE.Mesh | null = null;
  const trunkWorldPos = new THREE.Vector3();
  let trunkMesh: THREE.Mesh | null = null;
  let trunkDoubleSide = false;
  let trunkNoDepthTest = false;

  const applyTrunkDebug = () => {
    if (!trunkMesh) return;
    const mats = Array.isArray(trunkMesh.material) ? trunkMesh.material : [trunkMesh.material];
    for (const mat of mats) {
      if (!mat) continue;
      mat.side = trunkDoubleSide ? THREE.DoubleSide : THREE.FrontSide;
      mat.depthTest = !trunkNoDepthTest;
      mat.needsUpdate = true;
    }
  };

  function createHaloTexture() {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext("2d");
    if (!ctx) return c;
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
    g.addColorStop(0, "rgba(255, 234, 170, 0.9)");
    g.addColorStop(0.35, "rgba(255, 211, 106, 0.45)");
    g.addColorStop(1, "rgba(255, 211, 106, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return c;
  }

  function createFlameTexture() {
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
  }

  function findByName(root: THREE.Object3D, name: string): THREE.Object3D | null {
    let hit: THREE.Object3D | null = null;
    root.traverse((o) => {
      if (o.name === name) hit = o;
    });
    return hit;
  }

  function spring(current: number, velocity: number, target: number, k: number, c: number, dt: number) {
    const accel = -k * (current - target) - c * velocity;
    const nextVel = velocity + accel * dt;
    const next = current + nextVel * dt;
    return [next, nextVel] as const;
  }

  function addCandleFlames(wick: THREE.Mesh, target: THREE.Object3D) {
    const geom = wick.geometry as THREE.BufferGeometry;
    const posAttr = geom.getAttribute("position") as THREE.BufferAttribute | null;
    if (!posAttr) return;

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

    if (buckets.size === 0) return;
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
      sprite.layers.enable(BLOOM_LAYER);
      target.add(sprite);
      flameSprites.push({
        sprite,
        baseScale: new THREE.Vector2(0.1, 0.16),
        phase: Math.random() * Math.PI * 2,
      });
    }

    if (!flameLight) {
      flameLight = new THREE.PointLight(0xffb24a, 0.45, 5);
      flameLight.position.set(stage.treeX, stage.groundY + 1.4, stage.treeZ);
      scene.add(flameLight);
    }

    if (!candleLight) {
      candleLight = new THREE.PointLight(0xffc36a, basePointLights.candle, 2.5);
      candleLight.position.set(stage.treeX, stage.groundY + 1.0, stage.treeZ);
      scene.add(candleLight);
    }
  }

  function updateTreeBounds() {
    treeBounds.box.setFromObject(treeGroup);
    treeBounds.box.getSize(treeBounds.size);
    treeBounds.box.getCenter(treeBounds.center);
  }

  function frameObject() {
    updateTreeBounds();
    lookTarget.copy(treeBounds.center);
    lookTarget.y += LOOK_TARGET_Y_OFFSET;
    frameObjectToCamera({
      camera,
      object: treeGroup,
      target: lookTarget,
      fov: isPortrait() ? 36 : 32,
      padding: isPortrait() ? 1.35 : 1.2,
      minDist: isPortrait() ? 4.2 : 4.0,
      maxDist: 6.2,
    });
    updateDebugHelpers();
  }

  // Load tree model
  try {
    const gltf = await loader.loadAsync(TREE_MODEL_URL);
    const model = gltf.scene;

    // Center & scale roughly
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    model.position.sub(center);
    const targetHeight = 1.65;
    const scale = targetHeight / Math.max(size.y, 0.001);
    model.scale.setScalar(scale);

    model.position.y = 0;
    model.updateMatrixWorld(true);
    const scaledBox = new THREE.Box3().setFromObject(model);
    model.position.y += -scaledBox.min.y;
    rig.add(model);

    trunkMesh = findMeshByName(model, "mesh1356770401_1");
    if (trunkMesh) {
      const m: any = trunkMesh.material;
      console.log("[TRUNK]", {
        name: trunkMesh.name,
        matType: m?.type,
        color: m?.color?.getHexString?.(),
        roughness: m?.roughness,
        metalness: m?.metalness,
        emissive: m?.emissive?.getHexString?.(),
      });
      console.log("[TRUNK world]", trunkMesh.getWorldPosition(new THREE.Vector3()).toArray());
    } else {
      console.warn("[TRUNK] not found");
    }

    console.table({
      ambient: amb.intensity,
      key: key.intensity,
      fill: fill.intensity,
      rim: rimLight.intensity,
      candleLight: candleLight?.intensity ?? 0,
      bloom: bloomPass.strength,
    });

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
      console.log("[TRUNK fog disabled]", { fog: (trunkMesh.material as any).fog });
      trunkMesh.visible = true;
      const mats = Array.isArray(trunkMesh.material) ? trunkMesh.material : [trunkMesh.material];
      for (const mat of mats) {
        (mat as THREE.Material).transparent = false;
        (mat as THREE.Material).opacity = 1;
      }
      console.log("[TRUNK visible test]", trunkMesh.visible, (trunkMesh.material as any).transparent);
      trunkMesh.renderOrder = 30;
      trunkMesh.frustumCulled = false;
      applyTrunkDebug();
      trunkHelper = new THREE.BoxHelper(trunkMesh, 0xff00ff);
      (trunkHelper.material as THREE.Material).depthTest = false;
      trunkHelper.renderOrder = 31;
      scene.add(trunkHelper);
      trunkMesh.getWorldPosition(trunkWorldPos);
      console.log("[TRUNK scale]", trunkMesh.scale.toArray());
      console.log("[TRUNK world]", trunkWorldPos.toArray());
      const trunkBox = new THREE.Box3().setFromObject(trunkMesh);
      const trunkSize = new THREE.Vector3();
      trunkBox.getSize(trunkSize);
      console.log("[TRUNK size]", trunkSize.toArray());
      trunkMarker = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xff00ff, depthTest: false })
      );
      trunkMarker.renderOrder = 32;
      trunkMarker.position.copy(trunkWorldPos);
      scene.add(trunkMarker);
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
      sm.emissiveIntensity = 2.0;
      starMesh = star;
      star.layers.enable(BLOOM_LAYER);

      const haloTex = new THREE.CanvasTexture(createHaloTexture());
      haloTex.colorSpace = THREE.SRGBColorSpace;
      const haloMat = new THREE.SpriteMaterial({
        map: haloTex,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      starHalo = new THREE.Sprite(haloMat);
      starHalo.scale.setScalar(0.35);
      starHalo.position.copy(haloOffset);
      star.add(starHalo);

      if (!starLight) {
        starLight = new THREE.PointLight(0xfff2b0, basePointLights.star, 3);
        scene.add(starLight);
      }
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
        mat.emissiveIntensity = 1.6;
        candleEmissiveMats.push(mat);
      }
    }

    rig.updateMatrixWorld(true);
    model.updateMatrixWorld(true);
    const meshes: THREE.Mesh[] = [];
    model.traverse((o) => {
      if ((o as any).isMesh) meshes.push(o as THREE.Mesh);
    });
    for (const mesh of meshes) {
      if (mesh === trunkMesh) {
        trunkGroup.attach(mesh);
      } else if (mesh === crown || mesh === star) {
        crownGroup.attach(mesh);
      } else {
        decoGroup.attach(mesh);
      }
    }
    rig.remove(model);

    if (wick) addCandleFlames(wick, decoGroup);

    frameObject();
  } catch (e) {
    // If no model is present yet, show a placeholder cone
    const placeholder = new THREE.Mesh(
      new THREE.ConeGeometry(1, 2.4, 10),
      new THREE.MeshStandardMaterial({ color: 0x2aa84a, roughness: 1 })
    );
    placeholder.position.y = 1.2;
    crownGroup.add(placeholder);
    frameObject();
  }

  const giftGroup = new THREE.Group();
  giftGroup.position.set(stage.treeX, stage.groundY + 0.18, stage.treeZ);
  giftGroup.visible = false;
  scene.add(giftGroup);

  const giftLight = new THREE.PointLight(0xfff2cc, 0, 5);
  giftLight.position.set(0, 1.2, 1.2);
  scene.add(giftLight);

  // Snow layers (respect reduced motion)
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const snowScale = prefersReducedMotion ? 0.5 : 1;

  const snowConfigs = [
    { count: Math.floor(220 * snowScale), size: [0.7, 1.3], speed: 0.08, z: -8, opacity: 0.2 },
    { count: Math.floor(170 * snowScale), size: [1.0, 1.8], speed: 0.12, z: -3.2, opacity: 0.28 },
    { count: Math.floor(28 * snowScale), size: [1.4, 2.2], speed: 0.16, z: 0.8, opacity: 0.22 },
  ];

  for (const cfg of snowConfigs) {
    const layer = createSnowLayer({
      count: cfg.count,
      areaRadius: 4.2,
      areaHeight: 6,
      fallSpeed: cfg.speed,
      sizeMin: cfg.size[0],
      sizeMax: cfg.size[1],
      windAmp: 0.12,
      opacity: cfg.opacity,
      zPos: cfg.z,
    });
    snowLayers.push(layer);
    scene.add(layer.points);
    envObjects.push(layer.points);
  }

  // Load gift model
  let giftHalfHeight = 0.35;

  try {
    const gltfGift = await loader.loadAsync(GIFT_MODEL_URL);
    const gift = gltfGift.scene;

    // Center & scale
    const box = new THREE.Box3().setFromObject(gift);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    gift.position.sub(center);

    const targetHeight = 0.7;
    const s = targetHeight / Math.max(size.y, 0.001);
    gift.scale.setScalar(s);

    giftGroup.add(gift);

    const gBox = new THREE.Box3().setFromObject(gift);
    const gSize = new THREE.Vector3();
    gBox.getSize(gSize);
    giftHalfHeight = gSize.y / 2;
  } catch (e) {
    // Fallback placeholder if the gift model is missing
    const ph = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.6, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x44aa55, roughness: 0.9 })
    );
    giftGroup.add(ph);
  }

  // gift placement synced to tree position
  function updateGiftAnchor() {
    giftGroup.position.copy(new THREE.Vector3(stage.treeX, stage.groundY, stage.treeZ)).add(
      new THREE.Vector3(STAGE.giftOffset.x, STAGE.giftOffset.y, STAGE.giftOffset.z)
    );
    giftGroup.position.y = stage.groundY + giftHalfHeight;
  }
  updateGiftAnchor();

  const setSize = (w: number, h: number) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    bloomComposer.setSize(w, h);
    finalComposer.setSize(w, h);
    mode = getLayoutMode();
    stage.treeX = isPortrait() ? STAGE.mobile.treeX : STAGE.desktop.treeX;
    stage.treeZ = isPortrait() ? STAGE.mobile.treeZ : STAGE.desktop.treeZ;
    treeGroup.position.set(stage.treeX, stage.groundY, stage.treeZ);
    ground.position.set(stage.treeX, stage.groundY - 0.36, stage.treeZ - 0.6);
    shadow.position.set(stage.treeX, stage.groundY + 0.002, stage.treeZ);
    contactShadow.position.set(stage.treeX, stage.groundY + 0.003, stage.treeZ);
    trunkWarm.position.set(stage.treeX, stage.groundY + 0.6, stage.treeZ + 0.3);
    if (flameLight) {
      flameLight.position.set(stage.treeX, stage.groundY + 1.4, stage.treeZ);
    }
    if (treeGroup.children.length > 0) frameObject();
  };

  let giftVisible = false;
  const setSpinVelocity = (v: number) => {
    yawVel = v;
  };

  const showGift = () => {
    giftVisible = true;
    giftGroup.visible = true;
    starPulse = 0.3;
  };

  const hideGift = () => {
    giftVisible = false;
    giftGroup.visible = false;
  };

  // Debug overlay: toggled with "d"
  function setDebug(on: boolean) {
    debugVisible = on;
    for (const h of debugHelpers) {
      h.visible = debugVisible;
    }
    if (debugVisible) updateDebugHelpers();
  }

  // Build debug helpers
  function makeLabel(text: string, pos: THREE.Vector3): LabelHandle {
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ffeaa7";
      ctx.font = "16px 'Segoe UI'";
      ctx.fillText(text, 10, 24);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(0.9, 0.25, 1);
    sprite.position.copy(pos).add(new THREE.Vector3(0.2, 0.3, 0));
    debugHelpers.push(sprite);
    scene.add(sprite);
    return { sprite, canvas, ctx, texture };
  }

  function updateLabel(label: LabelHandle, text: string, pos: THREE.Vector3) {
    if (label.ctx) {
      label.ctx.clearRect(0, 0, label.canvas.width, label.canvas.height);
      label.ctx.fillStyle = "rgba(0,0,0,0.7)";
      label.ctx.fillRect(0, 0, label.canvas.width, label.canvas.height);
      label.ctx.fillStyle = "#ffeaa7";
      label.ctx.font = "16px 'Segoe UI'";
      label.ctx.fillText(text, 10, 24);
      label.texture.needsUpdate = true;
    }
    label.sprite.position.copy(pos).add(new THREE.Vector3(0.2, 0.3, 0));
  }

  function updateLine(line: THREE.Line, a: THREE.Vector3, b: THREE.Vector3) {
    const pos = line.geometry.getAttribute("position") as THREE.BufferAttribute;
    pos.setXYZ(0, a.x, a.y, a.z);
    pos.setXYZ(1, b.x, b.y, b.z);
    pos.needsUpdate = true;
    line.geometry.computeBoundingSphere();
  }

  const addDebugHelpers = () => {
    // Crosshair at look target
    const crossGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.3, 0, 0),
      new THREE.Vector3(0.3, 0, 0),
      new THREE.Vector3(0, -0.3, 0),
      new THREE.Vector3(0, 0.3, 0),
    ]);
    const crossMat = new THREE.LineBasicMaterial({ color: 0xffdd55, depthTest: false });
    const cross = new THREE.LineSegments(crossGeo, crossMat);
    cross.position.copy(lookTarget);
    debugHelpers.push(cross);
    scene.add(cross);

    const crossLabel = makeLabel(
      `Target (${lookTarget.x.toFixed(2)}, ${lookTarget.y.toFixed(2)}, ${lookTarget.z.toFixed(2)})`,
      lookTarget
    );

    // Ground line
    const groundMat = new THREE.LineBasicMaterial({ color: 0x99c2ff, depthTest: false });
    const groundGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-5, stage.groundY, 0),
      new THREE.Vector3(5, stage.groundY, 0),
    ]);
    const groundLine = new THREE.Line(groundGeo, groundMat);
    debugHelpers.push(groundLine);
    scene.add(groundLine);
    const groundLabel = makeLabel(
      `Ground y=${stage.groundY.toFixed(2)}`,
      new THREE.Vector3(stage.treeX, stage.groundY + 0.15, stage.treeZ)
    );

    // Safe frame (top margin)
    const frameMat = new THREE.LineBasicMaterial({ color: 0xff88aa, depthTest: false });
    const frameGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-1, 1.6, -2),
      new THREE.Vector3(1, 1.6, -2),
    ]);
    const safeFrame = new THREE.Line(frameGeo, frameMat);
    debugHelpers.push(safeFrame);
    scene.add(safeFrame);
    const safeLabel = makeLabel("Tree top", new THREE.Vector3(1, 1.6, -2));

    // Bounding box helper for tree
    const boxHelper = new THREE.BoxHelper(treeGroup, 0x55ff88);
    (boxHelper.material as THREE.Material).depthTest = false;
    debugHelpers.push(boxHelper);
    scene.add(boxHelper);

    debugHandles = { cross, crossLabel, groundLine, groundLabel, safeFrame, safeLabel, boxHelper };
    // Hide by default
    debugHelpers.forEach((h) => (h.visible = false));
  };

  function updateDebugHelpers() {
    if (!debugHandles) return;
    updateTreeBounds();
    debugHandles.cross.position.copy(lookTarget);
    updateLabel(
      debugHandles.crossLabel,
      `Target (${lookTarget.x.toFixed(2)}, ${lookTarget.y.toFixed(2)}, ${lookTarget.z.toFixed(2)})`,
      lookTarget
    );
    const groundLeft = new THREE.Vector3(stage.treeX - 2, stage.groundY, stage.treeZ);
    const groundRight = new THREE.Vector3(stage.treeX + 2, stage.groundY, stage.treeZ);
    updateLine(debugHandles.groundLine, groundLeft, groundRight);
    updateLabel(
      debugHandles.groundLabel,
      `Ground y=${stage.groundY.toFixed(2)}`,
      new THREE.Vector3(stage.treeX, stage.groundY + 0.15, stage.treeZ)
    );
    const topY = treeBounds.center.y + treeBounds.size.y * 0.5;
    const safeY = topY + treeBounds.size.y * 0.05;
    const safeLeft = new THREE.Vector3(stage.treeX - 0.6, safeY, stage.treeZ);
    const safeRight = new THREE.Vector3(stage.treeX + 0.6, safeY, stage.treeZ);
    updateLine(debugHandles.safeFrame, safeLeft, safeRight);
    updateLabel(debugHandles.safeLabel, "Tree top", new THREE.Vector3(stage.treeX + 0.2, safeY, stage.treeZ));
    debugHandles.boxHelper.update();
  }

  addDebugHelpers();

  const update = (dt: number) => {
    // dt is seconds
    yaw += yawVel * dt;
    const speed = Math.min(1, Math.abs(yawVel) / 2.5);
    const glow = 0.35 + speed * 0.9;
    amb.intensity = baseLightLevels.amb * glow;
    key.intensity = baseLightLevels.key * glow;
    fill.intensity = baseLightLevels.fill * glow;
    rimLight.intensity = baseLightLevels.rim * glow;
    trunkWarm.intensity = baseLightLevels.trunkWarm * glow;
    bloomPass.strength = baseBloomStrength * glow;
    if (candleLight) candleLight.intensity = basePointLights.candle * glow;
    if (starLight) starLight.intensity = basePointLights.star * glow;
    const targetLeanX = 0.03 * speed;
    const targetLeanZ = 0.05 * speed * Math.sign(yawVel || 1);
    [swayX, swayVelX] = spring(swayX, swayVelX, targetLeanX, 26, 7, dt);
    [swayZ, swayVelZ] = spring(swayZ, swayVelZ, targetLeanZ, 26, 7, dt);
    swayX = THREE.MathUtils.clamp(swayX, -0.18, 0.18);
    swayZ = THREE.MathUtils.clamp(swayZ, -0.22, 0.22);

    rig.rotation.y = yaw;
    const t = performance.now() * 0.001;
    trunkGroup.rotation.x = swayX * 0.35;
    trunkGroup.rotation.z = swayZ * 0.35;
    crownGroup.rotation.x = swayX + Math.sin(t * 1.7) * 0.005;
    crownGroup.rotation.z = swayZ + Math.sin(t * 1.3) * 0.005;
    [decoYaw, decoYawVel] = spring(decoYaw, decoYawVel, yawVel * 0.08, 18, 6, dt);
    decoGroup.rotation.y = -decoYaw;
    decoGroup.rotation.x = swayX * 1.15;
    decoGroup.rotation.z = swayZ * 1.15;

    if (giftVisible) {
      giftLight.intensity = THREE.MathUtils.lerp(giftLight.intensity, 3.0, dt * 3.5);
    } else {
      camera.position.lerpVectors(baseCamPos, revealZoomPos, revealFactor);
      giftLight.intensity = THREE.MathUtils.lerp(giftLight.intensity, 0, dt * 3);
    }

    camera.lookAt(lookTarget);

    if (starMesh && (starMesh.material as any)?.emissive) {
      const t = performance.now() * 0.001;
      starPulse = Math.max(0, starPulse - dt);
      const pulse = 1.0 + Math.sin(t * 1.6) * 0.25;
      const spark = starPulse > 0 ? 0.6 : 0;
      (starMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = baseEmissive.star * glow * pulse + spark;
    }
    if (starMesh && starHalo) {
      const pulse = 0.8 + Math.sin(performance.now() * 0.0016) * 0.2;
      starMesh.getWorldPosition(starWorldPos);
      const dist = camera.position.distanceTo(starWorldPos);
      const scale = THREE.MathUtils.clamp(dist * 0.08, 0.22, 0.55);
      starHalo.scale.setScalar(scale);
      (starHalo.material as THREE.SpriteMaterial).opacity = 0.45 + pulse * 0.25;
    }
    if (starLight && starMesh) {
      starMesh.getWorldPosition(starWorldPos);
      starLight.position.copy(starWorldPos);
    }
    if (candleLight) {
      candleLight.position.set(stage.treeX, stage.groundY + 1.0, stage.treeZ);
    }
    if (candleEmissiveMats.length > 0) {
      const t = performance.now() * 0.001;
      for (let i = 0; i < candleEmissiveMats.length; i++) {
        candleEmissiveMats[i].emissiveIntensity = baseEmissive.candle * glow + Math.sin(t * 8 + i) * 0.2;
      }
    }
    if (flameSprites.length > 0) {
      const t = performance.now() * 0.001;
      for (const flame of flameSprites) {
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

    for (const layer of snowLayers) {
      layer.update(dt);
    }

    if (debugVisible) updateDebugHelpers();
    if (trunkHelper) trunkHelper.update();
    if (trunkMarker && trunkMesh) {
      trunkMesh.getWorldPosition(trunkWorldPos);
      trunkMarker.position.copy(trunkWorldPos);
    }
    if (!treeGroup.visible) {
      console.warn("[BUG] treeGroup not visible");
      treeGroup.visible = true;
    }
  };

  return {
    renderer,
    scene,
    camera,
    treeGroup,
    giftGroup,
    render: () => {
      const prevLayer = camera.layers.mask;
      camera.layers.set(BLOOM_LAYER);
      bloomComposer.render();
      camera.layers.mask = prevLayer;
      finalComposer.render();
    },
    setSpinVelocity,
    showGift,
    hideGift,
    setSize,
    toggleDebug: setDebug,
    toggleTrunkDoubleSide: () => {
      trunkDoubleSide = !trunkDoubleSide;
      applyTrunkDebug();
      console.log("[TRUNK debug] doubleSide", trunkDoubleSide);
    },
    toggleTrunkDepthTest: () => {
      trunkNoDepthTest = !trunkNoDepthTest;
      applyTrunkDebug();
      console.log("[TRUNK debug] depthTest", !trunkNoDepthTest);
    },
    toggleEnv,
    setRevealFactor: (t: number) => {
      revealFactor = THREE.MathUtils.clamp(t, 0, 1);
    },
    getDebugState: () => {
      updateTreeBounds();
      return {
        camera: {
          x: camera.position.x,
          y: camera.position.y,
          z: camera.position.z,
          fov: camera.fov,
          aspect: camera.aspect,
        },
        target: { x: lookTarget.x, y: lookTarget.y, z: lookTarget.z },
        treeBounds: {
          center: { x: treeBounds.center.x, y: treeBounds.center.y, z: treeBounds.center.z },
          size: { x: treeBounds.size.x, y: treeBounds.size.y, z: treeBounds.size.z },
        },
        stage: { groundY: stage.groundY, treeX: stage.treeX, treeZ: stage.treeZ },
      };
    },
    update,
  };
}

export function setAutoRotateSpeed(handles: SceneHandles, speed: number) {
  // small helper called from main
  // Note: stored in closure in createScene. We'll just rotate directly here.
  handles.treeGroup.rotation.y += speed;
}
