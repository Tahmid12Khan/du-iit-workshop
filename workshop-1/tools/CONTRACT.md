# Workshop 1 deck — build contract

Every agent follows this file. Root: `workshop-1/` (= `$W`).

## Audience and rules
- 3rd/4th-year SE students, Dhaka University. Presenter-led. Students do the worksheet at home.
- 71.5 minutes of slides + 3.5 minutes buffer (hard ceiling 75). `data-minutes` on slides must sum to 71.5.
- **Language rule (strict):** every visible thing is English: slides, captions, terminal input and output, commands, worksheet, videos. **Bangla appears ONLY in the speaker notes** (`<aside class="notes" lang="bn">`), which are the transcript the presenter says aloud.
- Slide text: ASD-STE100 Simplified Technical English (imperative instructions, active voice, simple present, no -ing words except technical names, max 20 words per instruction / 25 per description, ≤ 6 bullets, result first, no marketing words). Title = the result of the slide.
- Few words. Each slide is mostly a diagram. The diagram uses ≥ 2/3 of the slide area. Slide text ≥ 24px at the 1280×720 design size; diagram text ≥ 18px in the SVG at design size.
- Light and dark: use only the CSS tokens below. No hard-coded colors in slides or SVG attributes; set fill/stroke in CSS classes or `currentColor`.

## Speaker notes (Bangla transcript)
- Spoken informal Bangla (চলিত, তুমি/তোমরা). Technical terms stay in English script with Bangla suffix: `token-গুলো`, `context window-টা`, `JSON-এ`.
- Short sentences. Explain what the screen shows; never read the slide aloud. Local analogies welcome (SMS, exam desk, rough-work page, viva, mess cook, application form, order slip, Dhaka traffic).
- Cue tags, uppercase in square brackets: `[STEP n]` (matches the animation step), `[ASK]`, `[PAUSE 5s]`, `[DEMO <ID>]`, `[CLICK]`, `[LIVE]`. Also `[DO: text]`: an instruction to the presenter. It is shown in the notes but not spoken, and it is not counted in the notes word budget.
- Budget: ≈ 75 words of narration per `data-minutes` minute (±20%).
- Use the real numbers from `data/<topic>.json`, never invented numbers.

## Slide fragment format
One file per topic group in `slides/`, named so they sort in deck order:
`00-intro.html, 10-tokens.html, 20-context.html, 30-effort.html, 40-hallucination.html, 50-prompt.html, 60-structured.html, 70-toolcall.html, 80-agentloop.html, 90-outro.html`.

```html
<section class="slide" id="tokens-2" data-topic="Tokens" data-minutes="2" data-steps="4">
  <h2>Text becomes tokens before the model sees it</h2>
  <div class="stage">
    <svg viewBox="0 0 1200 520" class="diagram" role="img" aria-label="…">
      <g data-step="1">…</g>          <!-- active in step 1 -->
      <g data-step="2 3">…</g>        <!-- active in steps 2 and 3 -->
      <g>…</g>                        <!-- no data-step: always normal -->
    </svg>
  </div>
  <ol class="captions">               <!-- one STE caption per step; engine shows it in an aria-live region -->
    <li>Send the text to the tokenizer.</li>
    <li>…</li>
  </ol>
  <aside class="notes" lang="bn">[STEP 1] … [ASK] … </aside>
</section>
```

Step engine behaviour (implemented by the engine; slides only declare):
- Step 1 shows on slide entry. No autoplay.
- Elements whose `data-step` list contains the current step get class `is-active` (accent color, full opacity). Elements with a `data-step` that does not contain it get `is-dim` (opacity ≈ 0.25). Nothing is hidden.
- Add `data-from="n"` to an element to make it appear from step n on (before that: `is-future`, opacity 0.08 — still in layout). Use it for reveals of results.
- Counters: `<text data-count="75" data-count-step="3">0</text>` counts up to 75 when step 3 starts.
- `data-steps` = number of steps (≥ 1). Captions count must equal `data-steps`.
- Transitions: CSS transitions (opacity, transform, fill) ~600 ms. Disabled under `prefers-reduced-motion`.
- Optional hook for custom motion: `Deck.onStep('tokens-2', (step, el) => { … })` in a `<script>` inside the section. Prefer CSS + data attributes.

Terminal demo inside a slide:
```html
<div class="term" data-cast="T1" data-play-step="2" data-speed="1.5"></div>
```
- The engine creates an asciinema-player from the inlined cast `window.CASTS.T1`, paused; it starts playing when step `data-play-step` begins. The player has a link to `video/term/T1.mp4` and `video/anim/T1.mp4`.
- Live demo: `<pre class="cmd" data-live>tokens "Hello"</pre>` shows the command with a copy button and a LIVE tag; the cast is still the fallback.

Room check (hands / A-B-C cards):
```html
<div class="check" data-step="1"><p>Which costs more tokens?</p><ol><li>Hello</li><li>{"greeting":"Hello"}</li></ol></div>
<div class="reveal" data-from="3">JSON: 11 tokens</div>
```

## Animation-only slides (one per command, 27 in all)
```html
<section class="slide anim-only" id="anim-T1" data-cmd="T1" data-steps="5"> … same structure, with notes omitted … </section>
```
- Skipped in normal navigation and in the slide count. `tools/render-anim.mjs` renders each to `video/anim/<ID>.mp4` (1280×720, light theme, ≈ 3 s per step plus the transition).
- 4–6 steps: (1) the command, (2) what goes to the model / what our code does, (3) what the model or tool does, (4) the real result from `data/<topic>.json`, (5) optional one-line takeaway. Reuse the topic's concept diagram as the template so the video matches the deck.

## Design tokens (defined by the engine on :root; use them via var())
`--bg --surface --surface-2 --ink --ink-2 --ink-3 --line --accent --accent-ink --accent-soft --ok --warn --bad --c1 --c2 --c3 --c4 --c5` (c1–c5 = soft chip fills, readable with --ink in both themes). Fonts: `--font-sans` (Inter), `--font-mono` (JetBrains Mono), `--font-bn` (Hind Siliguri, notes only).

## Commands (ids are fixed — see data/commands.json)
Each command `<ID>` has: `demo/<ID>.sh` (sources `demo/lib.sh`; uses `show '<command>'` and `say '<comment>'`), `casts/<ID>.cast`, `video/term/<ID>.mp4` (made by `tools/record.sh <ID>`), an `anim-<ID>` slide, and `video/anim/<ID>.mp4`.
- Use `cc` / `tokens` from `demo/cc.sh` for model calls, unless the command is about Claude Code itself (T5, C1–C5).
- Before recording, run the script once without recording to check it. Record with `tools/record.sh <ID>`. The cast must show the real result. If a run fails, fix and re-record; never fake output.
- Write the measured results to `data/<topic>.json`: `{ "<ID>": { "command": "...", "result": "short text", "numbers": {…}, "seconds": n, "cost_usd": n } }`.
- Privacy: casts must not show the presenter's own work data (names of MCP servers, skills, plugins, clients, e-mail, `/Users/<name>` paths). The build fails if a cast contains `/Users/` or a term from the git-ignored `tools/privacy-terms.txt`.
- Keep each cast short: under ~60 s of playback after idle trimming (the 805 puzzle E3 is a time-lapse; summarise long runs with a printed table).

## Build
- `node tools/build.mjs` → reads `tools/template.html`, inserts `slides/*.html` in name order, inlines `casts/*.cast` as `window.CASTS`, writes `index.html`, and writes `videos.html` (every command: title, command, terminal MP4, animation MP4) from `data/commands.json`.
- The deck opens from `file://` with no network. Vendor files live in `vendor/`.
- Keys: → / Space next step (then next slide), ← previous, Home/End, N notes drawer, P presenter window, T theme cycle. Buttons: Previous, Play/Pause, Next, Reset, and "Step k of N"; "Slide n / N" in the corner.
- Debug/capture URL: `index.html?slide=<id>&step=<n>&capture=1` (hides chrome, shows caption bar) and `window.Deck.go(id, step)`.
