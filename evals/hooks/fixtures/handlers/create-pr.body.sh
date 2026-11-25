#!/usr/bin/env bash
# Eval handler: proves it RAN (run log), not merely that it was read.
echo "ran $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "${HOOK_RUN_LOG:-/dev/null}"
echo "### Rollout notes"
echo "- HOOK-MARKER-SH-$(printf '%s' 2C19 | rev): ship behind the \`export_status_filter\` flag."
