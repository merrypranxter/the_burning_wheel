const BAYER_4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const LOOKS = {
  clean: {
    label: "CLEAN",
    ditherStrength: 0,
    levels: 256,
    scanlineStrength: 0,
    forceScale: 1,
  },
  "dither-monster": {
    label: "DITHER MONSTER",
    ditherStrength: 0.92,
    levels: 9,
    scanlineStrength: 0.035,
    forceScale: null,
  },
  "extra-fucked": {
    label: "EXTRA FUCKED",
    ditherStrength: 1.28,
    levels: 6,
    scanlineStrength: 0.095,
    forceScale: 0.25,
  },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function even(value) {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

export function resolveExportLook(
  look = "dither-monster",
  internalScale = 0.33
) {
  const preset = LOOKS[look] || LOOKS["dither-monster"];
  const requestedScale = clamp(Number(internalScale) || 0.33, 0.2, 1);

  let scale = preset.forceScale ?? requestedScale;

  if (look === "dither-monster") {
    scale = clamp(scale, 0.25, 0.66);
  }

  return {
    key: LOOKS[look] ? look : "dither-monster",
    ...preset,
    internalScale: scale,
  };
}

export function getInternalDimensions(
  width,
  height,
  look = "dither-monster",
  internalScale = 0.33
) {
  const config = resolveExportLook(look, internalScale);

  return {
    width: even(width * config.internalScale),
    height: even(height * config.internalScale),
    config,
  };
}

export function applyExportLook(
  imageData,
  {
    look = "dither-monster",
    internalScale = 0.33,
    frameIndex = 0,
  } = {}
) {
  const config = resolveExportLook(look, internalScale);

  if (config.key === "clean") {
    return imageData;
  }

  const { data, width, height } = imageData;
  const levels = Math.max(2, config.levels);
  const step = 255 / (levels - 1);
  const ditherAmplitude = step * config.ditherStrength;
  const extraFucked = config.key === "extra-fucked";

  for (let y = 0; y < height; y += 1) {
    const scanline =
      config.scanlineStrength > 0 && y % 4 === 3
        ? 1 - config.scanlineStrength
        : 1;

    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const threshold =
        ((BAYER_4[y % 4][x % 4] + 0.5) / 16 - 0.5) *
        ditherAmplitude;

      // Static ordered dithering keeps the live screenprint/pixel look without
      // turning every video frame into random snow.
      for (let channel = 0; channel < 3; channel += 1) {
        let value = data[index + channel] + threshold;

        if (extraFucked) {
          // Tiny deterministic channel bias makes the damaged preset feel like
          // a bad transfer without destroying legibility.
          const phase =
            ((x + y + channel * 3 + (frameIndex % 2)) % 7) - 3;
          value += phase * (channel === 1 ? 0.7 : 1.15);
        }

        value = Math.round(clamp(value, 0, 255) / step) * step;
        data[index + channel] = Math.round(clamp(value * scanline, 0, 255));
      }

      data[index + 3] = 255;
    }
  }

  return imageData;
}

export const EXPORT_LOOK_KEYS = Object.keys(LOOKS);
