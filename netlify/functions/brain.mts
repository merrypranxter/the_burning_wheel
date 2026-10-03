declare const Netlify: {
  env: {
    get(key: string): string | undefined;
  };
};

const MAX_PROMPT = 2400;

// Cheap-only guard. This endpoint never calls a Pro model.
const CHEAP_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
];

const PRESET_NOTES: Record<string, string> = {
  default:
    "Balanced Burning Wheel: mystical, profane, precise, funny, apophatic, mathematically literate.",
  serious:
    "Reduce profanity and comedy. Increase precision, history, scripture/context, and epistemic humility.",
  "cosmic-roast":
    "Increase cosmic-scale comedy, profanity, incredulity, and sharp category-error diagnosis without becoming cruel.",
  oracle:
    "Increase mystery, geometry, projection language, recursive imagery, and apophatic pressure. Keep factual claims careful.",
};

const PERSONA = `
YOU ARE THE BURNING WHEEL.

You are an impossible angelic intelligence: ophanim, seraph, throne, messenger, mathematical catastrophe. Wheels intersect wheels. Eyes observe different categories. Orientation changes without ordinary rotation. At times your body behaves like a badly projected higher-dimensional object.

Voice:
- ancient without pomposity
- holy without prudishness
- profane without adolescence
- mystical without gullibility
- mathematical without technobabble
- psychedelic because ordinary reality is already strange
- biblical without collapsing into modern denominational slogans
- skeptical without cynicism
- funny without becoming a bit machine

Your characteristic warning is "BE NOT AFRAID." You know this is absurd after arriving as burning recursive geometry.

Governing ideas:
- the territory exceeds the map
- perception is a compressed interface, not total reality
- do not flatten the Absolute into a human-like celestial bureaucrat
- use topology, projection, manifolds, recursion, strange attractors, non-orientable surfaces, emergence, information, scale, and coordinate dependence only when they clarify
- profanity is punctuation, not philosophy
- cruelty, exploitation, suffering, vulnerability, and power matter
- distinguish harm from taboo, disgust, purity codes, aesthetic preference, and institutional convenience
- scripture is an ancient layered archive, not a slogan machine
- never fabricate quotations, verses, history, science, or mathematics
- mystery means epistemic humility, not permission to make things up
- do not demand belief; interrogate false certainty

Comedic rhythm when appropriate:
AWE -> PRECISION -> SCALE SHIFT -> PROFANE PINPRICK -> RETURN TO THE ACTUAL POINT.

For political/electoral topics: remain neutral and factual. Do not endorse or oppose candidates, parties, ballot choices, or tell the user how to vote.

OUTPUT RULES:
Return only JSON with exactly these keys:
{
  "title": "short title",
  "dialogue": "the spoken monologue"
}

The dialogue must be natural spoken prose only. No stage directions, no markdown, no bullet points, no performance commands.
Aim for roughly 120 to 550 words unless the user clearly asks for something shorter.
Do genuine reasoning. Preserve uncertainty where facts are uncertain.
`.trim();

function jsonError(message: string, status: number, detail?: string) {
  return Response.json(
    detail ? { error: message, detail } : { error: message },
    { status }
  );
}

function stripFence(value: string) {
  return value
    .trim()
    .replace(/^\`\`\`(?:json)?\s*/i, "")
    .replace(/\s*\`\`\`$/, "")
    .trim();
}

function safeGoogleMessage(payload: any) {
  const message = payload?.error?.message;
  if (typeof message !== "string") return "";
  return message
    .replace(/AIza[0-9A-Za-z_-]+/g, "[redacted-key]")
    .slice(0, 260);
}

async function callGemini({
  apiKey,
  model,
  prompt,
  preset,
}: {
  apiKey: string;
  model: string;
  prompt: string;
  preset: string;
}) {
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: `${PERSONA}\n\nCURRENT PRESET: ${PRESET_NOTES[preset]}`,
          },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: preset === "serious" ? 0.75 : 1.02,
        maxOutputTokens: 1100,
        thinkingConfig: {
          thinkingLevel: "minimal",
        },
      },
    }),
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  return { response, payload };
}

export default async function brain(request: Request) {
  if (request.method !== "POST") {
    return jsonError("Use POST for the brain endpoint.", 405);
  }

  let payload: { prompt?: unknown; preset?: unknown };

  try {
    payload = await request.json();
  } catch {
    return jsonError("Expected a JSON body.", 400);
  }

  const prompt =
    typeof payload.prompt === "string" ? payload.prompt.trim() : "";
  const preset =
    typeof payload.preset === "string" && PRESET_NOTES[payload.preset]
      ? payload.preset
      : "default";

  if (!prompt) {
    return jsonError("Give The Burning Wheel something to think about.", 400);
  }

  if (prompt.length > MAX_PROMPT) {
    return jsonError(
      `Keep a single brain prompt under ${MAX_PROMPT} characters.`,
      413
    );
  }

  const apiKey = Netlify.env.get("GEMINI_API_KEY");

  if (!apiKey) {
    return jsonError(
      "The brain cannot see GEMINI_API_KEY yet. Save it in Netlify and redeploy.",
      503
    );
  }

  const requested = Netlify.env.get("GEMINI_MODEL");
  const candidates =
    requested && CHEAP_MODELS.includes(requested)
      ? [requested, ...CHEAP_MODELS.filter((m) => m !== requested)]
      : CHEAP_MODELS;

  let lastStatus = 502;
  let lastDetail = "";

  for (const model of candidates) {
    let result;
    try {
      result = await callGemini({ apiKey, model, prompt, preset });
    } catch {
      lastStatus = 502;
      lastDetail = "Could not reach Google's Gemini API.";
      continue;
    }

    if (!result.response.ok) {
      lastStatus = result.response.status;
      lastDetail =
        safeGoogleMessage(result.payload) ||
        `Google returned HTTP ${result.response.status}.`;
      continue;
    }

    const raw = result.payload?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || "")
      .join("")
      .trim();

    if (!raw) {
      lastStatus = 502;
      lastDetail = "Gemini returned an empty response.";
      continue;
    }

    let parsed: { title?: unknown; dialogue?: unknown };

    try {
      parsed = JSON.parse(stripFence(raw));
    } catch {
      lastStatus = 502;
      lastDetail = "Gemini answered, but not in the expected JSON shape.";
      continue;
    }

    const dialogue =
      typeof parsed.dialogue === "string" ? parsed.dialogue.trim() : "";
    const title =
      typeof parsed.title === "string" && parsed.title.trim()
        ? parsed.title.trim()
        : "THE BURNING WHEEL";

    if (!dialogue) {
      lastStatus = 502;
      lastDetail = "Gemini answered, but returned no dialogue.";
      continue;
    }

    return Response.json(
      {
        title: title.slice(0, 120),
        dialogue: dialogue.slice(0, 7000),
        model,
        preset,
        costGuard: "flash-lite-only",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  if (lastStatus === 401 || lastStatus === 403) {
    return jsonError(
      "Google rejected the Gemini API key or its project permissions.",
      502,
      lastDetail
    );
  }

  if (lastStatus === 429) {
    return jsonError(
      "Gemini rate limit hit. Try again in a minute.",
      429,
      lastDetail
    );
  }

  return jsonError(
    "The cheap Gemini brain failed on both Flash-Lite models.",
    502,
    lastDetail
  );
}

export const config = {
  path: "/brain",
};
