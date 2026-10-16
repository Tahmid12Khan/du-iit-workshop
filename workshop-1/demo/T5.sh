source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
mkdir -p ../work/neutral && cd ../work/neutral
# Default Claude Code, with settings, plugins and MCP servers of the presenter turned off.
claude() {
  command claude "$@" --strict-mcp-config --mcp-config '{"mcpServers":{}}' --setting-sources "" --model haiku --no-session-persistence </dev/null
}
say 'Default Claude Code: its own system prompt, tools and skills. One word of input.'
show 'claude -p "Hello" --output-format json | jq ".usage | {input_tokens,
  cache_creation_input_tokens, cache_read_input_tokens, output_tokens}"'
say 'Add the three input fields to get the total.'
show 'claude -p "Hello" --output-format json | jq ".usage |
  .input_tokens + .cache_creation_input_tokens + .cache_read_input_tokens"'
