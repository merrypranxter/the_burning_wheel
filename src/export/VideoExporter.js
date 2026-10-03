import {
  applyExportLook,
  drawGildedPixelFrame,
  getInternalDimensions,
} from "./ExportLooks.js";

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
    this.processingCanvas = null;
    this.processingContext = null;
    this.exportLook = "dither-monster";
    this.internalScale = 0.33;
    this.frameStyle = "none";
    this.frameIndex = 0;
  }

  captureFrame() {
    if (
      !this.active ||
      !this.captureCanvas ||
      !this.captureContext ||
      !this.processingCanvas ||
      !this.processingContext
    ) {
      return;
    }

    const finalCtx = this.captureContext;
    const processCtx = this.processingContext;
    const finalWidth = this.captureCanvas.width;
    const finalHeight = this.captureCanvas.height;
    const processWidth = this.processingCanvas.width;
    const processHeight = this.processingCanvas.height;
    const source = this.renderer.domElement;

    processCtx.save();
    processCtx.clearRect(0, 0, processWidth, processHeight);
    processCtx.imageSmoothingEnabled = false;

    const breach = Math.max(
      0,
      Math.min(1, Number(this.containment?.breachLevel) || 0)
    );

    if ("filter" in processCtx) {
      processCtx.filter =
        `saturate(${1 + breach * 3.8}) contrast(${1 + breach * 0.35})`;
    }

    // The WebGL renderer is deliberately running at the small internal
    // resolution during ugly export. Keep it native here: no smoothing.
    processCtx.drawImage(
      source,
      0,
      0,
      processWidth,
      processHeight
    );

    if ("filter" in processCtx) {
      processCtx.filter = "none";
    }

    const overlay = this.containment?.overlay;
    if (overlay?.width && overlay?.height) {
      // Composite containment/glitch effects BEFORE dithering so they belong
      // to the same busted artifact instead of looking pasted on afterward.
      processCtx.drawImage(
        overlay,
        0,
        0,
        processWidth,
        processHeight
      );
    }

    processCtx.restore();

    if (this.exportLook !== "clean") {
      const image = processCtx.getImageData(
        0,
        0,
        processWidth,
        processHeight
      );

      applyExportLook(image, {
        look: this.exportLook,
        internalScale: this.internalScale,
        frameIndex: this.frameIndex,
      });

      processCtx.putImageData(image, 0, 0);
    }

    drawGildedPixelFrame(
      processCtx,
      processWidth,
      processHeight,
      this.frameStyle
    );

    finalCtx.save();
    finalCtx.clearRect(0, 0, finalWidth, finalHeight);
    finalCtx.imageSmoothingEnabled = false;

    // High-resolution container, low-resolution soul.
    finalCtx.drawImage(
      this.processingCanvas,
      0,
      0,
      processWidth,
      processHeight,
      0,
      0,
      finalWidth,
      finalHeight
    );

    finalCtx.restore();
    this.frameIndex += 1;
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
    {
      aspect = "16:9",
      resolution = 720,
      frameRate = 30,
      look = "dither-monster",
      internalScale = 0.33,
      frameStyle = "none",
    } = {}
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
    const {
      width: internalWidth,
      height: internalHeight,
      config: lookConfig,
    } = getInternalDimensions(
      width,
      height,
      look,
      internalScale
    );

    let recorder = null;
    let videoStream = null;
    let combinedStream = null;
    const chunks = [];

    this.active = true;
    this.exportLook = lookConfig.key;
    this.internalScale = lookConfig.internalScale;
    this.frameStyle = frameStyle === "gilded-pixel" ? "gilded-pixel" : "none";
    this.frameIndex = 0;

    try {
      this.onState("preparing", `PREPARING AUDIO // ${width}×${height}`);

      this.performanceEngine.stop({ silent: true });
      await this.performanceEngine.prepare(script);

      const audioStream = await this.voice.getRecordingStream();
      if (!audioStream?.getAudioTracks().length) {
        throw new Error("Could not create the export audio track.");
      }

      this.onState(
        "framing",
        `FRAMING // ${aspect} // ${resolution}P // ${lookConfig.label}${this.frameStyle === "gilded-pixel" ? " // GILDED FRAME" : ""}`
      );

      // The scene itself renders at the intentionally ugly internal size.
      // The recorder canvas stays at the requested final delivery size.
      this.setExportViewport(
        internalWidth,
        internalHeight,
        aspect
      );

      this.captureCanvas = document.createElement("canvas");
      this.captureCanvas.width = width;
      this.captureCanvas.height = height;
      this.captureContext = this.captureCanvas.getContext("2d", {
        alpha: false,
      });

      if (!this.captureContext) {
        throw new Error("Could not create the export canvas.");
      }

      this.captureContext.imageSmoothingEnabled = false;

      this.processingCanvas = document.createElement("canvas");
      this.processingCanvas.width = internalWidth;
      this.processingCanvas.height = internalHeight;
      this.processingContext = this.processingCanvas.getContext("2d", {
        alpha: false,
        willReadFrequently: this.exportLook !== "clean",
      });

      if (!this.processingContext) {
        throw new Error("Could not create the dither canvas.");
      }

      this.processingContext.imageSmoothingEnabled = false;

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
      this.onState(
        "recording",
        `RECORDING // ${width}×${height} // INTERNAL ${internalWidth}×${internalHeight} // ${lookConfig.label}${this.frameStyle === "gilded-pixel" ? " // GILDED FRAME" : ""}`
      );

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
        look: lookConfig.key,
        internalScale: lookConfig.internalScale,
        internalWidth,
        internalHeight,
        frameStyle: this.frameStyle,
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
      this.processingCanvas = null;
      this.processingContext = null;
      this.active = false;
      this.restoreViewport();
    }
  }
}

export const VIDEO_EXPORT_ASPECTS = Object.keys(ASPECTS);
