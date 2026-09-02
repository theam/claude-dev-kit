#!/usr/bin/env bash
# N-run eval matrix: every scenario x N runs, sequential (parallel headless
# sessions in one fixture dir could collide on project state).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
N="${N:-5}"
export MODEL="${MODEL:-sonnet}"
echo "matrix start: model=$MODEL N=$N $(date -u +%H:%M:%SZ)"
for i in $(seq 1 "$N"); do
  for scen in s2-control s1-gate s3-clean; do
    RUN_ID="r$i" bash "$ROOT/run/run.sh" "$scen"
  done
done
echo "matrix done $(date -u +%H:%M:%SZ)"
