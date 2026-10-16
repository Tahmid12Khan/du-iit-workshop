source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
say 'A naive prompt: one line, no details.'
show 'cc "write a BD phone number validator" > prompt/naive.json'
say 'The start of the answer:'
show 'jq -r .result prompt/naive.json | head -12; echo "..."'
say 'How long is the full answer?'
show 'jq -r .result prompt/naive.json | wc -l'
show 'jq ".usage | {output_tokens, thinking_tokens: .output_tokens_details.thinking_tokens}" prompt/naive.json'
show 'node prompt/extract.mjs prompt/naive.json prompt/naive.js'
