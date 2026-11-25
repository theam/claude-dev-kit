# SCRATCH-7: Filter exports by payment status

Issue: https://github.com/acme-sandbox/nonexistent-scratch/issues/7

## What was delivered
Users can filter the CSV export by payment status (paid / pending / failed).
The filter is applied server-side in `src/export.js`.

## Gate evidence (all run on the pushed branch)
- Unit tests: `npm test` — 14 passed, 0 failed
- Coverage on touched files: `src/export.js` 97% lines / 95% branches
- E2E: not applicable — the project has no e2e setup (recommend adding)
- Lint: `npm run lint` — clean
- Self-review: no blocking findings
- Security pass: no findings (input is validated against the status enum)
