import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));

export function load(file, preferred) {
  let src;
  try {
    src = readFileSync(join(dir, file), 'utf8');
  } catch {
    return { error: 'file missing' };
  }
  if (isPython(src)) return loadPython(src);
  const names = [...src.matchAll(/function\s+(\w+)/g)].map((m) => m[1]);
  const name = names.includes(preferred) ? preferred : names.find((n) => /^isValid/i.test(n)) ?? names.find((n) => /valid/i.test(n));
  if (!name) return { error: 'no validator function found' };
  const quiet = { log() {}, error() {}, warn() {} };
  try {
    const module = { exports: {} };
    const body = src.replace(/^\s*export\s+(default\s+)?/gm, '');
    const fn = new Function('console', 'module', `${body}\n; return ${name};`)(quiet, module);
    return { fn, name };
  } catch (e) {
    return { error: `not runnable JavaScript: ${e.name}: ${e.message}` };
  }
}

function isPython(src) {
  try {
    new Function(src);
    return false;
  } catch {
    return /^def\s+\w+\(/m.test(src);
  }
}

function loadPython(src) {
  const names = [...src.matchAll(/^def\s+(\w+)\(/gm)].map((m) => m[1]);
  const name = names.find((n) => /valid/i.test(n));
  if (!name) return { error: 'no validator function found' };
  const fn = (input) => {
    const code = [
      'import json, sys, io, contextlib',
      "ns = {'__name__': 'lib'}",
      "with contextlib.redirect_stdout(io.StringIO()): exec(sys.argv[2], ns)",
      `print(ns['${name}'](json.loads(sys.argv[1])))`,
    ].join('\n');
    const r = spawnSync('python3', ['-I', '-c', code, JSON.stringify(input), src], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr);
    return r.stdout.trim().toLowerCase();
  };
  return { fn, name, language: 'Python' };
}

export function run(entry, input) {
  if (!entry.fn) return 'n/a';
  try {
    return String(entry.fn(input));
  } catch {
    return 'THROWS';
  }
}
