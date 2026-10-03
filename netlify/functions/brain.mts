declare const Netlify: {
  env: {
    get(key: string): string | undefined;
  };
};

const MAX_PROMPT = 2400;

// Cost guard: this endpoint is intentionally not allowed to drift upward into
// Pro-tier models. Add another model here only after explicitly deciding its cost.
const CHEAP_MODELS = new Set([
  "gemini-3.1-flash-lite",
]);

const DEFAULT_MODEL = "gemini-3.1-flash-lite";

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

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function stripFence(value: string) {
  return value
    .trim()
    .replace(/^\`\`\`(?:json)?\s*/i, "")
    .replace(/\s*\`\`\`$/, "")
    .trim();
}

export default async function brain(request: Request) {
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
  const requestedModel = Netlify.env.get("GEMINI_MODEL") || DEFAULT_MODEL;
  const model = CHEAP_MODELS.has(requestedModel)
    ? requestedModel
    : DEFAULT_MODEL;

  if (!apiKey) {
    return jsonError(
      "The Burning Wheel's brain is not configured yet. Add GEMINI_API_KEY to the Netlify project environment.",
      503
    );
  }

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent`;

  let upstream: Response;

  try {
    upstream = await fetch(endpoint, {
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
          temperature: preset === "serious" ? 0.75 : 1.05,
          maxOutputTokens: 1100,
          responseMimeType: "application/json",
          thinkingConfig: {
            thinkingLevel: "minimal",
          },
        },
      }),
    });
  } catch {
    return jsonError("Could not reach the brain service.", 502);
  }

  if (!upstream.ok) {
    return jsonError(
      `Brain generation failed upstream (HTTP ${upstream.status}).`,
      502
    );
  }

  const result = await upstream.json();
  const raw = result?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text || "")
    .join("")
    .trim();

  if (!raw) {
    return jsonError("The brain returned an empty thought.", 502);
  }

  let parsed: { title?: unknown; dialogue?: unknown };

  try {
    parsed = JSON.parse(stripFence(raw));
  } catch {
    return jsonError("The brain returned malformed JSON.", 502);
  }

  const dialogue =
    typeof parsed.dialogue === "string" ? parsed.dialogue.trim() : "";
  const title =
    typeof parsed.title === "string" && parsed.title.trim()
      ? parsed.title.trim()
      : "THE BURNING WHEEL";

  if (!dialogue) {
    return jsonError("The brain returned no dialogue.", 502);
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

export const config = {
  path: "/brain",
  method: "POST",
  rateLimit: {
    windowLimit: 6,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  },
};
