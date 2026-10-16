source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
source ./effort/runs.sh
RUN_ID=E3
PUZZLE="How many integers from 1 to 100000 inclusive are divisible by 7 and have digits that add up to exactly 20? Reply with only the number."
say "Harder puzzle: 3 runs at low and 3 runs at max, all at the same time. The right answer is 805."
show 'runs 805 3 low max'
