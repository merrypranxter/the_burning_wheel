import * as THREE from "three";

const EXPRESSIONS = {
  neutral: {
    openness: 0.9,
    lidTilt: 0,
    browTilt: 0,
    irisScale: 1,
    pupilScale: 1,
    gazeX: 0,
    gazeY: 0,
  },
  deadpan: {
    openness: 0.44,
    lidTilt: 0,
    browTilt: 0,
    irisScale: 0.98,
    pupilScale: 0.96,
    gazeX: 0,
    gazeY: 0.03,
  },
  smug: {
    openness: 0.52,
    lidTilt: -0.18,
    browTilt: -0.25,
    irisScale: 0.98,
    pupilScale: 0.98,
    gazeX: 0.13,
    gazeY: 0.02,
  },
  suspicious: {
    openness: 0.36,
    lidTilt: 0.16,
    browTilt: 0.28,
    irisScale: 0.97,
    pupilScale: 0.92,
    gazeX: -0.14,
    gazeY: 0.01,
  },
  offended: {
    openness: 0.58,
    lidTilt: 0.28,
    browTilt: 0.38,
    irisScale: 0.94,
    pupilScale: 0.9,
    gazeX: -0.05,
    gazeY: 0.04,
  },
  delighted: {
    openness: 0.82,
    lidTilt: -0.05,
    browTilt: -0.1,
    irisScale: 1.08,
    pupilScale: 1.12,
    gazeX: 0.02,
    gazeY: -0.01,
  },
  wide: {
    openness: 1,
    lidTilt: 0,
    browTilt: 0.1,
    irisScale: 1.08,
    pupilScale: 0.86,
    gazeX: 0,
    gazeY: 0,
  },
  sideEye: {
    openness: 0.56,
    lidTilt: -0.08,
    browTilt: -0.18,
    irisScale: 0.97,
    pupilScale: 0.94,
    gazeX: 0.26,
    gazeY: 0.02,
  },
  eyeRoll: {
    openness: 0.72,
    lidTilt: 0,
    browTilt: 0.05,
    irisScale: 0.98,
    pupilScale: 0.92,
    gazeX: 0.04,
    gazeY: -0.25,
  },
  wtf: {
    openness: 0.86,
    lidTilt: 0.32,
    browTilt: 0.42,
    irisScale: 0.95,
    pupilScale: 0.8,
    gazeX: -0.08,
    gazeY: -0.02,
  },
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function eyePath(ctx, cx, cy, halfWidth, halfHeight, tilt) {
  const tiltPixels = tilt * 10;
  ctx.beginPath();
  ctx.moveTo(cx - halfWidth, cy + tiltPixels);
  ctx.quadraticCurveTo(
    cx,
    cy - halfHeight - tiltPixels,
    cx + halfWidth,
    cy - tiltPixels
  );
  ctx.quadraticCurveTo(
    cx,
    cy + halfHeight + tiltPixels,
    cx - halfWidth,
    cy + tiltPixels
  );
  ctx.closePath();
}

export class CoreEye {
  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 96;
    this.canvas.height = 72;

    this.ctx = this.canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.colorSpace = THREE.SRGBColorSpace;

    this.group = new THREE.Group();
    this.group.name = "core-eye";

    this.screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.88, 0.66),
      new THREE.MeshBasicMaterial({
        map: this.texture,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    this.screen.position.z = 0.685;
    this.group.add(this.screen);

    this.priorityReasons = new Set();
    this.normalRenderOrder = this.screen.renderOrder;
    this.normalDepthTest = this.screen.material.depthTest;
    this.normalDepthWrite = this.screen.material.depthWrite;

    this.current = { ...EXPRESSIONS.neutral };
    this.target = { ...EXPRESSIONS.neutral };
    this.currentExpression = "neutral";
    this.expressionUntil = 0;

    this.lookX = 0;
    this.lookY = 0;
    this.targetLookX = 0;
    this.targetLookY = 0;

    this.blinkStart = -100;
    this.blinkDuration = 0.12;
    this.nextBlinkAt = 1.2;

    this.saccadeX = 0;
    this.saccadeY = 0;
    this.nextSaccadeAt = 0.8;

    this.randomState = 0x0f4a9b31;
    this.voiceEnergy = 0;

    this.draw(0, 0);
  }

  random() {
    this.randomState = (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0;
    return this.randomState / 4294967296;
  }

  get expressionNames() {
    return Object.keys(EXPRESSIONS);
  }

  setForegroundPriority(enabled, reason = "manual") {
    if (enabled) {
      this.priorityReasons.add(reason);
    } else {
      this.priorityReasons.delete(reason);
    }

    const active = this.priorityReasons.size > 0;

    if (active) {
      this.screen.renderOrder = 10000;
      this.screen.material.depthTest = false;
      this.screen.material.depthWrite = false;
    } else {
      this.screen.renderOrder = this.normalRenderOrder;
      this.screen.material.depthTest = this.normalDepthTest;
      this.screen.material.depthWrite = this.normalDepthWrite;
    }

    this.screen.material.needsUpdate = true;
  }

  setVoiceEnergy(energy = 0) {
    this.voiceEnergy = clamp(Number(energy) || 0, 0, 1);
  }

  setExpression(name = "neutral", holdSeconds = 1.8, elapsed = 0) {
    const expression = EXPRESSIONS[name] || EXPRESSIONS.neutral;
    this.currentExpression = EXPRESSIONS[name] ? name : "neutral";
    this.target = { ...expression };
    this.expressionUntil =
      holdSeconds > 0 && this.currentExpression !== "neutral"
        ? elapsed + holdSeconds
        : 0;
  }

  blinkNow(elapsed = 0, duration = 0.13) {
    this.blinkStart = elapsed;
    this.blinkDuration = duration;
    this.nextBlinkAt = elapsed + 1.4 + this.random() * 2.8;
  }

  blinkAmount(elapsed) {
    const age = elapsed - this.blinkStart;
    if (age < 0 || age > this.blinkDuration) return 0;
    return Math.sin((age / this.blinkDuration) * Math.PI);
  }

  update(delta, elapsed, pointer = { x: 0, y: 0 }) {
    if (this.expressionUntil > 0 && elapsed >= this.expressionUntil) {
      this.setExpression("neutral", 0, elapsed);
    }

    if (elapsed >= this.nextBlinkAt) {
      this.blinkNow(elapsed, 0.08 + this.random() * 0.1);
    }

    if (elapsed >= this.nextSaccadeAt) {
      this.saccadeX = (this.random() - 0.5) * 0.08;
      this.saccadeY = (this.random() - 0.5) * 0.05;
      this.nextSaccadeAt = elapsed + 0.55 + this.random() * 2.5;
    }

    for (const key of Object.keys(this.current)) {
      this.current[key] = lerp(this.current[key], this.target[key], 0.13);
    }

    const pointerX = clamp(pointer.x, -1, 1) * 0.12;
    const pointerY = clamp(pointer.y, -1, 1) * -0.09;

    this.targetLookX = clamp(
      pointerX + this.current.gazeX + this.saccadeX,
      -0.3,
      0.3
    );
    this.targetLookY = clamp(
      pointerY + this.current.gazeY + this.saccadeY,
      -0.27,
      0.27
    );

    this.lookX = lerp(this.lookX, this.targetLookX, 0.14);
    this.lookY = lerp(this.lookY, this.targetLookY, 0.14);

    const blink = this.blinkAmount(elapsed);
    this.draw(elapsed, blink);

    this.voiceEnergy *= 0.9;

    this.group.rotation.z =
      Math.sin(elapsed * 0.63) * 0.012 +
      this.current.lidTilt * 0.025 +
      Math.sin(elapsed * 9.5) * this.voiceEnergy * 0.006;

    this.group.scale.setScalar(
      1 +
      Math.sin(elapsed * 1.4) * 0.006 +
      this.voiceEnergy * 0.018
    );

    void delta;
  }

  draw(elapsed, blink) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2 + 2;

    ctx.clearRect(0, 0, w, h);

    const openness = clamp(
      this.current.openness * (1 - blink * 0.96),
      0.04,
      1
    );
    const halfWidth = 37;
    const halfHeight = 22 * openness;
    const lidTilt = this.current.lidTilt;

    // Tiny ugly-gold socket shadow so it feels embedded, not pasted on.
    ctx.fillStyle = "rgba(53, 29, 0, 0.82)";
    ctx.beginPath();
    ctx.ellipse(cx, cy, 42, 28, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    eyePath(ctx, cx, cy, halfWidth, halfHeight, lidTilt);
    ctx.clip();

    const scleraGradient = ctx.createRadialGradient(
      cx - 8,
      cy - 7,
      3,
      cx,
      cy,
      45
    );
    scleraGradient.addColorStop(0, "#fffef8");
    scleraGradient.addColorStop(0.55, "#fff8ea");
    scleraGradient.addColorStop(0.82, "#eadfd4");
    scleraGradient.addColorStop(1, "#c9b8ad");
    ctx.fillStyle = scleraGradient;
    ctx.fillRect(0, 0, w, h);

    // Crude little blood vessels: enough organic wrongness without becoming gore.
    ctx.strokeStyle = "rgba(207, 69, 82, 0.48)";
    ctx.lineWidth = 1;
    const vesselWave = Math.sin(elapsed * 0.7) * 1.5;
    for (let i = 0; i < 5; i += 1) {
      const y = cy - 14 + i * 7;
      ctx.beginPath();
      ctx.moveTo(10, y);
      ctx.lineTo(24 + i * 2, y + vesselWave + (i % 2 ? 3 : -2));
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(86, y + 1);
      ctx.lineTo(72 - i * 2, y - vesselWave + (i % 2 ? -2 : 3));
      ctx.stroke();
    }

    const irisX = cx + this.lookX * 42;
    const irisY = cy + this.lookY * 28;
    const irisRadius =
      15 *
      this.current.irisScale *
      (1 + this.voiceEnergy * 0.035);

    ctx.fillStyle = "rgba(17, 8, 38, 0.78)";
    ctx.beginPath();
    ctx.arc(irisX, irisY, irisRadius + 1.8, 0, Math.PI * 2);
    ctx.fill();

    const irisGradient = ctx.createRadialGradient(
      irisX - 3,
      irisY - 4,
      2,
      irisX,
      irisY,
      irisRadius
    );
    irisGradient.addColorStop(0, "#bffbff");
    irisGradient.addColorStop(0.24, "#59e7ff");
    irisGradient.addColorStop(0.55, "#3977ff");
    irisGradient.addColorStop(0.8, "#743ee8");
    irisGradient.addColorStop(1, "#180b3c");

    ctx.fillStyle = irisGradient;
    ctx.beginPath();
    ctx.arc(irisX, irisY, irisRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.34)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 28; i += 1) {
      const angle =
        (i / 28) * Math.PI * 2 +
        Math.sin(elapsed * 0.2 + i * 0.17) * 0.045;
      ctx.beginPath();
      ctx.moveTo(
        irisX + Math.cos(angle) * 5,
        irisY + Math.sin(angle) * 5
      );
      ctx.lineTo(
        irisX + Math.cos(angle) * (irisRadius - 1),
        irisY + Math.sin(angle) * (irisRadius - 1)
      );
      ctx.stroke();
    }

    ctx.fillStyle = "#08040e";
    ctx.beginPath();
    ctx.arc(
      irisX,
      irisY,
      6.8 * this.current.pupilScale,
      0,
      Math.PI * 2
    );
    ctx.fill();

    const cornea = ctx.createRadialGradient(
      irisX - 5,
      irisY - 7,
      1,
      irisX - 3,
      irisY - 5,
      10
    );
    cornea.addColorStop(0, "rgba(255,255,255,0.98)");
    cornea.addColorStop(0.24, "rgba(255,255,255,0.58)");
    cornea.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = cornea;
    ctx.beginPath();
    ctx.arc(irisX - 3, irisY - 5, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(Math.round(irisX - 5), Math.round(irisY - 6), 3, 3);
    ctx.fillRect(Math.round(irisX + 4), Math.round(irisY + 2), 2, 2);

    ctx.restore();

    // Wet lower-lid line gives the center eye a more physical, glassy read.
    ctx.strokeStyle = "rgba(255, 224, 218, 0.72)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - halfWidth + 5, cy + halfHeight * 0.42);
    ctx.quadraticCurveTo(
      cx,
      cy + halfHeight + 2,
      cx + halfWidth - 5,
      cy + halfHeight * 0.42
    );
    ctx.stroke();

    // Heavy cutout-like outline.
    ctx.strokeStyle = "#160b02";
    ctx.lineWidth = 4;
    eyePath(ctx, cx, cy, halfWidth, halfHeight, lidTilt);
    ctx.stroke();

    // Angular golden "brows" = most of the attitude.
    const brow = this.current.browTilt;
    ctx.strokeStyle = "#ffc400";
    ctx.lineWidth = 5;
    ctx.lineCap = "square";

    ctx.beginPath();
    ctx.moveTo(16, 17 + brow * 10);
    ctx.lineTo(40, 13 - brow * 8);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(56, 13 - brow * 8);
    ctx.lineTo(80, 17 + brow * 10);
    ctx.stroke();

    this.texture.needsUpdate = true;
  }
}
