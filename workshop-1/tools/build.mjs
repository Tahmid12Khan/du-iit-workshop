#!/usr/bin/env node
// Build index.html, videos.html and transcript.html.  Usage: node tools/build.mjs [--strict] [--quiet]
//   --strict: exit 1 when a hard rule is broken (Bangla outside the speaker notes).
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const W = join(dirname(fileURLToPath(import.meta.url)), '..');
const STRICT = process.argv.includes('--strict');
const QUIET = process.argv.includes('--quiet');
const WORDS_PER_MIN = 75;
const PLAN_MINUTES = 69.5;
const BANGLA = /[ঀ-৿]/;

const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);
const read = (p) => readFileSync(join(W, p), 'utf8');
const privateTerms = existsSync(join(W, 'tools/privacy-terms.txt')) ? read('tools/privacy-terms.txt').split('\n').map((t) => t.trim()).filter(Boolean) : [];
const PRIVATE = new RegExp(['/Users/', ...privateTerms].map((t) => t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).join('|'), 'i');
const list = (dir, ext) => (existsSync(join(W, dir)) ? readdirSync(join(W, dir)).filter((f) => f.endsWith(ext)).sort() : []);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fileExists = (p) => existsSync(join(W, p)) && statSync(join(W, p)).size > 0;

// ---------- slides ----------
const slideFiles = list('slides', '.html');
const slideInfo = [];
const seenIds = new Set();
let slidesHtml = '';

function attrs(str) {
  const o = {};
  for (const m of str.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) o[m[1]] = m[2] ?? '';
  return o;
}

for (const f of slideFiles) {
  const html = read(join('slides', f));
  slidesHtml += `\n<!-- ${f} -->\n${html.trim()}\n`;
  const withoutNotes = html.replace(/<aside\b[^>]*class="[^"]*\bnotes\b[^"]*"[^>]*>[\s\S]*?<\/aside>/g, '');
  if (BANGLA.test(withoutNotes)) err(`${f}: Bangla text outside <aside class="notes">`);
  if (/(?:fill|stroke|stop-color|color)="(?:#|rgb|hsl)/i.test(html)) warn(`${f}: hard-coded color in an SVG attribute`);
  for (const m of html.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/g)) {
    const a = attrs(m[1]);
    if (!/\bslide\b/.test(a.class || '')) continue;
    const body = m[2];
    const animOnly = /\banim-only\b/.test(a.class);
    const cap = body.match(/<ol\b[^>]*class="[^"]*\bcaptions\b[^"]*"[^>]*>([\s\S]*?)<\/ol>/);
    const caps = cap ? (cap[1].match(/<li\b/g) || []).length : 0;
    const notes = body.match(/<aside\b[^>]*class="[^"]*\bnotes\b[^"]*"[^>]*>([\s\S]*?)<\/aside>/);
    const notesText = notes ? notes[1].replace(/<[^>]+>/g, ' ').replace(/\[DO: [^\]]*\]/g, ' ').replace(/\[[A-Z]{2,}(?: [A-Za-z0-9.:_-]+)*\]/g, ' ') : '';
    const words = notesText.split(/\s+/).filter(Boolean).length;
    const steps = parseInt(a['data-steps'] || '0', 10);
    const minutes = animOnly ? 0 : parseFloat(a['data-minutes'] || '0');
    const h2 = body.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/);
    const title = h2 ? h2[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : a.id;
    const info = { file: f, id: a.id, topic: a['data-topic'] || '', animOnly, cmd: a['data-cmd'], steps, caps, minutes, words, hasNotes: !!notes, title, notesHtml: notes ? notes[1].replace(/<[^>]+>/g, ' ').replace(/[ \t\r\n]+/g, ' ').trim() : '' };
    slideInfo.push(info);
    if (!a.id) { err(`${f}: a slide has no id`); continue; }
    if (seenIds.has(a.id)) err(`${f}: duplicate slide id ${a.id}`);
    seenIds.add(a.id);
    if (!animOnly && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(a.id)) warn(`${f}: id ${a.id} should be kebab-case`);
    if (steps !== caps) warn(`${a.id}: data-steps=${steps} but ${caps} captions`);
    if (!animOnly) {
      if (!a['data-topic']) warn(`${a.id}: missing data-topic`);
      if (!minutes) warn(`${a.id}: missing data-minutes`);
      if (!notes) warn(`${a.id}: no speaker notes`);
      else {
        const want = minutes * WORDS_PER_MIN;
        if (want && (words < want * 0.8 || words > want * 1.2)) warn(`${a.id}: notes have ${words} words, expected ${Math.round(want * 0.8)}-${Math.round(want * 1.2)} for ${minutes} min`);
      }
    } else if (a.id !== `anim-${a['data-cmd']}`) warn(`${a.id}: anim-only id should be anim-<data-cmd>`);
  }
}

// ---------- casts ----------
const casts = {};
for (const f of list('casts', '.cast')) {
  const id = basename(f, '.cast');
  const txt = read(join('casts', f));
  casts[id] = txt;
  if (BANGLA.test(txt)) err(`casts/${f}: Bangla text in a terminal recording`);
  if (PRIVATE.test(txt)) err(`casts/${f}: private data in a terminal recording`);
}
const castScript = '<script>window.CASTS=' + JSON.stringify(casts).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029') + ';</script>';

// ---------- other Bangla scan ----------
for (const f of list('demo', '.sh')) if (BANGLA.test(read(join('demo', f)))) err(`demo/${f}: Bangla text`);
for (const f of list('data', '.json')) if (BANGLA.test(read(join('data', f)))) err(`data/${f}: Bangla text`);
if (existsSync(join(W, 'worksheet.html')) && BANGLA.test(read('worksheet.html'))) err('worksheet.html: Bangla text');

// ---------- index.html ----------
const template = read('tools/template.html');
if (!template.includes('<!--W1:SLIDES-->') || !template.includes('<!--W1:CASTS-->')) throw new Error('template.html lost a placeholder');
writeFileSync(join(W, 'index.html'), template.replace('<!--W1:SLIDES-->', () => slidesHtml).replace('<!--W1:CASTS-->', () => castScript));

// ---------- videos.html ----------
const commands = JSON.parse(read('data/commands.json'));
const results = {};
for (const f of list('data', '.json')) {
  if (f === 'commands.json') continue;
  try {
    Object.assign(results, JSON.parse(read(join('data', f))));
  } catch (e) {
    err(`data/${f}: invalid JSON (${e.message})`);
  }
}
const TOPIC_NAMES = { tokens: 'Tokens', context: 'Context window', effort: 'Effort levels', hallucination: 'Hallucination', prompt: 'Parts of a prompt', structured: 'Structured output', toolcall: 'Tool call', agentloop: 'Agent loop' };

function video(kind, id) {
  const path = `video/${kind}/${id}.mp4`;
  const label = kind === 'term' ? 'Terminal video' : 'Animation video';
  if (!fileExists(path)) return `<div class="vbox"><h4>${label}</h4><div class="missing">not yet</div></div>`;
  return `<div class="vbox"><h4>${label}</h4><video controls preload="metadata" src="${path}"></video></div>`;
}

let have = { term: 0, anim: 0, result: 0 };
let cards = '';
let lastTopic = '';
const nav = [];
for (const c of commands) {
  const r = results[c.id];
  if (fileExists(`video/term/${c.id}.mp4`)) have.term++;
  if (fileExists(`video/anim/${c.id}.mp4`)) have.anim++;
  if (r) have.result++;
  if (c.topic !== lastTopic) {
    if (lastTopic) cards += '</div></section>';
    const name = TOPIC_NAMES[c.topic] || c.topic;
    cards += `<section class="group" id="${esc(c.topic)}"><h2>${esc(name)}</h2><div class="cards">`;
    nav.push(`<a href="#${esc(c.topic)}">${esc(name)}</a>`);
    lastTopic = c.topic;
  }
  const nums = r && r.numbers ? Object.entries(r.numbers).map(([k, v]) => `<li><span>${esc(k)}</span> ${esc(typeof v === 'object' ? JSON.stringify(v) : v)}</li>`).join('') : '';
  const meta = [];
  if (r && r.seconds != null) meta.push(`${esc(r.seconds)} s`);
  if (r && r.cost_usd != null) meta.push(`$${esc(r.cost_usd)}`);
  cards += `
<article class="card" id="cmd-${esc(c.id)}">
  <header><span class="badge">${esc(c.id)}</span><h3>${esc(c.title)}</h3></header>
  <div class="field"><h4>Command</h4>${r && r.command ? `<pre class="code">${esc(r.command)}</pre>` : `<pre class="code planned">${esc(c.intent)}</pre><p class="note">Planned command. The real run is not yet recorded.</p>`}</div>
  <div class="field"><h4>Real result</h4>${r && r.result ? `<pre class="code result">${esc(r.result)}</pre>` : '<div class="missing">not yet</div>'}${nums ? `<ul class="nums">${nums}</ul>` : ''}${meta.length ? `<p class="note">Measured: ${meta.join(', ')}</p>` : ''}</div>
  <div class="videos">${video('term', c.id)}${video('anim', c.id)}</div>
</article>`;
}
if (lastTopic) cards += '</div></section>';

const videosHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Workshop 1 videos</title>
<link rel="stylesheet" href="vendor/fonts.css">
<link rel="stylesheet" href="vendor/tokens.css">
<link rel="stylesheet" href="vendor/pages.css">
<script src="vendor/theme.js"></script>
</head>
<body>
<header class="site">
  <nav aria-label="Pages"><a href="index.html">Deck</a><a href="videos.html" aria-current="page">Videos</a><a href="worksheet.html">Worksheet</a><a href="transcript.html">Transcript</a></nav>
  <span data-theme-toggle></span>
</header>
<main>
  <h1>Videos for each command</h1>
  <p class="lead">Each command has a terminal video and an animation video. Both show the real result.</p>
  <ul class="stats">
    <li><strong>${have.term} / ${commands.length}</strong> terminal videos</li>
    <li><strong>${have.anim} / ${commands.length}</strong> animation videos</li>
    <li><strong>${have.result} / ${commands.length}</strong> measured results</li>
  </ul>
  <nav class="jump" aria-label="Topics">${nav.join('')}</nav>
${cards}
</main>
</body>
</html>
`;
writeFileSync(join(W, 'videos.html'), videosHtml);

// ---------- transcript.html ----------
const CUE_RE = /(\[DO: [^\]]*\]|\[[A-Z]{2,}(?: [A-Za-z0-9.:_-]+)*\])/g;
const cueKind = (label) => (/^STEP/.test(label) ? 'step' : /^ASK/.test(label) ? 'ask' : /^PAUSE/.test(label) ? 'pause' : /^(DEMO|LIVE|CLICK)/.test(label) ? 'demo' : /^DO:/.test(label) ? 'do' : 'other');
const clock = (min) => {
  const sec = Math.round(min * 60);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};
const fmtMin = (m) => String(Math.round(m * 10) / 10);
const normalSlides = slideInfo.filter((x) => !x.animOnly);
const totalMinutes = normalSlides.reduce((a, x) => a + x.minutes, 0);
const totalWords = normalSlides.reduce((a, x) => a + x.words, 0);
let clockMin = 0;
let slideNo = 0;
let topicHtml = '';
let lastTopicName = '';
let transcriptBody = '';
for (const x of normalSlides) {
  slideNo++;
  if (x.topic !== lastTopicName) {
    if (lastTopicName) transcriptBody += '</section>';
    transcriptBody += `<section class="topic" id="topic-${slideNo}"><h2 class="topic-name">${esc(x.topic)}</h2>`;
    topicHtml += `<a href="#topic-${slideNo}">${esc(x.topic)}</a>`;
    lastTopicName = x.topic;
  }
  const paras = x.notesHtml
    .split(/(?=\[STEP \d+\])/)
    .filter((t) => t.trim())
    .map((t) => `<p>${esc(t.trim()).replace(/\[(?:DO: )?[^\]]*\]/g, (m) => m.replace(/&quot;/g, '"')).replace(CUE_RE, (m) => `<span class="cue cue-${cueKind(m.slice(1, -1))}">${m.slice(1, -1)}</span>`)}</p>`)
    .join('\n');
  transcriptBody += `
<article class="slide-note" id="${esc(x.id)}">
  <header>
    <span class="no">${slideNo}</span>
    <h3>${esc(x.title)}</h3>
    <p class="meta"><span>${fmtMin(x.minutes)} min</span><span>Start ${clock(clockMin)}</span><span>End ${clock(clockMin + x.minutes)}</span><span>${x.words} words</span></p>
  </header>
  <div class="bn" lang="bn">
${paras}
  </div>
</article>`;
  clockMin += x.minutes;
}
if (lastTopicName) transcriptBody += '</section>';

const transcriptHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Workshop 1 transcript</title>
<link rel="stylesheet" href="vendor/fonts.css">
<link rel="stylesheet" href="vendor/tokens.css">
<link rel="stylesheet" href="vendor/pages.css">
<style>
.bn { font-family: var(--font-bn); line-height: 1.7; font-size: 19px; }
.bn p { margin: 0 0 14px; max-width: 72ch; }
.topic-name { margin-top: 48px; padding-bottom: 8px; border-bottom: 2px solid var(--line); }
.slide-note { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 16px 20px; margin: 0 0 20px; }
.slide-note header { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; align-items: center; margin-bottom: 12px; }
.slide-note .no { font: 700 16px/1 var(--font-mono); background: var(--accent); color: var(--accent-ink); border-radius: 8px; padding: 6px 10px; }
.slide-note .meta { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 6px; margin: 0; }
.slide-note .meta span { background: var(--surface-2); border-radius: 8px; padding: 2px 10px; font-size: 15px; color: var(--ink-2); }
.cue { display: inline-block; font: 600 13px/1.5 var(--font-sans); border: 1px solid var(--line); border-radius: 6px; padding: 0 8px; vertical-align: baseline; background: var(--surface-2); color: var(--ink); }
.cue-step { background: var(--accent-soft); border-color: var(--accent); }
.cue-ask { background: var(--c3); border-color: var(--warn); }
.cue-pause { background: var(--c4); border-color: var(--bad); }
.cue-demo { background: var(--c2); border-color: var(--ok); }
.cue-do { background: var(--c3); border-color: var(--warn); font-style: italic; }
.legend { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 8px 0; font-size: 15px; color: var(--ink-2); }
.toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.toolbar button { font: 600 15px var(--font-sans); border: 1px solid var(--line); background: var(--surface); color: var(--ink); border-radius: 999px; padding: 6px 14px; cursor: pointer; }
@media print {
  header.site, .jump, .toolbar { display: none; }
  html, body { background: #fff; color: #000; }
  body { font-size: 12pt; }
  main { max-width: none; padding: 0; }
  .bn { font-size: 12.5pt; }
  .slide-note { break-inside: avoid-page; border-color: #999; background: #fff; }
  .topic { break-before: page; }
  .topic:first-of-type { break-before: auto; }
  .topic-name { margin-top: 0; }
  .cue { background: #fff !important; color: #000; border-color: #666 !important; }
}
</style>
<script src="vendor/theme.js"></script>
</head>
<body>
<header class="site">
  <nav aria-label="Pages"><a href="index.html">Deck</a><a href="videos.html">Videos</a><a href="worksheet.html">Worksheet</a><a href="transcript.html" aria-current="page">Transcript</a></nav>
  <span data-theme-toggle></span>
</header>
<main>
  <h1>Bangla transcript</h1>
  <p class="lead">The speaker notes of each slide, in order, with the plan time.</p>
  <ul class="stats">
    <li><strong>${fmtMin(totalMinutes)} min</strong> planned</li>
    <li><strong>${totalWords}</strong> spoken words</li>
    <li><strong>${normalSlides.length}</strong> slides</li>
  </ul>
  <p class="legend">Tags:
    <span class="cue cue-step">STEP n</span> animation step
    <span class="cue cue-ask">ASK</span> ask the room
    <span class="cue cue-pause">PAUSE 5s</span> stop
    <span class="cue cue-demo">DEMO ID</span> play or run
    <span class="cue cue-do">DO: text</span> do it, do not say it
  </p>
  <div class="toolbar"><button type="button" onclick="window.print()">Print</button></div>
  <nav class="jump" aria-label="Topics">${topicHtml}</nav>
${transcriptBody}
</main>
</body>
</html>
`;
writeFileSync(join(W, 'transcript.html'), transcriptHtml);

// ---------- report ----------
const normal = slideInfo.filter((s) => !s.animOnly);
const total = normal.reduce((a, s) => a + s.minutes, 0);
const animIds = new Set(slideInfo.filter((s) => s.animOnly).map((s) => s.cmd));
const missingAnim = commands.filter((c) => !animIds.has(c.id)).map((c) => c.id);
if (normal.length && Math.abs(total - PLAN_MINUTES) > 0.01) warn(`data-minutes sum to ${total}, the plan is ${PLAN_MINUTES} (normal while some slide files are missing)`);

if (!QUIET) {
  console.log(`slides: ${normal.length} normal + ${slideInfo.length - normal.length} anim-only | files: ${slideFiles.join(', ') || 'none'}`);
  console.log(`casts: ${Object.keys(casts).length} | minutes: ${total}/${PLAN_MINUTES} | videos: term ${have.term}/${commands.length}, anim ${have.anim}/${commands.length}`);
  if (missingAnim.length && slideInfo.some((s) => s.animOnly)) console.log(`anim-only slides missing for: ${missingAnim.join(' ')}`);
  for (const s of normal) console.log(`  ${s.id.padEnd(22)} ${String(s.minutes).padStart(3)} min  ${String(s.steps).padStart(2)} steps  ${String(s.words).padStart(4)} words  [${s.topic}]`);
}
for (const w of warns) console.warn('WARN  ' + w);
for (const e of errors) console.error('ERROR ' + e);
process.exitCode = STRICT && errors.length ? 1 : 0;
