import * as THREE from "three";
import { BurningWheel } from "./character/BurningWheel.js";
import { ContainmentEngine } from "./character/ContainmentEngine.js";
import "./style.css";

const stage = document.querySelector("#stage");
const motionToggle = document.querySelector("#motion-toggle");
const autoChaosToggle = document.querySelector("#auto-chaos");
const realityReset = document.querySelector("#reality-reset");
const statusLine = document.querySelector(".hud__label span");

const scene = new THREE.Scene();
scene.background = new THREE.Color("#168cff");

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

function makePixelCloud(scale = 1) {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color: "#f7fbff",
    depthWrite: false,
  });

  const blocks = [
    [-1.15, 0.00, 1.35, 0.34],
    [-0.45, 0.17, 1.20, 0.52],
    [0.35, 0.03, 1.45, 0.38],
    [1.10, -0.07, 0.68, 0.25],
  ];

  for (const [x, y, width, height] of blocks) {
    const geometry = new THREE.PlaneGeometry(width, height);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, 0);
    group.add(mesh);
  }

  group.scale.setScalar(scale);
  return group;
}

const cloudBackLeft = makePixelCloud(0.72);
cloudBackLeft.position.set(-3.0, 1.85, -4);
world.add(cloudBackLeft);

const cloudBackRight = makePixelCloud(0.58);
cloudBackRight.position.set(3.1, 1.25, -4);
world.add(cloudBackRight);

const cloudLow = makePixelCloud(0.45);
cloudLow.position.set(-2.75, -2.10, -4);
world.add(cloudLow);

const clouds = [cloudBackLeft, cloudBackRight, cloudLow];

const angel = new BurningWheel();
angel.setBaseScale(0.94);
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

const pointer = new THREE.Vector2(0, 0);
let motionEnabled = true;
let elapsed = 0;
let previousTime = performance.now();

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
  containment.reset();
});

window.addEventListener("keydown", (event) => {
  if (event.code === "Escape") {
    containment.reset();
    return;
  }

  if (event.code === "Space" && event.target === document.body) {
    event.preventDefault();
    toggleMotion();
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

function resize() {
  const aspect = Math.max(window.innerWidth / window.innerHeight, 0.25);
  const halfHeight = 3.15;
  const halfWidth = halfHeight * aspect;

  camera.left = -halfWidth;
  camera.right = halfWidth;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();

  const divisor = window.innerWidth < 700 ? 3.2 : 4.2;
  const renderWidth = Math.max(
    150,
    Math.round(window.innerWidth / divisor)
  );
  const renderHeight = Math.max(
    150,
    Math.round(window.innerHeight / divisor)
  );

  renderer.setSize(renderWidth, renderHeight, false);
  containment.resizeOverlay();

  const cloudSpread = Math.min(halfWidth * 0.82, 4.2);
  cloudBackLeft.position.x = -cloudSpread;
  cloudBackRight.position.x = cloudSpread;
  cloudLow.position.x = -cloudSpread * 0.9;

  containment.cloudBases = clouds.map((cloud) => ({
    cloud,
    position: cloud.position.clone(),
    scale: cloud.scale.clone(),
    rotation: cloud.rotation.clone(),
  }));

  const characterScale = window.innerWidth < 520 ? 0.82 : 0.94;
  angel.setBaseScale(characterScale);
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
    containment.update(delta, elapsed, pointer);

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
}

requestAnimationFrame(animate);
