const VALID_EYES = new Set([
  "neutral",
  "smug",
  "suspicious",
  "wide",
  "offended",
  "delighted",
  "deadpan",
  "sideEye",
  "eyeRoll",
  "wtf",
]);

const VALID_GESTURES = new Set([
  "leanIn",
  "recoil",
  "judgment",
  "flare",
  "attractorDrift",
  "orientationSlip",
  "mobiusFlip",
  "projectionError",
  "dimensionStutter",
]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parseDuration(value, fallbackMs = 250) {
  if (!value) return fallbackMs;

  const token = String(value).trim().toLowerCase();

  if (token.endsWith("ms")) {
    const ms = Number(token.slice(0, -2));
    return Number.isFinite(ms) ? Math.max(0, ms) : fallbackMs;
  }

  if (token.endsWith("s")) {
    const seconds = Number(token.slice(0, -1));
    return Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : fallbackMs;
  }

  const seconds = Number(token);
  return Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : fallbackMs;
}

function splitCommand(line) {
  const firstSpace = line.search(/\s/);
  if (firstSpace === -1) {
    return { command: line.toUpperCase(), rest: "" };
  }

  return {
    command: line.slice(0, firstSpace).toUpperCase(),
    rest: line.slice(firstSpace + 1).trim(),
  };
}

export function parsePerformanceScript(source) {
  const steps = [];
  const errors = [];

  String(source || "")
    .split(/\r?\n/)
    .forEach((rawLine, index) => {
      const lineNumber = index + 1;
      const line = rawLine.trim();

      if (!line || line.startsWith("#") || line.startsWith("//")) return;

      const { command, rest } = splitCommand(line);

      if (command === "SAY") {
        if (!rest) {
          errors.push(`Line ${lineNumber}: SAY needs words.`);
          return;
        }
        steps.push({ type: "say", text: rest, lineNumber });
        return;
      }

      if (command === "EYE") {
        const [name = "neutral", hold = "2.4"] = rest.split(/\s+/);
        if (!VALID_EYES.has(name)) {
          errors.push(
            `Line ${lineNumber}: unknown eye "${name}". Try ${[...VALID_EYES].join(", ")}.`
          );
          return;
        }

        steps.push({
          type: "eye",
          name,
          holdSeconds: Math.max(0, Number(hold) || 0),
          lineNumber,
        });
        return;
      }

      if (command === "GESTURE" || command === "BREACH") {
        const [name, rawIntensity = "1"] = rest.split(/\s+/);
        if (!VALID_GESTURES.has(name)) {
          errors.push(
            `Line ${lineNumber}: unknown gesture "${name || ""}". Try ${[
              ...VALID_GESTURES,
            ].join(", ")}.`
          );
          return;
        }

        steps.push({
          type: "gesture",
          name,
          intensity: clamp(Number(rawIntensity) || 1, 0.1, 1.35),
          lineNumber,
        });
        return;
      }

      if (command === "WAIT") {
        steps.push({
          type: "wait",
          durationMs: parseDuration(rest, 250),
          lineNumber,
        });
        return;
      }

      if (command === "BEAT") {
        steps.push({
          type: "wait",
          durationMs: parseDuration(rest, 180),
          lineNumber,
        });
        return;
      }

      if (command === "BLINK") {
        steps.push({ type: "blink", lineNumber });
        return;
      }

      if (command === "AUTOCHAOS") {
        const value = rest.toUpperCase();
        if (value !== "ON" && value !== "OFF") {
          errors.push(`Line ${lineNumber}: AUTOCHAOS expects ON or OFF.`);
          return;
        }
        steps.push({
          type: "autoChaos",
          enabled: value === "ON",
          lineNumber,
        });
        return;
      }

      if (command === "RESET") {
        steps.push({ type: "reset", lineNumber });
        return;
      }

      errors.push(
        `Line ${lineNumber}: unknown command "${command}". Use SAY, EYE, GESTURE, WAIT, BEAT, BLINK, AUTOCHAOS, or RESET.`
      );
    });

  return { steps, errors };
}

export class PerformanceEngine {
  constructor({
    angel,
    containment,
    voice,
    getElapsed = () => 0,
    onState = () => {},
    onStep = () => {},
  }) {
    this.angel = angel;
    this.containment = containment;
    this.voice = voice;
    this.getElapsed = getElapsed;
    this.onState = onState;
    this.onStep = onStep;

    this.runToken = 0;
    this.running = false;
    this.currentStep = -1;
  }

  async run(source) {
    const { steps, errors } = parsePerformanceScript(source);

    if (errors.length) {
      const error = new Error(errors.join("\n"));
      this.onState("error", error.message);
      throw error;
    }

    if (!steps.length) {
      const error = new Error("The skit is empty.");
      this.onState("error", error.message);
      throw error;
    }

    this.stop({ silent: true });

    const token = ++this.runToken;
    this.running = true;
    this.currentStep = -1;
    this.onState("running", `0 / ${steps.length}`);

    try {
      for (let index = 0; index < steps.length; index += 1) {
        if (token !== this.runToken) return { cancelled: true };

        const step = steps[index];
        this.currentStep = index;
        this.onStep(step, index, steps.length);
        this.onState("running", `${index + 1} / ${steps.length}`);

        const result = await this.executeStep(step, token);

        if (result?.cancelled || token !== this.runToken) {
          this.running = false;
          this.currentStep = -1;
          this.onState("idle", "cancelled");
          return { cancelled: true };
        }
      }

      if (token !== this.runToken) {
        this.running = false;
        this.currentStep = -1;
        this.onState("idle", "cancelled");
        return { cancelled: true };
      }

      this.running = false;
      this.currentStep = -1;
      this.onState("complete", `${steps.length} steps`);
      return { cancelled: false, steps: steps.length };
    } catch (error) {
      if (token !== this.runToken) return { cancelled: true };

      this.running = false;
      this.currentStep = -1;
      this.onState("error", error?.message || "Performance failed.");
      throw error;
    }
  }

  async executeStep(step, token) {
    const elapsed = this.getElapsed();

    switch (step.type) {
      case "say": {
        const result = await this.voice.speakAndWait(step.text);
        if (token !== this.runToken) return { cancelled: true };
        return result;
      }

      case "eye":
        this.angel.setExpression(
          step.name,
          step.name === "neutral" ? 0 : step.holdSeconds,
          elapsed
        );
        return null;

      case "gesture":
        this.containment.trigger(step.name, {
          intensity: step.intensity,
          elapsed,
        });
        return null;

      case "wait":
        return this.wait(step.durationMs, token);

      case "blink":
        this.angel.blink(elapsed);
        return null;

      case "autoChaos":
        this.containment.setAutoChaos(step.enabled);
        return null;

      case "reset":
        this.containment.reset();
        return null;

      default:
        return null;
    }
  }

  wait(durationMs, token) {
    return new Promise((resolve) => {
      const startedAt = performance.now();

      const tick = (now) => {
        if (token !== this.runToken) {
          resolve({ cancelled: true });
          return;
        }

        if (now - startedAt >= durationMs) {
          resolve({ cancelled: false });
          return;
        }

        requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    });
  }

  stop({ silent = false } = {}) {
    this.runToken += 1;
    this.running = false;
    this.currentStep = -1;
    this.voice.stop();

    if (!silent) {
      this.onState("idle", "stopped");
    }
  }
}
