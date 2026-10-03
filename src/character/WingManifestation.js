import * as THREE from "three";

const WHITE = "#fffdf3";
const PEARL = "#dff4ff";
const WARM = "#ffe6a1";
const SHADOW = "#9db7c9";
const GOLD = "#ffd35a";

const GESTURE_DURATION = {
  leanIn: 0.9,
  recoil: 0.72,
  judgment: 1.35,
  flare: 1.5,
  attractorDrift: 2.7,
  orientationSlip: 0.72,
  mobiusFlip: 1.08,
  projectionError: 1.0,
  dimensionStutter: 0.86,
};

const CLUSTERS = [
  { id: "upper-left", x: -1.58, y: 0.72, z: -0.9, rot: 0.44, scale: 1.0, mirror: -1, feathers: 9, phase: 0.2 },
  { id: "upper-right", x: 1.52, y: 0.58, z: -0.96, rot: -0.36, scale: 0.96, mirror: 1, feathers: 8, phase: 1.1 },
  { id: "lower-left", x: -1.5, y: -0.88, z: -1.06, rot: -0.22, scale: 0.82, mirror: -1, feathers: 7, phase: 2.0 },
  { id: "lower-right", x: 1.62, y: -0.72, z: -1.14, rot: 0.27, scale: 0.86, mirror: 1, feathers: 8, phase: 2.8 },
  { id: "side-left-impossible", x: -2.0, y: 0.0, z: -1.22, rot: 1.42, scale: 0.7, mirror: -1, feathers: 6, phase: 3.7 },
  { id: "side-right-impossible", x: 1.92, y: 0.18, z: -1.28, rot: -1.16, scale: 0.72, mirror: 1, feathers: 6, phase: 4.5 },
  { id: "crown", x: 0.08, y: 1.78, z: -1.34, rot: 0.04, scale: 0.66, mirror: 1, feathers: 7, phase: 5.6, crown: true },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pulse01(t) {
  const value = clamp(t, 0, 1);
  return Math.sin(value * Math.PI);
}

function makeFeatherGeometry(length = 1, width = 0.32) {
  const shape = new THREE.Shape();

  shape.moveTo(0, 0);
  shape.bezierCurveTo(
    width * 0.52,
    length * 0.13,
    width * 0.5,
    length * 0.68,
    0,
    length
  );
  shape.bezierCurveTo(
    -width * 0.48,
    length * 0.7,
    -width * 0.46,
    length * 0.16,
    0,
    0
  );

  return new THREE.ShapeGeometry(shape, 5);
}

function makeFeatherMaterial(index, opacity = 0.92) {
  const palette = [WHITE, PEARL, WHITE, WARM, WHITE, SHADOW];

  return new THREE.MeshBasicMaterial({
    color: palette[index % palette.length],
    transparent: opacity < 1,
    opacity,
    depthTest: true,
    depthWrite: true,
    side: THREE.DoubleSide,
  });
}

function makeCluster(layout, index) {
  const anchor = new THREE.Group();
  anchor.name = `wing-cluster:${layout.id}`;
  anchor.position.set(layout.x, layout.y, layout.z);
  anchor.rotation.z = layout.rot;
  anchor.scale.setScalar(layout.scale);

  const fan = new THREE.Group();
  fan.name = `wing-fan:${layout.id}`;
  anchor.add(fan);

  const feathers = [];
  const count = layout.feathers;

  for (let i = 0; i < count; i += 1) {
    const t = count <= 1 ? 0.5 : i / (count - 1);
    const length =
      (layout.crown ? 0.78 : 0.96) *
      (1 - Math.abs(t - 0.48) * 0.28);
    const width = 0.28 - Math.abs(t - 0.5) * 0.06;

    const feather = new THREE.Mesh(
      makeFeatherGeometry(length, width),
      makeFeatherMaterial(index + i, i % 5 === 0 ? 0.84 : 0.96)
    );

    const arc = (t - 0.5) * (layout.crown ? 1.42 : 1.16);
    const radial = 0.2 + Math.sin(t * Math.PI) * 0.14;

    feather.position.set(
      layout.mirror * (t - 0.5) * 0.36,
      -0.07 + radial,
      -i * 0.006
    );

    feather.rotation.z =
      layout.mirror *
      (arc + (layout.crown ? 0 : 0.2));

    feather.rotation.y =
      (t - 0.5) * 0.22;

    feather.scale.y = 0.88 + Math.sin((i + 1) * 1.7) * 0.06;

    fan.add(feather);
    feathers.push(feather);
  }

  // A tiny hard gold root makes the fans read as angel machinery instead of
  // loose decorative feathers.
  const root = new THREE.Mesh(
    new THREE.CircleGeometry(0.18, 10),
    new THREE.MeshBasicMaterial({
      color: GOLD,
      depthTest: true,
      depthWrite: true,
      side: THREE.DoubleSide,
    })
  );
  root.position.z = 0.02;
  fan.add(root);

  return {
    layout,
    anchor,
    fan,
    feathers,
    root,
    basePosition: anchor.position.clone(),
    baseRotation: anchor.rotation.clone(),
    baseScale: anchor.scale.clone(),
    index,
  };
}

export class WingManifestation {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = "wing-manifestation";
    this.group.position.z = -0.18;

    this.clusters = CLUSTERS.map((layout, index) => makeCluster(layout, index));
    for (const cluster of this.clusters) {
      this.group.add(cluster.anchor);
    }

    this.speaking = false;
    this.voiceEnergy = 0;
    this.voiceHigh = 0;
    this.pulseEnergy = 0;
    this.gesture = null;
  }

  setSpeaking(enabled = false) {
    this.speaking = Boolean(enabled);
  }

  setVoiceEnergy({ rms = 0, high = 0 } = {}) {
    this.voiceEnergy = Math.max(this.voiceEnergy, clamp(rms, 0, 1));
    this.voiceHigh = Math.max(this.voiceHigh, clamp(high, 0, 1));
  }

  pulse(intensity = 0.5) {
    this.pulseEnergy = Math.max(
      this.pulseEnergy,
      clamp(Number(intensity) || 0, 0, 1.35)
    );
  }

  manifestGesture(name, intensity = 1, elapsed = 0) {
    if (!GESTURE_DURATION[name]) return;

    this.gesture = {
      name,
      intensity: clamp(Number(intensity) || 1, 0.1, 1.35),
      startedAt: elapsed,
      duration: GESTURE_DURATION[name],
    };
  }

  reset() {
    this.speaking = false;
    this.voiceEnergy = 0;
    this.voiceHigh = 0;
    this.pulseEnergy = 0;
    this.gesture = null;

    for (const cluster of this.clusters) {
      cluster.anchor.position.copy(cluster.basePosition);
      cluster.anchor.rotation.copy(cluster.baseRotation);
      cluster.anchor.scale.copy(cluster.baseScale);
      cluster.fan.position.set(0, 0, 0);
      cluster.fan.rotation.set(0, 0, 0);
    }
  }

  update(delta, elapsed) {
    this.voiceEnergy *= this.speaking ? 0.95 : 0.84;
    this.voiceHigh *= this.speaking ? 0.91 : 0.78;
    this.pulseEnergy *= 0.86;

    let gesturePulse = 0;
    let gestureName = null;
    let gestureIntensity = 0;

    if (this.gesture) {
      const age = elapsed - this.gesture.startedAt;
      const progress = age / this.gesture.duration;

      if (progress >= 1) {
        this.gesture = null;
      } else if (progress >= 0) {
        gesturePulse = pulse01(progress);
        gestureName = this.gesture.name;
        gestureIntensity = this.gesture.intensity;
      }
    }

    this.clusters.forEach((cluster, index) => {
      const { layout, anchor, fan, feathers } = cluster;
      const phase = layout.phase;
      const speech = this.speaking
        ? Math.max(0.08, this.voiceEnergy)
        : this.voiceEnergy * 0.35;

      const idleFlex =
        Math.sin(elapsed * (0.42 + index * 0.018) + phase) * 0.035;
      const speechFlex =
        Math.sin(elapsed * 3.1 + phase * 0.8) * speech * 0.08;
      const accentFlex =
        this.pulseEnergy *
        (index % 2 === 0 ? 1 : -1) *
        0.075;

      let spread = idleFlex + speechFlex + accentFlex;
      let lift = 0;
      let depthSlip = 0;
      let twist = 0;
      let localScale = 1 + speech * 0.025 + this.pulseEnergy * 0.03;

      if (gestureName === "leanIn") {
        spread -= gesturePulse * gestureIntensity * 0.08;
        depthSlip -= gesturePulse * 0.05;
      } else if (gestureName === "recoil") {
        spread +=
          gesturePulse *
          gestureIntensity *
          (index % 2 === 0 ? 0.11 : -0.045);
        lift += gesturePulse * 0.035 * (index % 3 - 1);
      } else if (gestureName === "judgment") {
        spread += gesturePulse * gestureIntensity * 0.10;
        twist +=
          gesturePulse *
          gestureIntensity *
          (index % 2 === 0 ? -0.055 : 0.055);
      } else if (gestureName === "flare") {
        spread += gesturePulse * gestureIntensity * 0.22;
        localScale += gesturePulse * gestureIntensity * 0.11;
        lift += gesturePulse * 0.06;
      } else if (gestureName === "attractorDrift") {
        depthSlip +=
          Math.sin(elapsed * 1.7 + phase) *
          gesturePulse *
          gestureIntensity *
          0.11;
        twist +=
          Math.cos(elapsed * 1.3 + phase) *
          gesturePulse *
          0.08;
      } else if (
        gestureName === "orientationSlip" ||
        gestureName === "projectionError"
      ) {
        const sign = index % 2 === 0 ? 1 : -1;
        depthSlip += sign * gesturePulse * gestureIntensity * 0.16;
        twist += sign * gesturePulse * 0.15;
      } else if (gestureName === "mobiusFlip") {
        twist +=
          Math.sin(gesturePulse * Math.PI * 2 + phase) *
          gestureIntensity *
          0.22;
      } else if (gestureName === "dimensionStutter") {
        const stutter = Math.sin(elapsed * 48 + index * 2.3);
        spread += stutter * gesturePulse * gestureIntensity * 0.16;
        depthSlip += stutter * gesturePulse * 0.1;
      }

      anchor.position.x =
        cluster.basePosition.x +
        Math.sin(elapsed * 0.16 + phase) * 0.035 +
        (layout.crown ? 0 : depthSlip * 0.22);

      anchor.position.y =
        cluster.basePosition.y +
        Math.cos(elapsed * 0.13 + phase) * 0.024 +
        lift;

      // Contradictory depth is intentional: clusters "belong" to different
      // implied coordinate systems but remain behind the wheel body.
      anchor.position.z =
        cluster.basePosition.z +
        depthSlip;

      anchor.rotation.z =
        cluster.baseRotation.z +
        spread +
        twist;

      anchor.rotation.x =
        Math.sin(elapsed * 0.22 + phase) * 0.035 +
        depthSlip * 0.18;

      anchor.rotation.y =
        Math.cos(elapsed * 0.19 + phase) * 0.045 +
        twist * 0.35;

      anchor.scale.set(
        cluster.baseScale.x * localScale,
        cluster.baseScale.y * localScale,
        cluster.baseScale.z
      );

      fan.rotation.z =
        Math.sin(elapsed * 0.36 + phase) * 0.018 +
        this.voiceHigh * (index % 2 ? -0.025 : 0.025);

      feathers.forEach((feather, featherIndex) => {
        feather.rotation.x =
          Math.sin(
            elapsed * (0.7 + featherIndex * 0.025) +
              phase +
              featherIndex * 0.42
          ) *
          (0.025 + speech * 0.03);

        const material = feather.material;
        material.opacity = clamp(
          (featherIndex % 5 === 0 ? 0.84 : 0.96) +
            this.voiceHigh * 0.04 +
            (gestureName === "flare"
              ? gesturePulse * gestureIntensity * 0.05
              : 0),
          0.7,
          1
        );
      });
    });

    void delta;
  }
}
