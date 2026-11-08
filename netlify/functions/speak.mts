declare const Netlify: {
  env: {
    get(key: string): string | undefined;
  };
};

const MAX_TEXT_LENGTH = 1200;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export default async function speak(request: Request) {
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

  if (!upstream.ok) {
    // Do not erase ElevenLabs' reason for rejecting the request. In particular,
    // a renewed balance cannot fix an expired API key, an inaccessible voice,
    // or a model/voice mismatch. Return only the safe error detail, never the key.
    let detail: any = null;

    try {
      detail = await upstream.json();
    } catch {
      detail = null;
    }

    const problem = detail?.detail ?? detail?.error ?? detail;
    const upstreamCode =
      typeof problem?.code === "string"
        ? problem.code
        : typeof problem?.status === "string"
          ? problem.status
          : "";

    const upstreamMessage =
      typeof problem?.message === "string"
        ? problem.message
        : typeof problem === "string"
          ? problem
          : "";

    const guidance: Record<number, string> = {
      400: "The voice request was rejected. Check the voice ID, model and audio format.",
      401: "ElevenLabs rejected the API key. Check the production ELEVENLABS_API_KEY.",
      402: "ElevenLabs reports insufficient available credits or a payment problem.",
      403: "This API key does not have permission to use the requested voice or model.",
      404: "The configured ElevenLabs voice could not be found or accessed.",
      422: "ElevenLabs rejected the voice, model or request parameters.",
      429: "ElevenLabs is rate-limiting voice requests. Try again later.",
    };

    const scrub = (value: string) =>
      value
        .replace(/(?:sk[-_]|xi[-_]api[-_]key)[A-Za-z0-9_-]{8,}/gi, "[redacted]")
        .slice(0, 300);

    const message = scrub(
      upstreamMessage || guidance[upstream.status] ||
        "The voice provider rejected the request."
    );

    console.error("ElevenLabs speech rejected", {
      status: upstream.status,
      code: upstreamCode,
      message,
    });

    return Response.json(
      {
        error: `ElevenLabs HTTP ${upstream.status}${upstreamCode ? ` (${scrub(upstreamCode)})` : ""}: ${message}`,
        upstreamStatus: upstream.status,
        upstreamCode: scrub(upstreamCode),
      },
      {
        status: upstream.status === 429 ? 429 : 502,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  if (!upstream.body) {
    return jsonError("ElevenLabs returned no audio.", 502);
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}

export const config = {
  path: "/speak",
  method: "POST",
  rateLimit: {
    windowLimit: 8,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  },
};
