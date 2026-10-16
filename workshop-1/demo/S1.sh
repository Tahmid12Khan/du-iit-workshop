source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
say 'The input: a messy notice.'
show 'cat structured/notice.txt'
say 'Ask for JSON in the prompt. No schema.'
show 'cc "Extract event, date, venue and fee as JSON from: $(cat structured/notice.txt)" > structured/noschema.json'
show 'jq -r .result structured/noschema.json'
say 'Parse the answer with Node.'
show 'jq -r .result structured/noschema.json | node structured/plain.mjs'
