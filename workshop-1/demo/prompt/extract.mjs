import { readFileSync, writeFileSync } from 'node:fs';
const [, , jsonFile, outFile] = process.argv;
const { result } = JSON.parse(readFileSync(jsonFile, 'utf8'));
const m = /```(\w*)\n([\s\S]*?)```/.exec(result);
writeFileSync(outFile, m ? m[2] : result);
console.log(`saved ${outFile}: ${(m ? m[2] : result).split('\n').length} lines, fence "${m ? m[1] : 'none'}"`);
