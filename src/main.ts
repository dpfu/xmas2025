import "./style.css";
import * as THREE from "three";
import { createScene } from "./three/scene";
import { VOUCHERS, type Voucher } from "./config/vouchers";
import { voucherToSVG, svgToPngBlob } from "./lib/voucherRender";
import { downloadBlob } from "./lib/download";
import { MUSIC_URL, SFX_GIFT_URL, SFX_SHAKE_URL } from "./config/audio";

const canvas = document.getElementById("scene") as HTMLCanvasElement;
const modal = document.getElementById("modal") as HTMLDivElement;
const voucherEl = document.getElementById("voucher") as HTMLDivElement;
const closeModalBtn = document.getElementById("closeModal") as HTMLButtonElement;
const revealOverlay = document.getElementById("revealOverlay") as HTMLDivElement;
const hint = document.getElementById("hint") as HTMLDivElement;

let currentVoucher: Voucher | null = null;
let giftReady = false;
let spinAngle = 0;
let spinVelocity = 0;
let spinCharge = 0;
let musicStarted = false;
let lastSpinSfx = 0;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let music: HTMLAudioElement | null = null;
let shakeSfx: HTMLAudioElement | null = null;
let giftSfx: HTMLAudioElement | null = null;

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
      if (!giftReady && !isDragging) setHint("Spin the tree");
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
    if (!giftReady) scheduleHint();
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
    if (!giftReady) return;
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
  });

  // Main loop
  let last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    // decay spin charge & cooldown
    spinCharge = Math.max(0, spinCharge * 0.96 - dt * 0.15) + Math.abs(spinVelocity) * dt * 0.8;
    cooldown = Math.max(0, cooldown - dt);

    // integrate spin
    spinAngle += spinVelocity * dt;
    spinVelocity *= 0.985;
    handles.treeGroup.rotation.y = spinAngle;

    // drive secondary motion
    const spinAmt = Math.min(1, Math.abs(spinVelocity) / 8);
    if (handles.setSpinAmount) {
      handles.setSpinAmount(spinAmt);
    }

    // threshold -> gift ready
    if (!giftReady && cooldown <= 0 && spinCharge > 1.25) {
      giftReady = true;
      startMusic();
      playSfx(giftSfx);
      handles.showGift();
      revealOverlay.classList.remove("hidden");
      setHint("Tap the present");
      cooldown = 1.2;
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
    handles.renderer.render(handles.scene, handles.camera);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
})();
