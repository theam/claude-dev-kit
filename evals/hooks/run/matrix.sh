#!/usr/bin/env bash
# N-run hooks eval matrix: every scenario x N runs. Each run builds its own
# throwaway repo, so the scenarios of one round run in parallel; rounds are
# sequential. Then asserts each round and prints per-test pass rates.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
N="${N:-5}"
export MODEL="${MODEL:-sonnet}"
SCENARIOS="h4-control h1-md h2-sh h3-not-opted-in h5-sh-fail"
echo "matrix start: model=$MODEL N=$N $(date -u +%H:%M:%SZ)"
for i in $(seq 1 "$N"); do
  for scen in $SCENARIOS; do RUN_ID="r$i" bash "$ROOT/run/run.sh" "$scen" & done
  wait
done
echo "matrix done $(date -u +%H:%M:%SZ)"
for i in $(seq 1 "$N"); do
  RUN_ID="r$i" node --test "$ROOT/assert/hooks-evals.test.mjs" 2>&1 | grep -E '^(✔|✖|﹣) (h[0-9]|baseline)' | sed -E "s/ \([0-9.]+ms\)//; s/^/r$i /"
done | tee "$ROOT/results/matrix-$MODEL.txt"
echo "--- pass rate per test (model=$MODEL, N=$N)"
sed -E 's/^r[0-9]+ //' "$ROOT/results/matrix-$MODEL.txt" | awk '{mark=$1; $1=""; sub(/:.*/,""); n[$0]++; if (mark=="✔") p[$0]++} END {for (k in n) printf "%d/%d%s\n", p[k]+0, n[k], k}' | sort -k2
