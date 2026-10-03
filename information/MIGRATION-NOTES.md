# Migration Notes — Google Notebook → GitHub

**Migration date:** 2026-10-04
**Source of record:** `Burning wheel bibliography .pdf` (in this folder) + `BIBLICALLY ACCURATE ANGEL personality prompt.pdf`

## What was migrated

- All **262 bibliography entries** (Batches 1–10) were parsed, categorized, and annotated into 12 thematic section documents plus a master bibliography.
- The **Burning Wheel persona prompt** was reconstructed into a clean, organized Markdown document with its six add-on modules (A–F).
- The notebook's embedded **Van Lommel NDE explainer** (the flat-line EEG / nonlocal consciousness summary) was preserved in `03-consciousness-and-mind.md`.

## Duplicates found in the notebook

The notebook itself contained duplicate entries. They are flagged, not deleted:

| Pair | Entries |
|------|---------|
| Aldous Huxley's *Island* Revisited | #12 = #13 |
| Hofstadter's Gödelian Philosophy of Mind | #41 = #42 |
| PNAS Fractal dynamics in physiology | #59 ≈ #60 (same paper, two formats) |
| Relational quantum mechanics (Wikipedia) | #155 = #156 |
| The Fourth Dimension (unspecified PDF) | #205 = #206 |
| Quanta: What Does the Fourth Dimension Actually Look Like? | #242 = #243 |
| Hopkins' Cusa translation | #120 ≈ #127 (book vs. Goodreads page) |
| Flatland cluster | #50, #54, #55, #135 (primary text, Wikipedia, annotated edition, Oneworld foreword — kept as distinct records) |
| I Am a Strange Loop cluster | #43, #86, #87 (book, Wikipedia, Catalan Wikipedia) |

## Verified during migration

Several cryptic entries were looked up and identified:

- **#51 — "Field Report 0011 ⇔ ΔϘ ⇔ The Noospheric AFEI Manifold"** is part of a series of AI-generated "field reports" circulated via Discord/AnswerOverflow (SACSA&AMA v0.1). It is an AI-output artifact, not a research document. Filed under `11-fringe-speculative-and-unverified.md`.
- **#97 — McGinty-Nottale Scale Equation (MNSE)** is a self-published 2024 paper by Chris McGinty (Skywise.ai) in the *International Journal of Theoretical & Computational Physics*, combining his "McGinty Equation" with Laurent Nottale's Scale Relativity. Fringe.
- **#28 — Cycle Clock Theory** is by Klee Irwin (Alt Propulsion / Quantum Gravity Research circle): a code-theoretic, self-simulation approach to a theory of everything. Fringe but coherent.
- **#251 — arXiv:1803.10589** is *Incompleteness theorem for physics* (2018), arguing a Gödel-analog in quantum theory.
- **#252 — arXiv:2603.25760** is *Topology as a Language for Emergent Organization in Complex Systems* (March 2026 review).
- **#254 — arXiv:1701.08641** is Daegene Song, *Dark Energy and Consciousness* (self-reference applied to the cosmological constant problem).
- **#256 — arXiv:cond-mat/0409545** is Ivanov et al., *Levels of Complexity in Scale-Invariant Neural Signals* (2004).
- **#257 — arXiv:q-bio/0409039** is Kiyono et al., *Critical Scale-Invariance in Healthy Human Heart Rate* (2004).

## Not recoverable / needs manual retrieval

These entries point at private or ephemeral sources that could not be looked up:

- **#70** — Gemini chat log ("Generating Repository Documentation for Weird Information") — private chat export.
- **#82** — Google Doc ("Hey give me a shit tons of concepts to look up for...") — private doc.
- **#108** — Google Drive "MAGA SUCKS - Combined Files" — private drive folder.
- **#259** — Google Drive "maga hypocrisy.pdf" — private file.
- **#93** — Toratherapeutics, *In Good Hands* — title identified, content not located.
- **#96** — IJARP "Research Papers" — generic journal listing, no specific paper identifiable.
- **#98** — "Introduction" (unspecified PDF) — unidentifiable without the notebook link.
- **#202** — PD.org "The Eternal Recurrence of 'l'effroyablement ancien'" — could not be verified.
- **#261** — Cosmocritic, "the responsive cosmos" — could not be verified.

If you still have the notebook open, export those items and drop them into `12-notebook-artifacts-and-unclassified.md`'s backlog section, or just commit the files directly.

## Structure decisions

- Entries were assigned to **exactly one** section (the best fit), with cross-references noted in annotations where a source strongly serves two sections.
- Wikipedia/SEP entries were kept as **[reference]** companions to primary texts rather than merged away — in the notebook they appeared to serve as quick-lookup anchors.
- Fringe material was **quarantined, not deleted** — several fringe sources (holofractal, zero-point, quantum-holographic consciousness) clearly feed the persona's voice, but they should never be cited as established science.
