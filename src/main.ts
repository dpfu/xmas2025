import "./style.css";
import * as THREE from "three";
import { createScene } from "./three/scene";
import { VOUCHERS, type Voucher } from "./config/vouchers";
import { voucherToSVG, svgToPngBlob } from "./lib/voucherRender";
import { downloadBlob } from "./lib/download";
import { MUSIC_URL, SFX_GIFT_URL, SFX_SHAKE_URL } from "./config/audio";
import { initBackground } from "./ui/background";
import { createRevealController } from "./state/reveal";
import { createDropController } from "./state/presentDrop";
import { createSpinState, applySpinImpulse, resetCooldown, shouldTriggerReveal, updateSpin } from "./state/spin";
import { SPIN } from "./config/tuning";

const canvas = document.getElementById("scene") as HTMLCanvasElement;
const bg = document.getElementById("bg") as HTMLDivElement | null;
const modal = document.getElementById("modal") as HTMLDivElement;
const voucherEl = document.getElementById("voucher") as HTMLDivElement;
const closeModalBtn = document.getElementById("closeModal") as HTMLButtonElement;
const revealOverlay = document.getElementById("revealOverlay") as HTMLDivElement;
const hint = document.getElementById("hint") as HTMLDivElement;

let currentVoucher: Voucher | null = null;
let musicStarted = false;
let lastSpinSfx = 0;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let music: HTMLAudioElement | null = null;
let shakeSfx: HTMLAudioElement | null = null;
let giftSfx: HTMLAudioElement | null = null;

type Phase = "IDLE" | "REVEAL" | "DROP" | "PRESENT_READY";


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


function showModal(v: Voucher) {
  const svg = voucherToSVG(v, { width: 900, height: 507 });
  voucherEl.innerHTML = `
    <div class="voucher-header">
      <strong class="voucher-title">Your voucher</strong>
      <span class="voucher-date">${new Date().toLocaleDateString()}</span>
    </div>
    <div class="voucher-preview">
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
  let phase: Phase = "IDLE";
  const background = initBackground(bg, import.meta.env.BASE_URL);
  const revealController = createRevealController((e) => {
    background.applyReveal(e);
    if (handles.setRevealFactor) handles.setRevealFactor(e);
  });
  const setPhase = (next: Phase) => {
    if (phase === next) return;
    phase = next;
  };
  const dropController = createDropController({
    giftGroup: handles.giftGroup,
    showGift: handles.showGift,
    camera: handles.camera,
  });
  const spinState = createSpinState();

  startMusic();
  background.applyReveal(0);

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
      if (Math.abs(dx) + Math.abs(dy) > SPIN.sfxMinDelta && now - lastSpinSfx > SPIN.sfxCooldownMs) {
        playSfx(shakeSfx);
        lastSpinSfx = now;
      }

      // Apply guided spin
      applySpinImpulse(spinState, dx);
    } else if (isHovering) {
      // gentle hover auto-rotation
      spinState.velocity += SPIN.hoverSpin;
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


  // Main loop
  let last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    updateSpin(spinState, dt);
    if (handles.setSpinVelocity) {
      handles.setSpinVelocity(spinState.velocity);
    }

    if (phase === "REVEAL") {
      if (revealController.update(performance.now())) {
        setPhase("DROP");
        startMusic();
        playSfx(giftSfx);
        dropController.start(handles.getTreeMetrics?.());
        revealOverlay.classList.remove("hidden");
        resetCooldown(spinState);
      }
    }

    if (phase === "DROP") {
      if (dropController.update(dt)) {
        setPhase("PRESENT_READY");
        setHint("Tap the present");
      }
    }

    // threshold -> start reveal
    if (phase === "IDLE" && shouldTriggerReveal(spinState)) {
      setPhase("REVEAL");
      revealController.start(performance.now());
      setHint(null);
    }

    handles.update(dt);
    handles.render();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
})();
