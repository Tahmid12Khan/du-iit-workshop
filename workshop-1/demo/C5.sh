source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
source ./context/env.sh
say 'Ask for the detail from step 1.'
show 'claude -p "What exact port number did I give you at the start?" \
  --resume "$(cat session-compacted.id)" --output-format json | save_session -'
