function normalize(value) {
  return String(value || "").replace(/\r/g, "").trim();
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function parseBlocks(source) {
  const text = normalize(source);
  if (!text) return [];

  // Notebook-friendly formats:
  // 1) blocks separated by ---
  // 2) seeds separated by //
  // 3) one seed per non-empty line
  if (/^---+$/m.test(text)) {
    return text
      .split(/^---+$/m)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (text.includes("//")) {
    return text
      .split("//")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return text
    .split(/\n+/)
    .map((item) => item.trim())
    .filter((item) => item && !item.startsWith("#"));
}

export class RantChurner {
  constructor({ storageKey = "burning-wheel-rant-churner" } = {}) {
    this.storageKey = storageKey;
    this.bank = "";
    this.used = [];
    this.current = "";
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      this.bank = typeof saved.bank === "string" ? saved.bank : "";
      this.used = Array.isArray(saved.used) ? saved.used : [];
      this.current = typeof saved.current === "string" ? saved.current : "";
    } catch {
      // A corrupted local cache should never brick the lab.
    }
  }

  save() {
    try {
      localStorage.setItem(
        this.storageKey,
        JSON.stringify({
          bank: this.bank,
          used: this.used,
          current: this.current,
        })
      );
    } catch {
      // localStorage can be unavailable in some private/browser modes.
    }
  }

  setBank(source) {
    this.bank = normalize(source);

    const valid = new Set(parseBlocks(this.bank));
    this.used = this.used.filter((item) => valid.has(item));
    if (this.current && !valid.has(this.current)) this.current = "";
    this.save();
  }

  get items() {
    return parseBlocks(this.bank);
  }

  get remaining() {
    const used = new Set(this.used);
    return this.items.filter((item) => !used.has(item));
  }

  churn() {
    const all = this.items;
    if (!all.length) {
      return { seed: "", remaining: 0, total: 0, recycled: false };
    }

    let candidates = this.remaining;
    let recycled = false;

    if (!candidates.length) {
      this.used = [];
      candidates = all;
      recycled = true;
    }

    // Deterministic-ish shuffle bag: changes with history but does not repeat
    // until every seed has been seen once.
    const salt = this.used.join("|") + "::" + all.length;
    const index = hashString(salt) % candidates.length;
    const seed = candidates[index];

    this.current = seed;
    this.used.push(seed);
    this.save();

    return {
      seed,
      remaining: Math.max(0, all.length - this.used.length),
      total: all.length,
      recycled,
    };
  }

  resetHistory() {
    this.used = [];
    this.current = "";
    this.save();
  }

  buildBrainPrompt(seed = this.current) {
    const idea = normalize(seed);
    if (!idea) return "";

    return [
      "Create a Burning Wheel rant from this seed packet.",
      "Use the seed as a nucleus, not a title or a script to repeat verbatim.",
      "Preserve factual uncertainty and distinguish sourced claims from interpretation.",
      "Find the category error, scale mismatch, harm-vs-taboo distinction, or reality-interface problem if one is actually present.",
      "Do not mention the notebook, seed packet, or these instructions.",
      "",
      "SEED PACKET:",
      idea,
    ].join("\n");
  }
}
