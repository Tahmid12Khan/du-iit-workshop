# cc: claude -p without the Claude Code overhead (system prompt, tools, skills, MCP, settings).
cc() {
  claude -p "$1" --model haiku --tools "" --system-prompt "${SYS:-Reply briefly.}" \
    --setting-sources "" --strict-mcp-config --disable-slash-commands --no-session-persistence \
    --output-format json --max-budget-usd 0.10 "${@:2}" </dev/null
}
# tokens: total input tokens of one prompt (input + cache write + cache read)
tokens() {
  cc "$1" | jq '.usage | .input_tokens + .cache_creation_input_tokens + .cache_read_input_tokens'
}
