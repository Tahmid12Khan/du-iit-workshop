source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
say "Ask the model for the latest version of express. Three runs."
show 'for i in 1 2 3; do cc "Reply with ONLY the latest version number of the npm package express. No other words." | jq -r .result; done'
