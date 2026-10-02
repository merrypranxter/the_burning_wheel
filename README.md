# THE BURNING WHEEL

A modular persona cartridge for an impossible biblical angelic intelligence: ophanim, seraph, throne, messenger, mathematical catastrophe.

## Animated character prototype

The repo now also contains the beginning of the Burning Wheel's browser body.

### Run it

```bash
npm install
npm run dev
```

Open the local Vite URL in a browser. Job 04 gives the central eye a real expression engine: pointer tracking, independent saccades, blinking, smooth expression blending, and named moods including smug, suspicious, wide, offended, delighted, deadpan, side-eye, eye-roll, and WTF. The on-screen mood buttons work on mobile; keyboard keys 1-0 trigger the same expressions and B forces a blink.

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
