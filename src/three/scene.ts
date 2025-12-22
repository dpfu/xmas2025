import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createSnowLayer, type SnowLayer } from "./snow";
import { STAGE, getLayoutMode } from "../config/layout";
import { frameObjectToCamera } from "./frame";
import { CAMERA, GLOW } from "../config/tuning";
import { createSceneLights } from "./lights";
import { createBloomPipeline } from "./postprocess";
import { loadTreeModel, updateTreeEffects, type TreeEffects } from "./tree";
import { loadGiftModel } from "./gift";

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
  setRevealFactor?: (t: number) => void;
  getTreeMetrics?: () => {
    treeBounds: { center: { x: number; y: number; z: number }; size: { x: number; y: number; z: number } };
    stage: { groundY: number; treeX: number; treeZ: number };
  };
  update: (dt: number) => void;
};

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
  const treeBounds = {
    box: new THREE.Box3(),
    size: new THREE.Vector3(),
    center: new THREE.Vector3(),
  };

  let mode = getLayoutMode();
  const isPortrait = () => mode === "portrait";
  const stage = {
    groundY: STAGE.groundY,
    targetY: STAGE.targetY,
    treeX: isPortrait() ? STAGE.mobile.treeX : STAGE.desktop.treeX,
    treeZ: isPortrait() ? STAGE.mobile.treeZ : STAGE.desktop.treeZ,
  };

  const camera = new THREE.PerspectiveCamera(isPortrait() ? CAMERA.fovPortrait : CAMERA.fovLandscape, 1, 0.1, 100);
  camera.position.set(0, 1.2, 4.2);
  camera.layers.enable(BLOOM_LAYER);
  const lights = createSceneLights(scene, stage);

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

  const loader = new GLTFLoader();
  const bloomPipeline = createBloomPipeline(renderer, scene, camera, BLOOM_LAYER);
  const baseBloomStrength = bloomPipeline.bloomPass.strength;
  const baseCamPos = camera.position.clone();
  const revealZoomPos = baseCamPos.clone().add(new THREE.Vector3(
    CAMERA.revealZoomOffset.x,
    CAMERA.revealZoomOffset.y,
    CAMERA.revealZoomOffset.z
  ));
  const lookTarget = new THREE.Vector3(stage.treeX, STAGE.targetY + CAMERA.lookTargetYOffset, stage.treeZ);
  const haloOffset = new THREE.Vector3(0, 0.05, 0.06);
  let treeEffects: TreeEffects | null = null;
  const baseEmissive = { candle: GLOW.candleEmissive, star: GLOW.starEmissive };
  const basePointLights = { candle: GLOW.candleLight, star: GLOW.starLight };
  let yaw = 0;
  let yawVel = 0;
  let swayX = 0;
  let swayZ = 0;
  let swayVelX = 0;
  let swayVelZ = 0;
  let decoYaw = 0;
  let decoYawVel = 0;
  let revealFactor = 0;

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

  function spring(current: number, velocity: number, target: number, k: number, c: number, dt: number) {
    const accel = -k * (current - target) - c * velocity;
    const nextVel = velocity + accel * dt;
    const next = current + nextVel * dt;
    return [next, nextVel] as const;
  }

  function updateTreeBounds() {
    treeBounds.box.setFromObject(treeGroup);
    treeBounds.box.getSize(treeBounds.size);
    treeBounds.box.getCenter(treeBounds.center);
  }

  function frameObject() {
    updateTreeBounds();
    lookTarget.copy(treeBounds.center);
    lookTarget.y += CAMERA.lookTargetYOffset;
    frameObjectToCamera({
      camera,
      object: treeGroup,
      target: lookTarget,
      fov: isPortrait() ? CAMERA.fovPortrait : CAMERA.fovLandscape,
      padding: isPortrait() ? CAMERA.paddingPortrait : CAMERA.paddingLandscape,
      minDist: isPortrait() ? CAMERA.minDistPortrait : CAMERA.minDistLandscape,
      maxDist: CAMERA.maxDist,
    });
  }

  const treeLoad = await loadTreeModel({
    loader,
    rig,
    trunkGroup,
    crownGroup,
    decoGroup,
    stage,
    scene,
    bloomLayer: BLOOM_LAYER,
    haloOffset,
  });
  treeEffects = treeLoad.effects;

  if (treeLoad.model) {
    frameObject();
  } else {
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
  }

  // Load gift model
  let giftHalfHeight = await loadGiftModel(loader, giftGroup);

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
    bloomPipeline.setSize(w, h);
    mode = getLayoutMode();
    stage.treeX = isPortrait() ? STAGE.mobile.treeX : STAGE.desktop.treeX;
    stage.treeZ = isPortrait() ? STAGE.mobile.treeZ : STAGE.desktop.treeZ;
    treeGroup.position.set(stage.treeX, stage.groundY, stage.treeZ);
    ground.position.set(stage.treeX, stage.groundY - 0.36, stage.treeZ - 0.6);
    shadow.position.set(stage.treeX, stage.groundY + 0.002, stage.treeZ);
    contactShadow.position.set(stage.treeX, stage.groundY + 0.003, stage.treeZ);
    lights.updateStage(stage);
    if (treeGroup.children.length > 0) frameObject();
  };

  let giftVisible = false;
  const setSpinVelocity = (v: number) => {
    yawVel = v;
  };

  const showGift = () => {
    giftVisible = true;
    giftGroup.visible = true;
  };

  const hideGift = () => {
    giftVisible = false;
    giftGroup.visible = false;
  };

  const update = (dt: number) => {
    // dt is seconds
    yaw += yawVel * dt;
    const speed = Math.min(1, Math.abs(yawVel) / 2.5);
    const glow = GLOW.base + speed * GLOW.scale;
    lights.updateGlow(glow);
    bloomPipeline.bloomPass.strength = baseBloomStrength * glow;
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

    if (treeEffects) {
      updateTreeEffects({
        effects: treeEffects,
        dt,
        glow,
        camera,
        stage,
        baseEmissive,
        basePointLights,
      });
    }

    for (const layer of snowLayers) {
      layer.update(dt);
    }

  };

  return {
    renderer,
    scene,
    camera,
    treeGroup,
    giftGroup,
    render: bloomPipeline.render,
    setSpinVelocity,
    showGift,
    hideGift,
    setSize,
    setRevealFactor: (t: number) => {
      revealFactor = THREE.MathUtils.clamp(t, 0, 1);
    },
    getTreeMetrics: () => {
      updateTreeBounds();
      return {
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
