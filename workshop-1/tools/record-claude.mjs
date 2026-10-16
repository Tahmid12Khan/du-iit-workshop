// usage: node tools/record-claude.mjs <ID>...  → types demo/<ID>.claude into a terminal; writes casts/<ID>.cast and video/term/<ID>.mp4
// The IDs share one tmux session, so one Claude Code session runs across them (for example C1 C2 C3 C4 C5).
// Lines in demo/<ID>.claude: "$ text" goes to the shell, "> text" goes to Claude Code, "# text" is a note and is not typed.
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const W = join(dirname(fileURLToPath(import.meta.url)), '..');
const SESSION = 'w1rec';
const SOCKET = join(W, 'work', 'tmux.sock');
const COLS = 100;
const ROWS = 40;
const TYPE_DELAY_MS = 25;
const IDLE_MS = 5000;
const STEP_TIMEOUT_MS = 240000;
const BUSY = /esc to interrupt|Compacting|Running…/;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tmux = (...args) => execFileSync('tmux', ['-S', SOCKET, ...args], { encoding: 'utf8' });
const screen = () => tmux('capture-pane', '-p', '-t', SESSION);
// Claude Code prints "… for 3s · done 11:54 PM" when a reply ends. A "! command" reply can start seconds after its output.
const replies = () => (tmux('capture-pane', '-p', '-S', '-', '-t', SESSION).match(/ for \d+s · done /g) || []).length;

const ids = process.argv.slice(2);
if (!ids.length) throw new Error('usage: node tools/record-claude.mjs <ID>...');
for (const id of ids) if (!existsSync(join(W, 'demo', `${id}.claude`))) throw new Error(`missing demo/${id}.claude`);

async function type(text) {
  for (const ch of text) {
    tmux('send-keys', '-t', SESSION, '-l', ch);
    await sleep(TYPE_DELAY_MS);
  }
  await sleep(400);
  tmux('send-keys', '-t', SESSION, 'Enter');
}

async function waitReply(before) {
  const start = Date.now();
  while (replies() <= before) {
    if (Date.now() - start > STEP_TIMEOUT_MS) throw new Error('timeout: no reply\n' + screen());
    await sleep(500);
  }
}

async function waitIdle() {
  const start = Date.now();
  let last = '', since = Date.now();
  await sleep(1000);
  while (Date.now() - start < STEP_TIMEOUT_MS) {
    const s = screen();
    if (/Yes, I trust this folder/.test(s)) {
      await sleep(1500);
      tmux('send-keys', '-t', SESSION, 'Down');
      await sleep(400);
      tmux('send-keys', '-t', SESSION, 'Enter');
    }
    if (s !== last) { last = s; since = Date.now(); }
    else if (!BUSY.test(s.trimEnd().split('\n').slice(-8).join('\n')) && Date.now() - since >= IDLE_MS) return;
    await sleep(500);
  }
  throw new Error('timeout: the terminal did not become idle\n' + screen());
}

async function record(id) {
  const cast = join(W, 'casts', `${id}.cast`);
  const rec = spawn('asciinema', ['rec', '--overwrite', '--headless', '--window-size', `${COLS}x${ROWS}`, '-i', '2', '-c', `tmux -S '${SOCKET}' attach -t ${SESSION}`, cast], { stdio: 'ignore' });
  await sleep(1500);
  for (const line of readFileSync(join(W, 'demo', `${id}.claude`), 'utf8').split('\n')) {
    // /exit prints the session id, so the recording stops before it.
    if (!/^[$>] /.test(line) || line === '> /exit') continue;
    const before = replies();
    await type(line.slice(2));
    if (/^> [^/]/.test(line)) await waitReply(before);
    await waitIdle();
  }
  await sleep(2000);
  tmux('detach-client', '-s', SESSION);
  await new Promise((r) => rec.on('exit', r));

  // The header holds the command and the environment: drop both (privacy grep). Also drop the end, where tmux detaches and clears the screen.
  let lines = readFileSync(cast, 'utf8').split('\n');
  const detached = lines.findIndex((l, i) => i > 0 && l.includes('[?1049l'));
  if (detached > 0) lines = lines.slice(0, detached);
  const head = JSON.parse(lines[0]);
  delete head.command;
  delete head.env;
  lines[0] = JSON.stringify(head);
  writeFileSync(cast, lines.join('\n') + '\n');

  const work = join(W, 'work', `rec-${id}`);
  mkdirSync(work, { recursive: true });
  execFileSync('agg', ['--font-size', '22', '--font-family', 'JetBrains Mono,Menlo', '--theme', 'monokai', '--idle-time-limit', '2', cast, join(work, `${id}.gif`)]);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', join(work, `${id}.gif`), '-movflags', '+faststart', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', join(W, 'video', 'term', `${id}.mp4`)]);
  rmSync(work, { recursive: true });
  console.log(`ok ${id}: casts/${id}.cast video/term/${id}.mp4`);
}

mkdirSync(join(W, 'work'), { recursive: true });
try { tmux('kill-session', '-t', SESSION); } catch { /* no old session */ }
tmux('new-session', '-d', '-s', SESSION, '-x', String(COLS), '-y', String(ROWS), '-c', join(W, 'demo'),
  // Claude Code snapshots the .zshrc of $SHELL for "! command"; that snapshot prints compdef errors here.
  `SHELL=/bin/bash PS1='\\[\\e[38;5;245m\\]demo $\\[\\e[0m\\] ' bash --norc --noprofile`);
tmux('set-option', '-t', SESSION, 'status', 'off');
tmux('set-option', '-g', 'focus-events', 'on');
try {
  for (const id of ids) await record(id);
} finally {
  tmux('kill-session', '-t', SESSION);
}
