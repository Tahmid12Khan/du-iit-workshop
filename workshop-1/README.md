# Workshop 1: Foundations of LLMs and Agentic Systems

HTML slide deck, speaker notes, demo recordings and a take-home worksheet.
Length: 69.5 minutes of slides plus 5.5 minutes of buffer (ceiling 75).
Audience: 3rd and 4th year software-engineering students. The presenter speaks Bangla.

**Language rule.** Bangla appears only in `<aside class="notes" lang="bn">` (the speaker transcript) and in `transcript.html` (generated from the notes).
Slides, terminals, commands, demo files, worksheet, videos and this README are English.
`node tools/build.mjs --strict` fails if Bangla appears anywhere else.

## Open the deck

- Open `index.html` in Chrome. No server and no network are needed (`file://` works).
- `videos.html` lists all 27 commands, each with a terminal video and an animation video.
- `worksheet.html` is the take-home worksheet (8 tasks). Students do it at home.
- `transcript.html` is the printable Bangla transcript. It lists every slide with its minutes, the clock time and the notes. The build writes it. It is the only page besides the notes where Bangla may appear.

### Keys

| Key | Action |
| --- | --- |
| Right arrow, Space | Next step. After the last step, next slide. |
| Left arrow | Previous step. At step 1, last step of the previous slide. |
| Page Down, Page Up | Next slide, previous slide |
| Home, End | First slide, last slide |
| N | Speaker notes drawer (Bangla transcript) |
| P | Presenter window |
| T | Theme: light, dark, system |
| R | Reset the slide to step 1 |
| F | Full screen |

Arrow keys and Space are ignored while a button has focus. Play (button) advances one step every 3 s.

### Presenter window

- Press **P** (or the Presenter button). A second window opens with the clock, the elapsed timer, the plan time, the current caption, the Bangla notes with the active step highlighted, and the next step.
- The two windows follow each other in both directions (`BroadcastChannel` and `postMessage`, tested on `file://`).
- The timer starts on the first step change. Buttons: Start, Pause, Reset.
- Put the deck window on the projector. Keep the presenter window on your screen.

## Minute plan

| Topic | Slides | Minutes | Demos (recorded casts) | Live |
| --- | --- | --- | --- | --- |
| Intro (title slide and 3 slides) | 4 | 3.5 | none | none |
| Tokens (with next-token and cost extras) | 5 | 10 | T1 to T5 | none |
| Context window (with the no-memory extra) | 4 | 9.5 | C1 to C5 | `/context` in Claude Code (context-3) |
| Effort levels | 5 | 8.5 | E1 to E3 | none |
| Hallucination | 4 | 6 | H1 to H4 | none |
| Parts of a prompt | 3 | 7 | P1 to P4 | none |
| Structured output | 3 | 5 | S1 to S3 | S2 and S3 (structured-3) |
| Tool call | 3 | 7 | L1 | none |
| Agent loop | 4 | 9 | L2, L3 | none |
| Wrap-up | 2 | 4 | none | none |
| **Total** | **37** | **69.5** | 27 casts | 2 live demos |

- The presenter runs every command. Students do not type during the session.
- Two demos run live in the room: `/context` (slide context-3) and structured output (slide structured-3). Every other demo plays a recorded cast inside the slide. Each live slide keeps its cast as a fallback.
- Two slides open the live pricing page with a `[CLICK]` cue (tokens-5, effort-5). No price is hard-coded on a slide.
- The notes carry one cue per step: `[STEP n]`, `[ASK]`, `[PAUSE 5s]`, `[DEMO <ID>]`, `[CLICK]`, `[LIVE]`. Play each cast in step order.
- `[DO: ...]` is an instruction to the presenter (for example, which window to open). Do not say it aloud. It is not counted in the spoken words.
- Room checks use hands or A/B/C cards. There are no QR polls.

### Before a live demo

```bash
cd workshop-1/demo
bash context/env.sh          # creates /tmp/ws1-ctx with big.txt (context demo); runs in a subshell
source cc.sh                 # cc and tokens helpers (structured output demo)
```

- Context demo, once before the session: run `cd /tmp/ws1-ctx && claude --model haiku --strict-mcp-config --setting-sources "" --no-chrome`. Choose Yes on the folder trust prompt. Then exit.
- Context demo, live: open a new terminal in `/tmp/ws1-ctx` and run the same command (it is on slide context-3). This gives a clean profile, so no private tool names show.
- Live numbers differ from the recording: about 30k to 100k tokens, depending on the run. Show the shape, not the numbers. Two reads of `big.txt` are normal.
- Structured output demo: run the two commands shown on slide structured-3 from the `demo/` folder. If the live run fails, play the recording in the slide.
- Never press N on the projector window. Use the presenter window (P) to read the notes.

## Files

```
index.html        generated deck (do not edit; run tools/build.mjs)
transcript.html   generated printable Bangla transcript (do not edit)
videos.html       generated video index
worksheet.html    take-home worksheet
slides/           one HTML fragment per topic: 00-intro ... 90-outro (edit these)
casts/            27 asciinema recordings, inlined into index.html
video/term/       27 terminal MP4 (from the casts)
video/anim/       27 animation MP4 (from the anim-only slides) and manifest.json
demo/             <ID>.sh scripts, lib.sh, cc.sh, loop.mjs, loop.starter.mjs, notes/, inputs
data/             measured results per topic, commands.json (the 27 fixed ids)
vendor/           deck engine, styles, fonts, asciinema-player (works offline)
tools/            build.mjs, record.sh, render-anim.mjs, check.mjs, CONTRACT.md
```

`tools/CONTRACT.md` holds the slide format, the note rules and the design tokens.

## Build

```bash
source ~/.nvm/nvm.sh
cd workshop-1/tools && npm install      # once: playwright
cd .. && node tools/build.mjs           # table of slides, minutes, steps, notes words; writes index.html, videos.html and transcript.html
node tools/build.mjs --strict           # exit 1 on Bangla outside the notes
```

The build warns when `data-steps` differs from the caption count, when the notes length is more than 20% off 75 words per minute, or when the minutes do not add up to 69.5.

## Re-record a command

Tools needed: `claude` CLI, `asciinema`, `agg`, `ffmpeg`, `jq`, Node.

```bash
tools/record.sh T1          # runs demo/T1.sh, writes casts/T1.cast and video/term/T1.mp4
```

1. Run `bash demo/<ID>.sh` once without recording. Check the output.
2. Record. The cast must show the real result. Never fake output.
3. Check privacy: `node tools/build.mjs --strict` fails if a cast contains `/Users/` or a term from `tools/privacy-terms.txt` (git-ignored, one term per line: your name, employer, clients, work tools).
4. Update `data/<topic>.json` with the new measured numbers.
5. Update the slide numbers and the Bangla notes if the result changed. Model output varies between runs: the P1 language, the P3 and P4 table, the S1 JSON shape, the L2 file order and the E and H counts can change.
6. `node tools/build.mjs`, then re-render the animation video (next section).

Order rules:

- Context demos (C1 to C5) form a chain in `/tmp/ws1-ctx`. Record C1 first, then C2 to C5.
- E1 to E3 call `demo/effort/runs.sh` (parallel runs, raw results in `demo/effort/out/`). E3 takes several minutes.
- H2 and H4 call `npm view`. The registry answer can change. Run them again on the recording day.

## Re-render an animation video

```bash
node tools/render-anim.mjs T1            # slide anim-T1 -> video/anim/T1.mp4
node tools/render-anim.mjs all --jobs 3  # all 27 (about 90 s)
node tools/render-anim.mjs <slideId>     # any slide, for example tokens-2
```

- Output: 1280x720, 30 fps, light theme, about 3 s per step.
- The renderer steps the animations frame by frame. The result does not depend on machine speed.
- `video/anim/manifest.json` stores a fingerprint of each slide and the engine. `tools/check.mjs` fails when a video is older than its slide.
- Options: `--theme dark`, `--fps`, `--keep-frames`.

## Check everything

```bash
node tools/check.mjs --out /tmp/w1-check
```

The script runs 32 checks and exits 1 on a failure. It covers:

- Build, 27 casts, 27 terminal MP4, 27 animation MP4 (size, length, fingerprint).
- Minutes (69.5), caption count equals `data-steps`, Bangla notes on every normal slide, no Bangla elsewhere, privacy grep.
- Every step of every slide in light and dark: text outside the diagram, overlapping text, caption overflow, SVG text size, console errors.
- 375 px width, `prefers-reduced-motion`, keys, presenter sync, casts that play inside slides, `videos.html`.
- Notes length per slide against 75 words per minute.
- `transcript.html`: one section per normal slide, Bangla allowed, total minutes and words in the header.

It writes screenshots and contact sheets (`sheet-*.png`) to the output folder.

## Known limits

- Models are Haiku. The slides say so. A different model gives different numbers.
- `/context` reports a 1m window for Haiku in this setup. The slides do not say 200k.
- Casts are 100 columns wide, so terminal text in slides is about 17 to 20 px. The diagram text is 18 px or more.
- `demo/prompt/naive.js` holds Python. The naive prompt did not state a language, and the model chose Python.
- The loop uses `--json-schema` to imitate a tool call. It does not use the native API `tool_use` (that needs an API key).
