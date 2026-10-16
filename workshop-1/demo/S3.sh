source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
say 'Pipe the structured result into Node.'
show 'cc "Extract the event, date, venue and fee from: $(cat structured/notice.txt)" --json-schema "$(cat structured/schema.json)" | node structured/parse.mjs'
