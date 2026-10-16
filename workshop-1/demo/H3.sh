source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
say "Ask about a package name that we made up."
show 'cc "What config options does the npm package fastjson-validator-kit support? If you are not sure, say I don'"'"'t know." | jq -r .result'
