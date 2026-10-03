import * as THREE from "three";
import { BurningWheel } from "./character/BurningWheel.js";
import { BrainController } from "./brain/BrainController.js";
import { ContainmentEngine } from "./character/ContainmentEngine.js";
import { PerformanceEngine } from "./performance/PerformanceEngine.js";
import { directDialogue } from "./performance/AutoDirector.js";
import { RantChurner } from "./rants/RantChurner.js";
import godRantSkit from "../skits/the-word-god-is-not-god.bwskit?raw";
import { VoiceController } from "./voice/VoiceController.js";
import { HeavenBackdrop } from "./visual/HeavenBackdrop.js";
import { VideoExporter } from "./export/VideoExporter.js";
import "./style.css";

const stage = document.querySelector("#stage");
const motionToggle = document.querySelector("#motion-toggle");
const autoChaosToggle = document.querySelector("#auto-chaos");
const realityReset = document.querySelector("#reality-reset");
const statusLine = document.querySelector(".hud__label span");
const controlLab = document.querySelector("#control-lab");
const hudToggle = document.querySelector("#hud-toggle");

const voiceText = document.querySelector("#voice-text");
const voiceSpeak = document.querySelector("#voice-speak");
const voiceStop = document.querySelector("#voice-stop");
const voiceStatus = document.querySelector("#voice-status");
const voiceSpeed = document.querySelector("#voice-speed");
const voiceSpeedValue = document.querySelector("#voice-speed-value");
const voiceApertureToggle = document.querySelector("#voice-aperture-toggle");

const skitScript = document.querySelector("#skit-script");
const skitRun = document.querySelector("#skit-run");
const skitStop = document.querySelector("#skit-stop");
const skitStatus = document.querySelector("#skit-status");
const skitLoadGodRant = document.querySelector("#skit-load-god-rant");
const directorText = document.querySelector("#director-text");
const directorBuild = document.querySelector("#director-build");
const directorStatus = document.querySelector("#director-status");
const brainPrompt = document.querySelector("#brain-prompt");
const brainPreset = document.querySelector("#brain-preset");
const brainGenerate = document.querySelector("#brain-generate");
const brainStatus = document.querySelector("#brain-status");
const rantBank = document.querySelector("#rant-bank");
const rantCurrent = document.querySelector("#rant-current");
const rantSave = document.querySelector("#rant-save");
const rantChurn = document.querySelector("#rant-churn");
const rantThink = document.querySelector("#rant-think");
const rantReset = document.querySelector("#rant-reset");
const rantStatus = document.querySelector("#rant-status");

const exportAspect = document.querySelector("#export-aspect");
const exportResolution = document.querySelector("#export-resolution");
const exportLook = document.querySelector("#export-look");
const exportInternalScale = document.querySelector("#export-internal-scale");
const exportFrameStyle = document.querySelector("#export-frame-style");
const exportSkit = document.querySelector("#export-skit");
const exportDownload = document.querySelector("#export-download");
const exportStatus = document.querySelector("#export-status");

const scene = new THREE.Scene();
scene.background = new THREE.Color("#5bb9f4");

const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, 0.1, 100);
camera.position.set(0, 0, 10);

const renderer = new THREE.WebGLRenderer({
  antialias: false,
  alpha: false,
  powerPreference: "high-performance",
});

renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.setAttribute("aria-hidden", "true");
stage.appendChild(renderer.domElement);

const world = new THREE.Group();
scene.add(world);

const heaven = new HeavenBackdrop({ scene });
const clouds = heaven.clouds;

const angel = new BurningWheel();
angel.setBaseScale(1.08);
world.add(angel.group);

const hoverShadow = new THREE.Mesh(
  new THREE.RingGeometry(0.72, 1.62, 32),
  new THREE.MeshBasicMaterial({
    color: "#0867c9",
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide,
  })
);
hoverShadow.position.set(0, -2.28, -2.5);
hoverShadow.scale.y = 0.31;
world.add(hoverShadow);

const containment = new ContainmentEngine({
  angel,
  scene,
  renderer,
  stage,
  clouds,
  statusLine,
  motionButton: motionToggle,
  resetButton: realityReset,
});

const voice = new VoiceController({
  angel,
  containment,
  playbackRate: 1.3,
  onState(state) {
    if (!voiceStatus) return;

    const labels = {
      idle: "THROAT IDLE",
      summoning: "SUMMONING VOICE...",
      speaking: "VOICE ONLINE",
      paused: "VOICE PAUSED",
      error: "THROAT ERROR",
    };

    voiceStatus.textContent = labels[state] || state.toUpperCase();
    voiceStatus.dataset.state = state;
  },
});

const rantChurner = new RantChurner();

const brain = new BrainController({
  onState(state) {
    if (!brainStatus) return;

    const labels = {
      idle: "BRAIN IDLE",
      thinking: "THINKING...",
      ready: "THOUGHT ACQUIRED",
      error: "BRAIN ERROR",
    };

    brainStatus.textContent = labels[state] || state.toUpperCase();
    brainStatus.dataset.state = state;

    if (brainGenerate) {
      brainGenerate.toggleAttribute("disabled", state === "thinking");
    }
  },
});

if (rantBank) rantBank.value = rantChurner.bank;
if (rantCurrent && rantChurner.current) {
  rantCurrent.value = rantChurner.current;
}

async function generateAndDirectFromPrompt(prompt, preset = "default") {
  const thought = await brain.generate(prompt, preset);
  if (thought?.cancelled) return null;

  if (directorText) {
    directorText.value = thought.dialogue;
  }

  const directed = directDialogue(thought.dialogue, {
    title: thought.title || "BRAIN-GENERATED BURNING WHEEL",
  });

  if (skitScript) {
    skitScript.value = directed.script;
    skitScript.scrollTop = 0;
  }

  if (directorStatus) {
    directorStatus.textContent =
      `DIRECTED // ${directed.stats.chunks} LINES // ${directed.stats.gestures} GESTURES`;
    directorStatus.dataset.state = "ready";
  }

  if (brainStatus) {
    brainStatus.textContent =
      `READY // ${thought.model || "BRAIN"}`;
    brainStatus.dataset.state = "ready";
  }

  return { thought, directed };
}

const pointer = new THREE.Vector2(0, 0);
let motionEnabled = true;
let elapsed = 0;
let previousTime = performance.now();

const performanceEngine = new PerformanceEngine({
  angel,
  containment,
  voice,
  getElapsed: () => elapsed,
  onState(state, detail = "") {
    if (!skitStatus) return;

    const labels = {
      idle: "SKIT IDLE",
      running: "PERFORMING",
      complete: "SKIT COMPLETE",
      error: "SKIT ERROR",
    };

    skitStatus.textContent = detail
      ? `${labels[state] || state.toUpperCase()} // ${detail}`
      : labels[state] || state.toUpperCase();
    skitStatus.dataset.state = state;

    if (skitRun) {
      skitRun.toggleAttribute("disabled", state === "running");
    }
  },
  onStep(step, index) {
    if (skitScript) {
      skitScript.dataset.activeLine = String(step.lineNumber || index + 1);
    }

    if (step.type === "autoChaos" && autoChaosToggle) {
      autoChaosToggle.setAttribute("aria-pressed", String(step.enabled));
      autoChaosToggle.textContent = step.enabled
        ? "AUTO CHAOS: ON"
        : "AUTO CHAOS: OFF";
    }
  },
});

let lastExportUrl = null;

const videoExporter = new VideoExporter({
  renderer,
  containment,
  voice,
  performanceEngine,
  setExportViewport,
  restoreViewport,
  onState(state, detail = "") {
    if (!exportStatus) return;

    const labels = {
      idle: "EXPORT IDLE",
      preparing: "PREPARING...",
      framing: "REFRAMING...",
      recording: "RECORDING...",
      ready: "VIDEO READY",
      complete: "VIDEO READY",
      error: "EXPORT ERROR",
    };

    exportStatus.textContent = detail
      ? `${labels[state] || state.toUpperCase()} // ${detail}`
      : labels[state] || state.toUpperCase();
    exportStatus.dataset.state = state;
  },
});

function setLabOpen(open) {
  if (!controlLab || !hudToggle) return;

  controlLab.classList.toggle("is-collapsed", !open);
  hudToggle.setAttribute("aria-expanded", String(open));
  hudToggle.textContent = open ? "CLOSE LAB" : "OPEN LAB";
}

hudToggle?.addEventListener("click", () => {
  setLabOpen(controlLab?.classList.contains("is-collapsed"));
});

voiceSpeed?.addEventListener("input", () => {
  const rate = Number(voiceSpeed.value);
  voice.setPlaybackRate(rate);

  if (voiceSpeedValue) {
    voiceSpeedValue.textContent = `${rate.toFixed(2)}×`;
  }
});

voiceApertureToggle?.addEventListener("click", () => {
  const enabled =
    voiceApertureToggle.getAttribute("aria-pressed") !== "true";

  voiceApertureToggle.setAttribute("aria-pressed", String(enabled));
  voiceApertureToggle.textContent = enabled
    ? "VOICE APERTURE: ON"
    : "VOICE APERTURE: OFF";

  angel.setVoiceApertureEnabled(enabled);
});

brainGenerate?.addEventListener("click", async () => {
  const prompt = brainPrompt?.value || "";
  const preset = brainPreset?.value || "default";

  try {
    await generateAndDirectFromPrompt(prompt, preset);
  } catch (error) {
    console.error(error);
    if (brainStatus) {
      brainStatus.textContent = error?.message || "BRAIN FAILURE";
      brainStatus.dataset.state = "error";
    }
  }
});

rantSave?.addEventListener("click", () => {
  rantChurner.setBank(rantBank?.value || "");
  if (rantStatus) {
    rantStatus.textContent = `SAVED // ${rantChurner.items.length} SEEDS`;
    rantStatus.dataset.state = "ready";
  }
});

function churnOne() {
  rantChurner.setBank(rantBank?.value || "");
  const result = rantChurner.churn();

  if (!result.seed) {
    if (rantStatus) {
      rantStatus.textContent = "PASTE A SEED BANK FIRST";
      rantStatus.dataset.state = "error";
    }
    return null;
  }

  if (rantCurrent) {
    rantCurrent.value = result.seed;
  }

  if (rantStatus) {
    rantStatus.textContent =
      `CHURNED // ${result.remaining} LEFT${result.recycled ? " // RECYCLED" : ""}`;
    rantStatus.dataset.state = "ready";
  }

  return result.seed;
}

rantChurn?.addEventListener("click", () => {
  churnOne();
});

rantThink?.addEventListener("click", async () => {
  const seed = churnOne();
  if (!seed) return;

  try {
    const prompt = rantChurner.buildBrainPrompt(seed);
    const preset = brainPreset?.value || "default";
    await generateAndDirectFromPrompt(prompt, preset);

    if (rantStatus) {
      rantStatus.textContent = "RANT BUILT // READY TO REVIEW";
      rantStatus.dataset.state = "ready";
    }
  } catch (error) {
    console.error(error);
    if (rantStatus) {
      rantStatus.textContent = error?.message || "RANT FAILURE";
      rantStatus.dataset.state = "error";
    }
  }
});

rantReset?.addEventListener("click", () => {
  rantChurner.resetHistory();
  if (rantCurrent) rantCurrent.value = "";
  if (rantStatus) {
    rantStatus.textContent = "HISTORY CLEARED";
    rantStatus.dataset.state = "idle";
  }
});

directorBuild?.addEventListener("click", () => {
  const source = directorText?.value || "";
  const directed = directDialogue(source, { title: "AUTO-DIRECTED BURNING WHEEL" });

  if (!directed.script) {
    if (directorStatus) {
      directorStatus.textContent = "GIVE THE DIRECTOR SOME WORDS";
      directorStatus.dataset.state = "error";
    }
    return;
  }

  if (skitScript) {
    skitScript.value = directed.script;
    skitScript.scrollTop = 0;
  }

  if (directorStatus) {
    directorStatus.textContent =
      `DIRECTED // ${directed.stats.chunks} LINES // ${directed.stats.gestures} GESTURES`;
    directorStatus.dataset.state = "ready";
  }
});

async function speakCurrentLine() {
  const line = voiceText?.value || "";

  try {
    if (performanceEngine.running) {
      performanceEngine.stop({ silent: true });
    }

    voiceSpeak?.setAttribute("disabled", "");
    setLabOpen(false);
    await voice.speak(line);
  } catch (error) {
    console.error(error);
    if (voiceStatus) {
      voiceStatus.textContent = error?.message || "VOICE FAILURE";
      voiceStatus.dataset.state = "error";
    }
  } finally {
    voiceSpeak?.removeAttribute("disabled");
  }
}

async function runSkit() {
  const script = skitScript?.value || "";

  try {
    setLabOpen(false);
    await performanceEngine.run(script);
  } catch (error) {
    console.error(error);
  }
}

function exportFilename(result) {
  const ratio = String(result.aspect || "video").replace(":", "x");
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .replace("Z", "");

  return `burning-wheel_${ratio}_${result.resolution}p_${stamp}.${result.extension}`;
}

async function exportCurrentSkit() {
  const script = skitScript?.value || "";

  if (!script.trim()) {
    if (exportStatus) {
      exportStatus.textContent = "EXPORT ERROR // GIVE HIM A SKIT FIRST";
      exportStatus.dataset.state = "error";
    }
    return;
  }

  try {
    exportSkit?.setAttribute("disabled", "");
    exportSkit && (exportSkit.textContent = "EXPORTING...");
    setLabOpen(false);

    const result = await videoExporter.exportSkit(script, {
      aspect: exportAspect?.value || "16:9",
      resolution: Number(exportResolution?.value || 720),
      look: exportLook?.value || "dither-monster",
      internalScale: Number(exportInternalScale?.value || 0.33),
      frameStyle: exportFrameStyle?.value || "none",
      frameRate: 30,
    });

    if (lastExportUrl) {
      URL.revokeObjectURL(lastExportUrl);
    }

    lastExportUrl = URL.createObjectURL(result.blob);
    const filename = exportFilename(result);

    if (exportDownload) {
      exportDownload.href = lastExportUrl;
      exportDownload.download = filename;
      exportDownload.hidden = false;
      const lookLabel = String(result.look || "clean")
        .replaceAll("-", " ")
        .toUpperCase();

      exportDownload.textContent =
        `SAVE LAST VIDEO // ${result.width}×${result.height} // ${lookLabel}`;
    }

    // Desktop browsers generally honor this immediately. Mobile Safari may
    // require the visible SAVE LAST VIDEO link, which remains available.
    const autoSave = document.createElement("a");
    autoSave.href = lastExportUrl;
    autoSave.download = filename;
    autoSave.style.display = "none";
    document.body.appendChild(autoSave);
    autoSave.click();
    autoSave.remove();

    setLabOpen(true);
  } catch (error) {
    console.error(error);

    if (exportStatus) {
      exportStatus.textContent =
        `EXPORT ERROR // ${error?.message || "VIDEO FAILED"}`;
      exportStatus.dataset.state = "error";
    }

    setLabOpen(true);
  } finally {
    exportSkit?.removeAttribute("disabled");
    if (exportSkit) exportSkit.textContent = "EXPORT SKIT";
  }
}

exportSkit?.addEventListener("click", exportCurrentSkit);

voiceSpeak?.addEventListener("click", speakCurrentLine);
voiceStop?.addEventListener("click", () => {
  if (performanceEngine.running) {
    performanceEngine.stop();
  } else {
    voice.stop();
  }
});

voiceText?.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    speakCurrentLine();
  }
});

skitRun?.addEventListener("click", runSkit);
skitStop?.addEventListener("click", () => performanceEngine.stop());

skitLoadGodRant?.addEventListener("click", () => {
  if (!skitScript) return;
  performanceEngine.stop({ silent: true });
  skitScript.value = godRantSkit;
  skitScript.scrollTop = 0;
  skitScript.focus();

  if (skitStatus) {
    skitStatus.textContent = "LOADED // THE WORD \"GOD\" IS NOT GOD";
    skitStatus.dataset.state = "idle";
  }
});

skitScript?.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    runSkit();
  }
});

const EXPRESSION_KEYS = {
  Digit1: "neutral",
  Digit2: "smug",
  Digit3: "suspicious",
  Digit4: "wide",
  Digit5: "offended",
  Digit6: "delighted",
  Digit7: "deadpan",
  Digit8: "sideEye",
  Digit9: "eyeRoll",
  Digit0: "wtf",
};

const GESTURE_KEYS = {
  KeyQ: "leanIn",
  KeyW: "recoil",
  KeyE: "judgment",
  KeyR: "flare",
  KeyT: "attractorDrift",
  KeyY: "orientationSlip",
  KeyU: "mobiusFlip",
  KeyI: "projectionError",
  KeyO: "dimensionStutter",
};

document.querySelectorAll("[data-expression]").forEach((button) => {
  button.addEventListener("click", () => {
    const expression = button.dataset.expression;
    angel.setExpression(
      expression,
      expression === "neutral" ? 0 : 2.4,
      elapsed
    );

    document.querySelectorAll("[data-expression]").forEach((item) => {
      item.classList.toggle("is-active", item === button);
    });
  });
});

document.querySelectorAll("[data-gesture]").forEach((button) => {
  button.addEventListener("click", () => {
    containment.trigger(button.dataset.gesture, {
      intensity: Number(button.dataset.intensity || 1),
      elapsed,
    });
  });
});

function updatePointer(clientX, clientY) {
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -((clientY / window.innerHeight) * 2 - 1);
}

window.addEventListener("pointermove", (event) => {
  updatePointer(event.clientX, event.clientY);
});

window.addEventListener("pointerleave", () => {
  pointer.set(0, 0);
});

function toggleMotion() {
  motionEnabled = !motionEnabled;
  motionToggle.setAttribute("aria-pressed", String(!motionEnabled));
  motionToggle.textContent = motionEnabled ? "PAUSE MOTION" : "RESUME MOTION";
  containment.originalMotionText = motionToggle.textContent;

  angel.setEyeForegroundPriority(!motionEnabled, "paused");
}

motionToggle.addEventListener("click", toggleMotion);

autoChaosToggle?.addEventListener("click", () => {
  containment.setAutoChaos(!containment.autoChaos);
  autoChaosToggle.setAttribute("aria-pressed", String(containment.autoChaos));
  autoChaosToggle.textContent = containment.autoChaos
    ? "AUTO CHAOS: ON"
    : "AUTO CHAOS: OFF";
});

realityReset?.addEventListener("click", () => {
  performanceEngine.stop({ silent: true });
  containment.reset();
  if (skitStatus) {
    skitStatus.textContent = "SKIT IDLE";
    skitStatus.dataset.state = "idle";
  }
});

window.addEventListener("keydown", (event) => {
  if (event.code === "Escape") {
    if (controlLab && !controlLab.classList.contains("is-collapsed")) {
      setLabOpen(false);
      return;
    }

    performanceEngine.stop({ silent: true });
    containment.reset();
    return;
  }

  if (
    event.target instanceof HTMLElement &&
    event.target.matches("input, textarea, [contenteditable='true']")
  ) {
    return;
  }

  if (event.code === "Space" && event.target === document.body) {
    event.preventDefault();
    toggleMotion();
    return;
  }

  if (event.code === "KeyH") {
    setLabOpen(controlLab?.classList.contains("is-collapsed"));
    return;
  }

  if (event.code === "KeyB") {
    angel.blink(elapsed);
    return;
  }

  const gesture = GESTURE_KEYS[event.code];
  if (gesture) {
    containment.trigger(gesture, { elapsed });
    return;
  }

  const expression = EXPRESSION_KEYS[event.code];
  if (expression) {
    angel.setExpression(
      expression,
      expression === "neutral" ? 0 : 2.4,
      elapsed
    );
  }
});

let exportViewportActive = false;

function applyStageViewport({
  renderWidth,
  renderHeight,
  halfWidth,
  halfHeight,
  characterScale,
}) {
  camera.left = -halfWidth;
  camera.right = halfWidth;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(renderWidth, renderHeight, false);
  containment.resizeOverlay();

  heaven.resize({ halfWidth, halfHeight });

  containment.cloudBases = clouds.map((cloud) => ({
    cloud,
    position: cloud.position.clone(),
    scale: cloud.scale.clone(),
    rotation: cloud.rotation.clone(),
  }));

  angel.setBaseScale(characterScale);
}

function setExportViewport(width, height) {
  exportViewportActive = true;
  stage.dataset.exporting = "true";

  const aspect = Math.max(width / height, 0.25);
  let halfHeight = 3.15;
  let halfWidth = halfHeight * aspect;

  // Tall video needs extra world-space width or the seraphic wing field gets
  // cropped. Expand the camera vertically instead of shrinking the creature.
  if (halfWidth < 2.85) {
    halfWidth = 2.85;
    halfHeight = halfWidth / aspect;
  }

  applyStageViewport({
    renderWidth: width,
    renderHeight: height,
    halfWidth,
    halfHeight,
    characterScale: 1.06,
  });
}

function restoreViewport() {
  exportViewportActive = false;
  delete stage.dataset.exporting;
  resize();
}

function resize() {
  if (exportViewportActive) return;

  const aspect = Math.max(window.innerWidth / window.innerHeight, 0.25);
  const halfHeight = 3.15;
  const halfWidth = halfHeight * aspect;

  const divisor = window.innerWidth < 700 ? 3.2 : 4.2;
  const renderWidth = Math.max(
    150,
    Math.round(window.innerWidth / divisor)
  );
  const renderHeight = Math.max(
    150,
    Math.round(window.innerHeight / divisor)
  );

  applyStageViewport({
    renderWidth,
    renderHeight,
    halfWidth,
    halfHeight,
    characterScale: window.innerWidth < 520 ? 0.92 : 1.08,
  });
}
window.addEventListener("resize", resize);
resize();

function animate(now) {
  requestAnimationFrame(animate);

  const delta = Math.min((now - previousTime) / 1000, 0.05);
  previousTime = now;

  if (motionEnabled) {
    elapsed += delta;

    angel.update(delta, elapsed, pointer);
    heaven.update(delta, elapsed, pointer, containment.breachLevel);
    containment.update(delta, elapsed, pointer);
    voice.update(delta, elapsed);

    hoverShadow.scale.x =
      1 +
      Math.sin(elapsed * 1.16) * 0.055 +
      containment.breachLevel * 0.1;

    hoverShadow.material.opacity =
      0.39 -
      Math.sin(elapsed * 1.16) * 0.045 -
      containment.breachLevel * 0.14;
  }

  renderer.render(scene, camera);
  containment.afterRender(elapsed);
  videoExporter.captureFrame();
}

window.addEventListener("beforeunload", () => {
  brain.cancel();
  performanceEngine.stop({ silent: true });
  voice.dispose();
  heaven.dispose();

  if (lastExportUrl) {
    URL.revokeObjectURL(lastExportUrl);
  }
});

requestAnimationFrame(animate);
