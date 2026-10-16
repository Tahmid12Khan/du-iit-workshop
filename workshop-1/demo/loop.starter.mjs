import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

const MAX_STEPS = Number(process.env.MAX_STEPS ?? 8);
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

// TODO 1: write the tool runner.
// list_dir({ path }) returns the file names, one per line (readdirSync).
// read_file({ path }) returns the text of the file (readFileSync).
const tools = {};

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

function showPlan({ decision, inputTokens }) {
  console.log(`[plan]    ${decision.thought}`);
  console.log(`[plan]    action=${decision.action} args=${JSON.stringify(decision.args)}  (model saw ${inputTokens} input tokens)`);
}

let transcript = `Task: ${TASK}\n`;
let totalCost = 0;
const started = Date.now();
const elapsed = () => ((Date.now() - started) / 1000).toFixed(1);

// TODO 2: write the loop. For each step up to MAX_STEPS:
//   [context] print the transcript size
//   [plan]    call askModel(transcript) and print it with showPlan()
//   if the action is final_answer, print the answer and stop (exit code 0)
//   [act]     run tools[decision.action](decision.args) and print the result size
//   [check]   add the action and the result to the transcript, then loop again
// Bonus: with --once, stop after the first tool result is sent back to the model.

console.log(`\nGUARDRAIL: reached MAX_STEPS=${MAX_STEPS} without a final answer. Loop stopped. cost=$${totalCost.toFixed(4)} seconds=${elapsed()}`);
process.exit(1);
