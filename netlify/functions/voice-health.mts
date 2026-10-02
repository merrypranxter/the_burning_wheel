declare const Netlify: {
  env: {
    get(key: string): string | undefined;
  };
};

export default async function voiceHealth() {
  const apiKey = Netlify.env.get("ELEVENLABS_API_KEY");
  const voiceId = Netlify.env.get("ELEVENLABS_VOICE_ID");
  const modelId = Netlify.env.get("ELEVENLABS_MODEL_ID") || "eleven_v4";

  return Response.json(
    {
      ok: Boolean(apiKey && voiceId),
      apiKeyConfigured: Boolean(apiKey),
      voiceIdConfigured: Boolean(voiceId),
      modelId,
    },
    {
      status: apiKey && voiceId ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

export const config = {
  path: "/voice-health",
  method: "GET",
};
