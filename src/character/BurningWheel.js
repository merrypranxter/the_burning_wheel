import * as THREE from "three";
import { buildWheelPanels } from "./WheelPanel.js";
import { CoreEye } from "./CoreEye.js";

const GOLD = "#ffc400";
const GOLD_LIGHT = "#fff0a0";
const GOLD_SHADOW = "#9b5e00";
const GOLD_DEEP = "#4d2d00";
const CORE_DARK = "#211300";
const CORE_INNER = "#6f4300";

const DEFAULT_WHEELS = [
  { id: "equator", radius: 1.92, tube: 0.145, tilt: [1.48, 0.04, 0.03], spin: 0.42, precession: [0.055, 0.08, 0.03], wobble: 0.055, phase: 0.0, slots: 16 },
  { id: "slash", radius: 1.82, tube: 0.13, tilt: [0.92, 0.28, -0.67], spin: -0.53, precession: [-0.07, 0.04, 0.06], wobble: 0.075, phase: 0.8, slots: 15 },
  { id: "backslash", radius: 1.74, tube: 0.13, tilt: [0.78, -0.42, 0.78], spin: 0.61, precession: [0.05, -0.06, 0.04], wobble: 0.065, phase: 1.9, slots: 14 },
  { id: "vertical", radius: 1.62, tube: 0.12, tilt: [0.08, 1.36, 0.2], spin: -0.36, precession: [0.06, 0.035, -0.05], wobble: 0.05, phase: 2.7, slots: 13 },
  { id: "inner-a", radius: 1.38, tube: 0.11, tilt: [0.48, 0.72, -0.18], spin: 0.73, precession: [-0.045, 0.065, 0.03], wobble: 0.06, phase: 3.4, slots: 12 },
  { id: "inner-b", radius: 1.27, tube: 0.105, tilt: [1.15, -0.63, 0.34], spin: -0.82, precession: [0.07, -0.025, 0.045], wobble: 0.08, phase: 4.2, slots: 11 },
  { id: "crown", radius: 1.12, tube: 0.095, tilt: [0.26, 0.38, 1.02], spin: 0.95, precession: [-0.055, -0.06, 0.025], wobble: 0.07, phase: 5.1, slots: 10 },
  { id: "inner-c", radius: 0.98, tube: 0.09, tilt: [0.62, 1.04, 0.66], spin: -1.05, precession: [0.05, 0.075, -0.035], wobble: 0.085, phase: 5.8, slots: 9 },
  { id: "tiny-chaos", radius: 0.82, tube: 0.085, tilt: [1.34, 0.58, -0.92], spin: 1.18, precession: [-0.08, 0.045, 0.07], wobble: 0.095, phase: 6.6, slots: 8 },
];

function makeMaterial(color, options = {}) {
  return new THREE.MeshBasicMaterial({
    color,
    side: THREE.DoubleSide,
    ...options,
  });
}

function addRivets(rotor, radius, tube, count) {
  const light = makeMaterial(GOLD_LIGHT);
  const shadow = makeMaterial(GOLD_SHADOW);
  const geometry = new THREE.BoxGeometry(tube * 0.38, tube * 0.58, tube * 0.42);

  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const rivet = new THREE.Mesh(geometry, i % 4 === 0 ? light : shadow);

    rivet.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      tube * 1.15
    );
    rivet.rotation.z = angle;
    rotor.add(rivet);
  }
}

function createWheel(config, wheelIndex) {
  const carrier = new THREE.Group();
  carrier.name = `wheel-carrier:${config.id}`;

  const rotor = new THREE.Group();
  rotor.name = `wheel-rotor:${config.id}`;
  carrier.add(rotor);

  const shadow = new THREE.Mesh(
    new THREE.TorusGeometry(config.radius, config.tube * 1.28, 4, 48),
    makeMaterial(GOLD_SHADOW)
  );
  shadow.position.z = -config.tube * 0.38;
  rotor.add(shadow);

  const body = new THREE.Mesh(
    new THREE.TorusGeometry(config.radius, config.tube, 5, 48),
    makeMaterial(GOLD)
  );
  rotor.add(body);

  const innerStripe = new THREE.Mesh(
    new THREE.TorusGeometry(config.radius, config.tube * 0.23, 4, 48),
    makeMaterial(GOLD_LIGHT)
  );
  innerStripe.position.z = config.tube * 0.62;
  rotor.add(innerStripe);

  addRivets(rotor, config.radius, config.tube, config.slots);

  const panels = buildWheelPanels({
    wheelId: config.id,
    wheelIndex,
    radius: config.radius,
    tube: config.tube,
    slotHint: config.slots,
  });

  for (const panel of panels) {
    rotor.add(panel.group);
  }

  carrier.rotation.set(...config.tilt);

  const baseRotation = new THREE.Euler(...config.tilt);

  return {
    config,
    carrier,
    rotor,
    panels,
    baseRotation,
    originalBaseRotation: baseRotation.clone(),
    spinAngle: config.phase * 0.5,
  };
}

function createEyeProjection(eye) {
  const group = new THREE.Group();
  group.name = "core-eye-projection";

  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(0.52, 32),
    new THREE.MeshBasicMaterial({
      color: "#77e9ff",
      transparent: true,
      opacity: 0.075,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
  );
  glow.position.z = 0.69;
  glow.renderOrder = 14990;
  group.add(glow);

  const eyePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.92, 0.69),
    new THREE.MeshBasicMaterial({
      map: eye.texture,
      transparent: true,
      opacity: 0.30,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    })
  );
  eyePlane.position.z = 0.705;
  eyePlane.renderOrder = 15000;
  group.add(eyePlane);

  return {
    group,
    glow,
    eyePlane,
    voiceEnergy: 0,
  };
}

function createCore() {
  const group = new THREE.Group();
  group.name = "burning-wheel-core";

  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(0.72, 12, 8),
    makeMaterial(GOLD_SHADOW)
  );
  shell.scale.z = 0.68;
  group.add(shell);

  const facePlate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.59, 0.59, 0.18, 16),
    makeMaterial(GOLD)
  );
  facePlate.rotation.x = Math.PI / 2;
  facePlate.position.z = 0.52;
  group.add(facePlate);

  const socket = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 16),
    makeMaterial(CORE_DARK)
  );
  socket.position.z = 0.625;
  group.add(socket);

  const innerSocket = new THREE.Mesh(
    new THREE.CircleGeometry(0.27, 12),
    makeMaterial(CORE_INNER)
  );
  innerSocket.position.z = 0.635;
  group.add(innerSocket);

  const eye = new CoreEye();
  group.add(eye.group);

  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2;
    const rivet = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.055, 0.05),
      makeMaterial(i % 3 === 0 ? GOLD_LIGHT : GOLD_DEEP)
    );
    rivet.position.set(
      Math.cos(angle) * 0.52,
      Math.sin(angle) * 0.52,
      0.64
    );
    rivet.rotation.z = angle;
    group.add(rivet);
  }

  return { group, eye };
}

export class BurningWheel {
  constructor({ wheelConfigs = DEFAULT_WHEELS } = {}) {
    this.group = new THREE.Group();
    this.group.name = "THE-BURNING-WHEEL";

    this.body = new THREE.Group();
    this.body.name = "body";
    this.group.add(this.body);

    const coreParts = createCore();
    this.core = coreParts.group;
    this.eye = coreParts.eye;
    this.body.add(this.core);

    // A camera-facing impossible projection keeps the central eye readable even
    // when rotating wheel geometry crosses the physical face.
    this.eyeProjection = createEyeProjection(this.eye);
    this.group.add(this.eyeProjection.group);

    this.wheels = wheelConfigs.map((config, index) => createWheel(config, index));
    for (const wheel of this.wheels) {
      this.body.add(wheel.carrier);
    }

    this.pointerInfluence = new THREE.Vector2();
    this.baseScale = 1;
    this.voicePresence = 0;
  }

  update(delta, elapsed, pointer = { x: 0, y: 0 }) {
    this.pointerInfluence.x += (pointer.x - this.pointerInfluence.x) * 0.045;
    this.pointerInfluence.y += (pointer.y - this.pointerInfluence.y) * 0.045;

    const bob = Math.sin(elapsed * 1.16) * 0.075;
    const breath = 1 + Math.sin(elapsed * 0.83) * 0.012;

    this.group.position.y = bob;
    this.group.scale.setScalar(this.baseScale * breath);

    this.body.position.set(0, 0, 0);
    this.body.rotation.y =
      this.pointerInfluence.x * 0.10 + Math.sin(elapsed * 0.31) * 0.035;
    this.body.rotation.x =
      -this.pointerInfluence.y * 0.075 + Math.cos(elapsed * 0.27) * 0.025;
    this.body.rotation.z = Math.sin(elapsed * 0.21) * 0.022;

    this.core.rotation.z = Math.sin(elapsed * 0.52) * 0.08;
    this.core.scale.setScalar(1 + Math.sin(elapsed * 1.7) * 0.018);
    this.eye.update(delta, elapsed, pointer);

    this.voicePresence *= 0.9;
    const projectionPulse =
      1 +
      Math.sin(elapsed * 1.7) * 0.018 +
      this.voicePresence * 0.055;

    this.eyeProjection.group.rotation.z =
      this.eye.group.rotation.z * 0.28 +
      Math.sin(elapsed * 0.37) * 0.008;
    this.eyeProjection.group.scale.setScalar(projectionPulse);
    this.eyeProjection.eyePlane.material.opacity =
      0.24 +
      this.voicePresence * 0.24 +
      (this.eye.currentExpression === "wide" ? 0.08 : 0);
    this.eyeProjection.glow.material.opacity =
      0.055 +
      this.voicePresence * 0.16 +
      Math.max(0, Math.sin(elapsed * 1.4)) * 0.025;

    for (const wheel of this.wheels) {
      const { config, carrier, rotor, baseRotation } = wheel;

      carrier.position.set(0, 0, 0);
      carrier.scale.set(1, 1, 1);
      rotor.position.set(0, 0, 0);
      rotor.scale.set(1, 1, 1);

      wheel.spinAngle += delta * config.spin;
      rotor.rotation.set(0, 0, wheel.spinAngle);

      carrier.rotation.x =
        baseRotation.x +
        Math.sin(elapsed * config.precession[0] * 7 + config.phase) *
          config.wobble +
        Math.sin(elapsed * 0.19 + config.phase) * config.precession[0];

      carrier.rotation.y =
        baseRotation.y +
        Math.cos(elapsed * config.precession[1] * 7 + config.phase * 0.73) *
          config.wobble +
        Math.sin(elapsed * 0.17 + config.phase) * config.precession[1];

      carrier.rotation.z =
        baseRotation.z +
        Math.sin(elapsed * config.precession[2] * 8 + config.phase * 1.17) *
          config.wobble +
        Math.cos(elapsed * 0.23 + config.phase) * config.precession[2];

      for (const panel of wheel.panels) {
        panel.update(delta, elapsed, {
          pointer,
          coreEye: this.eye,
        });
      }
    }
  }

  setBaseScale(scale = 1) {
    this.baseScale = scale;
    this.group.scale.setScalar(scale);
  }

  applyVoiceEnergy({ rms = 0, low = 0, high = 0, onset = 0 } = {}, elapsed = 0) {
    const energy = Math.max(0, Math.min(1, rms));
    const bass = Math.max(0, Math.min(1, low));
    const edge = Math.max(0, Math.min(1, high));

    this.body.position.z += energy * 0.13;
    this.body.rotation.z += Math.sin(elapsed * 13.0) * edge * 0.024;
    this.core.scale.multiplyScalar(1 + energy * 0.11 + bass * 0.035);
    this.voicePresence = Math.max(this.voicePresence, energy);
    this.eye?.setVoiceEnergy(energy);

    this.wheels.forEach((wheel, index) => {
      const direction = index % 2 === 0 ? 1 : -1;
      wheel.carrier.rotation.z +=
        direction * bass * (0.012 + index * 0.0018);
      wheel.rotor.rotation.z +=
        direction * edge * (0.014 + (index % 3) * 0.006);

      const expansion =
        1 + energy * (index % 3 === 0 ? 0.014 : 0.005);
      wheel.carrier.scale.multiplyScalar(expansion);
    });

    if (onset > 0.68) {
      this.eye.group.rotation.z += (Math.random() - 0.5) * onset * 0.04;
    }
  }

  setExpression(name, holdSeconds = 1.8, elapsed = 0) {
    this.eye?.setExpression(name, holdSeconds, elapsed);
  }

  setEyeForegroundPriority(enabled, reason = "manual") {
    this.eye?.setForegroundPriority(enabled, reason);

    if (this.eyeProjection) {
      this.eyeProjection.eyePlane.material.opacity = enabled ? 0.58 : 0.3;
      this.eyeProjection.glow.material.opacity = enabled ? 0.18 : 0.075;
    }
  }

  blink(elapsed = 0) {
    this.eye?.blinkNow(elapsed);
  }

  panicPanels(elapsed = 0, duration = 0.8, intensity = 1) {
    for (const wheel of this.wheels) {
      for (const panel of wheel.panels) {
        panel.setPanic(elapsed, duration, intensity);
      }
    }
  }

  resetGeometry() {
    this.body.position.set(0, 0, 0);
    this.body.rotation.set(0, 0, 0);

    for (const wheel of this.wheels) {
      wheel.baseRotation.copy(wheel.originalBaseRotation);
      wheel.carrier.position.set(0, 0, 0);
      wheel.carrier.scale.set(1, 1, 1);
      wheel.rotor.position.set(0, 0, 0);
      wheel.rotor.scale.set(1, 1, 1);
    }

    this.setExpression("neutral", 0, 0);
  }
}
