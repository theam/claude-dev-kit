#!/usr/bin/env bash
# watch-pr-feedback.sh — wait out late PR review feedback after a push.
#
# Review bots (Codex, CodeRabbit, Copilot, CI) post minutes after a push lands,
# so a PR that looks clean the instant you push is not necessarily done. This
# watches the PR on a backoff schedule and returns as soon as it knows the
# answer, so `fix-pr` does not have to be relaunched by hand for late comments.
#
# GitHub only (uses `gh`). For Bitbucket/GitLab, fix-pr falls back to a single
# post-push check via that host's API instead of this watcher.
#
# Adapted from theam/monkey-skills (tam-pr-review-loop). Apache-2.0.
#
# Usage:   watch-pr-feedback.sh <pr-number>
#
# Environment:
#   WATCH_SCHEDULE  cumulative minutes to check at (default "1,2,4,6,8,10")
#   SINCE           ISO-8601 UTC anchor (default: committer date of HEAD)
#   SETTLE_SECONDS  extra wait after the first new item, to collect the rest of
#                   the same review batch (default 60)
#   BOT_LOGINS      extra bot logins as a regex alternation ("our-ci|codex")
#   BASELINE        file of already-triaged GitHub items, "kind<TAB>id" per line
#                   (the ledger). Anything absent from it is reported.
#   EXCLUDE_AUTHORS logins whose comments are never new feedback (default: the
#                   authenticated account, so the loop doesn't read its own
#                   replies back as findings). Set "" to disable.
#
# Output:  stdout = TSV of new feedback (kind, id, author, when, url); stderr = progress
# Exit:    0 quiet · 10 new feedback (stdout) · 20 bot all-clear · 30 inconclusive (re-run) · 1 error
#
# Exit 0 means "we looked and saw nothing", never "we could not look": `gh api`
# prints error bodies on stdout, so every call is status-checked and every row
# shape-checked, or a rate-limit page would be triaged as five findings.

set -uo pipefail

PR="${1:-}"
[ -n "$PR" ] || { echo "usage: watch-pr-feedback.sh <pr-number>" >&2; exit 1; }
command -v gh >/dev/null 2>&1 || { echo "gh CLI not found" >&2; exit 1; }

if ! gh auth status >/dev/null 2>&1; then
  gh auth token >/dev/null 2>&1 \
    && echo "warning: 'gh auth status' failed but a token is present — treating as transient" >&2 \
    || { echo "gh is not authenticated — run 'gh auth login'" >&2; exit 1; }
fi

read -r OWNER REPO <<<"$(gh repo view --json owner,name -q '.owner.login + " " + .name')" || exit 1
[ -n "${OWNER:-}" ] && [ -n "${REPO:-}" ] || { echo "could not resolve owner/repo" >&2; exit 1; }

SCHEDULE="${WATCH_SCHEDULE:-1,2,4,6,8,10}"
SETTLE_SECONDS="${SETTLE_SECONDS:-60}"
SINCE="${SINCE:-$(TZ=UTC git log -1 --format=%cd --date=format-local:%Y-%m-%dT%H:%M:%SZ 2>/dev/null)}"
SINCE="${SINCE:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"

is_bot='.user.type == "Bot" or (.user.login | endswith("[bot]"))'
[ -n "${BOT_LOGINS:-}" ] && is_bot="$is_bot or (.user.login | test(\"^($BOT_LOGINS)\$\"; \"i\"))"

if [ -z "${EXCLUDE_AUTHORS+set}" ]; then EXCLUDE_AUTHORS="$(gh api user -q .login 2>/dev/null)"; fi
skip=""
[ -n "$EXCLUDE_AUTHORS" ] && skip="select((.user.login | test(\"^($EXCLUDE_AUTHORS)\$\"; \"i\")) | not) |"

feedback() {
  local inline conv rev raw
  inline="$(gh api "repos/$OWNER/$REPO/pulls/$PR/comments" --paginate -q ".[] | $skip [\"inline\",(.id|tostring),.user.login,.created_at,.html_url]|@tsv" 2>/dev/null)" || return 1
  conv="$(gh api "repos/$OWNER/$REPO/issues/$PR/comments" --paginate -q ".[] | $skip [\"conversation\",(.id|tostring),.user.login,.created_at,.html_url]|@tsv" 2>/dev/null)" || return 1
  rev="$(gh api "repos/$OWNER/$REPO/pulls/$PR/reviews" --paginate -q ".[] | select(.body != null and .body != \"\") | $skip [\"review\",(.id|tostring),.user.login,.submitted_at,.html_url]|@tsv" 2>/dev/null)" || return 1
  raw="$(printf '%s\n%s\n%s\n' "$inline" "$conv" "$rev" | awk 'NF')"
  printf '%s\n' "$raw" | awk -F'\t' 'NF && (NF!=5 || $1 !~ /^(inline|conversation|review)$/ || $2 !~ /^[0-9]+$/){exit 1}' || return 1
  printf '%s\n' "$raw"
}

completion_signal() {
  gh api "repos/$OWNER/$REPO/issues/$PR/reactions" --paginate -q ".[] | select(.content==\"+1\") | select(.created_at > \"$SINCE\") | select($is_bot) | \"👍 by \" + .user.login" 2>/dev/null
  gh api "repos/$OWNER/$REPO/pulls/$PR/reviews" --paginate -q ".[] | select(.state==\"APPROVED\") | select(.submitted_at > \"$SINCE\") | select($is_bot) | \"approving review by \" + .user.login" 2>/dev/null
}

new_since() { awk -F'\t' 'NR==FNR{seen[$1"\t"$2]=1;next} NF && !seen[$1"\t"$2]' <(printf '%s\n' "$1") <(printf '%s\n' "$2"); }

printf 'Watching PR #%s for late review feedback.\n' "$PR" >&2
if [ -n "${BASELINE:-}" ]; then
  [ -f "$BASELINE" ] || { echo "BASELINE file not found: $BASELINE" >&2; exit 1; }
  snapshot="$(cut -f1,2 "$BASELINE" | sort -u)"
else
  startup="$(feedback)" || { echo "could not read the PR's current feedback" >&2; exit 30; }
  snapshot="$(printf '%s\n' "$startup" | cut -f1,2 | sort -u)"
fi

elapsed=0; last_read_ok=0
IFS=',' read -r -a checkpoints <<<"$SCHEDULE"
for cp in "${checkpoints[@]}"; do
  delta=$(( cp*60 - elapsed )); [ "$delta" -gt 0 ] && sleep "$delta"; elapsed=$(( cp*60 ))
  if ! current="$(feedback)"; then
    printf 'Checkpoint t+%sm inconclusive — API call failed; retrying next.\n' "$cp" >&2; last_read_ok=0; continue
  fi
  last_read_ok=1
  new="$(new_since "$snapshot" "$current")"
  if [ -n "$new" ]; then
    printf 'New feedback at t+%sm — settling %ss for the rest of the batch.\n' "$cp" "$SETTLE_SECONDS" >&2
    sleep "$SETTLE_SECONDS"
    if settled="$(feedback)"; then new="$(new_since "$snapshot" "$settled")"; fi
    printf '%s\n' "$new"
    exit 10
  fi
  if [ -n "$(completion_signal)" ]; then completion_signal >&2; exit 20; fi
  printf 'Quiet at t+%sm.\n' "$cp" >&2
done

[ "$last_read_ok" -eq 1 ] && exit 0 || exit 30
