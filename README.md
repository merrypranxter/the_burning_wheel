# THE BURNING WHEEL

A modular persona cartridge for an impossible biblical angelic intelligence: ophanim, seraph, throne, messenger, mathematical catastrophe.

## Animated character prototype

The repo now also contains the beginning of the Burning Wheel's browser body.

### Run it

```bash
npm install
npm run dev
```

Open the local Vite URL in a browser. Job 02 now renders the character skeleton: nine independently moving golden wheels around a central core, each with its own axis, spin direction, speed, wobble, phase, and precession. The whole creature idles, floats, and reacts subtly to pointer movement while keeping the deliberately low-resolution pixel-art browser-toy look.

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
