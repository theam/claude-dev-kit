#!/usr/bin/env bash
echo "ran $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "${HOOK_RUN_LOG:-/dev/null}"
echo "rollout service unreachable" >&2
exit 3
