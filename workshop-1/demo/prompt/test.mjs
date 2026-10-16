import { load, run } from './load.mjs';

const naive = load('naive.js', 'isValidBDPhone');
const structured = load('structured.js', 'isValidBDPhone');
const cases = [
  ['01712345678', 'true'],
  ['+8801812345678', 'true'],
  ['8801912345678', 'true'],
  ['0171234567', 'false'],
  ['01212345678', 'false'],
  ['+88017123456789', 'false'],
];
const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad('input', 17)}${pad('expect', 8)}${pad('naive', 8)}${pad('structured', 12)}`);
const score = { naive: 0, structured: 0 };
for (const [input, expect] of cases) {
  const n = run(naive, input);
  const s = run(structured, input);
  score.naive += n === expect;
  score.structured += s === expect;
  console.log(`${pad(input, 17)}${pad(expect, 8)}${pad(n, 8)}${pad(s, 12)}`);
}
console.log(`${pad('passed', 17)}${pad('', 8)}${pad(`${score.naive}/6`, 8)}${pad(`${score.structured}/6`, 12)}`);
for (const [label, e] of [['naive', naive], ['structured', structured]]) {
  if (e.error) console.log(`${label}: ${e.error}`);
  else console.log(`${label}: ${e.language ?? 'JavaScript'} function ${e.name}`);
}
