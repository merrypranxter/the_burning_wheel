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
  }) {
    this.id = id;
    this.radius = radius;
    this.tube = tube;
    this.baseAngle = angle;
    this.trackAngle = angle;
    this.type = type;
    this.color = color;
    this.driftSpeed = driftSpeed;
    this.phase = phase;

    this.rng = mulberry32(hashString(id));
    this.canvas = document.createElement("canvas");
    this.canvas.width = 48;
    this.canvas.height = 28;
    this.ctx = this.canvas.getContext("2d", { alpha: false });
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

    const bezel = new THREE.Mesh(
      new THREE.PlaneGeometry(width * 1.18, height * 1.25),
      new THREE.MeshBasicMaterial({
        color: "#4a2b00",
        side: THREE.DoubleSide,
      })
    );
    bezel.position.z = -0.006;
    this.group.add(bezel);

    this.screen = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({
        map: this.texture,
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
    this.nextLookAt = 0.4 + this.rng() * 2.0;
    this.symbols = ["heart", "eye", "crown", "arrow", "star", "question", "smile"];
    this.symbolIndex = Math.floor(this.rng() * this.symbols.length);
    this.irisColor = IRIS[Math.floor(this.rng() * IRIS.length)];
    this.paperTone = this.rng() > 0.5 ? "#f7efe3" : "#ece7d8";
    this.glitchSeed = Math.floor(this.rng() * 10000);

    this.positionOnTrack(this.baseAngle);
    this.draw(0);
  }

  positionOnTrack(angle) {
    this.trackAngle = angle;
    this.group.position.set(
      Math.cos(angle) * this.radius,
      Math.sin(angle) * this.radius,
      this.tube * 1.48
    );
    this.group.rotation.z = angle + Math.PI / 2;
  }

  update(delta, elapsed) {
    this.positionOnTrack(this.trackAngle + delta * this.driftSpeed);

    if (elapsed >= this.nextLookAt) {
      this.targetPupilX = (this.rng() - 0.5) * 1.05;
      this.targetPupilY = (this.rng() - 0.5) * 0.55;
      this.nextLookAt = elapsed + 0.55 + this.rng() * 2.6;
    }

    this.pupilX += (this.targetPupilX - this.pupilX) * 0.08;
    this.pupilY += (this.targetPupilY - this.pupilY) * 0.08;

    if (elapsed >= this.nextBlinkAt) {
      this.blinkStart = elapsed;
      this.blinkDuration = 0.08 + this.rng() * 0.15;
      this.nextBlinkAt = elapsed + 1.1 + this.rng() * 4.8;
    }

    const needsFastEyeFrames =
      this.type === "cutout-eye" || this.type === "led-eye" || this.type === "face";

    const interval = needsFastEyeFrames ? 0.07 : 0.11 + this.rng() * 0.05;

    if (elapsed >= this.nextFrameAt) {
      this.frame += 1;
      this.nextFrameAt = elapsed + interval;

      if (this.type === "symbol" && this.frame % 10 === 0) {
        this.symbolIndex = (this.symbolIndex + 1) % this.symbols.length;
      }

      this.draw(elapsed);
    }
  }

  blinkAmount(elapsed) {
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
    const blink = this.blinkAmount(elapsed);
    const lid = 1 - blink * 0.93;

    this.clear("#1d1209");

    // Deliberately imperfect magazine-cutout paper rectangle.
    ctx.fillStyle = this.paperTone;
    ctx.beginPath();
    ctx.moveTo(4, 5);
    ctx.lineTo(43, 3);
    ctx.lineTo(46, 21);
    ctx.lineTo(39, 25);
    ctx.lineTo(7, 24);
    ctx.lineTo(2, 19);
    ctx.closePath();
    ctx.fill();

    const eyeY = 14;
    const eyeHalfHeight = Math.max(1.5, 7 * lid);

    ctx.fillStyle = "#fffdf7";
    ctx.beginPath();
    ctx.ellipse(24, eyeY, 16, eyeHalfHeight, 0, 0, Math.PI * 2);
    ctx.fill();

    const irisX = 24 + this.pupilX * 5.2;
    const irisY = eyeY + this.pupilY * 3.0;

    ctx.fillStyle = this.irisColor;
    ctx.beginPath();
    ctx.arc(irisX, irisY, Math.max(2.2, 5.4 * lid), 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#15100d";
    ctx.beginPath();
    ctx.arc(irisX, irisY, Math.max(1.4, 2.9 * lid), 0, Math.PI * 2);
    ctx.fill();

    if (lid > 0.22) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(Math.round(irisX - 1), Math.round(irisY - 2), 2, 2);
    }

    ctx.strokeStyle = "#1b120f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(7, eyeY);
    ctx.quadraticCurveTo(24, eyeY - 10 * lid, 41, eyeY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(7, eyeY);
    ctx.quadraticCurveTo(24, eyeY + 10 * lid, 41, eyeY);
    ctx.stroke();

    ctx.fillStyle = "#d46c78";
    ctx.fillRect(7, eyeY, 2, 2);
  }

  drawLedEye(elapsed) {
    const ctx = this.ctx;
    const blink = this.blinkAmount(elapsed);
    const openness = 1 - blink * 0.95;

    this.clear("#020509");

    ctx.fillStyle = "#151c23";
    for (let x = 2; x < 48; x += 4) {
      for (let y = 2; y < 28; y += 4) {
        ctx.fillRect(x, y, 1, 1);
      }
    }

    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(5, 14);
    ctx.quadraticCurveTo(24, 4 + 9 * (1 - openness), 43, 14);
    ctx.quadraticCurveTo(24, 24 - 9 * (1 - openness), 5, 14);
    ctx.stroke();

    if (openness > 0.18) {
      const x = 24 + this.pupilX * 5.5;
      const y = 14 + this.pupilY * 2.5;
      ctx.fillStyle = this.color;
      ctx.fillRect(Math.round(x - 3), Math.round(y - 3), 6, 6);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(Math.round(x - 1), Math.round(y - 1), 2, 2);
    }
  }

  drawSymbol() {
    const ctx = this.ctx;
    this.clear("#05040a");
    const glyph = this.symbols[this.symbolIndex];
    const pulse = this.frame % 6 < 3 ? this.color : "#ffffff";
    drawPixelGlyph(ctx, glyph, pulse, 12, 5, 3);
  }

  drawMarquee() {
    const ctx = this.ctx;
    this.clear("#020409");

    const glyphs = ["arrow", "heart", "eye", "arrow"];
    const shift = -(this.frame % 14) * 3;

    glyphs.forEach((glyph, index) => {
      drawPixelGlyph(
        ctx,
        glyph,
        NEON[(index + this.symbolIndex) % NEON.length],
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
    const eyeHeight = blink > 0.6 ? 1 : 3;

    ctx.fillStyle = this.color;
    ctx.fillRect(8, 4, 32, 20);

    ctx.fillStyle = "#09030a";
    ctx.fillRect(15, 10, 5, eyeHeight);
    ctx.fillRect(29, 10, 5, eyeHeight);

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
    for (let i = 0; i < 20; i += 1) {
      ctx.fillStyle = NEON[Math.floor(local() * NEON.length)];
      const x = Math.floor(local() * 48);
      const y = Math.floor(local() * 28);
      const w = 1 + Math.floor(local() * 8);
      const h = 1 + Math.floor(local() * 4);
      ctx.fillRect(x, y, w, h);
    }

    if (this.frame % 5 !== 0) {
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

export function buildWheelPanels({ wheelId, wheelIndex, radius, tube, slotHint }) {
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
      })
    );
  }

  return panels;
}
