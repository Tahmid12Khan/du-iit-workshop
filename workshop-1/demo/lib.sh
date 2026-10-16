# Sourced by every demo/<ID>.sh. Shows a typed command, then runs it.
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./cc.sh
PROMPT=$'\e[38;5;245mdemo $\e[0m '
show() {  # show "<command>" : type it, then run it
  printf '%s' "$PROMPT"
  local s="$1" i
  for ((i = 0; i < ${#s}; i++)); do printf '%s' "${s:i:1}"; sleep 0.025; done
  printf '\n'; sleep 0.4
  eval "$1"
  printf '\n'; sleep 1.5
}
say() { printf '\e[38;5;245m# %s\e[0m\n' "$1"; sleep 1; }  # say "<comment>" : print a dim comment line
