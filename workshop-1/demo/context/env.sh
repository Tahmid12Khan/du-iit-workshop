# Sourced by C1..C5 (after lib.sh). Neutral work folder, clean Claude Code profile, session chain files.
DEMO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"
CTXDIR=/tmp/ws1-ctx
mkdir -p "$CTXDIR"
cp "$DEMO_DIR/context/big.txt" "$CTXDIR/big.txt"
cd "$CTXDIR"
# Same Claude Code as the default, with settings, plugins and MCP servers of the presenter turned off.
claude() {
  command claude "$@" --strict-mcp-config --mcp-config '{"mcpServers":{}}' --setting-sources "" --model haiku </dev/null
}
# save_session <file|->: store the session id of a json result ("-" = do not store), print a short summary.
save_session() {
  local j; j=$(cat)
  [ "$1" = "-" ] || jq -r .session_id <<<"$j" >"$1"
  echo "$j" >"$CTXDIR/last-$(basename "$0" .sh).json"
  jq 'if .result == "" then {local_command, is_error, duration_ms} else {result} end' <<<"$j"
}
