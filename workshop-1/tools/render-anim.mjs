#!/usr/bin/env node
// Render animation slides to MP4 by deterministic frame stepping.
//   node tools/render-anim.mjs <ID|slideId|all> [--fps 30] [--theme light|dark] [--jobs 3] [--keep-frames]
//   ID       command id (T1, C2 ...): renders slide anim-<ID> to video/anim/<ID>.mp4
//   slideId  any slide id of index.html: renders it to video/anim/<slideId>.mp4
//   all      every anim-only slide that exists
// Method: capture mode (?capture=1), pause and seek document.getAnimations() per frame, screenshot, encode with ffmpeg.
// The page never runs in real time, so the result does not depend on the speed of the machine.
import { chromium } from 'playwright';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, symlinkSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { animHash } from './anim-hash.mjs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const TOOLS = dirname(fileURLToPath(import.meta.url));
const W = join(TOOLS, '..');
const argv = process.argv.slice(2);
const flag = (name, def) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : def; };
const VALUE_FLAGS = new Set(['--fps', '--theme', '--jobs']);
const target = argv.find((a, i) => !a.startsWith('--') && !VALUE_FLAGS.has(argv[i - 1]));
const FPS = parseInt(flag('fps', '30'), 10);
const THEME = flag('theme', 'light');
const JOBS = parseInt(flag('jobs', '3'), 10);
const KEEP = argv.includes('--keep-frames');
const HOLD_S = 2.4;        // hold after the transition of each step
const FIRST_HOLD_S = 3.0;  // step 1 has no transition
const END_PAD_S = 0.6;     // extra hold on the last step
const FRAME = 1 / FPS;

if (!target) {
  console.error('usage: node tools/render-anim.mjs <ID|slideId|all> [--fps 30] [--theme light|dark] [--jobs 3] [--keep-frames]');
  process.exit(2);
}

const build = spawnSync(process.execPath, [join(TOOLS, 'build.mjs'), '--quiet'], { stdio: ['ignore', 'ignore', 'inherit'] });
if (build.status !== 0) { console.error('build failed'); process.exit(1); }
mkdirSync(join(W, 'video', 'anim'), { recursive: true });

const url = (id, step = 1) => `file://${W}/index.html?capture=1&theme=${THEME}&slide=${encodeURIComponent(id)}&step=${step}`;

async function openPage(browser, id) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, colorScheme: THEME, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url(id));
  await page.waitForFunction(() => window.Deck && window.Deck.isReady);
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page, errors };
}

async function renderOne(browser, id, outName) {
  const { ctx, page, errors } = await openPage(browser, id);
  const dir = mkdtempSync(join(tmpdir(), `w1-anim-${outName}-`));
  const entries = []; // { file, duration }
  let n = 0;
  const shot = async () => {
    const file = join(dir, `f${String(n++).padStart(5, '0')}.png`);
    await page.screenshot({ path: file });
    return file;
  };
  try {
    const info = await page.evaluate((i) => ({ steps: window.Deck.steps(i), state: window.Deck.state() }), id);
    if (!info.steps) throw new Error(`no slide ${id} in index.html`);
    if (info.state.id !== id) throw new Error(`Deck shows ${info.state.id}, not ${id}`);
    const steps = info.steps;

    entries.push({ file: await shot(), duration: steps === 1 ? FIRST_HOLD_S + END_PAD_S : FIRST_HOLD_S });
    for (let s = 2; s <= steps; s++) {
      await page.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch (e) { /* infinite animation */ } }));
      // Start the step, then pause every animation it created before any frame is drawn.
      const endMs = await page.evaluate(([i, st]) => {
        window.Deck.go(i, st);
        const anims = document.getAnimations();
        anims.forEach((a) => a.pause());
        window.__anims = anims;
        return anims.reduce((m, a) => Math.max(m, a.effect.getComputedTiming().endTime), 0);
      }, [id, s]);
      const frames = Math.ceil(endMs / 1000 / FRAME);
      for (let f = 0; f < frames; f++) {
        const t = f * FRAME * 1000;
        await page.evaluate((tt) => { window.__anims.forEach((a) => { a.currentTime = tt; }); window.Deck.sync(); }, t);
        entries.push({ file: await shot(), duration: FRAME });
      }
      await page.evaluate((e) => { window.__anims.forEach((a) => { a.currentTime = e; }); window.Deck.sync(); }, endMs);
      entries.push({ file: await shot(), duration: HOLD_S + (s === steps ? END_PAD_S : 0) });
    }
    const caption = await page.evaluate(() => document.getElementById('cap').textContent);
    if (!caption) errors.push('empty caption on the last step');

    // Expand each entry to a constant frame rate with symlinks, so every frame lasts exactly 1/FPS s.
    let total = 0;
    for (const e of entries) {
      const repeat = Math.max(1, Math.round(e.duration * FPS));
      for (let k = 0; k < repeat; k++) symlinkSync(e.file, join(dir, `g${String(total++).padStart(6, '0')}.png`));
    }
    const out = join(W, 'video', 'anim', `${outName}.mp4`);
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', join(dir, 'g%06d.png'),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', out]);
    const seconds = total / FPS;
    return { id, out: `video/anim/${outName}.mp4`, steps, frames: n, seconds, errors, hash: animHash(W, id) };
  } finally {
    await ctx.close();
    if (!KEEP) rmSync(dir, { recursive: true, force: true }); else console.log('frames kept in', dir);
  }
}

const browser = await chromium.launch({ channel: 'chrome' });
let exit = 0;
try {
  const probe = await openPage(browser, 'x');
  const slides = await probe.page.evaluate(() => window.Deck.slides());
  await probe.ctx.close();
  let jobs;
  if (target === 'all') jobs = slides.filter((s) => s.animOnly).map((s) => ({ id: s.id, out: s.cmd }));
  else if (slides.some((s) => s.id === target)) jobs = [{ id: target, out: slides.find((s) => s.id === target).cmd || target }];
  else if (slides.some((s) => s.id === `anim-${target}`)) jobs = [{ id: `anim-${target}`, out: target }];
  else throw new Error(`no slide "${target}" or "anim-${target}" in index.html`);
  if (!jobs.length) console.log('no anim-only slides yet');

  const manifestPath = join(W, 'video', 'anim', 'manifest.json');
  const manifest = {};
  const queue = [...jobs];
  const worker = async () => {
    while (queue.length) {
      const j = queue.shift();
      try {
        const r = await renderOne(browser, j.id, j.out);
        if (THEME === 'light' && FPS === 30) manifest[j.out] = r.hash;
        console.log(`ok ${r.out}  ${r.steps} steps, ${r.frames} frames, ${r.seconds.toFixed(1)} s${r.errors.length ? '  PAGE ERRORS: ' + r.errors.join(' | ') : ''}`);
        if (r.errors.length) exit = 1;
      } catch (e) {
        console.error(`FAIL ${j.id}: ${e.message}`);
        exit = 1;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(JOBS, jobs.length)) }, worker));
  const old = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
  writeFileSync(manifestPath, JSON.stringify({ ...old, ...manifest }, null, 1) + '\n');
} catch (e) {
  console.error(e.message);
  exit = 1;
} finally {
  await browser.close();
}
process.exit(exit);
