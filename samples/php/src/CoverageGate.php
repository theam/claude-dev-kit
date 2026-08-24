<?php

declare(strict_types=1);

namespace DevKitSample;

use InvalidArgumentException;

/**
 * Evaluates per-file coverage against a project's bar. The sample mirrors the
 * kit's own coverage gate so its tests exercise real branches — a sample with
 * no branches would prove nothing about branch-level metrics.
 */
final class CoverageGate
{
    public function __construct(private readonly float $bar = 95.0)
    {
        if ($bar < 0.0 || $bar > 100.0) {
            throw new InvalidArgumentException('bar must be within 0..100');
        }
    }

    /** PASS, FAIL_LINES, or FAIL_BRANCHES — lines are reported first, like the kit's table. */
    public function verdict(float $lines, float $branches): string
    {
        foreach ([$lines, $branches] as $metric) {
            if ($metric < 0.0 || $metric > 100.0) {
                throw new InvalidArgumentException('coverage must be within 0..100');
            }
        }
        if ($lines < $this->bar) {
            return 'FAIL_LINES';
        }
        return $branches < $this->bar ? 'FAIL_BRANCHES' : 'PASS';
    }

    /** A touched file may not drop below its pre-change coverage, even above the bar. */
    public function regressed(float $before, float $after): bool
    {
        return $after < $before;
    }
}
