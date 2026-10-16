#!/usr/bin/env node
// Integration checks for the deck.  Usage: node tools/check.mjs [--out <dir>] [--skip-shots]
// Runs every check, prints a checklist, writes screenshots and contact sheets to <dir>, exits 1 on a failure.
import { chromium } from 'playwright';
import { spawnSync, execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { animHash } from './anim-hash.mjs';

const TOOLS = dirname(fileURLToPath(import.meta.url));
const W = join(TOOLS, '..');
const argv = process.argv.slice(2);
const OUT = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : join(tmpdir(), 'w1-check');
const SHOTS = !argv.includes('--skip-shots');
mkdirSync(OUT, { recursive: true });

const BANGLA = /[ঀ-৿]/;
const results = [];
const check = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`); };
const note = (name, detail) => { results.push({ name, pass: true, info: true, detail }); console.log(`INFO  ${name}  -- ${detail}`); };
const read = (p) => readFileSync(join(W, p), 'utf8');
const privateTerms = existsSync(join(W, 'tools/privacy-terms.txt')) ? read('tools/privacy-terms.txt').split('\n').map((t) => t.trim()).filter(Boolean) : [];
const PRIVATE = new RegExp(['/Users/', ...privateTerms].map((t) => t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).join('|'), 'i');
const walk = (dir) => readdirSync(join(W, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const short = (arr, n = 8) => arr.slice(0, n).join('; ') + (arr.length > n ? `; ... +${arr.length - n}` : '');
const commands = JSON.parse(read('data/commands.json'));

// ---------------------------------------------------------------- static
{
  const b = spawnSync(process.execPath, [join(TOOLS, 'build.mjs'), '--strict', '--quiet'], { encoding: 'utf8' });
  const lines = (b.stderr || '').split('\n').filter((l) => /^(WARN|ERROR)/.test(l));
  check('build --strict: no errors, no warnings', b.status === 0 && lines.length === 0, lines.join(' | '));

  const casts = commands.map((c) => `casts/${c.id}.cast`);
  const missingCast = casts.filter((p) => !existsSync(join(W, p)));
  check('27 casts exist', missingCast.length === 0 && casts.length === 27, `${casts.length - missingCast.length}/27 ${missingCast.join(' ')}`);
  const priv = [];
  for (const p of casts) if (existsSync(join(W, p)) && PRIVATE.test(read(p))) priv.push(p);
  check('privacy grep on all casts is empty', priv.length === 0, priv.join(' '));

  const bangla = [];
  for (const dir of ['casts', 'demo', 'data']) for (const f of walk(dir)) { try { if (BANGLA.test(read(f))) bangla.push(f); } catch (e) { /* binary */ } }
  for (const f of ['worksheet.html', 'videos.html', 'README.md', 'tools/template.html']) if (existsSync(join(W, f)) && BANGLA.test(read(f))) bangla.push(f);
  check('no Bangla in casts, demo files, data, worksheet, videos page, README', bangla.length === 0, bangla.join(' '));

  const term = commands.filter((c) => !existsSync(join(W, `video/term/${c.id}.mp4`)) || statSync(join(W, `video/term/${c.id}.mp4`)).size < 1000).map((c) => c.id);
  const anim = commands.filter((c) => !existsSync(join(W, `video/anim/${c.id}.mp4`)) || statSync(join(W, `video/anim/${c.id}.mp4`)).size < 1000).map((c) => c.id);
  check('27 terminal MP4 exist', term.length === 0, term.join(' '));
  check('27 animation MP4 exist', anim.length === 0, anim.join(' '));
}

// ---------------------------------------------------------------- browser helpers
const browser = await chromium.launch({ channel: 'chrome' });
const FILE = `file://${W}/index.html`;
const consoleLog = [];
function watch(page, tag) {
  page.on('pageerror', (e) => consoleLog.push(`${tag}: pageerror ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') consoleLog.push(`${tag}: ${m.type()} ${m.text()}`); });
  page.on('requestfailed', (r) => consoleLog.push(`${tag}: requestfailed ${r.url().replace(W, '')}`));
}
async function open(opts = {}, url = FILE) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 720 }, colorScheme: opts.theme || 'light', reducedMotion: opts.reduced ? 'reduce' : 'no-preference', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  watch(page, opts.tag || 'page');
  await page.goto(url);
  if (url === FILE) await page.waitForFunction(() => window.Deck && window.Deck.isReady);
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page };
}
const settle = (page) => page.evaluate(() => { document.getAnimations().forEach((a) => { try { a.finish(); } catch (e) { /* infinite */ } }); if (window.Deck) Deck.sync(); });

// ---------------------------------------------------------------- structure
const main = await open({ tag: 'structure' });
const slides = await main.page.evaluate(() => Deck.slides());
const normal = slides.filter((s) => !s.animOnly);
const anim = slides.filter((s) => s.animOnly);
const dom = await main.page.evaluate(() => [...document.querySelectorAll('section.slide')].map((s) => {
  const notes = s.querySelector('aside.notes');
  const clone = s.cloneNode(true);
  clone.querySelectorAll('aside.notes, script, style').forEach((n) => n.remove());
  const attrText = [...clone.querySelectorAll('[aria-label],[title],[alt]')].map((n) => (n.getAttribute('aria-label') || '') + (n.getAttribute('title') || '') + (n.getAttribute('alt') || '')).join(' ');
  return {
    id: s.id, animOnly: s.classList.contains('anim-only'), steps: +s.dataset.steps, minutes: parseFloat(s.dataset.minutes || '0'),
    caps: s.querySelectorAll('ol.captions > li').length,
    notesLang: notes ? notes.getAttribute('lang') : null,
    notesText: notes ? notes.textContent.replace(/\[DO: [^\]]*\]/g, ' ').replace(/\[[A-Z]{2,}(?: [A-Za-z0-9.:_-]+)*\]/g, ' ') : '',
    visible: clone.textContent + ' ' + attrText,
  };
}));
const sumMin = dom.filter((d) => !d.animOnly).reduce((a, d) => a + d.minutes, 0);
check('slide counts', normal.length === 37 && anim.length === 27, `${normal.length} normal + ${anim.length} anim-only = ${slides.length}`);
check('data-minutes on normal slides sum to 69.5', Math.abs(sumMin - 69.5) < 0.01, `sum ${sumMin}`);
const capBad = dom.filter((d) => d.steps !== d.caps).map((d) => `${d.id} steps ${d.steps} caps ${d.caps}`);
check('captions count == data-steps on every slide', capBad.length === 0, capBad.length ? short(capBad) : `${dom.length} slides`);
const animIds = new Set(anim.map((s) => s.cmd));
const animMiss = commands.filter((c) => !animIds.has(c.id)).map((c) => c.id);
check('27 anim-only slides, one per command', animMiss.length === 0, animMiss.join(' '));
const noBn = dom.filter((d) => !d.animOnly && !(d.notesLang === 'bn' && (d.notesText.match(/[ঀ-৿]/g) || []).length > 100)).map((d) => d.id);
check('every normal slide has Bangla notes (lang="bn")', noBn.length === 0, noBn.join(' '));
const bnVisible = dom.filter((d) => BANGLA.test(d.visible)).map((d) => d.id);
check('no Bangla in visible text or attributes outside .notes', bnVisible.length === 0, bnVisible.join(' '));
const bnPage = await main.page.evaluate(() => { const c = document.body.cloneNode(true); c.querySelectorAll('aside, script, style, section.slide').forEach((n) => n.remove()); return /[ঀ-৿]/.test(c.textContent); });
check('no Bangla in the deck chrome', !bnPage);
const bnTerm = await main.page.evaluate(() => Object.values(window.CASTS).some((t) => /[ঀ-৿]/.test(t)));
check('no Bangla in inlined casts', !bnTerm);

// notes words vs minutes
{
  const rows = dom.filter((d) => !d.animOnly).map((d) => {
    const words = d.notesText.split(/\s+/).filter(Boolean).length;
    const want = d.minutes * 75;
    return { id: d.id, minutes: d.minutes, words, want, pct: Math.round((words / want - 1) * 100) };
  });
  const total = rows.reduce((a, r) => a + r.words, 0);
  const out30 = rows.filter((r) => Math.abs(r.pct) > 30);
  const out20 = rows.filter((r) => Math.abs(r.pct) > 20);
  check('notes words within +-30% of 75 words/minute on every slide', out30.length === 0, `${rows.length} slides; total ${total} words; >20% off: ${short(out20.map((r) => `${r.id} ${r.words}w vs ${r.want} (${r.pct}%)`)) || 'none'}`);
  writeFileSync(join(OUT, 'notes-words.json'), JSON.stringify(rows, null, 1));
  note('total notes words', `${total} words for ${sumMin} min = ${(total / sumMin).toFixed(1)} words/min`);
}
await main.ctx.close();

// ---------------------------------------------------------------- per slide, per step (light + dark)
const ORDER = [...slides.map((s) => s.id)];
const pageDefects = `(() => {
  const out = [];
  const W = innerWidth, H = innerHeight;
  const slide = document.querySelector('section.slide.active') || document.querySelector('section.slide.is-current') || [...document.querySelectorAll('section.slide')].find((s) => getComputedStyle(s).display !== 'none' && getComputedStyle(s).visibility !== 'hidden' && s.getBoundingClientRect().width > 0);
  if (!slide) return ['no active slide'];
  const vis = (n) => { for (let e = n; e && e !== slide.parentNode; e = e.parentNode) { if (!e.nodeType || e.nodeType !== 1) continue; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.1) return false; } return true; };
  // 1. svg text outside its viewBox, and rendered size
  slide.querySelectorAll('svg.diagram').forEach((svg) => {
    const vb = svg.viewBox.baseVal;
    svg.querySelectorAll('text').forEach((t) => {
      if (!vis(t) || !t.textContent.trim()) return;
      let b; try { b = t.getBBox(); } catch (e) { return; }
      if (b.x < vb.x - 1 || b.y < vb.y - 1 || b.x + b.width > vb.x + vb.width + 1 || b.y + b.height > vb.y + vb.height + 1) out.push('text outside viewBox: ' + t.textContent.trim().slice(0, 30));
      const m = t.getScreenCTM(); const fs = parseFloat(getComputedStyle(t).fontSize);
      if (m && fs * m.a < 17.5) out.push('small svg text ' + (fs * m.a).toFixed(1) + 'px: ' + t.textContent.trim().slice(0, 30));
    });
  });
  // 2. overlap between visible svg texts
  slide.querySelectorAll('svg.diagram').forEach((svg) => {
    const eff = (n) => { let o = 1; for (let e = n; e && e !== svg.parentNode; e = e.parentNode) if (e.nodeType === 1) o *= +getComputedStyle(e).opacity; return o; };
    const top = (t) => { const r = t.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!e && (e === t || t.contains(e)); };
    const ts = [...svg.querySelectorAll('text')].filter((t) => vis(t) && t.textContent.trim() && eff(t) >= 0.5 && top(t));
    const rs = ts.map((t) => t.getBoundingClientRect());
    for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) {
      if (ts[i].contains(ts[j]) || ts[j].contains(ts[i])) continue;
      const a = rs[i], b = rs[j];
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 2 && h > 4 && (w * h) / Math.min(a.width * a.height, b.width * b.height) > 0.25) out.push('overlap: "' + ts[i].textContent.trim().slice(0, 20) + '" / "' + ts[j].textContent.trim().slice(0, 20) + '"');
    }
  });
  // 3. html text that leaves the stage, and clipped boxes
  slide.querySelectorAll('h2, .reveal, .check, .cmdbox, li, p, pre').forEach((n) => {
    if (!vis(n) || n.closest('.captions') || n.closest('aside') || n.closest('.term') || !n.textContent.trim()) return;
    const r = n.getBoundingClientRect();
    if (r.width && (r.right > W + 1 || r.bottom > H + 1 || r.left < -1 || r.top < -1)) out.push('html outside window: ' + n.textContent.trim().slice(0, 30));
    if (n.scrollWidth > n.clientWidth + 2 && getComputedStyle(n).overflowX !== 'visible') out.push('clipped html: ' + n.textContent.trim().slice(0, 30));
  });
  // 4. caption overflow
  const cap = document.getElementById('cap');
  if (cap && (cap.scrollHeight > cap.clientHeight + 2 || cap.scrollWidth > cap.clientWidth + 2)) out.push('caption overflow');
  if (document.documentElement.scrollWidth > innerWidth + 1) out.push('page scrolls sideways');
  return out;
})()`;

const defectLog = [];
const shotFiles = { light: [], dark: [], anim: [] };
for (const theme of ['light', 'dark']) {
  const { ctx, page } = await open({ theme, tag: `visual-${theme}` });
  await page.evaluate((t) => window.Theme && window.Theme.set(t), theme);
  let stepsChecked = 0;
  for (const s of slides) {
    for (let st = 1; st <= s.steps; st++) {
      await page.evaluate(([i, n]) => Deck.go(i, n), [s.id, st]);
      await settle(page);
      const st2 = await page.evaluate(() => Deck.state());
      if (st2.id !== s.id || st2.step !== st) defectLog.push(`${theme} ${s.id} step ${st}: state is ${st2.id}/${st2.step}`);
      const d = await page.evaluate(pageDefects);
      for (const x of d) defectLog.push(`${theme} ${s.id} step ${st}: ${x}`);
      stepsChecked++;
      if (SHOTS && st === s.steps) {
        const f = join(OUT, `${theme}-${s.animOnly ? 'z' : 'a'}-${String(ORDER.indexOf(s.id)).padStart(2, '0')}-${s.id}.png`);
        await page.screenshot({ path: f });
        (s.animOnly ? (theme === 'light' ? shotFiles.anim : []) : shotFiles[theme]).push(f);
      }
    }
  }
  note(`visual ${theme}`, `${stepsChecked} slide-steps visited`);
  await ctx.close();
}
const hard = defectLog.filter((x) => !/small svg text|overlap:/.test(x));
const soft = defectLog.filter((x) => /small svg text|overlap:/.test(x));
check('no text outside viewBox / window, no caption overflow, no sideways page scroll (both themes, every step)', hard.length === 0, short(hard, 12));
check('no overlapping svg text', !soft.some((x) => /overlap/.test(x)), short(soft.filter((x) => /overlap/.test(x)), 12));
{
  const smalls = soft.filter((x) => /small svg text/.test(x));
  check('svg text >= 18px at 1280x720 on every slide-step', smalls.length === 0, `${smalls.length} hits: ${short(smalls, 6)}`);
}
writeFileSync(join(OUT, 'defects.txt'), defectLog.join('\n'));

// ---------------------------------------------------------------- 375px
{
  const { ctx, page } = await open({ viewport: { width: 375, height: 800 }, tag: 'phone' });
  const bad = [];
  for (const s of slides) {
    await page.evaluate(([i]) => Deck.go(i, 1), [s.id]);
    await settle(page);
    const w = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
    if (w > 376) bad.push(`${s.id} ${w}px`);
  }
  await page.evaluate(([i]) => Deck.go(i, 3), [normal[3].id]);
  if (SHOTS) await page.screenshot({ path: join(OUT, 'phone-375.png') });
  check('375px width: no horizontal scroll on any slide', bad.length === 0, bad.length ? short(bad) : `${slides.length} slides`);
  await ctx.close();
  for (const pg of ['worksheet.html', 'videos.html', 'transcript.html']) {
    const { ctx: c2, page: p2 } = await open({ viewport: { width: 375, height: 800 }, tag: pg }, `file://${W}/${pg}`);
    const w = await p2.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
    check(`375px width: ${pg} has no horizontal scroll`, w <= 376, `${w}px`);
    await c2.close();
  }
}

// ---------------------------------------------------------------- reduced motion
{
  const { ctx, page } = await open({ reduced: true, tag: 'reduced' });
  const probs = [];
  const probe = normal.find((s) => s.id === 'tokens-1') || normal[3];
  for (const s of [probe, ...normal.filter((x) => /^(context-1|agentloop-1|effort-3)$/.test(x.id))]) {
    for (let st = 1; st <= s.steps; st++) {
      await page.evaluate(([i, n]) => Deck.go(i, n), [s.id, st]);
      await page.waitForTimeout(60);
      const r = await page.evaluate(() => {
        const running = document.getAnimations().filter((a) => a.playState === 'running' && a.effect && isFinite(a.effect.getComputedTiming().endTime) && a.effect.getComputedTiming().endTime > 50).length;
        const st = Deck.state();
        const slide = document.querySelector('section.slide.active') || document.querySelector('section.slide.is-current');
        const act = slide ? slide.querySelectorAll('.is-active').length : -1;
        const dur = [...(slide || document).querySelectorAll('svg.diagram [data-step]')].map((n) => parseFloat(getComputedStyle(n).transitionDuration)).filter((x) => x > 0).length;
        return { running, step: st.step, act, dur, cap: st.caption };
      });
      if (r.running) probs.push(`${s.id}/${st}: ${r.running} running animations`);
      if (r.dur) probs.push(`${s.id}/${st}: ${r.dur} elements with a transition`);
      if (r.step !== st || !r.cap) probs.push(`${s.id}/${st}: step or caption not shown`);
    }
  }
  check('prefers-reduced-motion: steps and captions work, no transitions or running animations', probs.length === 0, short(probs));
  await ctx.close();
}

// ---------------------------------------------------------------- keyboard
{
  const { ctx, page } = await open({ tag: 'keys' });
  const st = () => page.evaluate(() => Deck.state());
  const probs = [];
  const a = normal[3]; // tokens-1
  const b = normal[4];
  await page.evaluate(([i]) => Deck.go(i, 1), [a.id]);
  for (let i = 1; i < a.steps; i++) { await page.keyboard.press('ArrowRight'); }
  let s = await st();
  if (!(s.id === a.id && s.step === a.steps)) probs.push(`ArrowRight x${a.steps - 1}: ${s.id}/${s.step}`);
  await page.keyboard.press('ArrowRight');
  s = await st();
  if (!(s.id === b.id && s.step === 1)) probs.push(`ArrowRight after last step: ${s.id}/${s.step}, expected ${b.id}/1`);
  await page.keyboard.press('ArrowLeft');
  s = await st();
  if (!(s.id === a.id && s.step === a.steps)) probs.push(`ArrowLeft at step 1: ${s.id}/${s.step}, expected ${a.id}/${a.steps}`);
  await page.keyboard.press('ArrowLeft');
  s = await st();
  if (s.step !== a.steps - 1) probs.push(`ArrowLeft: step ${s.step}`);
  await page.evaluate(([i]) => Deck.go(i, 1), [a.id]);
  await page.keyboard.press(' ');
  s = await st();
  if (s.step !== 2) probs.push(`Space: step ${s.step}`);
  await page.keyboard.press('Home'); s = await st();
  if (s.id !== normal[0].id || s.step !== 1) probs.push(`Home: ${s.id}/${s.step}`);
  await page.keyboard.press('End'); s = await st();
  if (s.id !== normal[normal.length - 1].id) probs.push(`End: ${s.id}`);
  await page.keyboard.press('Home');
  await page.keyboard.press('PageDown'); s = await st();
  if (s.id !== normal[1].id) probs.push(`PageDown: ${s.id}`);
  await page.keyboard.press('PageUp'); s = await st();
  if (s.id !== normal[0].id) probs.push(`PageUp: ${s.id}`);
  // N
  const open0 = await page.evaluate(() => document.getElementById('notes').classList.contains('open'));
  await page.keyboard.press('n');
  const open1 = await page.evaluate(() => document.getElementById('notes').classList.contains('open'));
  const nbody = await page.evaluate(() => document.querySelector('#notes .nbody').textContent);
  await page.keyboard.press('N');
  const open2 = await page.evaluate(() => document.getElementById('notes').classList.contains('open'));
  if (open0 || !open1 || open2) probs.push(`N toggle: ${open0}/${open1}/${open2}`);
  if (!BANGLA.test(nbody)) probs.push('N drawer shows no Bangla notes');
  // T
  const themes = [];
  for (let i = 0; i < 3; i++) { await page.keyboard.press('t'); themes.push(await page.evaluate(() => document.documentElement.getAttribute('data-theme') || 'system')); }
  if (new Set(themes).size !== 3) probs.push(`T cycle: ${themes.join(',')}`);
  // keys ignored when a button has focus
  await page.evaluate(([i]) => Deck.go(i, 1), [a.id]);
  await page.focus('#btn-notes');
  await page.keyboard.press('ArrowRight');
  s = await st();
  if (s.step !== 1) probs.push('arrow key not ignored on a focused button');
  check('keyboard: arrows, Space, Home/End, PageUp/PageDown, N, T, focus guard', probs.length === 0, short(probs));
  // P and presenter sync
  const presProbs = [];
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.evaluate(([i]) => Deck.go(i, 1), [a.id]);
  const [pop] = await Promise.all([page.waitForEvent('popup', { timeout: 5000 }).catch(() => null), page.keyboard.press('p')]);
  if (!pop) presProbs.push('P opened no window');
  else {
    watch(pop, 'presenter');
    await pop.waitForFunction(() => window.Deck && window.Deck.isReady);
    await pop.waitForTimeout(500);
    let ps = await pop.evaluate(() => Deck.state());
    if (ps.id !== a.id) presProbs.push(`presenter opens on ${ps.id}`);
    await page.bringToFront();
    await page.keyboard.press('ArrowRight');
    await pop.waitForTimeout(400);
    ps = await pop.evaluate(() => Deck.state());
    if (!(ps.id === a.id && ps.step === 2)) presProbs.push(`deck -> presenter: ${ps.id}/${ps.step}`);
    await page.keyboard.press('PageDown');
    await pop.waitForTimeout(400);
    ps = await pop.evaluate(() => Deck.state());
    if (ps.id !== b.id) presProbs.push(`deck PageDown -> presenter: ${ps.id}`);
    await pop.bringToFront();
    await pop.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);
    let ms = await st();
    const ps2 = await pop.evaluate(() => Deck.state());
    if (!(ms.id === ps2.id && ms.step === ps2.step && ms.step === 2)) presProbs.push(`presenter -> deck: ${ms.id}/${ms.step} vs ${ps2.id}/${ps2.step}`);
    const notesShown = await pop.evaluate(() => /[ঀ-৿]/.test(document.getElementById('p-notes').textContent));
    if (!notesShown) presProbs.push('presenter shows no Bangla notes');
    const timerOk = await pop.evaluate(() => /\d+:\d\d/.test(document.getElementById('p-elapsed').textContent));
    if (!timerOk) presProbs.push('presenter timer missing');
    if (SHOTS) await pop.screenshot({ path: join(OUT, 'presenter.png') });
    await pop.close();
  }
  check('presenter window (P): opens, syncs both ways on file://, shows notes and timer', presProbs.length === 0, short(presProbs));
  await ctx.close();
}

// ---------------------------------------------------------------- play and live demo smoke
{
  const { ctx, page } = await open({ tag: 'play' });
  const probs = [];
  await page.evaluate(() => Deck.go('tokens-1', 1));
  await page.evaluate(() => Deck.play());
  await page.waitForTimeout(3600);
  const s1 = await page.evaluate(() => Deck.state());
  if (s1.step < 2) probs.push(`play did not advance (step ${s1.step})`);
  await page.evaluate(() => Deck.pause());
  // casts start when their step begins: check every .term gets a player
  const terms = await page.evaluate(() => [...document.querySelectorAll('.term')].map((t) => ({ slide: t.closest('section').id, cast: t.dataset.cast, hasCast: !!(window.CASTS && window.CASTS[t.dataset.cast]), step: t.dataset.playStep })));
  const noCast = terms.filter((t) => !t.hasCast).map((t) => `${t.slide}:${t.cast}`);
  if (noCast.length) probs.push('no cast for ' + noCast.join(' '));
  const used = new Set(terms.map((t) => t.cast));
  check('play advances steps; every terminal component has its cast', probs.length === 0, `${terms.length} terminal components. ${short(probs)}`);
  const usedIds = [...used].sort().join(' ');
  note('casts embedded in slides', `${used.size}/27: ${usedIds}`);
  await ctx.close();
}

// ---------------------------------------------------------------- casts play in real time inside the slides
{
  const { ctx, page } = await open({ tag: 'casts' });
  const terms = await page.evaluate(() => [...document.querySelectorAll('.term')].map((t) => ({ slide: t.closest('section').id, cast: t.dataset.cast, step: parseInt(t.dataset.playStep, 10) })));
  const probs = [];
  const manual = [];
  let played = 0;
  for (const t of terms) {
    if (t.step > 50) { manual.push(t.cast); continue; }
    await page.evaluate(([i, n]) => Deck.go(i, n), [t.slide, t.step]);
    await page.waitForTimeout(2200);
    const r = await page.evaluate((c) => {
      const el = document.querySelector(`.term[data-cast="${c}"]`);
      const r = el.getBoundingClientRect();
      let shown = true;
      for (let n = el; n && n !== document.body; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.5) shown = false; }
      const txt = (el.querySelector('.ap-terminal, .ap-term') || el).textContent.replace(/\s+/g, '');
      return { w: r.width, h: r.height, shown, len: txt.length };
    }, t.cast);
    if (r.w < 300 || r.h < 150) probs.push(`${t.cast}: player ${Math.round(r.w)}x${Math.round(r.h)}`);
    else if (!r.shown) probs.push(`${t.cast}: player hidden at its play step`);
    else if (r.len < 5) probs.push(`${t.cast}: no terminal text after 2 s`);
    else played++;
  }
  check('casts play at their step inside the slides (visible, with text, no console errors)', probs.length === 0, `${played} played; manual play (step 99): ${manual.join(' ')}. ${short(probs)}`);
  await ctx.close();
}

// ---------------------------------------------------------------- videos page, worksheet
{
  const { ctx, page } = await open({ tag: 'videos' }, `file://${W}/videos.html`);
  const info = await page.evaluate(() => ({
    cards: document.querySelectorAll('article.card').length,
    vids: [...document.querySelectorAll('article.card')].map((c) => ({ id: c.id, n: c.querySelectorAll('video[src]').length, missing: c.querySelectorAll('.missing').length })),
    srcs: [...document.querySelectorAll('video[src]')].map((v) => v.getAttribute('src')),
  }));
  const bad = info.vids.filter((v) => v.n !== 2 || v.missing);
  const gone = info.srcs.filter((s) => !existsSync(join(W, s)));
  check('videos.html lists 27 commands, each with a terminal and an animation video', info.cards === 27 && bad.length === 0 && gone.length === 0, `${info.cards} cards, ${info.srcs.length} videos; bad: ${short(bad.map((b) => b.id))} ${short(gone)}`);
  await ctx.close();
  const { ctx: c2, page: p2 } = await open({ tag: 'worksheet' }, `file://${W}/worksheet.html`);
  const ws = await p2.evaluate(() => document.body.textContent.length);
  check('worksheet.html loads without console errors', ws > 1000, `${ws} chars`);
  await c2.close();
  const { ctx: c3, page: p3 } = await open({ tag: 'transcript' }, `file://${W}/transcript.html`);
  const tr = await p3.evaluate(() => ({
    ids: [...document.querySelectorAll('article.slide-note')].map((a) => a.id),
    bnBlocks: [...document.querySelectorAll('article.slide-note .bn')].filter((n) => n.getAttribute('lang') === 'bn' && /[ঀ-৿]/.test(n.textContent)).length,
    font: getComputedStyle(document.querySelector('.bn')).fontFamily,
    lh: parseFloat(getComputedStyle(document.querySelector('.bn')).lineHeight) / parseFloat(getComputedStyle(document.querySelector('.bn')).fontSize),
    toggle: document.querySelectorAll('[data-theme-toggle] button').length,
    head: document.querySelector('.stats').textContent,
    cues: document.querySelectorAll('article .cue').length,
  }));
  const wantIds = normal.map((s) => s.id);
  const ordered = tr.ids.length === wantIds.length && tr.ids.every((id, i) => id === wantIds[i]);
  const headNums = tr.head.match(/[\d.]+/g) || [];
  check('transcript.html: one Bangla block per normal slide in deck order, Hind Siliguri, line-height 1.7, theme toggle, cue tags, totals in the header',
    ordered && tr.bnBlocks === 37 && /Hind Siliguri/.test(tr.font) && Math.abs(tr.lh - 1.7) < 0.02 && tr.toggle === 3 && tr.cues > 100 && headNums[0] === '69.5',
    `${tr.ids.length} articles, ${tr.bnBlocks} Bangla blocks, font ${tr.font}, lh ${tr.lh.toFixed(2)}, toggle ${tr.toggle}, cues ${tr.cues}, header ${tr.head.replace(/\s+/g, ' ')}`);
  await c3.close();
}

// ---------------------------------------------------------------- video files (ffprobe)
{
  const probs = [];
  const rows = [];
  const manifest = existsSync(join(W, 'video/anim/manifest.json')) ? JSON.parse(read('video/anim/manifest.json')) : {};
  for (const c of commands) {
    const f = join(W, `video/anim/${c.id}.mp4`);
    const t = join(W, `video/term/${c.id}.mp4`);
    const probe = (p) => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height,r_frame_rate,duration,codec_name', '-of', 'json', p], { encoding: 'utf8' })).streams[0];
    try {
      const a = probe(f), tt = probe(t);
      const slide = slides.find((s) => s.cmd === c.id);
      const dur = parseFloat(a.duration);
      const expect = 3.0 + (slide.steps - 1) * 3.0 + 0.6;
      if (manifest[c.id] !== animHash(W, `anim-${c.id}`)) probs.push(`${c.id}: anim video does not match the slide (re-render)`);
      if (a.width !== 1280 || a.height !== 720 || a.r_frame_rate !== '30/1') probs.push(`${c.id}: ${a.width}x${a.height} ${a.r_frame_rate}`);
      if (Math.abs(dur - expect) > 3) probs.push(`${c.id}: anim ${dur.toFixed(1)}s for ${slide.steps} steps (about ${expect.toFixed(1)}s expected)`);
      if (!(parseFloat(tt.duration) > 2)) probs.push(`${c.id}: term video ${tt.duration}s`);
      rows.push(`${c.id} anim ${dur.toFixed(1)}s term ${parseFloat(tt.duration).toFixed(1)}s`);
    } catch (e) { probs.push(`${c.id}: ffprobe failed`); }
  }
  check('27 animation MP4: 1280x720, 30 fps, length fits the steps, made from the current slide and engine; 27 terminal MP4 > 2 s', probs.length === 0, short(probs, 10));
  writeFileSync(join(OUT, 'videos.txt'), rows.join('\n'));
}

// ---------------------------------------------------------------- numbers on slides
{
  const ansi = /\x1b\[[0-9;?]*[A-Za-z]/g;
  const hay = new Set();
  const add = (txt) => { for (const m of txt.matchAll(/\d[\d,]*(?:\.\d+)?/g)) { hay.add(m[0].replace(/,/g, '')); } };
  for (const f of walk('data')) add(read(f));
  for (const c of commands) { try { add(read(`casts/${c.id}.cast`).replace(ansi, '')); } catch (e) { /* skip */ } }
  const un = [];
  for (const d of dom) {
    const t = d.visible.replace(/\s+/g, ' ');
    for (const m of t.matchAll(/\$?\d[\d,]*(?:\.\d+)?/g)) {
      const n = m[0].replace(/[,$]/g, '');
      if (!hay.has(n)) un.push(`${d.id}:${m[0]}`);
    }
  }
  writeFileSync(join(OUT, 'numbers-not-in-data.txt'), un.join('\n'));
  note('numbers on slides not found in data/*.json or casts (review by hand)', `${un.length}: ${short(un, 60)}`);
}

// ---------------------------------------------------------------- console errors collected so far
check('no console errors or warnings during all page loads and steps', consoleLog.length === 0, short([...new Set(consoleLog)], 6));

// ---------------------------------------------------------------- contact sheets
if (SHOTS) {
  const sheets = [];
  for (const [name, files] of Object.entries(shotFiles)) {
    for (let i = 0; i < files.length; i += 9) {
      const out = join(OUT, `sheet-${name}-${String(i / 9 + 1)}.png`);
      const chunk = files.slice(i, i + 9);
      const args = ['-loglevel', 'error', '-y'];
      chunk.forEach((f) => args.push('-i', f));
      const filt = chunk.length === 1 ? '[0:v]scale=640:360[o]' : chunk.map((_, k) => `[${k}:v]scale=640:360[v${k}]`).join(';') + ';' + chunk.map((_, k) => `[v${k}]`).join('') + `xstack=inputs=${chunk.length}:layout=${chunk.map((_, k) => `${(k % 3) * 640}_${Math.floor(k / 3) * 360}`).join('|')}[o]`;
      args.push('-filter_complex', filt, '-map', '[o]', out);
      execFileSync('ffmpeg', args);
      sheets.push(out);
    }
  }
  note('contact sheets', sheets.join(' '));
}

await browser.close();
const fails = results.filter((r) => !r.pass);
console.log(`\n${results.filter((r) => !r.info).length - fails.length}/${results.filter((r) => !r.info).length} checks passed; screenshots in ${OUT}`);
writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 1));
process.exit(fails.length ? 1 : 0);
