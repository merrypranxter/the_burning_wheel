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

function normalizeContinuousSpeech(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n+ */g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitContinuousSpeech(value, maxLength = 1100) {
  const text = normalizeContinuousSpeech(value);
  if (!text) return [];
  if (text.length <= maxLength) return [text];

  const pieces = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    let cut = -1;

    for (const token of [". ", "? ", "! ", "; ", ", "]) {
      const candidate = remaining.lastIndexOf(token, maxLength);
      if (candidate > cut) cut = candidate + token.length - 1;
    }

    if (cut < Math.round(maxLength * 0.58)) {
      cut = remaining.lastIndexOf(" ", maxLength);
    }

    if (cut < Math.round(maxLength * 0.45)) {
      cut = maxLength;
    }

    pieces.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }

  if (remaining) pieces.push(remaining);
  return pieces.filter(Boolean);
}

export class VoiceController {
  constructor({ angel, containment, onState = () => {}, playbackRate = 1.3 }) {
    this.angel = angel;
    this.containment = containment;
    this.onState = onState;

    this.audio = new Audio();
    this.audio.preload = "auto";
    this.playbackRate = Math.max(0.6, Math.min(1.8, Number(playbackRate) || 1));
    this.audio.playbackRate = this.playbackRate;
    this.audio.defaultPlaybackRate = this.playbackRate;

    if ("preservesPitch" in this.audio) {
      this.audio.preservesPitch = true;
    }

    this.context = null;
    this.source = null;
    this.analyser = null;
    this.captureDestination = null;
    this.timeData = null;
    this.frequencyData = null;

    this.currentUrl = null;
    this.energy = { rms: 0, low: 0, high: 0 };
    this.previousEnergy = 0;
    this.lastGestureAt = -Infinity;
    this.lastAccentAt = -Infinity;
    this.lastSpeechBlinkAt = -Infinity;
    this.accentIndex = 0;
    this.gestureIndex = 0;
    this.requestToken = 0;
    this.playbackResolvers = new Set();
    this.continuousQueueActive = false;
    this.preparedSpeech = new Map();

    this.audio.addEventListener("play", () => {
      this.angel?.setSpeaking(true);
      this.onState("speaking");
    });
    this.audio.addEventListener("ended", () => {
      if (!this.continuousQueueActive) {
        this.finishPlayback();
      }
    });
    this.audio.addEventListener("pause", () => {
      this.angel?.setSpeaking(false);
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
    this.captureDestination = this.context.createMediaStreamDestination();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.78;

    this.timeData = new Uint8Array(this.analyser.fftSize);
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);

    this.source.connect(this.analyser);
    this.analyser.connect(this.context.destination);
    this.analyser.connect(this.captureDestination);
  }

  setPlaybackRate(rate = 1) {
    this.playbackRate = Math.max(0.6, Math.min(1.8, Number(rate) || 1));
    this.audio.playbackRate = this.playbackRate;
    this.audio.defaultPlaybackRate = this.playbackRate;
  }

  speechKey(text) {
    return normalizeContinuousSpeech(text);
  }

  async prepareSpeech(text) {
    const key = this.speechKey(text);
    const chunks = splitContinuousSpeech(key);

    if (!chunks.length) {
      throw new Error("Give him something to say first.");
    }

    const blobs = await Promise.all(
      chunks.map((chunk) => this.fetchSpeechBlob(chunk, null))
    );

    this.preparedSpeech.set(key, blobs);
    return { key, chunks: blobs.length };
  }

  takePreparedSpeech(text) {
    const key = this.speechKey(text);
    const blobs = this.preparedSpeech.get(key) || null;

    if (blobs) {
      this.preparedSpeech.delete(key);
    }

    return blobs;
  }

  async getRecordingStream() {
    await this.ensureAudioGraph();

    if (this.context.state === "suspended") {
      await this.context.resume();
    }

    return this.captureDestination?.stream || null;
  }

  async fetchSpeechBlob(text, token) {
    const response = await fetch("/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (token !== null && token !== undefined && token !== this.requestToken) {
      return null;
    }

    if (!response.ok) {
      let message = `Voice request failed (HTTP ${response.status}).`;
      try {
        const payload = await response.json();
        if (payload?.error) message = payload.error;
      } catch {
        // Keep the generic error if the response was not JSON.
      }

      throw new Error(message);
    }

    return response.blob();
  }

  async playPreparedBlob(blob, token) {
    if (!blob || token !== this.requestToken) {
      return { cancelled: true };
    }

    this.revokeCurrentUrl();
    this.currentUrl = URL.createObjectURL(blob);
    this.audio.src = this.currentUrl;
    this.audio.currentTime = 0;
    this.audio.playbackRate = this.playbackRate;

    const ended = new Promise((resolve) => {
      const onEnded = () => {
        this.audio.removeEventListener("ended", onEnded);
        resolve({ cancelled: token !== this.requestToken });
      };

      this.audio.addEventListener("ended", onEnded, { once: true });
    });

    await this.audio.play();
    return ended;
  }

  async speakContinuousAndWait(text) {
    const chunks = splitContinuousSpeech(text);

    if (!chunks.length) {
      throw new Error("Give him something to say first.");
    }

    const token = ++this.requestToken;
    this.stop({ invalidate: false });
    this.continuousQueueActive = true;
    this.onState("summoning");

    try {
      // Export can pre-generate the exact speech before recording starts.
      // Normal playback still falls back to generating all hidden chunks here.
      const prepared = this.takePreparedSpeech(text);
      const blobs =
        prepared ||
        (await Promise.all(
          chunks.map((chunk) => this.fetchSpeechBlob(chunk, token))
        ));

      if (token !== this.requestToken) {
        return { reason: "stopped", cancelled: true };
      }

      await this.ensureAudioGraph();
      if (this.context.state === "suspended") {
        await this.context.resume();
      }

      for (const blob of blobs) {
        if (token !== this.requestToken) {
          return { reason: "stopped", cancelled: true };
        }

        const result = await this.playPreparedBlob(blob, token);
        if (result?.cancelled) {
          return { reason: "stopped", cancelled: true };
        }
      }

      if (token !== this.requestToken) {
        return { reason: "stopped", cancelled: true };
      }

      this.continuousQueueActive = false;
      this.finishPlayback();
      return { reason: "ended", cancelled: false, chunks: chunks.length };
    } catch (error) {
      if (token === this.requestToken) {
        this.continuousQueueActive = false;
        this.angel?.setSpeaking(false);
        this.onState("error");
      }
      throw error;
    }
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
    this.audio.playbackRate = this.playbackRate;

    await this.audio.play();
  }

  stop({ invalidate = true } = {}) {
    if (invalidate) this.requestToken += 1;

    this.continuousQueueActive = false;
    this.resolvePlayback("stopped");
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.revokeCurrentUrl();

    this.energy.rms = 0;
    this.energy.low = 0;
    this.energy.high = 0;
    this.previousEnergy = 0;
    this.angel?.setSpeaking(false);
    this.onState("idle");
  }

  finishPlayback() {
    this.resolvePlayback("ended");
    this.energy.rms = 0;
    this.energy.low = 0;
    this.energy.high = 0;
    this.previousEnergy = 0;
    this.angel?.setSpeaking(false);
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
    return this.speakContinuousAndWait(text);
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

    const accentHit =
      onset > 0.26 &&
      scaledEnergy > 0.2 &&
      elapsed - this.lastAccentAt > 0.48;

    if (accentHit) {
      this.angel?.punctuateSpeech(0.22 + Math.min(0.58, onset * 0.62));
      this.accentIndex += 1;

      if (
        this.accentIndex % 4 === 0 &&
        elapsed - this.lastSpeechBlinkAt > 1.7
      ) {
        this.angel?.blink(elapsed);
        this.lastSpeechBlinkAt = elapsed;
      }

      this.lastAccentAt = elapsed;
    }

    const phraseHit =
      onset > 0.34 &&
      scaledEnergy > 0.3 &&
      elapsed - this.lastGestureAt > 2.15 &&
      !this.containment.active;

    if (phraseHit) {
      const intensity = 0.24 + Math.min(0.42, scaledEnergy * 0.42);
      const bassDominant = this.energy.low > this.energy.high * 1.2;
      const brightDominant = this.energy.high > this.energy.low * 1.16;

      const quietGestures = bassDominant
        ? ["judgment", "leanIn", "attractorDrift"]
        : brightDominant
          ? ["flare", "recoil", "leanIn"]
          : ["leanIn", "judgment", "flare", "attractorDrift"];

      const gesture =
        quietGestures[this.gestureIndex % quietGestures.length];

      this.gestureIndex += 1;
      this.containment.trigger(gesture, { intensity, elapsed });
      this.lastGestureAt = elapsed;
    }
  }

  dispose() {
    this.stop();
    this.preparedSpeech.clear();

    if (this.context) {
      this.context.close();
      this.context = null;
    }
  }
}
