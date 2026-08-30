"""Evaluates per-file coverage against a project's bar.

The sample mirrors the kit's own coverage gate (and the PHP sample's class,
so the matrix rows stay comparable) — its tests exercise real branches, because
a branchless sample would prove nothing about branch-level metrics.
"""

from __future__ import annotations


class CoverageGate:
    """PASS / FAIL_LINES / FAIL_BRANCHES verdicts for one file's coverage."""

    def __init__(self, bar: float = 95.0) -> None:
        if not 0.0 <= bar <= 100.0:
            raise ValueError("bar must be within 0..100")
        self._bar = bar

    def verdict(self, lines: float, branches: float) -> str:
        """PASS, FAIL_LINES, or FAIL_BRANCHES — lines reported first, like the kit's table."""
        for metric in (lines, branches):
            if not 0.0 <= metric <= 100.0:
                raise ValueError("coverage must be within 0..100")
        if lines < self._bar:
            return "FAIL_LINES"
        return "FAIL_BRANCHES" if branches < self._bar else "PASS"

    def regressed(self, before: float, after: float) -> bool:
        """A touched file may not drop below its pre-change coverage, even above the bar."""
        return after < before
