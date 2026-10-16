source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
say 'A structured prompt: role, task, context, examples, constraints, output format.'
show 'cat prompt/structured.prompt.txt'
show 'cc "$(cat prompt/structured.prompt.txt)" > prompt/structured.json'
show 'jq -r .result prompt/structured.json'
show 'jq ".usage | {output_tokens, thinking_tokens: .output_tokens_details.thinking_tokens}" prompt/structured.json'
show 'node prompt/extract.mjs prompt/structured.json prompt/structured.js'
