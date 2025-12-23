import "./style.css";
import * as THREE from "three";
import { createScene } from "./three/scene";
import { MUSIC_URL, SAD_JINGLE_URL, SFX_ANVIL_URL, SFX_GIFT_URL, SFX_SHAKE_URL, SFX_UNWRAP_URL } from "./config/audio";
import { initBackground } from "./ui/background";
import { createRevealController } from "./state/reveal";
import { createAnvilDropController } from "./state/anvilDrop";
import { createGiftPileController } from "./state/giftPile";
import { createSpinState, applySpinImpulse, resetCooldown, shouldTriggerReveal, updateSpin } from "./state/spin";
import { SPIN } from "./config/tuning";

const canvas = document.getElementById("scene") as HTMLCanvasElement;
const bg = document.getElementById("bg") as HTMLDivElement | null;
const revealOverlay = document.getElementById("revealOverlay") as HTMLDivElement;
const revealText = document.getElementById("revealText") as HTMLParagraphElement;
const hint = document.getElementById("hint") as HTMLDivElement;
const flash = document.getElementById("flash") as HTMLDivElement;
const greetingModal = document.getElementById("greetingModal") as HTMLDivElement;
const greetingTitle = document.getElementById("greetingTitle") as HTMLDivElement;
const greetingBody = document.getElementById("greetingBody") as HTMLDivElement;
const closeGreeting = document.getElementById("closeGreeting") as HTMLButtonElement;

let musicStarted = false;
let lastSpinSfx = 0;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let music: HTMLAudioElement | null = null;
let shakeSfx: HTMLAudioElement | null = null;
let giftSfx: HTMLAudioElement | null = null;
let anvilSfx: HTMLAudioElement | null = null;
let sadJingle: HTMLAudioElement | null = null;
let unwrapSfx: HTMLAudioElement | null = null;

type Phase = "IDLE" | "REVEAL" | "DROP";
type DropKind = "GIFT" | "ANVIL";

async function initAudio() {
  if (music && shakeSfx && giftSfx && anvilSfx && sadJingle && unwrapSfx) return;
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

  anvilSfx = new Audio(SFX_ANVIL_URL);
  anvilSfx.preload = "auto";
  anvilSfx.volume = 0.8;

  sadJingle = new Audio(SAD_JINGLE_URL);
  sadJingle.preload = "auto";
  sadJingle.volume = 0.6;

  unwrapSfx = new Audio(SFX_UNWRAP_URL);
  unwrapSfx.preload = "auto";
  unwrapSfx.volume = 0.7;
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

function stopMusic() {
  if (!music) return;
  music.pause();
  music.currentTime = 0;
}

function playSadJingle() {
  if (!sadJingle) return;
  sadJingle.currentTime = 0;
  sadJingle.play().catch(() => {});
}

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
  const giftPile = createGiftPileController({
    scene: handles.scene,
    createGiftInstance: handles.createGiftInstance,
  });
  const anvilDrop = createAnvilDropController({
    scene: handles.scene,
    createAnvilInstance: handles.createAnvilInstance,
    onImpact: () => {
      handles.crushTree();
      playSfx(anvilSfx);
      stopMusic();
      playSadJingle();
      background.setFinalScene();
      setHint("...");
    },
  });
  const spinState = createSpinState();

  const getRefCode = () => {
    const params = new URLSearchParams(window.location.search);
    return (params.get("ref") || params.get("refer") || params.get("code") || "").trim().toUpperCase();
  };

  const copy = getRefCode() === "DE"
    ? {
        lang: "de",
        title: "Akademische Baumgeschenke 🎄",
        revealText: "Ein Geschenk erscheint.",
        closeGreeting: "Schließen",
        closeGreetingAria: "Gruß schließen",
        hintSequence: [
          "Dreh den Baum",
          "Vielleicht noch mal?",
          "Aller guten Dinge sind drei",
          "Besser jetzt aufhören",
          "Sei nicht gierig",
          "Okay, bitte hör jetzt auf.",
          "STOP",
        ],
        greetings: [
          { title: "🎄 Weihnachten", body: "„Zu Weihnachten wünsche ich dir Erfolg bei dem, was du tust, und Freude an dem, wie du es tust.“" },
          { title: "✨ Neujahr", body: "„Für das neue Jahr wünsche ich dir gute Begegnungen, die Kraft geben, und genug Gelassenheit für alles andere.“" },
          { title: "🤍 Persönlich", body: "„Privat wünsche ich dir Gesundheit, Gelassenheit und ein Lachen zur richtigen Zeit.“" },
        ],
      }
    : {
        lang: "en",
        title: "Academic Tree Gifts 🎄",
        revealText: "A present appears.",
        closeGreeting: "Close",
        closeGreetingAria: "Close greeting",
        hintSequence: [
          "Spin the tree",
          "Maybe again?",
          "3 times the charm",
          "Better stop now",
          "Don't be greedy",
          "Ok, please stop now.",
          "STOP",
        ],
        greetings: [
          { title: "🎄 Christmas", body: "Wishing you success in what you do - and real enjoyment in how you do it." },
          { title: "✨ New Year", body: "For the year ahead, I wish you great encounters, the energy they bring, and enough calm for everything else." },
          { title: "🤍 Personal", body: "On a personal note: stay healthy, stay relaxed, and keep your sense of humor when it counts." },
        ],
      };

  document.documentElement.lang = copy.lang;
  document.title = copy.title;
  revealText.textContent = copy.revealText;
  greetingTitle.textContent = copy.greetings[0].title;
  closeGreeting.textContent = copy.closeGreeting;
  closeGreeting.setAttribute("aria-label", copy.closeGreetingAria);

  const hintSequence = copy.hintSequence;
  const greetings = copy.greetings;
  let storyIndex = 0;
  let giftCount = 0;
  let nextIdleHint = hintSequence[0];
  let nextDrop: DropKind = "GIFT";
  let anvilTriggered = false;
  let allowGiftDrops = true;

  const showGreeting = (index: number) => {
    const greeting = greetings[index];
    if (!greeting) return;
    greetingTitle.textContent = greeting.title;
    greetingBody.textContent = greeting.body;
    greetingModal.classList.remove("hidden");
    requestAnimationFrame(() => greetingModal.classList.add("visible"));
  };

  const hideGreeting = () => {
    greetingModal.classList.remove("visible");
    window.setTimeout(() => greetingModal.classList.add("hidden"), 220);
  };

  closeGreeting.addEventListener("click", hideGreeting);
  greetingModal.addEventListener("click", (event) => {
    if (event.target === greetingModal) hideGreeting();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideGreeting();
  });

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
  let overlayTimer: number | null = null;

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
      if (phase === "IDLE" && !isDragging) setHint(nextIdleHint);
    }, 2600);
  };
  scheduleHint();

  const triggerFlash = () => {
    flash.classList.remove("hidden");
    void flash.offsetWidth;
    window.setTimeout(() => {
      flash.classList.add("hidden");
    }, 620);
  };

  canvas.addEventListener("pointerenter", () => (isHovering = true));
  canvas.addEventListener("pointerleave", () => {
    isHovering = false;
    giftPile.setHovered(null);
    canvas.style.cursor = "default";
  });

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
    if (!isDragging && !greetingModal.classList.contains("hidden")) {
      giftPile.setHovered(null);
      canvas.style.cursor = "default";
      return;
    }
    if (!isDragging) {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(pointer, handles.camera);
      const intersects = raycaster.intersectObjects(handles.scene.children, true);
      let hovered: THREE.Object3D | null = null;
      for (const hit of intersects) {
        const idx = giftPile.findGreetingIndex(hit.object);
        if (typeof idx === "number") {
          hovered = hit.object;
          break;
        }
      }
      giftPile.setHovered(hovered);
      canvas.style.cursor = hovered ? "grab" : "default";
    }
  });

  canvas.addEventListener("click", (event) => {
    if (!giftCount || isDragging) return;
    if (!greetingModal.classList.contains("hidden")) return;
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, handles.camera);
    const intersects = raycaster.intersectObjects(handles.scene.children, true);
    for (const hit of intersects) {
      const idx = giftPile.openGift(hit.object);
      if (typeof idx === "number") {
        playSfx(unwrapSfx);
        window.setTimeout(() => showGreeting(idx), 220);
        break;
      }
    }
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
        if (nextDrop === "ANVIL") {
          anvilTriggered = true;
          playSfx(giftSfx);
          anvilDrop.start(handles.getTreeMetrics?.());
        } else if (allowGiftDrops) {
          playSfx(giftSfx);
          giftPile.dropGift(handles.getTreeMetrics?.(), giftCount);
        } else {
          triggerFlash();
        }
        revealOverlay.classList.remove("hidden");
        if (overlayTimer) window.clearTimeout(overlayTimer);
        overlayTimer = window.setTimeout(() => {
          revealOverlay.classList.add("hidden");
        }, 1400);
        resetCooldown(spinState);
      }
    }

    giftPile.update(dt);
    if (phase === "DROP") {
      if (nextDrop === "ANVIL") {
        if (anvilDrop.update(dt)) {
          setPhase("IDLE");
        }
      } else if (!allowGiftDrops) {
        storyIndex += 1;
        nextIdleHint = hintSequence[Math.min(storyIndex, hintSequence.length - 1)];
        if (storyIndex >= hintSequence.length - 1) {
          nextDrop = "ANVIL";
        }
        setPhase("IDLE");
        setHint(nextIdleHint);
      } else if (giftPile.lastDropSettled()) {
        giftCount += 1;
        storyIndex += 1;
        nextIdleHint = hintSequence[Math.min(storyIndex, hintSequence.length - 1)];
        if (giftCount >= 3) {
          allowGiftDrops = false;
        }
        if (storyIndex >= hintSequence.length - 1) {
          nextDrop = "ANVIL";
        }
        setPhase("IDLE");
        setHint(nextIdleHint);
      }
    }

    // threshold -> start reveal
    if (phase === "IDLE" && shouldTriggerReveal(spinState) && !anvilTriggered) {
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
