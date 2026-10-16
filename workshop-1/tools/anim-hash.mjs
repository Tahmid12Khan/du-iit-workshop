// Fingerprint of everything an animation video depends on: its slide markup and the engine files.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const ENGINE = ['vendor/deck.js', 'vendor/deck.css', 'vendor/tokens.css', 'vendor/fonts.css', 'tools/template.html'];

export function animHash(W, slideId) {
  const index = readFileSync(join(W, 'index.html'), 'utf8');
  const start = index.indexOf(`id="${slideId}"`);
  if (start < 0) throw new Error(`no slide ${slideId} in index.html`);
  const open = index.lastIndexOf('<section', start);
  const end = index.indexOf('</section>', start);
  const h = createHash('sha1');
  h.update(index.slice(open, end));
  for (const f of ENGINE) h.update(readFileSync(join(W, f)));
  return h.digest('hex').slice(0, 16);
}
