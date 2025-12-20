import "./style.css";
import * as THREE from "three";
import { createScene } from "./three/scene";
import { VOUCHERS, type Voucher } from "./config/vouchers";
import { voucherToSVG, svgToPngBlob } from "./lib/voucherRender";
import { downloadBlob } from "./lib/download";
import { MUSIC_URL, SFX_GIFT_URL, SFX_SHAKE_URL } from "./config/audio";

const canvas = document.getElementById("scene") as HTMLCanvasElement;
const bg = document.getElementById("bg") as HTMLDivElement | null;
const modal = document.getElementById("modal") as HTMLDivElement;
const voucherEl = document.getElementById("voucher") as HTMLDivElement;
const closeModalBtn = document.getElementById("closeModal") as HTMLButtonElement;
const revealOverlay = document.getElementById("revealOverlay") as HTMLDivElement;
const hint = document.getElementById("hint") as HTMLDivElement;

let currentVoucher: Voucher | null = null;
let spinVelocity = 0;
let spinCharge = 0;
let musicStarted = false;
let lastSpinSfx = 0;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let music: HTMLAudioElement | null = null;
let shakeSfx: HTMLAudioElement | null = null;
let giftSfx: HTMLAudioElement | null = null;

type Phase = "IDLE" | "REVEAL" | "DROP" | "PRESENT_READY";

const debugParam = new URLSearchParams(window.location.search).has("debug");
const debugStored = window.localStorage.getItem("treeDebug") === "1";
const debugEnabled = debugParam || debugStored;
if (debugParam) window.localStorage.setItem("treeDebug", "1");

function pickVoucher(): Voucher {
  return VOUCHERS[Math.floor(Math.random() * VOUCHERS.length)];
}

async function initAudio() {
  if (music && shakeSfx && giftSfx) return;
  music = new Audio(MUSIC_URL);
  music.loop = true;
  music.preload = "auto";
  music.volume = 0.35;

  shakeSfx = new Audio(SFX_SHAKE_URL);
  shakeSfx.preload = "auto";
  shakeSfx.volume = 0.45;

  giftSfx = new Audio(SFX_GIFT_URL);
  giftSfx.preload = "auto";
  giftSfx.volume = 0.6;
}

async function startMusic() {
  await initAudio();
  if (musicStarted || !music) return;
  musicStarted = true;
  try {
    music.currentTime = 0;
    await music.play();
  } catch (err) {
    musicStarted = false;
  }
}

function playSfx(audio: HTMLAudioElement | null) {
  if (!audio) return;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

function addSpinImpulse(dx: number) {
  spinVelocity += dx * 0.08;
}

function showModal(v: Voucher) {
  const svg = voucherToSVG(v, { width: 1200, height: 675 });
  voucherEl.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px;">
      <strong style="font-size:14px;">Your voucher</strong>
      <span style="font-size:12px;opacity:0.7;">${new Date().toLocaleDateString()}</span>
    </div>
    <div style="border-radius:12px;overflow:hidden;border:1px solid #e6e6ef;">
      ${svg}
    </div>
  `;
  modal.classList.remove("hidden");
}

function hideModal() {
  modal.classList.add("hidden");
}

closeModalBtn.addEventListener("click", hideModal);
modal.addEventListener("click", (e) => {
  if (e.target === modal) hideModal();
});

(async () => {
  const handles = await createScene(canvas);
  let debugVisible = false;
  let infoVisible = debugEnabled;
  let infoEl: HTMLDivElement | null = null;
  let phase: Phase = "IDLE";
  let revealStart = 0;
  let revealT = 0;
  const REVEAL_DUR = 900;
  const BG_Y0 = 50;
  const BG_Y1 = 42;
  const BG_SCALE0 = 1.0;
  const BG_SCALE1 = 1.04;

  const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const applyReveal = (e: number) => {
    document.documentElement.style.setProperty("--bgY", `${BG_Y0 + (BG_Y1 - BG_Y0) * e}%`);
    document.documentElement.style.setProperty("--bgScale", `${BG_SCALE0 + (BG_SCALE1 - BG_SCALE0) * e}`);
    if (handles.setRevealFactor) handles.setRevealFactor(e);
  };
  const setPhase = (next: Phase) => {
    if (phase === next) return;
    console.log("[PHASE]", phase, "->", next);
    phase = next;
  };

  let present: THREE.Object3D | null = null;
  const landing = new THREE.Vector3();
  let vY = 0;
  const startDrop = () => {
    const s = handles.getDebugState?.();
    if (!s) return;
    const center = new THREE.Vector3(s.treeBounds.center.x, s.treeBounds.center.y, s.treeBounds.center.z);
    const size = new THREE.Vector3(s.treeBounds.size.x, s.treeBounds.size.y, s.treeBounds.size.z);
    landing.copy(center).add(new THREE.Vector3(-size.x * 0.6, -size.y * 0.45, size.z * 0.1));
    landing.y = s.stage.groundY + 0.12;

    present = handles.giftGroup;
    handles.showGift();
    present.visible = true;
    present.position.copy(landing).add(new THREE.Vector3(0, 1.8, 0));
    present.rotation.set(0, Math.random() * Math.PI * 2, 0);
    present.scale.setScalar(0.9);
    vY = 0;
    const ndc = present.position.clone().project(handles.camera);
    console.log("[DROP start]", { landing: landing.toArray(), start: present.position.toArray() });
    console.log("[DROP NDC]", ndc.x, ndc.y);
  };

  const updateDrop = (dt: number) => {
    if (!present) return;
    const g = 6.5;
    vY += g * dt;
    present.position.y -= vY * dt;
    present.rotation.y += dt * 1.2;
    if (present.position.y <= landing.y) {
      present.position.y = landing.y;
      present.position.y += 0.03;
      setPhase("PRESENT_READY");
      console.log("[DROP landed]", present.position.toArray());
    }
  };

  const ensureInfoOverlay = () => {
    if (infoEl) return;
    infoEl = document.createElement("div");
    infoEl.className = "debug-panel";
    document.body.appendChild(infoEl);
  };

  const setInfoVisible = (on: boolean) => {
    infoVisible = on;
    if (infoVisible) ensureInfoOverlay();
    if (infoEl) infoEl.classList.toggle("hidden", !infoVisible);
  };

  if (debugEnabled) setInfoVisible(true);
  startMusic();
  applyReveal(0);
  if (bg) bg.style.setProperty("--bgImage", 'url("/assets/bg-alt.png")');

  // Resize
  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    handles.setSize(w, h);
  };
  window.addEventListener("resize", resize);
  resize();

  // Interaction: hover rotates gently; drag shakes
  let isHovering = false;
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;

  let cooldown = 0;
  let hintTimer: number | null = null;

  const setHint = (msg: string | null) => {
    if (!msg) {
      hint.classList.remove("visible");
      hint.classList.add("hidden");
      hint.textContent = "";
      return;
    }
    hint.textContent = msg;
    hint.classList.remove("hidden");
    hint.classList.add("visible");
  };

  const scheduleHint = () => {
    if (hintTimer) window.clearTimeout(hintTimer);
    hintTimer = window.setTimeout(() => {
      if (phase === "IDLE" && !isDragging) setHint("Spin the tree");
    }, 2600);
  };
  scheduleHint();

  canvas.addEventListener("pointerenter", () => (isHovering = true));
  canvas.addEventListener("pointerleave", () => (isHovering = false));

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    startMusic();
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    setHint(null);
  });

  canvas.addEventListener("pointerup", () => {
    isDragging = false;
    if (phase === "IDLE") scheduleHint();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (isDragging) {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      const now = performance.now();
      if (Math.abs(dx) + Math.abs(dy) > 12 && now - lastSpinSfx > 260) {
        playSfx(shakeSfx);
        lastSpinSfx = now;
      }

      // Apply guided spin
      addSpinImpulse(dx);
      spinCharge += Math.abs(dx) * 0.002;
    } else if (isHovering) {
      // gentle hover auto-rotation
      spinVelocity += 0.08;
    }
  });

  const handleGiftClick = (event: PointerEvent) => {
    if (phase !== "PRESENT_READY") return;
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, handles.camera);
    const intersects = raycaster.intersectObject(handles.giftGroup, true);
    if (intersects.length > 0) {
      currentVoucher = pickVoucher();
      showModal(currentVoucher);
      revealOverlay.classList.add("hidden");
    }
  };

  canvas.addEventListener("click", handleGiftClick);
  voucherEl.addEventListener("click", async () => {
    if (!currentVoucher) return;
    const svg = voucherToSVG(currentVoucher, { width: 1200, height: 675 });
    const png = await svgToPngBlob(svg, 1200, 675);
    downloadBlob(`voucher-${currentVoucher.id}.png`, png);
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "d" || e.key === "D") {
      debugVisible = !debugVisible;
      if ((handles as any).toggleDebug) {
        (handles as any).toggleDebug(debugVisible);
      }
    }
    if (e.key === "i" || e.key === "I") {
      setInfoVisible(!infoVisible);
    }
    if (e.key === "f" || e.key === "F") {
      const s = handles.scene;
      if (s.fog) {
        console.log("[FOG] disabling");
        s.fog = null;
      } else {
        console.log("[FOG] enabling");
        s.fog = new THREE.Fog(0xbcc9d9, 2.8, 10.0);
      }
    }
    if (e.key === "b" || e.key === "B") {
      if ((handles as any).toggleTrunkDoubleSide) {
        (handles as any).toggleTrunkDoubleSide();
      }
    }
    if (e.key === "z" || e.key === "Z") {
      if ((handles as any).toggleTrunkDepthTest) {
        (handles as any).toggleTrunkDepthTest();
      }
    }
    if (e.key === "g" || e.key === "G") {
      if ((handles as any).toggleEnv) {
        (handles as any).toggleEnv();
      }
    }
  });

  // Main loop
  let last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!handles.treeGroup?.visible) console.warn("[BUG] treeGroup not visible");

    // decay spin charge & cooldown
    spinCharge = Math.max(0, spinCharge * 0.96 - dt * 0.15) + Math.abs(spinVelocity) * dt * 0.8;
    cooldown = Math.max(0, cooldown - dt);

    // integrate spin (inertial yaw velocity)
    spinVelocity *= Math.exp(-dt * 1.8);
    if (Math.abs(spinVelocity) < 0.02) spinVelocity = 0;
    if (handles.setSpinVelocity) {
      handles.setSpinVelocity(spinVelocity);
    }

    if (phase === "REVEAL") {
      const t = (performance.now() - revealStart) / REVEAL_DUR;
      revealT = Math.max(0, Math.min(1, t));
      const e = easeInOutCubic(revealT);
      applyReveal(e);
      if (revealT >= 1) {
        setPhase("DROP");
        startMusic();
        playSfx(giftSfx);
        startDrop();
        revealOverlay.classList.remove("hidden");
        cooldown = 1.2;
      }
    }

    if (phase === "DROP") {
      updateDrop(dt);
      if (phase === "PRESENT_READY") {
        setHint("Tap the present");
      }
    }

    // threshold -> start reveal
    if (phase === "IDLE" && cooldown <= 0 && spinCharge > 1.25) {
      setPhase("REVEAL");
      revealStart = performance.now();
      revealT = 0;
      setHint(null);
    }

    handles.update(dt);
    if (infoVisible && infoEl && handles.getDebugState) {
      const s = handles.getDebugState();
      infoEl.textContent =
        `Debug info (i: toggle panel, d: helpers)\n` +
        `cam: (${s.camera.x.toFixed(2)}, ${s.camera.y.toFixed(2)}, ${s.camera.z.toFixed(2)}) fov ${s.camera.fov.toFixed(1)} aspect ${s.camera.aspect.toFixed(2)}\n` +
        `target: (${s.target.x.toFixed(2)}, ${s.target.y.toFixed(2)}, ${s.target.z.toFixed(2)})\n` +
        `tree center: (${s.treeBounds.center.x.toFixed(2)}, ${s.treeBounds.center.y.toFixed(2)}, ${s.treeBounds.center.z.toFixed(2)})\n` +
        `tree size: (${s.treeBounds.size.x.toFixed(2)}, ${s.treeBounds.size.y.toFixed(2)}, ${s.treeBounds.size.z.toFixed(2)})\n` +
        `stage: groundY ${s.stage.groundY.toFixed(2)} treeX ${s.stage.treeX.toFixed(2)} treeZ ${s.stage.treeZ.toFixed(2)}\n` +
        `dt: ${(dt * 1000).toFixed(1)}ms`;
    }
    handles.render();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
})();
