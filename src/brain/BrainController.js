export class BrainController {
  constructor({ onState = () => {} } = {}) {
    this.onState = onState;
    this.requestToken = 0;
  }

  async generate(prompt, preset = "default") {
    const idea = String(prompt || "").trim();
    if (!idea) throw new Error("Give the brain something to think about.");

    const token = ++this.requestToken;
    this.onState("thinking");

    const response = await fetch("/brain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: idea, preset }),
    });

    if (token !== this.requestToken) {
      return { cancelled: true };
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      this.onState("error");
      throw new Error(
        payload?.error || `Brain request failed (HTTP ${response.status}).`
      );
    }

    if (!payload?.dialogue) {
      this.onState("error");
      throw new Error("The brain returned no dialogue.");
    }

    this.onState("ready");
    return {
      title: payload.title || "THE BURNING WHEEL",
      dialogue: payload.dialogue,
      model: payload.model || null,
      cancelled: false,
    };
  }

  cancel() {
    this.requestToken += 1;
    this.onState("idle");
  }
}
