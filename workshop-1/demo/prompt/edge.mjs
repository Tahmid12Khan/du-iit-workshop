import { load, run } from './load.mjs';

const naive = load('naive.js', 'isValidBDPhone');
const structured = load('structured.js', 'isValidBDPhone');
const cases = ['017-1234-5678', '1712345678', ' 01712345678'];
const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad('input', 17)}${pad('spec', 8)}${pad('naive', 8)}${pad('structured', 12)}`);
for (const input of cases) {
  console.log(`${pad(JSON.stringify(input), 17)}${pad('false', 8)}${pad(run(naive, input), 8)}${pad(run(structured, input), 12)}`);
}
