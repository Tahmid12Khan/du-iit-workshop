source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
source ./context/env.sh
say 'Compact: the model writes a summary and drops the old messages.'
show 'claude -p "/compact" --resume "$(cat session.id)" \
  --output-format json | save_session session-compacted.id'
