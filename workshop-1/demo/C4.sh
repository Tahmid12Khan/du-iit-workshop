source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
source ./context/env.sh
say 'Look at the context window after compaction.'
show 'claude -p "/context" --resume "$(cat session-compacted.id)" | head -16'
