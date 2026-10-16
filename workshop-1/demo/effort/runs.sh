# Sourced after lib.sh. Parallel puzzle runs with a live table.
# usage: runs <expected> <n> <effort>...   (reads $PUZZLE, $RUN_ID; writes demo/effort/out/$RUN_ID.json)
runs() {
  local expected="$1" n="$2"; shift 2
  local dir; dir="$(mktemp -d)"
  local e i
  for e in "$@"; do
    for ((i = 1; i <= n; i++)); do
      ( cc "$PUZZLE" --effort "$e" --max-budget-usd 1 > "$dir/$e.$i.json" 2>/dev/null; touch "$dir/$e.$i.done" ) &
    done
  done
  local total=$(($# * n)) shown=0 f
  printf '%-7s %-4s %-8s %-9s %-8s %s\n' effort run answer correct? tokens seconds
  while [ "$shown" -lt "$total" ]; do
    for f in "$dir"/*.done; do
      [ -e "$f" ] || continue
      [ -e "$f.shown" ] && continue
      touch "$f.shown"; shown=$((shown + 1))
      row "$expected" "${f%.done}.json"
    done
    sleep 1
  done
  wait
  summary "$expected" "$n" "$dir" "$@"
}
fields() {  # fields <json> → answer TAB ok TAB tokens TAB seconds
  jq -r '[(.result // "" | gsub("[,*]";"") | [scan("[0-9]+")] | last // "none"), (if .is_error == null then true else .is_error end), (.usage.output_tokens // 0), ((.duration_ms // 0) / 100 | round / 10)] | @tsv' "$1" 2>/dev/null || printf 'none\ttrue\t0\t0\n'
}
row() {  # row <expected> <json>
  local b a err tok sec mark; b="$(basename "$2" .json)"
  IFS=$'\t' read -r a err tok sec <<< "$(fields "$2")"
  [ "$a" = "$1" ] && mark=yes || mark=NO
  [ "$err" = true ] && a=ERROR
  printf '%-7s %-4s %-8s %-9s %-8s %s\n' "${b%%.*}" "${b##*.}" "$a" "$mark" "$tok" "$(printf '%.1f' "$sec")"
}
summary() {  # summary <expected> <n> <dir> <effort>...
  local expected="$1" n="$2" dir="$3" e i a err tok sec ok st ss out="[]"; shift 3
  echo
  for e in "$@"; do
    ok=0 st=0 ss=0
    for ((i = 1; i <= n; i++)); do
      IFS=$'\t' read -r a err tok sec <<< "$(fields "$dir/$e.$i.json")"
      [ "$a" = "$expected" ] && [ "$err" != true ] && ok=$((ok + 1))
      st=$((st + tok)); ss=$(awk -v a="$ss" -v b="$sec" 'BEGIN{print a+b}')
      out="$(jq -c --arg e "$e" --arg a "$a" --argjson t "$tok" --argjson s "$sec" --argjson err "$err" \
        '. + [{effort:$e,answer:$a,tokens:$t,seconds:$s,error:$err}]' <<< "$out")"
    done
    printf '%-7s correct %d/%d, mean tokens %d, mean seconds %s\n' "$e" "$ok" "$n" "$((st / n))" "$(awk -v s="$ss" -v n="$n" 'BEGIN{printf "%.1f", s/n}')"
  done
  mkdir -p ./effort/out
  jq -s -c --argjson runs "$out" --arg exp "$expected" \
    '{expected:$exp, cost_usd:(map(.total_cost_usd // 0)|add), runs:$runs}' "$dir"/*.json > "./effort/out/$RUN_ID.json"
}
