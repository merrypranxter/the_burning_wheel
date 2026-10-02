function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function averageRange(array, start, end) {
  const from = Math.max(0, Math.min(array.length, start));
  const to = Math.max(from + 1, Math.min(array.length, end));
  let total = 0;

  for (let i = from; i < to; i += 1) total += array[i];
  return total / (to - from) / 255;
}

export class VoiceController {
  constructor({ angel, containment, onState = () => {} }) {
    this.angel = angel;
    this.containment = containment;
    this.onState = onState;

    this.audio = new Audio();
    this.audio.preload = "auto";

    this.context = null;
    this.source = null;
    this.analyser = null;
    this.timeData = null;
    this.frequencyData = null;

    this.currentUrl = null;
    this.energy = { rms: 0, low: 0, high: 0 };
    this.previousEnergy = 0;
    this.lastGestureAt = -Infinity;
    this.requestToken = 0;
    this.playbackResolvers = new Set();

    this.audio.addEventListener("play", () => this.onState("speaking"));
    this.audio.addEventListener("ended", () => this.finishPlayback());
    this.audio.addEventListener("pause", () => {
      if (!this.audio.ended && this.audio.currentTime > 0) {
        this.onState("paused");
      }
    });
  }

  async ensureAudioGraph() {
    if (this.context) return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      throw new Error("This browser does not expose the Web Audio API.");
    }

    this.context = new AudioContext();
    this.source = this.context.createMediaElementSource(this.audio);
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.78;

    this.timeData = new Uint8Array(this.analyser.fftSize);
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);

    this.source.connect(this.analyser);
    this.analyser.connect(this.context.destination);
  }

  async speak(text) {
    const line = text.trim();
    if (!line) throw new Error("Give him something to say first.");

    const token = ++this.requestToken;
    this.stop({ invalidate: false });
    this.onState("summoning");

    const response = await fetch("/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: line }),
    });

    if (token !== this.requestToken) return;

    if (!response.ok) {
      let message = `Voice request failed (HTTP ${response.status}).`;
      try {
        const payload = await response.json();
        if (payload?.error) message = payload.error;
      } catch {
        // Keep the generic error if the response was not JSON.
      }
      this.onState("error");
      throw new Error(message);
    }

    const blob = await response.blob();
    if (token !== this.requestToken) return;

    await this.ensureAudioGraph();
    if (this.context.state === "suspended") {
      await this.context.resume();
    }

    this.revokeCurrentUrl();
    this.currentUrl = URL.createObjectURL(blob);
    this.audio.src = this.currentUrl;
    this.audio.currentTime = 0;

    await this.audio.play();
  }

  stop({ invalidate = true } = {}) {
    if (invalidate) this.requestToken += 1;

    this.resolvePlayback("stopped");
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.revokeCurrentUrl();

    this.energy.rms = 0;
    this.energy.low = 0;
    this.energy.high = 0;
    this.previousEnergy = 0;
    this.onState("idle");
  }

  finishPlayback() {
    this.resolvePlayback("ended");
    this.energy.rms = 0;
    this.energy.low = 0;
    this.energy.high = 0;
    this.previousEnergy = 0;
    this.onState("idle");
    this.revokeCurrentUrl();
  }

  revokeCurrentUrl() {
    if (!this.currentUrl) return;
    URL.revokeObjectURL(this.currentUrl);
    this.currentUrl = null;
  }

  resolvePlayback(reason = "ended") {
    for (const resolve of this.playbackResolvers) {
      resolve({ reason, cancelled: reason !== "ended" });
    }
    this.playbackResolvers.clear();
  }

  async speakAndWait(text) {
    await this.speak(text);

    if (this.audio.ended) {
      return { reason: "ended", cancelled: false };
    }

    if (this.audio.paused) {
      return { reason: "stopped", cancelled: true };
    }

    return new Promise((resolve) => {
      this.playbackResolvers.add(resolve);
    });
  }

  update(_delta, elapsed) {
    if (!this.analyser || this.audio.paused || this.audio.ended) return;

    this.analyser.getByteTimeDomainData(this.timeData);
    this.analyser.getByteFrequencyData(this.frequencyData);

    let squareSum = 0;
    for (const sample of this.timeData) {
      const normalized = (sample - 128) / 128;
      squareSum += normalized * normalized;
    }

    const rawRms = Math.sqrt(squareSum / this.timeData.length);
    const rawLow = averageRange(this.frequencyData, 1, 12);
    const rawHigh = averageRange(this.frequencyData, 20, 56);

    this.energy.rms += (rawRms - this.energy.rms) * 0.3;
    this.energy.low += (rawLow - this.energy.low) * 0.22;
    this.energy.high += (rawHigh - this.energy.high) * 0.26;

    const scaledEnergy = clamp01(this.energy.rms * 3.8);
    const onset = clamp01((scaledEnergy - this.previousEnergy) * 4.6);
    this.previousEnergy += (scaledEnergy - this.previousEnergy) * 0.42;

    this.angel.applyVoiceEnergy(
      {
        rms: scaledEnergy,
        low: clamp01(this.energy.low * 1.65),
        high: clamp01(this.energy.high * 1.8),
        onset,
      },
      elapsed
    );

    const phraseHit =
      onset > 0.38 &&
      scaledEnergy > 0.32 &&
      elapsed - this.lastGestureAt > 3.2 &&
      !this.containment.active;

    if (phraseHit) {
      const intensity = 0.28 + Math.min(0.5, scaledEnergy * 0.5);
      const gesture =
        this.energy.low > this.energy.high * 1.18
          ? "judgment"
          : "flare";

      this.containment.trigger(gesture, { intensity, elapsed });
      this.lastGestureAt = elapsed;
    }
  }

  dispose() {
    this.stop();

    if (this.context) {
      this.context.close();
      this.context = null;
    }
  }
}
