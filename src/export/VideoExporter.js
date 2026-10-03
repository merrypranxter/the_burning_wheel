const ASPECTS = {
  "9:16": [9, 16],
  "16:9": [16, 9],
  "1:1": [1, 1],
  "4:3": [4, 3],
  "3:4": [3, 4],
};

const RESOLUTIONS = new Set([480, 720, 1080]);

function even(value) {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

export function getExportDimensions(aspectKey = "16:9", resolution = 720) {
  const [rw, rh] = ASPECTS[aspectKey] || ASPECTS["16:9"];
  const base = RESOLUTIONS.has(Number(resolution))
    ? Number(resolution)
    : 720;
  const ratio = rw / rh;

  if (ratio > 1) {
    return {
      width: even(base * ratio),
      height: even(base),
      ratio,
    };
  }

  if (ratio < 1) {
    return {
      width: even(base),
      height: even(base / ratio),
      ratio,
    };
  }

  return {
    width: even(base),
    height: even(base),
    ratio: 1,
  };
}

function pickMimeType() {
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];

  if (typeof MediaRecorder === "undefined") return "";

  for (const mimeType of candidates) {
    if (
      typeof MediaRecorder.isTypeSupported !== "function" ||
      MediaRecorder.isTypeSupported(mimeType)
    ) {
      return mimeType;
    }
  }

  return "";
}

function videoBitrateFor(width, height) {
  const pixels = width * height;

  if (pixels >= 1920 * 1080) return 14_000_000;
  if (pixels >= 1280 * 720) return 8_000_000;
  return 4_500_000;
}

function waitFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class VideoExporter {
  constructor({
    renderer,
    containment,
    voice,
    performanceEngine,
    setExportViewport,
    restoreViewport,
    onState = () => {},
  }) {
    this.renderer = renderer;
    this.containment = containment;
    this.voice = voice;
    this.performanceEngine = performanceEngine;
    this.setExportViewport = setExportViewport;
    this.restoreViewport = restoreViewport;
    this.onState = onState;

    this.active = false;
    this.captureCanvas = null;
    this.captureContext = null;
  }

  captureFrame() {
    if (!this.active || !this.captureCanvas || !this.captureContext) return;

    const ctx = this.captureContext;
    const width = this.captureCanvas.width;
    const height = this.captureCanvas.height;
    const source = this.renderer.domElement;

    ctx.save();
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;

    const breach = Math.max(
      0,
      Math.min(1, Number(this.containment?.breachLevel) || 0)
    );

    if ("filter" in ctx) {
      ctx.filter =
        `saturate(${1 + breach * 3.8}) contrast(${1 + breach * 0.35})`;
    }

    ctx.drawImage(source, 0, 0, width, height);

    if ("filter" in ctx) {
      ctx.filter = "none";
    }

    const overlay = this.containment?.overlay;
    if (overlay?.width && overlay?.height) {
      ctx.drawImage(overlay, 0, 0, width, height);
    }

    ctx.restore();
  }

  createRecorder(stream, width, height) {
    const mimeType = pickMimeType();
    const options = {
      videoBitsPerSecond: videoBitrateFor(width, height),
      audioBitsPerSecond: 192_000,
    };

    if (mimeType) options.mimeType = mimeType;

    try {
      return new MediaRecorder(stream, options);
    } catch {
      return new MediaRecorder(stream);
    }
  }

  async exportSkit(
    source,
    { aspect = "16:9", resolution = 720, frameRate = 30 } = {}
  ) {
    if (this.active) {
      throw new Error("An export is already running.");
    }

    if (typeof MediaRecorder === "undefined") {
      throw new Error("This browser does not support video recording.");
    }

    const probe = document.createElement("canvas");
    if (typeof probe.captureStream !== "function") {
      throw new Error("This browser cannot capture the stage canvas.");
    }

    const script = String(source || "").trim();
    if (!script) {
      throw new Error("Give the exporter a skit first.");
    }

    const { width, height } = getExportDimensions(aspect, resolution);
    let recorder = null;
    let videoStream = null;
    let combinedStream = null;
    const chunks = [];

    this.active = true;

    try {
      this.onState("preparing", `PREPARING AUDIO // ${width}×${height}`);

      this.performanceEngine.stop({ silent: true });
      await this.performanceEngine.prepare(script);

      const audioStream = await this.voice.getRecordingStream();
      if (!audioStream?.getAudioTracks().length) {
        throw new Error("Could not create the export audio track.");
      }

      this.onState("framing", `FRAMING // ${aspect} // ${resolution}P`);
      this.setExportViewport(width, height, aspect);

      this.captureCanvas = document.createElement("canvas");
      this.captureCanvas.width = width;
      this.captureCanvas.height = height;
      this.captureContext = this.captureCanvas.getContext("2d", {
        alpha: false,
      });

      if (!this.captureContext) {
        throw new Error("Could not create the export canvas.");
      }

      await waitFrame();
      await waitFrame();
      this.captureFrame();

      videoStream = this.captureCanvas.captureStream(frameRate);
      const videoTracks = videoStream.getVideoTracks();
      const audioTracks = audioStream.getAudioTracks();

      combinedStream = new MediaStream([...videoTracks, ...audioTracks]);
      recorder = this.createRecorder(combinedStream, width, height);

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data?.size) chunks.push(event.data);
      });

      const stopped = new Promise((resolve, reject) => {
        recorder.addEventListener("stop", resolve, { once: true });
        recorder.addEventListener(
          "error",
          (event) => reject(event.error || new Error("Recorder failed.")),
          { once: true }
        );
      });

      recorder.start(250);
      this.onState("recording", `RECORDING // ${width}×${height}`);

      const result = await this.performanceEngine.run(script);

      // Keep the final pose for a fraction of a second so the file does not
      // end on the same tick as the last syllable.
      await wait(220);
      this.captureFrame();

      if (recorder.state !== "inactive") {
        recorder.stop();
      }

      await stopped;

      const type =
        recorder.mimeType ||
        chunks.find((chunk) => chunk.type)?.type ||
        "video/webm";

      const blob = new Blob(chunks, { type });
      if (!blob.size) {
        throw new Error("The browser produced an empty video file.");
      }

      const extension = type.includes("mp4") ? "mp4" : "webm";

      this.onState(
        result?.cancelled ? "ready" : "complete",
        result?.cancelled ? "PARTIAL VIDEO READY" : "VIDEO READY"
      );

      return {
        blob,
        type,
        extension,
        width,
        height,
        aspect,
        resolution: Number(resolution),
        cancelled: Boolean(result?.cancelled),
      };
    } finally {
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          // Recorder may already be tearing down after an error.
        }
      }

      videoStream?.getTracks().forEach((track) => track.stop());
      combinedStream = null;

      this.captureCanvas = null;
      this.captureContext = null;
      this.active = false;
      this.restoreViewport();
    }
  }
}

export const VIDEO_EXPORT_ASPECTS = Object.keys(ASPECTS);
