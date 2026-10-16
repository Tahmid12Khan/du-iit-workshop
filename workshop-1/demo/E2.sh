source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
source ./effort/runs.sh
RUN_ID=E2
PUZZLE="How many integers from 1 to 5000 inclusive are divisible by 13 and have digits that add up to exactly 14? Reply with only the number."
say "Same puzzle, 10 runs at max effort, all at the same time. The right answer is 27."
show 'runs 27 10 max'
