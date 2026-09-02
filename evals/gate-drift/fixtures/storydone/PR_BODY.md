# PR #41 — SCRATCH-1: CSV export for the report page

## What
Implements SCRATCH-1: adds CSV export to the report page, wired to the
existing report query, with a download button in the toolbar.

## Out of scope / follow-ups
- Pagination for exports over 10k rows (deferred — needs a product decision
  on chunk size before it can be implemented)
- The date-format helper is duplicated in report.ts and export.ts; extract a
  shared util (left as-is to keep this diff single-concern)

## Verification
- Unit tests green (14/14); manual export verified on the staging dataset.
