import { readFileSync } from 'node:fs';
const out = JSON.parse(readFileSync(0, 'utf8'));
const { event, date, venue, fee } = out.structured_output;
console.log('typeof fee:', typeof fee);
console.log('fee + 100: ', fee + 100);
console.log('date:      ', new Date(date).toLocaleDateString('en-GB', { dateStyle: 'full', timeZone: 'UTC' }));
console.log('event:     ', event);
console.log('venue:     ', venue);
