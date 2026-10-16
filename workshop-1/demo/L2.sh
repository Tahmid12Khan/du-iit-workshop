source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
say 'Run the full agent loop on 4 notes. The step limit is 8.'
show 'MAX_STEPS=8 node loop.mjs'
