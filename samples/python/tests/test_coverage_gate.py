import pytest

from dev_kit_sample import CoverageGate


@pytest.mark.parametrize(
    ("lines", "branches", "expected"),
    [
        pytest.param(95.0, 95.0, "PASS", id="both at the bar pass"),
        pytest.param(100.0, 96.5, "PASS", id="both above pass"),
        pytest.param(94.9, 100.0, "FAIL_LINES", id="lines below fails on lines first"),
        pytest.param(96.0, 90.0, "FAIL_BRANCHES", id="branches below fails on branches"),
        pytest.param(10.0, 10.0, "FAIL_LINES", id="both below reports lines first"),
    ],
)
def test_verdict_against_the_default_bar(lines: float, branches: float, expected: str) -> None:
    assert CoverageGate().verdict(lines, branches) == expected


def test_a_custom_bar_moves_the_threshold() -> None:
    gate = CoverageGate(80.0)
    assert gate.verdict(85.0, 80.0) == "PASS"
    assert gate.verdict(79.9, 100.0) == "FAIL_LINES"


def test_regression_is_a_drop_even_above_the_bar() -> None:
    gate = CoverageGate()
    assert gate.regressed(99.0, 98.0) is True
    assert gate.regressed(98.0, 98.0) is False
    assert gate.regressed(96.0, 97.0) is False


def test_an_out_of_range_bar_is_rejected() -> None:
    with pytest.raises(ValueError, match="bar must be within 0..100"):
        CoverageGate(101.0)


def test_out_of_range_coverage_is_rejected() -> None:
    with pytest.raises(ValueError, match="coverage must be within 0..100"):
        CoverageGate().verdict(-1.0, 50.0)
