import * as THREE from "three";

const GOLD = "#ffc400";
const GOLD_LIGHT = "#fff0a0";
const GOLD_SHADOW = "#9b5e00";
const GOLD_DEEP = "#4d2d00";
const CORE_DARK = "#211300";
const CORE_INNER = "#6f4300";

const DEFAULT_WHEELS = [
  {
    id: "equator",
    radius: 1.92,
    tube: 0.145,
    tilt: [1.48, 0.04, 0.03],
    spin: 0.42,
    precession: [0.055, 0.08, 0.03],
    wobble: 0.055,
    phase: 0.0,
    slots: 16,
  },
  {
    id: "slash",
    radius: 1.82,
    tube: 0.13,
    tilt: [0.92, 0.28, -0.67],
    spin: -0.53,
    precession: [-0.07, 0.04, 0.06],
    wobble: 0.075,
    phase: 0.8,
    slots: 15,
  },
  {
    id: "backslash",
    radius: 1.74,
    tube: 0.13,
    tilt: [0.78, -0.42, 0.78],
    spin: 0.61,
    precession: [0.05, -0.06, 0.04],
    wobble: 0.065,
    phase: 1.9,
    slots: 14,
  },
  {
    id: "vertical",
    radius: 1.62,
    tube: 0.12,
    tilt: [0.08, 1.36, 0.2],
    spin: -0.36,
    precession: [0.06, 0.035, -0.05],
    wobble: 0.05,
    phase: 2.7,
    slots: 13,
  },
  {
    id: "inner-a",
    radius: 1.38,
    tube: 0.11,
    tilt: [0.48, 0.72, -0.18],
    spin: 0.73,
    precession: [-0.045, 0.065, 0.03],
    wobble: 0.06,
    phase: 3.4,
    slots: 12,
  },
  {
    id: "inner-b",
    radius: 1.27,
    tube: 0.105,
    tilt: [1.15, -0.63, 0.34],
    spin: -0.82,
    precession: [0.07, -0.025, 0.045],
    wobble: 0.08,
    phase: 4.2,
    slots: 11,
  },
  {
    id: "crown",
    radius: 1.12,
    tube: 0.095,
    tilt: [0.26, 0.38, 1.02],
    spin: 0.95,
    precession: [-0.055, -0.06, 0.025],
    wobble: 0.07,
    phase: 5.1,
    slots: 10,
  },
  {
    id: "inner-c",
    radius: 0.98,
    tube: 0.09,
    tilt: [0.62, 1.04, 0.66],
    spin: -1.05,
    precession: [0.05, 0.075, -0.035],
    wobble: 0.085,
    phase: 5.8,
    slots: 9,
  },
  {
    id: "tiny-chaos",
    radius: 0.82,
    tube: 0.085,
    tilt: [1.34, 0.58, -0.92],
    spin: 1.18,
    precession: [-0.08, 0.045, 0.07],
    wobble: 0.095,
    phase: 6.6,
    slots: 8,
  },
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

function addSkeletonSlots(rotor, radius, tube, count) {
  const slotCount = Math.max(4, Math.round(count / 3));
  const geometry = new THREE.BoxGeometry(tube * 2.5, tube * 1.18, tube * 0.58);
  const material = makeMaterial(GOLD_DEEP);

  for (let i = 0; i < slotCount; i += 1) {
    const angle = (i / slotCount) * Math.PI * 2 + 0.18;
    const slot = new THREE.Mesh(geometry, material);

    slot.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      tube * 1.28
    );
    slot.rotation.z = angle + Math.PI / 2;
    slot.userData.kind = "future-panel-slot";
    rotor.add(slot);
  }
}

function createWheel(config) {
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
  addSkeletonSlots(rotor, config.radius, config.tube, config.slots);

  carrier.rotation.set(...config.tilt);

  return {
    config,
    carrier,
    rotor,
    baseRotation: new THREE.Euler(...config.tilt),
    spinAngle: config.phase * 0.5,
  };
}

function createCore() {
  const core = new THREE.Group();
  core.name = "burning-wheel-core";

  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(0.72, 12, 8),
    makeMaterial(GOLD_SHADOW)
  );
  shell.scale.z = 0.68;
  core.add(shell);

  const facePlate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.59, 0.59, 0.18, 16),
    makeMaterial(GOLD)
  );
  facePlate.rotation.x = Math.PI / 2;
  facePlate.position.z = 0.52;
  core.add(facePlate);

  const socket = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 16),
    makeMaterial(CORE_DARK)
  );
  socket.position.z = 0.625;
  core.add(socket);

  const innerSocket = new THREE.Mesh(
    new THREE.CircleGeometry(0.27, 12),
    makeMaterial(CORE_INNER)
  );
  innerSocket.position.z = 0.635;
  core.add(innerSocket);

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
    core.add(rivet);
  }

  return core;
}

export class BurningWheel {
  constructor({ wheelConfigs = DEFAULT_WHEELS } = {}) {
    this.group = new THREE.Group();
    this.group.name = "THE-BURNING-WHEEL";

    this.body = new THREE.Group();
    this.body.name = "body";
    this.group.add(this.body);

    this.core = createCore();
    this.body.add(this.core);

    this.wheels = wheelConfigs.map((config) => createWheel(config));
    for (const wheel of this.wheels) {
      this.body.add(wheel.carrier);
    }

    this.pointerInfluence = new THREE.Vector2();
    this.baseScale = 1;
  }

  update(delta, elapsed, pointer = { x: 0, y: 0 }) {
    this.pointerInfluence.x += (pointer.x - this.pointerInfluence.x) * 0.045;
    this.pointerInfluence.y += (pointer.y - this.pointerInfluence.y) * 0.045;

    const bob = Math.sin(elapsed * 1.16) * 0.075;
    const breath = 1 + Math.sin(elapsed * 0.83) * 0.012;

    this.group.position.y = bob;
    this.group.scale.setScalar(this.baseScale * breath);

    this.body.rotation.y =
      this.pointerInfluence.x * 0.10 + Math.sin(elapsed * 0.31) * 0.035;
    this.body.rotation.x =
      -this.pointerInfluence.y * 0.075 + Math.cos(elapsed * 0.27) * 0.025;
    this.body.rotation.z = Math.sin(elapsed * 0.21) * 0.022;

    this.core.rotation.z = Math.sin(elapsed * 0.52) * 0.08;
    this.core.scale.setScalar(1 + Math.sin(elapsed * 1.7) * 0.018);

    for (const wheel of this.wheels) {
      const { config, carrier, rotor, baseRotation } = wheel;

      wheel.spinAngle += delta * config.spin;
      rotor.rotation.z = wheel.spinAngle;

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
    }
  }

  setBaseScale(scale = 1) {
    this.baseScale = scale;
    this.group.scale.setScalar(scale);
  }
}
