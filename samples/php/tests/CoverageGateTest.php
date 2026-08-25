<?php

declare(strict_types=1);

namespace DevKitSample\Tests;

use DevKitSample\CoverageGate;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class CoverageGateTest extends TestCase
{
    /** @return array<string, array{float, float, string}> */
    public static function verdicts(): array
    {
        return [
            'both at the bar pass' => [95.0, 95.0, 'PASS'],
            'both above pass' => [100.0, 96.5, 'PASS'],
            'lines below fails on lines first' => [94.9, 100.0, 'FAIL_LINES'],
            'branches below fails on branches' => [96.0, 90.0, 'FAIL_BRANCHES'],
            'both below reports lines first' => [10.0, 10.0, 'FAIL_LINES'],
        ];
    }

    #[DataProvider('verdicts')]
    public function testVerdictAgainstTheDefaultBar(float $lines, float $branches, string $expected): void
    {
        self::assertSame($expected, (new CoverageGate())->verdict($lines, $branches));
    }

    public function testACustomBarMovesTheThreshold(): void
    {
        $gate = new CoverageGate(80.0);
        self::assertSame('PASS', $gate->verdict(85.0, 80.0));
        self::assertSame('FAIL_LINES', $gate->verdict(79.9, 100.0));
    }

    public function testRegressionIsADropEvenAboveTheBar(): void
    {
        $gate = new CoverageGate();
        self::assertTrue($gate->regressed(99.0, 98.0));
        self::assertFalse($gate->regressed(98.0, 98.0));
        self::assertFalse($gate->regressed(96.0, 97.0));
    }

    public function testAnOutOfRangeBarIsRejected(): void
    {
        $this->expectException(InvalidArgumentException::class);
        new CoverageGate(101.0);
    }

    public function testOutOfRangeCoverageIsRejected(): void
    {
        $this->expectException(InvalidArgumentException::class);
        (new CoverageGate())->verdict(-1.0, 50.0);
    }
}
