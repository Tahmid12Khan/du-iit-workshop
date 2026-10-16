source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
source ./context/env.sh
say 'Look at the context window before compaction.'
show 'claude -p "/context" --resume "$(cat session.id)" | head -16'
