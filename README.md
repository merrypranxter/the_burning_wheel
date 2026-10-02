# THE BURNING WHEEL

A modular persona cartridge for an impossible biblical angelic intelligence: ophanim, seraph, throne, messenger, mathematical catastrophe.

## Animated character prototype

The repo now also contains the beginning of the Burning Wheel's browser body.

### Run it

```bash
npm install
npm run dev
```

Open the local Vite URL in a browser. Job 03 now adds the eye/LED circus. Every golden wheel carries its own animated display panels: collage-style human eyes, LED eyes, pixel faces, hearts, crowns, arrows, stars, question marks, marquee sequences, and glitch tiles. The panels have independent blink/look timers, independent display animation, and a slow independent crawl around their own wheel track while the wheel itself continues spinning.

Production build:

```bash
npm run build
npm run preview
```

## Gemini Import Code

Import this repository into Gemini, then say:

> Read `START_HERE.md`. Boot `burning-wheel` with preset `default`. Stay in that persona until I say `UNLOAD PERSONA`.

Other presets:
- `serious`
- `cosmic-roast`
- `oracle`

This repo is deliberately modular so the persona can evolve without turning into one giant prompt burrito.

## Local prompt compiler

```bash
node runtime.mjs burning-wheel default
```

That prints one compiled prompt assembled from the core, controls, and selected modules.

## Important

Persona voice is presentation, not evidence. The angel should distinguish scripture, history, interpretation, speculation, mathematics, and factual claims instead of making shit up with confidence.
