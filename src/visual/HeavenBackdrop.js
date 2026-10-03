import * as THREE from "three";

const BAYER_4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hexToRgb(hex) {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function makeSkyTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 128;

  const ctx = canvas.getContext("2d", { alpha: false });
  const image = ctx.createImageData(canvas.width, canvas.height);

  const top = hexToRgb("#4daaf2");
  const middle = hexToRgb("#8ed2fb");
  const bottom = hexToRgb("#d9f4ff");

  for (let y = 0; y < canvas.height; y += 1) {
    const t = y / (canvas.height - 1);
    const horizonGlow = Math.exp(-Math.pow((t - 0.78) / 0.2, 2)) * 0.12;

    let a;
    let b;
    let localT;

    if (t < 0.58) {
      a = top;
      b = middle;
      localT = t / 0.58;
    } else {
      a = middle;
      b = bottom;
      localT = (t - 0.58) / 0.42;
    }

    for (let x = 0; x < canvas.width; x += 1) {
      const threshold = (BAYER_4[y % 4][x % 4] + 0.5) / 16 - 0.5;
      const shimmer =
        Math.sin(x * 0.075 + y * 0.031) * 0.006 +
        Math.cos(x * 0.023 - y * 0.051) * 0.004;

      const dither = threshold * 0.035 + shimmer + horizonGlow;
      const quantSteps = 18;

      const r = lerp(a.r, b.r, localT);
      const g = lerp(a.g, b.g, localT);
      const blue = lerp(a.b, b.b, localT);

      const quantize = (value) => {
        const normalized = clamp(value / 255 + dither, 0, 1);
        return Math.round(normalized * quantSteps) / quantSteps * 255;
      };

      const index = (y * canvas.width + x) * 4;
      image.data[index] = quantize(r);
      image.data[index + 1] = quantize(g);
      image.data[index + 2] = quantize(blue);
      image.data[index + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCloudTexture(seed = 1) {
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 96;

  const ctx = canvas.getContext("2d", { alpha: true });
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const random = seededRandom(seed);

  // Blue-gray body shadows first. These keep the cloud from reading as flat
  // white clip art while remaining bright enough for the heavenly stage.
  for (let i = 0; i < 16; i += 1) {
    const x = 26 + random() * 140;
    const y = 48 + random() * 24;
    const rx = 20 + random() * 34;
    const ry = 8 + random() * 15;
    const gradient = ctx.createRadialGradient(x, y - 4, 1, x, y, rx);

    gradient.addColorStop(0, "rgba(185, 214, 232, 0.48)");
    gradient.addColorStop(0.58, "rgba(159, 198, 224, 0.25)");
    gradient.addColorStop(1, "rgba(116, 169, 207, 0)");

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Puffy lit masses.
  for (let i = 0; i < 24; i += 1) {
    const x = 18 + random() * 156;
    const y = 18 + random() * 52;
    const rx = 14 + random() * 29;
    const ry = 9 + random() * 20;
    const gradient = ctx.createRadialGradient(
      x - rx * 0.18,
      y - ry * 0.24,
      1,
      x,
      y,
      rx
    );

    gradient.addColorStop(0, "rgba(255, 255, 255, 0.96)");
    gradient.addColorStop(0.42, "rgba(250, 253, 255, 0.86)");
    gradient.addColorStop(0.72, "rgba(231, 244, 252, 0.52)");
    gradient.addColorStop(1, "rgba(211, 233, 247, 0)");

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Dither the cloud's soft alpha edge instead of leaving a modern airbrush
  // blur. The interior stays soft; the boundary breaks into screenprint dots.
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4;
      const alpha = image.data[index + 3] / 255;
      if (alpha <= 0) continue;

      const threshold = (BAYER_4[y % 4][x % 4] + 0.5) / 16;
      const edge = clamp((alpha - 0.04) / 0.96, 0, 1);
      const quantized =
        edge < 0.48
          ? edge > threshold * 0.72
            ? 0.46
            : 0
          : Math.round(edge * 8) / 8;

      image.data[index + 3] = Math.round(quantized * 255);

      // Slight pearl quantization in the visible cloud body.
      for (let channel = 0; channel < 3; channel += 1) {
        const value = image.data[index + channel];
        image.data[index + channel] = Math.round(value / 12) * 12;
      }
    }
  }

  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const CLOUD_LAYOUT = [
  { x: -0.78, y: 0.66, width: 0.92, height: 0.31, z: -6.3, opacity: 0.62, drift: 0.018, phase: 0.2 },
  { x: 0.71, y: 0.53, width: 0.82, height: 0.28, z: -6.0, opacity: 0.68, drift: -0.014, phase: 1.1 },
  { x: -0.12, y: 0.80, width: 0.66, height: 0.22, z: -6.8, opacity: 0.42, drift: 0.01, phase: 2.2 },
  { x: -0.82, y: -0.57, width: 1.05, height: 0.37, z: -5.7, opacity: 0.78, drift: 0.015, phase: 3.4 },
  { x: 0.77, y: -0.67, width: 1.12, height: 0.4, z: -5.5, opacity: 0.82, drift: -0.012, phase: 4.6 },
  { x: 0.04, y: -0.93, width: 1.5, height: 0.42, z: -6.1, opacity: 0.60, drift: 0.008, phase: 5.4 },
  { x: 0.03, y: 0.18, width: 0.72, height: 0.22, z: -7.0, opacity: 0.25, drift: -0.006, phase: 6.1 },
];

export class HeavenBackdrop {
  constructor({ scene }) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = "heaven-backdrop";
    this.scene.add(this.group);

    this.skyTexture = makeSkyTexture();
    this.skyMaterial = new THREE.MeshBasicMaterial({
      map: this.skyTexture,
      transparent: true,
      opacity: 0.88,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.sky = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      this.skyMaterial
    );
    this.sky.position.z = -9;
    this.sky.renderOrder = -1000;
    this.group.add(this.sky);

    this.clouds = CLOUD_LAYOUT.map((layout, index) => {
      const cloud = new THREE.Group();
      cloud.name = `heaven-cloud:${index}`;
      cloud.userData.layout = layout;

      const texture = makeCloudTexture(0x9e3779b1 + index * 977);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: layout.opacity,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), material);
      mesh.userData.baseScale = 1;
      cloud.add(mesh);
      cloud.userData.mesh = mesh;
      cloud.userData.texture = texture;

      this.group.add(cloud);
      return cloud;
    });

    this.horizon = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({
        color: "#f6fdff",
        transparent: true,
        opacity: 0.075,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.horizon.position.z = -8.6;
    this.horizon.renderOrder = -990;
    this.group.add(this.horizon);

    this.halfWidth = 4;
    this.halfHeight = 3.15;
    this.resize({ halfWidth: this.halfWidth, halfHeight: this.halfHeight });
  }

  resize({ halfWidth, halfHeight }) {
    this.halfWidth = halfWidth;
    this.halfHeight = halfHeight;

    this.sky.scale.set(halfWidth * 1.04, halfHeight * 1.04, 1);

    this.horizon.scale.set(halfWidth * 1.04, halfHeight * 0.22, 1);
    this.horizon.position.y = -halfHeight * 0.58;

    this.clouds.forEach((cloud) => {
      const layout = cloud.userData.layout;
      const mesh = cloud.userData.mesh;

      cloud.position.set(
        layout.x * halfWidth,
        layout.y * halfHeight,
        layout.z
      );
      cloud.rotation.set(0, 0, 0);
      cloud.scale.set(1, 1, 1);

      const width = Math.max(1.5, halfWidth * layout.width);
      const height = Math.max(0.55, halfHeight * layout.height);
      mesh.scale.set(width, height, 1);
      mesh.position.set(0, 0, 0);
    });
  }

  update(_delta, elapsed, pointer = { x: 0, y: 0 }, breach = 0) {
    this.clouds.forEach((cloud, index) => {
      const layout = cloud.userData.layout;
      const mesh = cloud.userData.mesh;

      const depthFactor = 1 - Math.min(index, 5) * 0.08;
      const pointerDriftX = pointer.x * 0.06 * depthFactor;
      const pointerDriftY = pointer.y * 0.025 * depthFactor;
      const floatX =
        Math.sin(elapsed * (0.08 + index * 0.009) + layout.phase) *
        this.halfWidth *
        layout.drift;
      const floatY =
        Math.cos(elapsed * (0.06 + index * 0.007) + layout.phase) *
        0.025;

      mesh.position.x = floatX + pointerDriftX;
      mesh.position.y = floatY + pointerDriftY;

      const breathe = 1 + Math.sin(elapsed * 0.11 + layout.phase) * 0.014;
      mesh.scale.x *= breathe;
      mesh.scale.y *= 1 + Math.cos(elapsed * 0.09 + layout.phase) * 0.009;

      // Undo the multiplicative breathing every frame so scale cannot drift.
      const width = Math.max(1.5, this.halfWidth * layout.width);
      const height = Math.max(0.55, this.halfHeight * layout.height);
      mesh.scale.x += (width - mesh.scale.x) * 0.2;
      mesh.scale.y += (height - mesh.scale.y) * 0.2;

      mesh.material.opacity =
        layout.opacity *
        (1 - clamp(breach, 0, 1) * 0.16);
    });

    this.horizon.material.opacity =
      0.07 +
      Math.max(0, Math.sin(elapsed * 0.16)) * 0.025 +
      clamp(breach, 0, 1) * 0.035;
  }

  dispose() {
    this.skyTexture.dispose();
    this.sky.geometry.dispose();
    this.skyMaterial.dispose();
    this.horizon.geometry.dispose();
    this.horizon.material.dispose();

    this.clouds.forEach((cloud) => {
      const mesh = cloud.userData.mesh;
      cloud.userData.texture?.dispose();
      mesh?.geometry?.dispose();
      mesh?.material?.dispose();
    });
  }
}
