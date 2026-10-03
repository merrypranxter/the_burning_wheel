import * as THREE from "three";

const VOID = "#120412";
const GUM = "#ff5bbd";
const PEARL = "#fff8df";
const CYAN = "#48f3ff";
const GOLD = "#ffd15c";
const UV = "#8b59ff";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeMaterial(color, options = {}) {
  return new THREE.MeshBasicMaterial({
    color,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    ...options,
  });
}

function makeShard(width = 0.07, height = 0.12, flip = false) {
  const shape = new THREE.Shape();
  shape.moveTo(-width * 0.5, 0);
  shape.lineTo(width * 0.5, 0);
  shape.lineTo(0, flip ? height : -height);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

function makeSatellite(x, y, scale, phase) {
  const group = new THREE.Group();
  group.position.set(x, y, 0);
  group.scale.setScalar(scale);
  group.visible = false;

  const voidMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.16, 14),
    makeMaterial(VOID, { opacity: 0.88 })
  );
  voidMesh.scale.set(1.4, 0.34, 1);
  group.add(voidMesh);

  const rim = new THREE.Mesh(
    new THREE.RingGeometry(0.12, 0.165, 16),
    makeMaterial(phase % 2 ? CYAN : GUM, {
      opacity: 0.74,
      blending: THREE.AdditiveBlending,
    })
  );
  rim.scale.set(1.42, 0.36, 1);
  group.add(rim);

  return { group, voidMesh, rim, phase };
}

export class VoiceAperture {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = "voice-aperture";
    this.group.position.set(0, -0.41, 0.72);
    this.group.renderOrder = 14970;

    this.enabled = true;
    this.speaking = false;
    this.energy = 0;
    this.low = 0;
    this.high = 0;
    this.accent = 0;
    this.accentDirection = 1;
    this.phaseIndex = 0;

    this.void = new THREE.Mesh(
      new THREE.CircleGeometry(0.22, 18),
      makeMaterial(VOID, { opacity: 0.97 })
    );
    this.void.renderOrder = 14970;
    this.group.add(this.void);

    this.outerRim = new THREE.Mesh(
      new THREE.RingGeometry(0.174, 0.225, 18),
      makeMaterial(GOLD, { opacity: 0.92 })
    );
    this.outerRim.renderOrder = 14971;
    this.group.add(this.outerRim);

    this.innerRim = new THREE.Mesh(
      new THREE.RingGeometry(0.134, 0.17, 18),
      makeMaterial(GUM, {
        opacity: 0.86,
        blending: THREE.AdditiveBlending,
      })
    );
    this.innerRim.renderOrder = 14972;
    this.group.add(this.innerRim);

    this.throatGlow = new THREE.Mesh(
      new THREE.CircleGeometry(0.13, 18),
      makeMaterial(UV, {
        opacity: 0.26,
        blending: THREE.AdditiveBlending,
      })
    );
    this.throatGlow.renderOrder = 14973;
    this.group.add(this.throatGlow);

    this.shards = [];
    for (let i = 0; i < 8; i += 1) {
      const top = i < 4;
      const local = i % 4;
      const shard = new THREE.Mesh(
        makeShard(
          0.06 + (local % 2) * 0.012,
          0.075 + ((local + i) % 3) * 0.016,
          !top
        ),
        makeMaterial(PEARL, { opacity: 0.98 })
      );

      shard.position.set(
        (local - 1.5) * 0.075 + (top ? 0.006 : -0.008),
        top ? 0.062 : -0.062,
        0.01
      );
      shard.rotation.z = (local - 1.5) * 0.055;
      shard.renderOrder = 14974;
      this.group.add(shard);
      this.shards.push({ mesh: shard, top, local });
    }

    this.centerLine = new THREE.Mesh(
      new THREE.PlaneGeometry(0.31, 0.018),
      makeMaterial(CYAN, {
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
      })
    );
    this.centerLine.position.z = 0.018;
    this.centerLine.renderOrder = 14975;
    this.group.add(this.centerLine);

    this.satellites = [
      makeSatellite(-0.49, 0.12, 0.55, 0),
      makeSatellite(0.43, 0.18, 0.44, 1),
      makeSatellite(-0.37, -0.18, 0.39, 2),
    ];

    for (const satellite of this.satellites) {
      satellite.group.renderOrder = 14960;
      this.group.add(satellite.group);
    }

    this.group.scale.set(1, 0.04, 1);
    this.group.visible = false;
  }

  setEnabled(enabled = true) {
    this.enabled = Boolean(enabled);

    if (!this.enabled) {
      this.group.visible = false;
    }
  }

  setSpeaking(enabled = false) {
    this.speaking = Boolean(enabled);

    if (this.enabled && this.speaking) {
      this.group.visible = true;
      this.energy = Math.max(this.energy, 0.12);
    }
  }

  setVoiceEnergy({ rms = 0, low = 0, high = 0 } = {}) {
    this.energy = Math.max(this.energy, clamp(rms, 0, 1));
    this.low = Math.max(this.low, clamp(low, 0, 1));
    this.high = Math.max(this.high, clamp(high, 0, 1));
  }

  punctuate(intensity = 0.5, direction = 1) {
    const amount = clamp(Number(intensity) || 0, 0, 1.2);
    this.accent = Math.max(this.accent, amount);
    this.accentDirection = direction >= 0 ? 1 : -1;
    this.phaseIndex += 1;
  }

  reset() {
    this.speaking = false;
    this.energy = 0;
    this.low = 0;
    this.high = 0;
    this.accent = 0;
    this.group.visible = false;

    for (const satellite of this.satellites) {
      satellite.group.visible = false;
    }
  }

  update(_delta, elapsed) {
    if (!this.enabled) {
      this.group.visible = false;
      return;
    }

    this.energy *= this.speaking ? 0.93 : 0.72;
    this.low *= this.speaking ? 0.91 : 0.68;
    this.high *= this.speaking ? 0.88 : 0.62;
    this.accent *= 0.79;

    const presence = this.speaking
      ? Math.max(0.14, this.energy)
      : this.energy;

    const shouldShow = this.speaking || presence > 0.035 || this.accent > 0.04;
    this.group.visible = shouldShow;

    if (!shouldShow) return;

    const syllable =
      (Math.sin(elapsed * 14.2 + this.phaseIndex * 0.81) * 0.5 + 0.5) *
      presence;
    const rasp =
      Math.sin(elapsed * 31.0 + this.phaseIndex * 1.7) *
      this.high *
      0.08;

    const open =
      0.07 +
      presence * 0.58 +
      syllable * 0.34 +
      this.low * 0.12 +
      this.accent * 0.22;

    const width =
      1 +
      presence * 0.12 -
      this.low * 0.04 +
      this.accent * 0.06;

    this.group.scale.set(
      width,
      clamp(open, 0.04, 1.08),
      1
    );

    this.group.rotation.z =
      rasp +
      this.accent * this.accentDirection * 0.045;

    this.group.position.x =
      Math.sin(elapsed * 2.8 + this.phaseIndex) * presence * 0.018 +
      this.accent * this.accentDirection * 0.012;

    this.void.scale.set(
      1.0 + presence * 0.13,
      0.72 + syllable * 0.38 + this.low * 0.16,
      1
    );

    this.outerRim.scale.set(
      1.02 + this.accent * 0.05,
      0.88 + syllable * 0.19,
      1
    );

    this.innerRim.rotation.z =
      -elapsed * 0.38 +
      this.accentDirection * this.accent * 0.18;

    this.innerRim.material.opacity =
      0.58 + presence * 0.25 + this.accent * 0.12;

    this.throatGlow.material.color.set(
      this.high > this.low ? CYAN : UV
    );
    this.throatGlow.material.opacity =
      0.12 +
      presence * 0.34 +
      Math.max(0, rasp) * 0.35;

    this.centerLine.material.opacity =
      clamp(
        this.high * 0.62 +
          this.accent * 0.28 -
          syllable * 0.18,
        0,
        0.78
      );

    this.shards.forEach(({ mesh, top, local }, index) => {
      const toothJitter =
        Math.sin(elapsed * (8.1 + local * 0.4) + index * 1.7) *
        this.high *
        0.006;

      mesh.position.y =
        (top ? 0.06 : -0.06) +
        (top ? 1 : -1) *
          (syllable * 0.018 + this.low * 0.008) +
        toothJitter;

      mesh.rotation.z =
        (local - 1.5) * 0.055 +
        this.accentDirection *
          this.accent *
          (index % 2 ? -0.035 : 0.035);
    });

    const satelliteThreshold = 0.56;
    this.satellites.forEach((satellite, index) => {
      const alive =
        this.accent > satelliteThreshold - index * 0.05 &&
        ((this.phaseIndex + index) % 3 !== 1 || this.accent > 0.82);

      satellite.group.visible = alive;

      if (!alive) return;

      const blink =
        0.4 +
        Math.abs(
          Math.sin(elapsed * (9.2 + index * 1.3) + satellite.phase)
        ) *
          0.7;

      satellite.group.scale.y =
        (0.42 + this.accent * 0.44) * blink;
      satellite.group.scale.x =
        0.82 + this.accent * 0.28;
      satellite.group.rotation.z =
        this.accentDirection *
          (0.08 + index * 0.04) *
          this.accent;
      satellite.rim.material.opacity =
        0.38 + this.accent * 0.35;
    });
  }
}
