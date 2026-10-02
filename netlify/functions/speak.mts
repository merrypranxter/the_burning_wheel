import type { Config, Context } from "@netlify/functions";

declare const Netlify: {
  env: {
    get(key: string): string | undefined;
  };
};

const MAX_TEXT_LENGTH = 1200;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export default async function speak(request: Request, _context: Context) {
  let payload: { text?: unknown };

  try {
    payload = await request.json();
  } catch {
    return jsonError("Expected a JSON body.", 400);
  }

  const text =
    typeof payload.text === "string"
      ? payload.text.trim()
      : "";

  if (!text) {
    return jsonError("Give The Burning Wheel something to say.", 400);
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return jsonError(
      `Keep a single utterance under ${MAX_TEXT_LENGTH} characters.`,
      413
    );
  }

  const apiKey = Netlify.env.get("ELEVENLABS_API_KEY");
  const voiceId = Netlify.env.get("ELEVENLABS_VOICE_ID");
  const modelId = Netlify.env.get("ELEVENLABS_MODEL_ID") || "eleven_v4";

  if (!apiKey || !voiceId) {
    return jsonError(
      "The Burning Wheel's throat is not configured yet. Add ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID to the Netlify project environment.",
      503
    );
  }

  const endpoint =
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
      voiceId
    )}?output_format=mp3_44100_128`;

  let upstream: Response;

  try {
    upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
      }),
    });
  } catch {
    return jsonError("Could not reach the voice service.", 502);
  }

  if (!upstream.ok || !upstream.body) {
    return jsonError(
      `Voice generation failed upstream (HTTP ${upstream.status}).`,
      502
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}

export const config: Config = {
  path: "/speak",
  method: "POST",
  rateLimit: {
    windowLimit: 8,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  },
};
