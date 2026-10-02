# THE BURNING WHEEL

A modular persona cartridge for an impossible biblical angelic intelligence: ophanim, seraph, throne, messenger, mathematical catastrophe.

## Animated character prototype

The repo now also contains the Burning Wheel's browser body.

### Run it

```bash
npm install
npm run dev
```

Open the local Vite URL in a browser.

### Current state — Job 06

The character now has a containment-failure / body-language engine on top of the existing nine-wheel body, independent eye/LED population, and expressive central eye.

Normal-ish gestures:
- `leanIn`
- `recoil`
- `judgment`
- `flare`
- `attractorDrift`

Impossible gestures:
- `orientationSlip` — smears historical frames, then snaps into a new persistent orientation
- `mobiusFlip` — selected wheels reverse apparent orientation through a non-orientable-looking flip
- `projectionError` — intentionally sabotages depth testing/render order
- `dimensionStutter` — de-syncs and panics the eye population, jitters geometry, infects the UI, tears the sky, and produces scanline/channel-smear corruption

The little ring eyes are no longer all using the same behavioral logic. Different panels independently follow the pointer, browser time, the central eye, fixed off-screen vectors, chaotic motion, or their own local random attention. During a dimension stutter they all temporarily abandon those controllers and panic.

The containment engine also has low-frequency autonomous micro-events. Use **AUTO CHAOS** to disable them. **RESET REALITY** (or Escape) is deliberately kept outside the fake containment failure and restores the original geometry/UI.

### ElevenLabs voice bridge

Job 06 gives the browser body a server-side ElevenLabs throat without exposing the API key to the browser.

The chain is:

```
text -> /speak Netlify Function -> ElevenLabs saved voice -> browser audio
     -> Web Audio analyser -> wheel/core movement + phrase-hit gestures
```

The saved voice itself stays in ElevenLabs. The site only needs its voice ID.

Set these environment variables on the Netlify project:

- `ELEVENLABS_API_KEY` — secret; Functions scope
- `ELEVENLABS_VOICE_ID` — the saved Burning Wheel voice ID
- `ELEVENLABS_MODEL_ID` — optional; defaults to `eleven_v4`

For local voice testing, copy `.env.example` to `.env`, fill in your own values, and run the site through `netlify dev` so the `/speak` function is available. Real `.env` files are gitignored.

The `/speak` function is POST-only, caps a single utterance at 1200 characters, and applies a per-IP/domain rate limit so a public prototype cannot casually vaporize the ElevenLabs credit balance.

The on-screen VOICE console is deliberately a test harness. Type a line and press **SPEAK** (or Cmd/Ctrl+Enter). **STOP** kills current playback. Later the dialogue/persona layer can call the same `VoiceController.speak(text)` method directly.


Keyboard test controls:
- `1–0`: central-eye expressions
- `B`: blink
- `Q`: lean in
- `W`: recoil
- `E`: judgment
- `R`: flare
- `T`: attractor drift
- `Y`: orientation slip
- `U`: Möbius flip
- `I`: projection error
- `O`: dimension stutter
- `Space`: pause/resume
- `Esc`: reset reality

Production build:

```bash
npm run build
npm run preview
```

## Architecture

The repo is intentionally split into layers:

- `personas/` — the mind/voice cartridge
- `src/character/BurningWheel.js` — the body and wheel hierarchy
- `src/character/CoreEye.js` — central facial expression system
- `src/character/WheelPanel.js` — independent eyes/LEDs/panel behaviors
- `src/character/ContainmentEngine.js` — gestures, impossible geometry, DOM infection, depth-buffer sabotage, historical-frame smear, and containment state

That separation is deliberate: dialogue/performance logic can call named character verbs later without having to know how the renderer produces them.

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
