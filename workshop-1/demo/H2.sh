source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
say "Ask the npm registry for the real latest version."
show 'npm view express version'
