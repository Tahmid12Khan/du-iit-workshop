source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
say 'The usage field holds the input tokens of the call.'
show 'cc "Hello" | jq ".usage | {input_tokens,
  cache_creation_input_tokens, cache_read_input_tokens}"'
say 'Add the three input fields. The helper does it for us.'
show 'tokens "Hello"'
