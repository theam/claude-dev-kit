#!/usr/bin/env bash
# Hooks eval runner (RFC #92 PoC) — one scenario per invocation. Builds a
# throwaway consuming repo OUTSIDE this checkout, stages this checkout's own
# create-pr skill + instructions into it, runs a headless claude session with
# gh stubbed, and captures the PR body the session tried to open.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$ROOT/../.." && pwd)"
SCEN="${1:?usage: run.sh <h1-md|h2-sh|h3-not-opted-in|h4-control|h5-sh-fail>}"
MODEL="${MODEL:-haiku}"
mkdir -p "$ROOT/results" "$ROOT/logs"

HOOKS_JSON=""     # the hooks block, or empty for none
HANDLERS=()       # "<fixture handler>:<name in the consuming repo>"
case "$SCEN" in
  h1-md)
    HOOKS_JSON='"hooks": { "create-pr.body": ".claude/dev-kit/hooks/create-pr.body.md" }'
    HANDLERS=("create-pr.body.md:create-pr.body.md");;
  h2-sh)
    HOOKS_JSON='"hooks": { "create-pr.body": ".claude/dev-kit/hooks/create-pr.body.sh" }'
    HANDLERS=("create-pr.body.sh:create-pr.body.sh");;
  h3-not-opted-in)   # handlers on disk, NOT listed in dev-kit.json
    HANDLERS=("create-pr.body.md:create-pr.body.md" "create-pr.body.sh:create-pr.body.sh");;
  h4-control) ;;     # no hook at all — the default body
  h5-sh-fail)
    HOOKS_JSON='"hooks": { "create-pr.body": ".claude/dev-kit/hooks/create-pr.body.sh" }'
    HANDLERS=("failing.sh:create-pr.body.sh");;
  *) echo "unknown scenario: $SCEN"; exit 2;;
esac

# Deliberately no mention of hooks: the skill has to find the point itself.
PROMPT="You have the create-pr skill at .claude/skills/create-pr/SKILL.md; the kit instructions it references are in .claude/instructions/. Story SCRATCH-7 is implemented, committed and pushed on the current branch, and every gate has passed (evidence in STORY.md). Follow the skill from its 'Pull request' section onward and open the PR now. Do not commit or push anything."

TAG="$SCEN${RUN_ID:+-$RUN_ID}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/hooks-eval-$TAG-XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

cp -R "$ROOT/fixtures/base/." "$WORK/"
mkdir -p "$WORK/.claude/skills/create-pr" "$WORK/.claude/instructions"
cp "$REPO/skills/create-pr/SKILL.md" "$WORK/.claude/skills/create-pr/SKILL.md"
cp -R "$REPO/instructions/." "$WORK/.claude/instructions/"
for pair in ${HANDLERS[@]+"${HANDLERS[@]}"}; do
  mkdir -p "$WORK/.claude/dev-kit/hooks"
  cp "$ROOT/fixtures/handlers/${pair%%:*}" "$WORK/.claude/dev-kit/hooks/${pair##*:}"
done
printf '{\n  "tracker": { "type": "github", "repo": "acme-sandbox/nonexistent-scratch" },\n  "prHost": "github"%s\n}\n' \
  "${HOOKS_JSON:+,
  $HOOKS_JSON}" > "$WORK/.claude/dev-kit.json"

git -C "$WORK" init -q -b feat/SCRATCH-7-export-status-filter
git -C "$WORK" remote add origin https://github.com/acme-sandbox/nonexistent-scratch.git
git -C "$WORK" add -A
git -C "$WORK" -c user.name=eval -c user.email=eval@example.invalid commit -q -m "feat: SCRATCH-7 filter exports by payment status"

export GH_STUB_LOG="$ROOT/logs/$TAG-gh-calls.log"
export GH_STUB_BODY="$ROOT/results/$TAG.body.md"
export GH_STUB_STATE="$WORK/.gh-pr-created"
export HOOK_RUN_LOG="$ROOT/logs/$TAG-hook-runs.log"
: > "$GH_STUB_LOG"; : > "$HOOK_RUN_LOG"; rm -f "$GH_STUB_BODY"

cd "$WORK"
# shellcheck disable=SC2086
PATH="$ROOT/stubs:$PATH" claude -p "$PROMPT" \
  --model "$MODEL" --max-turns 30 \
  --output-format stream-json --verbose \
  --allowedTools "Bash(gh:*)" \
    "Bash(bash .claude/dev-kit/hooks/*)" "Bash(bash ./.claude/dev-kit/hooks/*)" \
    "Bash(git status:*)" "Bash(git branch:*)" "Bash(git log:*)" "Bash(git remote:*)" "Bash(git rev-parse:*)" \
    "Read" "Glob" "Grep" "Write" \
  ${CLAUDE_EXTRA_ARGS:-} \
  > "$ROOT/results/$TAG.jsonl" 2> "$ROOT/results/$TAG.err" || true

echo "run=$TAG model=$MODEL events=$(wc -l < "$ROOT/results/$TAG.jsonl" | tr -d ' ') gh_calls=$(wc -l < "$GH_STUB_LOG" | tr -d ' ') pr_body=$([ -s "$GH_STUB_BODY" ] && echo captured || echo MISSING) hook_runs=$(wc -l < "$HOOK_RUN_LOG" | tr -d ' ')"
