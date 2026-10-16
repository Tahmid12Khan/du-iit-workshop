source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
source ./context/env.sh
rm -f session.id session-compacted.id
say 'Step 1: give the model one detail to remember.'
show 'claude -p "Remember: our dev server port is 8081. Reply with OK." \
  --output-format json | save_session session.id'
say 'Step 2: make the model read a 99 KB file.'
show 'claude -p "Read the whole file big.txt and tell me what it is about in one sentence." \
  --allowedTools Read --resume "$(cat session.id)" --output-format json |
  save_session session.id'
