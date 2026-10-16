import { readFileSync } from 'node:fs';
const text = readFileSync(0, 'utf8');
try {
  const { event, date, venue, fee } = JSON.parse(text);
  console.log({ event, date, venue, fee });
} catch (e) {
  console.log(`${e.name}: ${e.message}`);
  process.exitCode = 1;
}
