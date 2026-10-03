import * as THREE from "three";

const STATES = {
  leanIn: { duration: 0.9, breach: 0.04 },
  recoil: { duration: 0.72, breach: 0.08 },
  judgment: { duration: 1.35, breach: 0.48 },
  flare: { duration: 1.5, breach: 0.72 },
  attractorDrift: { duration: 2.7, breach: 0.18 },
  orientationSlip: { duration: 0.72, breach: 0.62, smear: true },
  mobiusFlip: { duration: 1.08, breach: 0.52, smear: true },
  projectionError: { duration: 1.0, breach: 0.78, smear: true, depthError: true },
  dimensionStutter: { duration: 0.86, breach: 1.0, smear: true, depthError: true },
};

const INFECTED_LABELS = [
  "CONTAINMENT // NOMINAL",
  "CONTAINER ≠ CONTENT",
  "ORIENTATION UNDEFINED",
  "DEPTH BUFFER IS LYING",
  "LOCAL REALITY DESYNC",
  "PLEASE IGNORE THE VOID",
  "THE TERRARIUM OBJECTS",
];

const INFECTED_BUTTONS = [
  "SUBMIT",
  "WEEP",
  "ABSOLUTELY NOT",
  "TOO LATE",
  "BE NOT AFRAID",
  "PAUSE? LOL",
];

const GLYPHS = "▓▒░█▚▞⌁⌬⟁⟟⧖⧗⫷⫸⋰⋱≠∅∞⊘⊙";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function pulse01(t) {
  return Math.sin(clamp(t, 0, 1) * Math.PI);
}

function scrambleText(source, amount, seed) {
  if (amount <= 0) return source;
  let out = "";
  let s = (seed * 2654435761) >>> 0;

  for (const char of source) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const roll = s / 4294967296;
    if (char !== " " && roll < amount) {
      out += GLYPHS[s % GLYPHS.length];
    } else {
      out += char;
    }
  }

  return out;
}

export class ContainmentEngine {
  constructor({
    angel,
    scene,
    renderer,
    stage,
    clouds = [],
    statusLine,
    motionButton,
    resetButton,
  }) {
    this.angel = angel;
    this.scene = scene;
    this.renderer = renderer;
    this.stage = stage;
    this.clouds = clouds;
    this.statusLine = statusLine;
    this.motionButton = motionButton;
    this.resetButton = resetButton;

    this.baseSky = new THREE.Color("#5bb9f4");
    this.hotSky = new THREE.Color("#ff2fb7");
    this.toxicSky = new THREE.Color("#71ff37");
    this.cyanSky = new THREE.Color("#00e5ff");

    this.originalStatus = statusLine?.textContent || "";
    this.originalMotionText = motionButton?.textContent?.trim() || "PAUSE MOTION";
    this.cloudBases = clouds.map((cloud) => ({
      cloud,
      position: cloud.position.clone(),
      scale: cloud.scale.clone(),
      rotation: cloud.rotation.clone(),
    }));

    this.active = null;
    this.breachLevel = 0;
    this.targetBreach = 0;
    this.autoChaos = true;
    this.nextAutoAt = 9;
    this.seed = 0x51f15e;

    this.lorenz = { x: 0.11, y: 0.0, z: 0.0 };
    this.snapCounter = 0;

    this.depthSnapshot = new Map();

    this.overlay = document.createElement("canvas");
    this.overlay.className = "breach-overlay";
    this.overlay.setAttribute("aria-hidden", "true");
    this.overlayCtx = this.overlay.getContext("2d");
    this.overlayCtx.imageSmoothingEnabled = false;
    stage.appendChild(this.overlay);

    this.history = Array.from({ length: 6 }, () => document.createElement("canvas"));
    this.historyIndex = 0;

    this.resizeOverlay();
  }

  random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  resizeOverlay() {
    const source = this.renderer.domElement;
    if (!source.width || !source.height) return;

    if (this.overlay.width !== source.width || this.overlay.height !== source.height) {
      this.overlay.width = source.width;
      this.overlay.height = source.height;
      this.overlayCtx.imageSmoothingEnabled = false;

      for (const canvas of this.history) {
        canvas.width = source.width;
        canvas.height = source.height;
        canvas.getContext("2d").imageSmoothingEnabled = false;
      }
    }
  }

  setAutoChaos(enabled) {
    this.autoChaos = Boolean(enabled);
    this.nextAutoAt = 8 + this.random() * 10;
  }

  trigger(name, { intensity = 1, elapsed = 0 } = {}) {
    const definition = STATES[name];
    if (!definition) return false;

    this.cleanupTransient();

    this.active = {
      name,
      startedAt: elapsed,
      duration: definition.duration,
      intensity: clamp(intensity, 0.1, 1.35),
      definition,
      snapped: false,
      frozenRotors: null,
      frozenCarriers: null,
    };

    this.targetBreach = definition.breach * this.active.intensity;
    this.stage.dataset.containment = name;

    if (definition.depthError) {
      this.setDepthSabotage(true);
    }

    if (name === "dimensionStutter") {
      this.angel.setExpression("wide", definition.duration, elapsed);
      this.angel.panicPanels?.(elapsed, definition.duration, this.active.intensity);
    } else if (name === "projectionError") {
      this.angel.setExpression("wtf", definition.duration, elapsed);
    } else if (name === "judgment") {
      this.angel.setExpression("deadpan", definition.duration + 0.25, elapsed);
    } else if (name === "flare") {
      this.angel.setExpression("wide", definition.duration, elapsed);
    }

    return true;
  }

  reset() {
    this.cleanupTransient();
    this.active = null;
    this.breachLevel = 0;
    this.targetBreach = 0;
    this.stage.dataset.containment = "stable";
    this.scene.background.copy(this.baseSky);
    this.angel.resetGeometry?.();
    this.restoreDom();
    this.restoreClouds();
    this.clearOverlay();
  }

  cleanupTransient() {
    this.setDepthSabotage(false);
    this.angel.setEyeForegroundPriority?.(false, "containment-freeze");

    for (const wheel of this.angel.wheels) {
      wheel.carrier.scale.set(1, 1, 1);
      wheel.rotor.scale.set(1, 1, 1);
      wheel.carrier.position.set(0, 0, 0);
      wheel.rotor.position.set(0, 0, 0);
    }

    this.angel.body.position.x = 0;
    this.angel.body.position.z = 0;
    this.restoreDom();
  }

  setDepthSabotage(enabled) {
    if (enabled) {
      this.angel.wheels.forEach((wheel, wheelIndex) => {
        if (wheelIndex % 3 !== 1) return;

        wheel.rotor.traverse((object) => {
          if (!object.isMesh || !object.material) return;

          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];

          if (!this.depthSnapshot.has(object)) {
            this.depthSnapshot.set(object, {
              renderOrder: object.renderOrder,
              materials: materials.map((material) => ({
                material,
                depthTest: material.depthTest,
                depthWrite: material.depthWrite,
              })),
            });
          }

          object.renderOrder = 999 - wheelIndex;
          for (const material of materials) {
            material.depthTest = false;
            material.depthWrite = false;
          }
        });
      });
      return;
    }

    for (const [object, snapshot] of this.depthSnapshot) {
      object.renderOrder = snapshot.renderOrder;
      for (const saved of snapshot.materials) {
        saved.material.depthTest = saved.depthTest;
        saved.material.depthWrite = saved.depthWrite;
      }
    }

    this.depthSnapshot.clear();
  }

  restoreDom() {
    if (this.statusLine) this.statusLine.textContent = this.originalStatus;
    if (this.motionButton) {
      this.motionButton.textContent = this.originalMotionText;
      this.motionButton.style.transform = "";
      this.motionButton.style.filter = "";
    }
    document.documentElement.style.setProperty("--breach", "0");
  }

  restoreClouds() {
    for (const saved of this.cloudBases) {
      saved.cloud.position.copy(saved.position);
      saved.cloud.scale.copy(saved.scale);
      saved.cloud.rotation.copy(saved.rotation);
    }
  }

  updateLorenz(delta) {
    const sigma = 10;
    const rho = 28;
    const beta = 8 / 3;
    const step = Math.min(delta, 0.025) * 0.72;

    const { x, y, z } = this.lorenz;
    this.lorenz.x += sigma * (y - x) * step;
    this.lorenz.y += (x * (rho - z) - y) * step;
    this.lorenz.z += (x * y - beta * z) * step;

    if (
      !Number.isFinite(this.lorenz.x) ||
      Math.abs(this.lorenz.x) > 1000
    ) {
      this.lorenz = { x: 0.11, y: 0, z: 0 };
    }
  }

  update(delta, elapsed, pointer) {
    this.resizeOverlay();
    this.updateLorenz(delta);

    if (this.autoChaos && !this.active && elapsed >= this.nextAutoAt) {
      const microStates = ["attractorDrift", "orientationSlip", "leanIn"];
      const name = microStates[Math.floor(this.random() * microStates.length)];
      this.trigger(name, { intensity: 0.35 + this.random() * 0.25, elapsed });
      this.nextAutoAt = elapsed + 9 + this.random() * 13;
    }

    if (!this.active) {
      this.targetBreach = 0;
      this.breachLevel += (0 - this.breachLevel) * 0.08;
      this.updateEnvironment(elapsed, pointer, 0);
      return;
    }

    const state = this.active;
    const age = elapsed - state.startedAt;
    const progress = clamp(age / state.duration, 0, 1);
    const pulse = pulse01(progress);
    const intensity = state.intensity;

    this.targetBreach = state.definition.breach * intensity * (0.3 + 0.7 * pulse);
    this.breachLevel += (this.targetBreach - this.breachLevel) * 0.22;

    this.applyState(state, progress, elapsed, pointer);
    this.updateEnvironment(elapsed, pointer, this.breachLevel);

    if (progress >= 1) {
      this.cleanupTransient();
      this.active = null;
      this.targetBreach = 0;
      this.stage.dataset.containment = "stable";
      this.nextAutoAt = Math.max(this.nextAutoAt, elapsed + 4);
    }
  }

  applyState(state, progress, elapsed, pointer) {
    const { name, intensity } = state;
    const pulse = pulse01(progress);
    const eased = easeOutCubic(progress);

    // Angel.update() establishes the normal pose first. Everything here is
    // a temporary insult added on top of that pose.
    for (const wheel of this.angel.wheels) {
      wheel.carrier.scale.set(1, 1, 1);
      wheel.rotor.scale.set(1, 1, 1);
      wheel.carrier.position.set(0, 0, 0);
    }

    if (name === "leanIn") {
      this.angel.body.position.z = 0.35 * pulse * intensity;
      this.angel.body.rotation.x -= 0.12 * pulse * intensity;
      this.angel.wheels[0].carrier.rotation.x += 0.16 * pulse;
      this.angel.wheels[3].carrier.rotation.z -= 0.12 * pulse;
    }

    if (name === "recoil") {
      this.angel.body.position.z = -0.42 * pulse * intensity;
      this.angel.body.position.x = -0.16 * pulse * intensity;
      this.angel.body.rotation.z += 0.12 * pulse * intensity;
    }

    if (name === "judgment") {
      this.angel.body.position.z = 0.22 * pulse * intensity;
      this.angel.body.rotation.z -= 0.045 * pulse;

      this.angel.wheels.forEach((wheel, index) => {
        const sign = index % 2 ? -1 : 1;
        wheel.carrier.rotation.z += sign * 0.13 * pulse * intensity;
        wheel.rotor.rotation.z *= 1 - 0.015 * pulse * (index + 1);
      });
    }

    if (name === "flare") {
      this.angel.wheels.forEach((wheel, index) => {
        const amount = 1 + pulse * intensity * (0.08 + index * 0.006);
        wheel.carrier.scale.setScalar(amount);
        wheel.carrier.rotation.y +=
          Math.sin(index * 2.17 + elapsed * 5) * 0.12 * pulse;
      });
    }

    if (name === "attractorDrift") {
      const lx = clamp(this.lorenz.x / 22, -1, 1);
      const ly = clamp(this.lorenz.y / 28, -1, 1);
      const lz = clamp((this.lorenz.z - 24) / 28, -1, 1);

      this.angel.body.position.x = lx * 0.28 * intensity;
      this.angel.body.position.z = lz * 0.2 * intensity;
      this.angel.body.rotation.x += ly * 0.12 * intensity;
      this.angel.body.rotation.y += lx * 0.16 * intensity;

      this.angel.wheels.forEach((wheel, index) => {
        wheel.carrier.rotation.z +=
          Math.sin(this.lorenz.z * 0.08 + index) * 0.08 * intensity;
      });
    }

    if (name === "orientationSlip") {
      const smearPhase = progress < 0.62;
      if (smearPhase) {
        const violence = Math.sin(progress * 34) * (1 - progress / 0.62);
        this.angel.body.position.x += violence * 0.16 * intensity;
        this.angel.body.rotation.y += violence * 0.2 * intensity;

        this.angel.wheels.forEach((wheel, index) => {
          wheel.carrier.rotation.x +=
            Math.sin(progress * 57 + index * 1.9) * 0.22 * intensity;
          wheel.carrier.rotation.y +=
            Math.cos(progress * 43 + index * 2.4) * 0.18 * intensity;
        });
      } else if (!state.snapped) {
        state.snapped = true;
        this.snapOrientation();
        state.frozenRotors = this.angel.wheels.map((wheel) => wheel.rotor.rotation.z);
        state.frozenCarriers = this.angel.wheels.map((wheel) => wheel.carrier.rotation.clone());
        this.angel.setEyeForegroundPriority?.(true, "containment-freeze");
      }

      if (state.snapped && state.frozenRotors && progress < 0.93) {
        this.angel.wheels.forEach((wheel, index) => {
          wheel.rotor.rotation.z = state.frozenRotors[index];
          wheel.carrier.rotation.copy(state.frozenCarriers[index]);
        });
      } else if (state.snapped) {
        this.angel.setEyeForegroundPriority?.(false, "containment-freeze");
      }
    }

    if (name === "mobiusFlip") {
      this.angel.wheels.forEach((wheel, index) => {
        if (index % 2 !== 0) return;
        const flip = Math.cos(progress * Math.PI * 2);
        wheel.rotor.scale.x = Math.sign(flip || 1) * Math.max(0.08, Math.abs(flip));
        wheel.rotor.rotation.y += progress * Math.PI * (index % 4 ? -1 : 1);
      });
    }

    if (name === "projectionError") {
      this.angel.wheels.forEach((wheel, index) => {
        if (index % 3 !== 1) return;
        wheel.carrier.position.z = 0.65 * pulse * intensity;
        wheel.carrier.rotation.z += Math.sin(elapsed * 22 + index) * 0.08;
      });
    }

    if (name === "dimensionStutter") {
      const step = Math.floor(progress * 13);
      const stutter = step % 2 === 0 ? 1 : -1;

      this.angel.body.position.x += stutter * 0.12 * intensity;
      this.angel.body.position.y +=
        Math.sin(step * 8.17) * 0.09 * intensity;
      this.angel.body.rotation.z += stutter * 0.11 * intensity;

      this.angel.wheels.forEach((wheel, index) => {
        const sign = (index + step) % 2 ? -1 : 1;
        wheel.carrier.position.z = sign * 0.35 * intensity;
        wheel.carrier.rotation.x += sign * 0.17 * intensity;
        wheel.rotor.rotation.z += sign * 0.09;
      });
    }
  }

  snapOrientation() {
    this.snapCounter += 1;

    this.angel.wheels.forEach((wheel, index) => {
      const direction = (index + this.snapCounter) % 2 ? 1 : -1;
      const magnitude = 0.18 + this.random() * 0.34;

      wheel.baseRotation.x += direction * magnitude;
      wheel.baseRotation.y +=
        (this.random() - 0.5) * magnitude * 1.8;
      wheel.baseRotation.z +=
        (this.random() - 0.5) * magnitude * 2.0;
    });
  }

  updateEnvironment(elapsed, pointer, breach) {
    const hotMix = clamp(breach, 0, 1);

    const target = this.baseSky.clone();
    if (hotMix > 0.02) {
      const phase = Math.sin(elapsed * 8) * 0.5 + 0.5;
      const colorA = phase > 0.5 ? this.hotSky : this.cyanSky;
      const colorB = phase > 0.72 ? this.toxicSky : colorA;
      target.lerp(colorB, hotMix * 0.82);
    }

    this.scene.background.lerp(target, 0.18);
    document.documentElement.style.setProperty("--breach", String(hotMix));

    this.cloudBases.forEach((saved, index) => {
      const cloud = saved.cloud;
      const jitter = hotMix * (0.04 + index * 0.012);
      cloud.position.x =
        saved.position.x + Math.sin(elapsed * 17 + index * 2.4) * jitter;
      cloud.position.y =
        saved.position.y + Math.cos(elapsed * 23 + index * 1.8) * jitter;
      cloud.rotation.z =
        saved.rotation.z + Math.sin(elapsed * 11 + index) * jitter * 0.6;

      const collapse = 1 - hotMix * 0.18 * (0.5 + 0.5 * Math.sin(elapsed * 13 + index));
      cloud.scale.set(
        saved.scale.x * collapse,
        saved.scale.y * (1 + hotMix * 0.12),
        saved.scale.z
      );
    });

    this.updateDomInfection(elapsed, pointer, hotMix);
  }

  updateDomInfection(elapsed, pointer, breach) {
    if (!this.active || breach < 0.22) {
      if (!this.active) this.restoreDom();
      return;
    }

    const severe =
      this.active.name === "dimensionStutter" ||
      this.active.name === "projectionError" ||
      this.active.name === "orientationSlip";

    const frameSeed = Math.floor(elapsed * (severe ? 28 : 8));

    if (this.statusLine) {
      const source =
        INFECTED_LABELS[
          (frameSeed + this.active.name.length) % INFECTED_LABELS.length
        ];
      this.statusLine.textContent = scrambleText(
        source,
        clamp(breach * (severe ? 0.65 : 0.25), 0, 0.82),
        frameSeed
      );
    }

    if (this.motionButton) {
      const buttonText =
        INFECTED_BUTTONS[
          (frameSeed + this.active.name.length * 3) % INFECTED_BUTTONS.length
        ];
      this.motionButton.textContent = buttonText;

      if (severe) {
        const fleeX = -pointer.x * 42 * breach;
        const fleeY = pointer.y * 24 * breach;
        const twitchX = Math.sin(elapsed * 31) * 7 * breach;
        const twitchY = Math.cos(elapsed * 27) * 5 * breach;
        this.motionButton.style.transform =
          `translate(${fleeX + twitchX}px, ${fleeY + twitchY}px)`;
        this.motionButton.style.filter =
          `hue-rotate(${Math.round(elapsed * 180)}deg) saturate(${1 + breach * 4})`;
      }
    }

    if (this.resetButton) {
      this.resetButton.textContent = "RESET REALITY";
    }
  }

  clearOverlay() {
    this.resizeOverlay();
    this.overlayCtx.clearRect(0, 0, this.overlay.width, this.overlay.height);
  }

  captureHistory() {
    const source = this.renderer.domElement;
    const target = this.history[this.historyIndex];
    const ctx = target.getContext("2d");
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.drawImage(source, 0, 0, target.width, target.height);
    this.historyIndex = (this.historyIndex + 1) % this.history.length;
  }

  afterRender(elapsed) {
    this.resizeOverlay();

    const ctx = this.overlayCtx;
    const w = this.overlay.width;
    const h = this.overlay.height;
    const source = this.renderer.domElement;

    ctx.clearRect(0, 0, w, h);

    if (!this.active || !this.active.definition.smear) {
      this.captureHistory();
      return;
    }

    const progress = clamp(
      (elapsed - this.active.startedAt) / this.active.duration,
      0,
      1
    );
    const violence = this.breachLevel;
    const smearWindow =
      this.active.name !== "orientationSlip" || progress < 0.66;

    if (smearWindow) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";

      for (let i = 0; i < this.history.length; i += 1) {
        const index =
          (this.historyIndex - 1 - i + this.history.length) %
          this.history.length;
        const frame = this.history[index];
        const age = i / this.history.length;
        const dx =
          Math.sin(elapsed * 41 + i * 1.7) *
          (4 + age * 15) *
          violence;
        const dy =
          Math.cos(elapsed * 33 + i * 2.1) *
          (2 + age * 8) *
          violence;

        ctx.globalAlpha = (0.2 - age * 0.018) * violence;
        ctx.filter =
          `hue-rotate(${i * 58 + elapsed * 90}deg) saturate(${2 + violence * 5}) contrast(1.3)`;
        ctx.drawImage(frame, dx, dy, w, h);
      }

      ctx.restore();

      // Brutal horizontal scanline tears.
      ctx.save();
      ctx.globalAlpha = 0.28 + violence * 0.34;
      for (let i = 0; i < 9; i += 1) {
        const y =
          ((Math.sin(elapsed * (11 + i * 0.7) + i * 4.1) * 0.5 + 0.5) * h) | 0;
        const stripH = 1 + ((i * 3) % 6);
        const shift = Math.sin(elapsed * 29 + i) * 25 * violence;
        ctx.filter = i % 2
          ? "hue-rotate(90deg) saturate(6)"
          : "hue-rotate(250deg) saturate(5)";
        ctx.drawImage(source, 0, y, w, stripH, shift, y, w, stripH);
      }
      ctx.restore();

      // The sky occasionally tears open into impossible saturated negative space.
      if (
        this.active.name === "dimensionStutter" ||
        this.active.name === "projectionError"
      ) {
        ctx.save();
        ctx.globalAlpha = violence * 0.75;
        ctx.fillStyle = "#050008";
        ctx.beginPath();
        ctx.moveTo(w * 0.08, h * 0.18);
        ctx.lineTo(w * 0.38, h * 0.08);
        ctx.lineTo(w * 0.31, h * 0.62);
        ctx.lineTo(w * 0.03, h * 0.79);
        ctx.closePath();
        ctx.fill();

        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = "#ff00bb";
        ctx.fillRect(w * 0.06, h * 0.32, w * 0.28, 2 + violence * 5);
        ctx.fillStyle = "#00ffee";
        ctx.fillRect(w * 0.16, h * 0.54, w * 0.36, 2 + violence * 4);
        ctx.restore();
      }
    }

    this.captureHistory();
  }
}
