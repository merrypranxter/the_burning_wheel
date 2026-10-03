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

### Current state — Job 10

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

Frozen poses now protect central eye readability: rings may naturally pass in front of the face while moving, but pausing motion or entering the snapped phase of an orientation slip temporarily promotes the central eye above wheel depth so the final pose never lands with his face completely hidden.

The containment engine also has low-frequency autonomous micro-events. Use **AUTO CHAOS** to disable them. **RESET REALITY** (or Escape) is deliberately kept outside the fake containment failure and restores the original geometry/UI.

### Rant churner

Job 10 adds a persistent rant seed bank intended to pair with Gemini Notebook (formerly NotebookLM). Paste a source-grounded report or seed bank into **RANTS**. Full seed packets can be separated with a line containing `---`; `//` or one seed per line also work.

- **SAVE BANK** stores the bank in browser localStorage.
- **CHURN ONE** picks one unused packet and remembers it.
- **CHURN + THINK** picks a packet, sends it through the Burning Wheel brain, and runs the returned dialogue through AutoDirector.
- **RESET HISTORY** clears only the used-seed history so the bank can cycle again.

The churner will not repeat a seed until the entire bank has been used once. The recommended Gemini Notebook report prompt lives at `prompts/gemini-notebook-rant-churner.md`.

Personal Gemini Notebook share links are human-facing rather than a direct app feed, so Job 10 uses copy/paste as the robust bridge. A later authenticated Google Drive bridge can remove that manual step by reading an exported Google Doc.

### Brain bridge

Job 09 adds a concept-to-rant layer above the AutoDirector. The BRAIN box sends a short idea or question to the server-side Burning Wheel brain, gets back spoken dialogue, and immediately converts that dialogue into an editable skit. It does not auto-perform, so voice credits are only spent when **PERFORM** is pressed.

Available brain presets: default, cosmic-roast, oracle, and serious.

### Auto-director

Job 08 adds a local deterministic director on top of the skit language. Paste raw dialogue into the DIRECT box and press **DIRECT THIS**. The browser breaks the monologue into ElevenLabs-sized chunks, chooses eye expressions, gestures, containment effects, and pauses from semantic/punctuation cues, and writes an editable `.bwskit` into the SKIT editor.

The director deliberately throttles severe containment failures so every sentence does not become a dimension stutter. The same raw text produces the same choreography, which makes it useful for repeatable video takes while still leaving the generated script editable.

The voice now defaults to **1.30× playback**, matching the current preferred delivery speed. A small VOICE speed slider can move it from 0.80× to 1.50× without regenerating the ElevenLabs audio.

### Little skit machine

Job 07 adds a tiny performance DSL and runner. A skit is just editable text, not hard-coded animation. The engine executes commands sequentially and can wait for ElevenLabs speech to actually finish before moving to the next beat.

Supported commands:

- `SAY words here` — speak the rest of the line and wait for playback to finish
- `EYE smug 2.5` — set a named central-eye expression and optional hold time in seconds
- `GESTURE orientationSlip 0.6` — trigger a named body/containment verb at an optional intensity
- `BREACH projectionError 0.8` — alias for `GESTURE`
- `WAIT 0.7s` or `WAIT 250ms` — explicit timing
- `BEAT 180ms` — readable timing punctuation; same timer semantics as `WAIT`
- `BLINK` — force a central blink
- `AUTOCHAOS ON` / `AUTOCHAOS OFF` — control autonomous weirdness inside a performance
- `RESET` — restore the containment scene

The on-screen SKIT editor includes a working sample. **PERFORM** runs it; **STOP SKIT** cancels current speech/timing without nuking the whole page. Cmd/Ctrl+Enter also runs the current skit.

The first full authored performance lives at `skits/the-word-god-is-not-god.bwskit`. **LOAD GNOSIS RANT** drops that full monologue/choreography into the editor so it can be performed or edited without copy/paste.

Example:

```text
AUTOCHAOS OFF
EYE smug 2.5
GESTURE leanIn 0.65
SAY BE NOT AFRAID. I said what I said.
BEAT 220ms
EYE sideEye 1.6
SAY Your coordinate system is adorable.
GESTURE orientationSlip 0.55
WAIT 700ms
EYE deadpan 2
SAY Anyway. You have mistaken certainty for knowledge.
GESTURE judgment 0.65
AUTOCHAOS ON
```

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

After changing any Netlify environment variable, trigger a fresh production deploy so the Function receives the new values.

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
- `src/voice/VoiceController.js` — ElevenLabs playback, Web Audio analysis, and body reaction to speech
- `src/performance/PerformanceEngine.js` — parser and sequential skit runner
- `src/performance/AutoDirector.js` — deterministic raw-dialogue-to-performance choreography
- `src/rants/RantChurner.js` — persistent no-repeat rant seed bank
- `src/brain/BrainController.js` — browser-side concept-to-dialogue client
- `netlify/functions/brain.mts` — server-side Burning Wheel brain bridge

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


## Visual polish backlog

The ring-eye system is structurally correct but not visually final. Replace the current banner-like display treatment on many eye panels with round eyeball-like forms: visible white sclera + iris/pupil, closer to loose eyeballs embedded around the gold wheels. Preserve their independent tracking modes and panic behavior while changing the visual shell.


### Job 11 — Presence pass

The central eye now has two coordinated layers: the physical depth-aware eye and a subtle always-visible projected eye rendered above the wheel geometry. This keeps the character's face readable even when rings cross in front. The projection brightens during speech and priority states.

The center eye is slightly larger and more organic: richer sclera shading, limbal ring, additional iris fibers, wet corneal highlights, and subtle voice-reactive dilation. Ring eye panels are now biased further toward actual eyeballs and their organic/LED variants have stronger sclera, iris, and highlight treatment.

Character framing was also increased so The Burning Wheel occupies more of the stage on desktop and mobile.


### Job 12 — Heaven pass

The old block-cloud placeholder sky has been replaced with a procedural heavenly backdrop. The sky is a quantized blue-to-pearl gradient with visible ordered dithering, layered behind seven softly modeled cloud banks.

Clouds are generated in-browser from shaded radial masses, then their edges and color bodies are deliberately dithered/quantized so they sit between soft atmospheric realism and the project's low-resolution screenprint/game-console language. Layers drift at different speeds with slight pointer parallax and slow breathing, while remaining compatible with ContainmentEngine cloud jitter/collapse effects.

The underlying scene sky is brighter and softer so containment flashes can still bleed through the translucent heaven texture.


### Job 13 — Performance pass

Speech now drives a dedicated acting layer instead of only adding tiny analyzer wiggles. When ElevenLabs audio is playing, The Burning Wheel visibly shifts into a speaking state with stronger core/head nods, yaw, roll, forward emphasis, lateral phrasing, ring counter-motion, and speech-reactive scale changes. The movement remains active even during quieter audio so the character still reads as speaking with the sound muted.

Audio onsets create short deterministic body accents through `punctuateSpeech()`. Frequent accents stay local to the body while larger phrase hits rotate through restrained gestures such as lean-in, judgment, flare, recoil, and attractor drift. Severe containment failures are not automatically spammed by normal speech.

The center eye now receives speech-timed blinks and subtle voice energy, while the projected eye brightens with vocal presence. Speech state begins on audio playback and ends cleanly on pause, stop, or completion.
