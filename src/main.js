import * as THREE from "three";
import "./style.css";

const stage = document.querySelector("#stage");
const motionToggle = document.querySelector("#motion-toggle");

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

const wheel = new THREE.Group();
world.add(wheel);

const gold = new THREE.MeshBasicMaterial({
  color: "#ffc800",
});

const goldShadow = new THREE.MeshBasicMaterial({
  color: "#9d6500",
});

const darkInset = new THREE.MeshBasicMaterial({
  color: "#3c2500",
});

const shadowGeometry = new THREE.TorusGeometry(1.68, 0.25, 4, 36);
const shadowRing = new THREE.Mesh(shadowGeometry, goldShadow);
shadowRing.position.z = -0.05;
wheel.add(shadowRing);

const ringGeometry = new THREE.TorusGeometry(1.62, 0.19, 5, 36);
const ring = new THREE.Mesh(ringGeometry, gold);
wheel.add(ring);

const insetGeometry = new THREE.TorusGeometry(1.62, 0.055, 4, 36);
const inset = new THREE.Mesh(insetGeometry, darkInset);
inset.position.z = 0.18;
wheel.add(inset);

for (let i = 0; i < 18; i += 1) {
  const angle = (i / 18) * Math.PI * 2;
  const geometry = new THREE.BoxGeometry(0.09, 0.09, 0.10);
  const material = new THREE.MeshBasicMaterial({
    color: i % 3 === 0 ? "#fff1a4" : "#d98c00",
  });
  const rivet = new THREE.Mesh(geometry, material);

  rivet.position.set(
    Math.cos(angle) * 1.62,
    Math.sin(angle) * 1.62,
    0.22
  );
  rivet.rotation.z = angle;
  wheel.add(rivet);
}

wheel.rotation.x = 1.03;
wheel.rotation.z = -0.22;

const hoverShadow = new THREE.Mesh(
  new THREE.RingGeometry(0.75, 1.55, 32),
  new THREE.MeshBasicMaterial({
    color: "#0867c9",
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
  })
);
hoverShadow.position.set(0, -2.18, -2.5);
hoverShadow.scale.y = 0.33;
world.add(hoverShadow);

const pointer = new THREE.Vector2(0, 0);
let motionEnabled = true;
let elapsed = 0;
let previousTime = performance.now();

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
}

motionToggle.addEventListener("click", toggleMotion);

window.addEventListener("keydown", (event) => {
  if (event.code === "Space" && event.target === document.body) {
    event.preventDefault();
    toggleMotion();
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

  // Render deliberately below display resolution, then let CSS nearest-neighbor
  // scaling give us the chunky browser-toy pixel texture.
  const divisor = window.innerWidth < 700 ? 3.2 : 4.2;
  const renderWidth = Math.max(150, Math.round(window.innerWidth / divisor));
  const renderHeight = Math.max(150, Math.round(window.innerHeight / divisor));

  renderer.setSize(renderWidth, renderHeight, false);

  const cloudSpread = Math.min(halfWidth * 0.82, 4.2);
  cloudBackLeft.position.x = -cloudSpread;
  cloudBackRight.position.x = cloudSpread;
  cloudLow.position.x = -cloudSpread * 0.9;
}

window.addEventListener("resize", resize);
resize();

function animate(now) {
  requestAnimationFrame(animate);

  const delta = Math.min((now - previousTime) / 1000, 0.05);
  previousTime = now;

  if (motionEnabled) {
    elapsed += delta;

    wheel.rotation.y += delta * 0.56;
    wheel.rotation.z += delta * 0.17;

    const targetTiltX = 1.03 + pointer.y * 0.16;
    const targetTiltZ = -0.22 - pointer.x * 0.13;

    wheel.rotation.x += (targetTiltX - wheel.rotation.x) * 0.04;
    wheel.rotation.z += (targetTiltZ - wheel.rotation.z) * 0.02;

    wheel.position.y = Math.sin(elapsed * 1.25) * 0.10;
    wheel.scale.setScalar(1 + Math.sin(elapsed * 0.88) * 0.012);

    hoverShadow.scale.x = 1 + Math.sin(elapsed * 1.25) * 0.05;
    hoverShadow.material.opacity = 0.40 - Math.sin(elapsed * 1.25) * 0.05;
  }

  renderer.render(scene, camera);
}

requestAnimationFrame(animate);
