import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

const MAX_STEPS = Number(process.env.MAX_STEPS ?? 8);
const ONCE = process.argv.includes('--once');
const TASK = process.argv.find((a, i) => i > 1 && !a.startsWith('--')) ?? 'Which file in ./notes is longest, and what is it about?';

const SYSTEM = `You are the planner of a small agent. You cannot run tools yourself. Each turn you reply with ONE action, and the program runs it and adds the result to the transcript.
Actions:
- list_dir: args.path = a folder. Returns the file names.
- read_file: args.path = a file. Returns its text.
- final_answer: args.answer = your answer to the task. Use it when you have enough information.
Use relative paths such as ./notes.`;

const SCHEMA = {
  type: 'object',
  properties: {
    thought: { type: 'string' },
    action: { type: 'string', enum: ['list_dir', 'read_file', 'final_answer'] },
    args: {
      type: 'object',
      properties: { path: { type: 'string' }, answer: { type: 'string' } },
      additionalProperties: false,
    },
  },
  required: ['thought', 'action', 'args'],
  additionalProperties: false,
};

const tools = {
  list_dir: ({ path }) => readdirSync(path).join('\n'),
  read_file: ({ path }) => readFileSync(path, 'utf8'),
};

function askModel(transcript) {
  const out = execFileSync(
    'claude',
    ['-p', transcript, '--json-schema', JSON.stringify(SCHEMA), '--output-format', 'json',
     '--model', 'haiku', '--tools', '', '--system-prompt', SYSTEM, '--setting-sources', '',
     '--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  );
  const res = JSON.parse(out);
  const u = res.usage;
  return {
    decision: res.structured_output,
    inputTokens: u.input_tokens + u.cache_creation_input_tokens + u.cache_read_input_tokens,
    cost: res.total_cost_usd,
  };
}

// Break lines at word boundaries so the recording does not split words at the terminal edge.
function printWrapped(prefix, text) {
  const width = (process.stdout.columns || 100) - 1;
  const indent = ' '.repeat(prefix.length);
  let line = prefix;
  let fresh = true;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (!fresh && line.length + 1 + word.length > width) {
      console.log(line);
      line = indent;
      fresh = true;
    }
    line += (fresh ? '' : ' ') + word;
    fresh = false;
  }
  console.log(line);
}

function showPlan({ decision, inputTokens }) {
  printWrapped('[plan]    ', decision.thought);
  // The full answer prints once in the ANSWER block, so the plan line shows only its start.
  const args = decision.action === 'final_answer' ? { answer: `${decision.args.answer.slice(0, 24)}...` } : decision.args;
  console.log(`[plan]    action=${decision.action} args=${JSON.stringify(args)}  (model saw ${inputTokens} input tokens)`);
}

let transcript = `Task: ${TASK}\n`;
let totalCost = 0;
const started = Date.now();
const elapsed = () => ((Date.now() - started) / 1000).toFixed(1);

for (let step = 1; step <= MAX_STEPS; step++) {
  console.log(`\n--- Step ${step}/${MAX_STEPS} ---`);
  console.log(`[context] transcript = ${transcript.length} chars`);

  const plan = askModel(transcript);
  totalCost += plan.cost;
  showPlan(plan);
  const { decision } = plan;

  if (decision.action === 'final_answer') {
    console.log('[check]   done');
    console.log();
    printWrapped('ANSWER: ', decision.args.answer);
    console.log(`steps=${step} cost=$${totalCost.toFixed(4)} seconds=${elapsed()}`);
    process.exit(0);
  }

  let result;
  try {
    result = tools[decision.action](decision.args);
  } catch (e) {
    result = `ERROR: ${e.message}`;
  }
  console.log(`[act]     ${decision.action}(${decision.args.path}) -> ${result.length} chars`);
  transcript += `\nAction: ${decision.action} ${JSON.stringify(decision.args)}\nResult:\n${result}\n`;

  if (ONCE) {
    console.log('[check]   not done, send the result back to the model once');
    console.log(`\n--- Step 2 (result sent back) ---`);
    console.log(`[context] transcript = ${transcript.length} chars`);
    const next = askModel(transcript);
    totalCost += next.cost;
    showPlan(next);
    console.log(`\n--once: stop after one tool round trip. cost=$${totalCost.toFixed(4)} seconds=${elapsed()}`);
    process.exit(0);
  }
  console.log('[check]   not done, add result to context');
}

console.log(`\nGUARDRAIL: reached MAX_STEPS=${MAX_STEPS} without a final answer. Loop stopped. cost=$${totalCost.toFixed(4)} seconds=${elapsed()}`);
process.exit(1);
