import * as THREE from "three";

const PANEL_TYPES = [
  "cutout-eye",
  "led-eye",
  "cutout-eye",
  "symbol",
  "marquee",
  "face",
  "led-eye",
  "glitch",
];

const TRACKING_MODES = [
  "pointer",
  "clock",
  "fixed",
  "core",
  "chaos",
  "independent",
];

const NEON = [
  "#ff4fd8",
  "#6df7ff",
  "#86ff5b",
  "#ff5b4d",
  "#b86cff",
  "#ffe84d",
  "#4d88ff",
];

const IRIS = [
  "#58a7ff",
  "#6bdc76",
  "#bc7cff",
  "#f2a94a",
  "#8ed8d8",
  "#9f6d42",
];

const GLYPHS = {
  heart: [
    "01100110",
    "11111111",
    "11111111",
    "01111110",
    "00111100",
    "00011000",
  ],
  crown: [
    "10011001",
    "11011011",
    "11111111",
    "01111110",
    "01111110",
  ],
  arrow: [
    "00011000",
    "00001100",
    "11111110",
    "11111111",
    "11111110",
    "00001100",
    "00011000",
  ],
  star: [
    "00011000",
    "01011010",
    "00111100",
    "11111111",
    "00111100",
    "01011010",
    "00011000",
  ],
  question: [
    "00111100",
    "01100110",
    "00000110",
    "00011100",
    "00011000",
    "00000000",
    "00011000",
  ],
  eye: [
    "00000000",
    "00111100",
    "01100110",
    "11011011",
    "01100110",
    "00111100",
    "00000000",
  ],
  smile: [
    "00111100",
    "01000010",
    "10100101",
    "10000001",
    "10100101",
    "01011010",
    "00111100",
  ],
};

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function drawPixelGlyph(ctx, glyph, color, x, y, scale, offsetX = 0) {
  const rows = GLYPHS[glyph] || GLYPHS.eye;
  ctx.fillStyle = color;

  rows.forEach((row, rowIndex) => {
    [...row].forEach((bit, columnIndex) => {
      if (bit !== "1") return;
      ctx.fillRect(
        Math.round(x + offsetX + columnIndex * scale),
        Math.round(y + rowIndex * scale),
        scale,
        scale
      );
    });
  });
}

export class WheelPanel {
  constructor({
    id,
    radius,
    tube,
    angle,
    type,
    color,
    driftSpeed,
    phase,
    trackingMode = "independent",
  }) {
    this.id = id;
    this.radius = radius;
    this.tube = tube;
    this.baseAngle = angle;
    this.trackAngle = angle;
    this.type = type;
    this.isEyeball = type === "cutout-eye" || type === "led-eye";
    this.color = color;
    this.driftSpeed = driftSpeed;
    this.phase = phase;
    this.trackingMode = trackingMode;

    this.rng = mulberry32(hashString(id));
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.isEyeball ? 32 : 48;
    this.canvas.height = this.isEyeball ? 32 : 28;
    this.ctx = this.canvas.getContext("2d", { alpha: true });
    this.ctx.imageSmoothingEnabled = false;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.colorSpace = THREE.SRGBColorSpace;

    this.group = new THREE.Group();
    this.group.name = `panel:${id}`;

    const width = clamp(tube * 3.25, 0.20, 0.34);
    const height = clamp(tube * 1.85, 0.12, 0.21);
    const orbRadius = clamp(tube * 1.48, 0.105, 0.17);

    const bezelGeometry = this.isEyeball
      ? new THREE.CircleGeometry(orbRadius * 1.18, 12)
      : new THREE.PlaneGeometry(width * 1.18, height * 1.25);

    const screenGeometry = this.isEyeball
      ? new THREE.CircleGeometry(orbRadius, 12)
      : new THREE.PlaneGeometry(width, height);

    const bezel = new THREE.Mesh(
      bezelGeometry,
      new THREE.MeshBasicMaterial({
        color: this.isEyeball ? "#7b4a00" : "#4a2b00",
        side: THREE.DoubleSide,
      })
    );
    bezel.position.z = -0.006;
    this.group.add(bezel);

    this.screen = new THREE.Mesh(
      screenGeometry,
      new THREE.MeshBasicMaterial({
        map: this.texture,
        transparent: this.isEyeball,
        side: THREE.DoubleSide,
      })
    );
    this.group.add(this.screen);

    this.frame = 0;
    this.nextFrameAt = 0;
    this.nextBlinkAt = 0.8 + this.rng() * 3.8;
    this.blinkStart = -10;
    this.blinkDuration = 0.11 + this.rng() * 0.09;

    this.pupilX = (this.rng() - 0.5) * 0.8;
    this.pupilY = (this.rng() - 0.5) * 0.45;
    this.targetPupilX = this.pupilX;
    this.targetPupilY = this.pupilY;
    this.fixedPupilX = (this.rng() - 0.5) * 1.45;
    this.fixedPupilY = (this.rng() - 0.5) * 0.75;
    this.nextLookAt = 0.4 + this.rng() * 2.0;

    this.symbols = ["heart", "eye", "crown", "arrow", "star", "question", "smile"];
    this.symbolIndex = Math.floor(this.rng() * this.symbols.length);
    this.irisColor = IRIS[Math.floor(this.rng() * IRIS.length)];
    this.paperTone = this.rng() > 0.5 ? "#f7efe3" : "#ece7d8";
    this.glitchSeed = Math.floor(this.rng() * 10000);

    this.panicUntil = -1;
    this.panicIntensity = 0;
    this.panicActive = false;

    this.positionOnTrack(this.baseAngle);
    this.draw(0);
  }

  setPanic(elapsed, duration = 0.8, intensity = 1) {
    this.panicUntil = Math.max(this.panicUntil, elapsed + duration);
    this.panicIntensity = Math.max(this.panicIntensity, intensity);
  }

  positionOnTrack(angle, jitterX = 0, jitterY = 0, jitterZ = 0) {
    this.trackAngle = angle;
    this.group.position.set(
      Math.cos(angle) * this.radius + jitterX,
      Math.sin(angle) * this.radius + jitterY,
      this.tube * 1.48 + jitterZ
    );
    this.group.rotation.z = angle + Math.PI / 2;
  }

  updateTracking(elapsed, context) {
    const pointer = context.pointer || { x: 0, y: 0 };
    const coreEye = context.coreEye;

    switch (this.trackingMode) {
      case "pointer":
        this.targetPupilX = clamp(pointer.x * 1.25, -1.2, 1.2);
        this.targetPupilY = clamp(-pointer.y * 0.7, -0.7, 0.7);
        break;

      case "clock":
        this.targetPupilX = Math.sin(elapsed * 0.73 + this.phase) * 1.05;
        this.targetPupilY = Math.cos(elapsed * 0.41 + this.phase) * 0.5;
        break;

      case "fixed":
        this.targetPupilX = this.fixedPupilX;
        this.targetPupilY = this.fixedPupilY;
        break;

      case "core":
        this.targetPupilX = clamp((coreEye?.lookX || 0) * 4.2, -1.1, 1.1);
        this.targetPupilY = clamp((coreEye?.lookY || 0) * 3.4, -0.65, 0.65);
        break;

      case "chaos":
        this.targetPupilX =
          Math.sin(elapsed * 1.71 + Math.sin(elapsed * 0.33 + this.phase) * 5) *
          1.1;
        this.targetPupilY =
          Math.cos(elapsed * 1.13 + Math.sin(elapsed * 0.52 + this.phase) * 4) *
          0.58;
        break;

      default:
        if (elapsed >= this.nextLookAt) {
          this.targetPupilX = (this.rng() - 0.5) * 1.05;
          this.targetPupilY = (this.rng() - 0.5) * 0.55;
          this.nextLookAt = elapsed + 0.55 + this.rng() * 2.6;
        }
        break;
    }
  }

  update(delta, elapsed, context = {}) {
    this.panicActive = elapsed <= this.panicUntil;

    if (!this.panicActive && elapsed > this.panicUntil) {
      this.panicIntensity *= 0.82;
    }

    this.updateTracking(elapsed, context);

    if (this.panicActive) {
      const violence = this.panicIntensity;
      this.targetPupilX =
        Math.sin(elapsed * 31 + this.phase * 4.7) * 1.35 * violence;
      this.targetPupilY =
        Math.cos(elapsed * 27 + this.phase * 3.1) * 0.72 * violence;
    }

    this.pupilX += (this.targetPupilX - this.pupilX) * (this.panicActive ? 0.34 : 0.08);
    this.pupilY += (this.targetPupilY - this.pupilY) * (this.panicActive ? 0.34 : 0.08);

    const jitter = this.panicActive ? this.panicIntensity : 0;
    const jitterX = Math.sin(elapsed * 43 + this.phase) * this.tube * 0.5 * jitter;
    const jitterY = Math.cos(elapsed * 37 + this.phase * 2) * this.tube * 0.42 * jitter;
    const jitterZ = Math.sin(elapsed * 51 + this.phase * 3) * this.tube * 0.75 * jitter;

    this.positionOnTrack(
      this.trackAngle + delta * this.driftSpeed,
      jitterX,
      jitterY,
      jitterZ
    );

    if (!this.panicActive && elapsed >= this.nextBlinkAt) {
      this.blinkStart = elapsed;
      this.blinkDuration = 0.08 + this.rng() * 0.15;
      this.nextBlinkAt = elapsed + 1.1 + this.rng() * 4.8;
    }

    const needsFastEyeFrames =
      this.type === "cutout-eye" ||
      this.type === "led-eye" ||
      this.type === "face";

    const interval = this.panicActive
      ? 0.025
      : needsFastEyeFrames
        ? 0.07
        : 0.11 + this.rng() * 0.05;

    if (elapsed >= this.nextFrameAt) {
      this.frame += 1;
      this.nextFrameAt = elapsed + interval;

      if (this.type === "symbol" && (this.panicActive || this.frame % 10 === 0)) {
        this.symbolIndex =
          (this.symbolIndex + 1 + (this.panicActive ? 2 : 0)) %
          this.symbols.length;
      }

      this.draw(elapsed);
    }
  }

  blinkAmount(elapsed) {
    if (this.panicActive) return 0;

    const age = elapsed - this.blinkStart;
    if (age < 0 || age > this.blinkDuration) return 0;
    const phase = age / this.blinkDuration;
    return Math.sin(phase * Math.PI);
  }

  clear(background = "#050505") {
    this.ctx.fillStyle = background;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawCutoutEye(elapsed) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const blink = this.blinkAmount(elapsed);
    const openness = this.panicActive
      ? 1
      : clamp(1 - blink * 0.94, 0.08, 1);

    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = this.panicActive ? "#ff5bd9" : "#fffdf7";
    ctx.beginPath();
    ctx.ellipse(cx, cy, 13, Math.max(1.4, 13 * openness), 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#3d2508";
    ctx.lineWidth = 2;
    ctx.stroke();

    const irisX = cx + this.pupilX * 4.8;
    const irisY = cy + this.pupilY * 4.2;
    const irisRadius = this.panicActive ? 6.2 : 5.5;

    ctx.fillStyle = this.irisColor;
    ctx.beginPath();
    ctx.arc(irisX, irisY, irisRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#120d0b";
    ctx.beginPath();
    ctx.arc(irisX, irisY, this.panicActive ? 2.1 : 2.7, 0, Math.PI * 2);
    ctx.fill();

    if (openness > 0.2) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(Math.round(irisX - 2), Math.round(irisY - 3), 2, 2);
    }
  }

  drawLedEye(elapsed) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const blink = this.blinkAmount(elapsed);
    const openness = this.panicActive
      ? 1
      : clamp(1 - blink * 0.94, 0.08, 1);

    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "#f6fbff";
    ctx.beginPath();
    ctx.ellipse(cx, cy, 12.5, Math.max(1.3, 12.5 * openness), 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = this.panicActive ? "#ff4fd8" : this.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    const irisX = cx + this.pupilX * 4.6;
    const irisY = cy + this.pupilY * 4.0;

    ctx.fillStyle = this.panicActive ? "#ff4fd8" : this.color;
    ctx.beginPath();
    ctx.arc(irisX, irisY, this.panicActive ? 6 : 5.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#070912";
    ctx.beginPath();
    ctx.arc(irisX, irisY, this.panicActive ? 2 : 2.6, 0, Math.PI * 2);
    ctx.fill();

    if (openness > 0.2) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(Math.round(irisX - 2), Math.round(irisY - 3), 2, 2);
    }
  }

  drawSymbol() {
    const ctx = this.ctx;
    this.clear(this.panicActive ? "#200018" : "#05040a");
    const glyph = this.symbols[this.symbolIndex];
    const pulse = this.panicActive
      ? NEON[this.frame % NEON.length]
      : this.frame % 6 < 3
        ? this.color
        : "#ffffff";
    drawPixelGlyph(ctx, glyph, pulse, 12, 5, 3);
  }

  drawMarquee() {
    const ctx = this.ctx;
    this.clear("#020409");

    const glyphs = this.panicActive
      ? ["eye", "question", "eye", "question"]
      : ["arrow", "heart", "eye", "arrow"];
    const shift = -(this.frame % 14) * 3;

    glyphs.forEach((glyph, index) => {
      drawPixelGlyph(
        ctx,
        glyph,
        NEON[(index + this.symbolIndex + this.frame) % NEON.length],
        0,
        5,
        2,
        shift + index * 20
      );
    });
  }

  drawFace(elapsed) {
    const ctx = this.ctx;
    this.clear("#160616");

    const blink = this.blinkAmount(elapsed);
    const eyeHeight = this.panicActive ? 6 : blink > 0.6 ? 1 : 3;

    ctx.fillStyle = this.panicActive ? "#6df7ff" : this.color;
    ctx.fillRect(8, 4, 32, 20);

    ctx.fillStyle = "#09030a";
    ctx.fillRect(15, 9, 5, eyeHeight);
    ctx.fillRect(29, 9, 5, eyeHeight);

    if (this.panicActive) {
      ctx.fillRect(20, 19, 9, 4);
      return;
    }

    const mood = Math.floor((this.frame / 16 + this.phase) % 4);
    if (mood === 0) {
      ctx.fillRect(17, 18, 15, 2);
      ctx.fillRect(20, 20, 9, 2);
    } else if (mood === 1) {
      ctx.fillRect(17, 20, 15, 2);
      ctx.fillRect(20, 18, 9, 2);
    } else if (mood === 2) {
      ctx.fillRect(18, 18, 14, 2);
    } else {
      ctx.fillRect(21, 17, 7, 5);
    }
  }

  drawGlitch() {
    const ctx = this.ctx;
    this.clear("#040404");

    const local = mulberry32(this.glitchSeed + this.frame * 131);
    const count = this.panicActive ? 42 : 20;

    for (let i = 0; i < count; i += 1) {
      ctx.fillStyle = NEON[Math.floor(local() * NEON.length)];
      const x = Math.floor(local() * 48);
      const y = Math.floor(local() * 28);
      const w = 1 + Math.floor(local() * 8);
      const h = 1 + Math.floor(local() * 4);
      ctx.fillRect(x, y, w, h);
    }

    if (this.frame % 5 !== 0 || this.panicActive) {
      drawPixelGlyph(ctx, "eye", "#ffffff", 12, 5, 3);
    }
  }

  draw(elapsed) {
    if (!this.ctx) return;

    switch (this.type) {
      case "cutout-eye":
        this.drawCutoutEye(elapsed);
        break;
      case "led-eye":
        this.drawLedEye(elapsed);
        break;
      case "symbol":
        this.drawSymbol();
        break;
      case "marquee":
        this.drawMarquee();
        break;
      case "face":
        this.drawFace(elapsed);
        break;
      case "glitch":
        this.drawGlitch();
        break;
      default:
        this.drawLedEye(elapsed);
    }

    this.texture.needsUpdate = true;
  }
}

export function buildWheelPanels({
  wheelId,
  wheelIndex,
  radius,
  tube,
  slotHint,
}) {
  const count = Math.max(4, Math.round(slotHint / 3));
  const panels = [];

  for (let i = 0; i < count; i += 1) {
    const id = `${wheelId}:panel:${i}`;
    const rng = mulberry32(hashString(id));
    const type = PANEL_TYPES[(wheelIndex * 3 + i) % PANEL_TYPES.length];
    const color = NEON[(wheelIndex + i * 2) % NEON.length];
    const angle = (i / count) * Math.PI * 2 + 0.16 + rng() * 0.12;
    const direction = rng() > 0.48 ? 1 : -1;
    const driftSpeed = direction * (0.012 + rng() * 0.032);
    const trackingMode =
      TRACKING_MODES[(wheelIndex + i * 2) % TRACKING_MODES.length];

    panels.push(
      new WheelPanel({
        id,
        radius,
        tube,
        angle,
        type,
        color,
        driftSpeed,
        phase: rng() * Math.PI * 2,
        trackingMode,
      })
    );
  }

  return panels;
}
