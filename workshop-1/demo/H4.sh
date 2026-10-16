source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
say "Ask the npm registry if the package exists."
show 'npm view fastjson-validator-kit version 2>&1 | head -3'
