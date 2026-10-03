const EYES = [
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
];

const GESTURES = [
  "leanIn",
  "recoil",
  "judgment",
  "flare",
  "attractorDrift",
  "orientationSlip",
  "mobiusFlip",
  "projectionError",
  "dimensionStutter",
];

const SEVERE_GESTURES = new Set([
  "orientationSlip",
  "mobiusFlip",
  "projectionError",
  "dimensionStutter",
]);

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeWhitespace(value) {
  return String(value || "")
    .replace(/[\t ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

function splitSentences(paragraph) {
  const text = paragraph.trim();
  if (!text) return [];

  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
    return [...segmenter.segment(text)]
      .map((item) => item.segment.trim())
      .filter(Boolean);
  }

  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“‘])/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function chunkParagraph(paragraph, maxLength = 460) {
  const sentences = splitSentences(paragraph);
  const chunks = [];
  let current = "";

  for (const sentence of sentences) {
    if (!current) {
      current = sentence;
      continue;
    }

    if ((current + " " + sentence).length <= maxLength) {
      current += " " + sentence;
    } else {
      chunks.push(current);
      current = sentence;
    }
  }

  if (current) chunks.push(current);

  // A single enormous "sentence" still needs to fit the voice endpoint.
  return chunks.flatMap((chunk) => {
    if (chunk.length <= maxLength) return [chunk];

    const pieces = [];
    let remaining = chunk;

    while (remaining.length > maxLength) {
      let cut = remaining.lastIndexOf(" ", maxLength);
      if (cut < maxLength * 0.55) cut = maxLength;
      pieces.push(remaining.slice(0, cut).trim());
      remaining = remaining.slice(cut).trim();
    }

    if (remaining) pieces.push(remaining);
    return pieces;
  });
}

function scoreSignals(text) {
  const lower = text.toLowerCase();

  const has = (pattern) => pattern.test(lower);
  const profanity = (lower.match(/\b(fuck|fucking|shit|damn|hell|motherfucker)\b/g) || []).length;
  const capsWords = (text.match(/\b[A-Z]{3,}\b/g) || []).length;

  return {
    question: /\?/.test(text),
    exclaim: /!/.test(text),
    laugh: has(/\b(lol|funny|comedy|ridiculous|absurd|hilarious)\b/),
    contempt: has(/\b(bigot|bigotry|purity|tribal|bureaucrat|taboo|cruelty|exploitation|judge|judging)\b/),
    theology: has(/\b(god|absolute|infinite|theology|tetragrammaton|apophatic|divine|creator|being)\b/),
    math: has(/\b(fractal|topology|manifold|calabi|geometry|dimension|dimensional|flatland|cross-section|shader|glsl|quantum)\b/),
    reality: has(/\b(reality|existence|metaphysics|ontolog|render|simulation|perception|language|noun)\b/),
    body: has(/\b(sex|genital|skin|biological|urge|pleasure|touch)\b/),
    certainty: has(/\b(certainty|knowledge|claim|announce|authority|law)\b/),
    expansive: has(/\b(quasar|black hole|dark matter|universe|infinite|vast|hurricane|stars|spacetime)\b/),
    profanity,
    capsWords,
  };
}

function chooseEye(text, index) {
  const s = scoreSignals(text);

  if (s.question) return index % 2 ? "sideEye" : "suspicious";
  if (s.contempt && s.certainty) return "deadpan";
  if (s.contempt) return "suspicious";
  if (s.laugh) return "smug";
  if (s.capsWords >= 2 || s.exclaim) return "wide";
  if (s.expansive || s.theology) return index % 3 === 0 ? "wide" : "neutral";
  if (s.body) return "smug";
  if (s.math || s.reality) return index % 2 ? "sideEye" : "neutral";
  if (s.profanity >= 2) return "wtf";

  const deterministic = hashString(text + ":" + index) % 5;
  return ["neutral", "smug", "deadpan", "sideEye", "neutral"][deterministic];
}

function chooseGesture(text, index, severeCooldown) {
  const s = scoreSignals(text);
  let name = null;
  let intensity = 0.34;

  if (s.math && /\b(topology|mobius|möbius|loop|recursive)\b/i.test(text)) {
    name = "mobiusFlip";
    intensity = 0.38;
  } else if (
    s.math &&
    /\b(dimension|dimensional|flatland|cross-section|projection)\b/i.test(text)
  ) {
    name = "orientationSlip";
    intensity = 0.42;
  } else if (
    s.reality &&
    /\b(simulation|render|dashboard|perception|reality)\b/i.test(text)
  ) {
    name = "projectionError";
    intensity = 0.38;
  } else if (s.contempt) {
    name = "judgment";
    intensity = 0.42 + Math.min(0.2, s.profanity * 0.04);
  } else if (s.expansive || (s.theology && s.capsWords > 0)) {
    name = "flare";
    intensity = 0.36 + Math.min(0.16, s.capsWords * 0.04);
  } else if (s.question) {
    name = "leanIn";
    intensity = 0.32;
  } else if (s.math || s.theology || s.reality) {
    name = "attractorDrift";
    intensity = 0.3;
  } else if (s.laugh) {
    name = "leanIn";
    intensity = 0.28;
  }

  if (!name) {
    const roll = hashString(text + ":" + index) % 7;
    if (roll === 0) {
      name = "attractorDrift";
      intensity = 0.24;
    }
  }

  if (name && SEVERE_GESTURES.has(name) && severeCooldown > 0) {
    // Preserve the shape of the performance without turning every line into
    // a containment breach.
    name = index % 2 ? "attractorDrift" : "flare";
    intensity = Math.min(intensity, 0.32);
  }

  return name
    ? {
        name,
        intensity: clamp(intensity, 0.18, 0.72),
        severe: SEVERE_GESTURES.has(name),
      }
    : null;
}

function chooseBeat(text, paragraphBreak = false) {
  const s = scoreSignals(text);

  if (paragraphBreak) return 420;
  if (s.question) return 260;
  if (s.capsWords >= 2) return 300;
  if (s.contempt) return 250;
  if (s.laugh) return 180;

  return 180 + (hashString(text) % 120);
}

export function directDialogue(source, { title = "AUTO-DIRECTED RANT" } = {}) {
  const normalized = normalizeWhitespace(source);

  if (!normalized) {
    return {
      script: "",
      stats: { chunks: 0, gestures: 0, severeGestures: 0 },
    };
  }

  const paragraphs = normalized
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const speechText = paragraphs.join("\n");
  const eye = chooseEye(speechText, 0);
  const hold = 4 + ((hashString(speechText) % 20) / 10);
  const gesture = chooseGesture(speechText, 0, 0);

  const lines = [
    `# ${title}`,
    "# generated locally by AutoDirector — continuous rant mode",
    "AUTOCHAOS OFF",
    "RESET",
    `EYE ${eye} ${hold.toFixed(1)}`,
  ];

  let gestureCount = 0;
  let severeCount = 0;

  if (gesture) {
    lines.push(
      `GESTURE ${gesture.name} ${gesture.intensity.toFixed(2)}`
    );
    gestureCount = 1;
    severeCount = gesture.severe ? 1 : 0;
  }

  if (/\b(blink|look|stare|eye)\b/i.test(speechText)) {
    lines.push("BLINK");
  }

  // RANT is a readable multiline block in the skit editor, but the voice
  // controller flattens it and prefetches hidden TTS chunks before playback.
  // Result: one continuous delivery instead of paragraph-by-paragraph dead air.
  lines.push("RANT", ...paragraphs, "ENDRANT");

  lines.push("EYE neutral 0", "AUTOCHAOS ON");

  return {
    script: lines.join("\n"),
    stats: {
      chunks: 1,
      gestures: gestureCount,
      severeGestures: severeCount,
    },
  };
}

export const AUTO_DIRECTOR_EYES = EYES;
export const AUTO_DIRECTOR_GESTURES = GESTURES;
