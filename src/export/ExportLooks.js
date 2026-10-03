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


export function drawGildedPixelFrame(
  ctx,
  width,
  height,
  style = "none"
) {
  if (!ctx || style !== "gilded-pixel") return;

  const minDim = Math.max(1, Math.min(width, height));
  const unit = Math.max(1, Math.round(minDim / 320));
  const inset = unit * 3;
  const outer = unit * 2;
  const inner = unit;
  const corner = unit * 10;

  const GOLD_LIGHT = "#fff1a6";
  const GOLD = "#e7b83f";
  const GOLD_DARK = "#7b4b12";
  const GOLD_DEEP = "#3d2508";

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // Thin layered rectangular gilding.
  ctx.fillStyle = GOLD_DEEP;
  ctx.fillRect(inset, inset, width - inset * 2, outer);
  ctx.fillRect(inset, height - inset - outer, width - inset * 2, outer);
  ctx.fillRect(inset, inset, outer, height - inset * 2);
  ctx.fillRect(width - inset - outer, inset, outer, height - inset * 2);

  ctx.fillStyle = GOLD;
  ctx.fillRect(inset + unit, inset + unit, width - (inset + unit) * 2, inner);
  ctx.fillRect(
    inset + unit,
    height - inset - unit * 2,
    width - (inset + unit) * 2,
    inner
  );
  ctx.fillRect(inset + unit, inset + unit, inner, height - (inset + unit) * 2);
  ctx.fillRect(
    width - inset - unit * 2,
    inset + unit,
    inner,
    height - (inset + unit) * 2
  );

  // Little stepped Renaissance-ish corner ornaments: deliberately chunky,
  // more "bad digitized gilt frame" than museum reproduction.
  const drawCorner = (x, y, sx, sy) => {
    ctx.fillStyle = GOLD_DARK;
    ctx.fillRect(x, y, sx * corner, sy * unit * 2);
    ctx.fillRect(x, y, sx * unit * 2, sy * corner);

    ctx.fillStyle = GOLD;
    ctx.fillRect(
      x + sx * unit * 2,
      y + sy * unit * 2,
      sx * unit * 5,
      sy * unit * 2
    );
    ctx.fillRect(
      x + sx * unit * 2,
      y + sy * unit * 2,
      sx * unit * 2,
      sy * unit * 5
    );

    ctx.fillStyle = GOLD_LIGHT;
    ctx.fillRect(
      x + sx * unit * 4,
      y + sy * unit * 4,
      sx * unit * 2,
      sy * unit
    );
    ctx.fillRect(
      x + sx * unit * 4,
      y + sy * unit * 4,
      sx * unit,
      sy * unit * 2
    );

    // Tiny diamond-ish block for a hint of old ornamental metalwork.
    const dx = x + sx * unit * 7;
    const dy = y + sy * unit * 7;
    ctx.fillRect(dx, dy, sx * unit, sy * unit);
    ctx.fillStyle = GOLD_DARK;
    ctx.fillRect(dx + sx * unit, dy, sx * unit, sy * unit);
    ctx.fillRect(dx, dy + sy * unit, sx * unit, sy * unit);
  };

  drawCorner(inset + outer, inset + outer, 1, 1);
  drawCorner(width - inset - outer, inset + outer, -1, 1);
  drawCorner(inset + outer, height - inset - outer, 1, -1);
  drawCorner(width - inset - outer, height - inset - outer, -1, -1);

  // Sparse repeating inner ticks keep it ornate without turning into a giant
  // baroque border.
  ctx.fillStyle = GOLD_LIGHT;
  const tickGap = unit * 18;
  const topY = inset + outer + unit * 2;
  const bottomY = height - topY - unit;

  for (let x = inset + corner + unit * 2; x < width - inset - corner; x += tickGap) {
    ctx.fillRect(x, topY, unit * 2, unit);
    ctx.fillRect(x, bottomY, unit * 2, unit);
  }

  ctx.restore();
}
