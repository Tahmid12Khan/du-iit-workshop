source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
say 'The schema: four fields with types.'
show "jq -c '.properties | map_values(.type)' structured/schema.json"
say 'Pass the schema with --json-schema.'
show 'cc "Extract the event, date, venue and fee from: $(cat structured/notice.txt)" --json-schema "$(cat structured/schema.json)" > structured/out.json'
show 'jq .structured_output structured/out.json'
