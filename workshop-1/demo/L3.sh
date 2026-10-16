source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
say 'Set the step limit to 4. The task needs more steps.'
show 'MAX_STEPS=4 node loop.mjs'
