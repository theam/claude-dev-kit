/*
 * Tests for the Clover coverage-bar checker used by the stack matrix. The
 * fixture mirrors real PHPUnit output: a class-level <metrics> first and the
 * file-level one (with loc=) last inside each <file> — the parser must read
 * the last — and, under PCOV, conditionals="0" meaning "no branch data", which
 * is n/a rather than a 0% failure.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseClover, verdicts } from './check-clover.mjs';

const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<coverage generated="1">
  <project timestamp="1">
    <file name="/app/src/CoverageGate.php">
      <class name="CoverageGate"><metrics complexity="10" methods="3" coveredmethods="3" conditionals="0" coveredconditionals="0" statements="8" coveredstatements="4" elements="11" coveredelements="7"/></class>
      <metrics loc="43" ncloc="36" classes="1" methods="3" coveredmethods="3" conditionals="0" coveredconditionals="0" statements="9" coveredstatements="9" elements="12" coveredelements="12"/>
    </file>
    <file name="/app/src/Partial.php">
      <metrics loc="20" ncloc="15" classes="1" methods="2" coveredmethods="1" statements="10" coveredstatements="9" conditionals="4" coveredconditionals="2" elements="16" coveredelements="12"/>
    </file>
  </project>
</coverage>`;

test('reads the file-level metrics (the last), order-independently', () => {
  const files = parseClover(FIXTURE);
  assert.equal(files.length, 2);
  const [gate, partial] = files;
  // 9/9 from the file-level metrics, not 4/8 from the class-level one.
  assert.equal(gate.lines, 100);
  assert.equal(partial.lines, 90);
  assert.equal(partial.branches, 50); // attributes appear in a different order here
});

test('conditionals="0" is n/a branch data, never a 0% failure', () => {
  const [gate] = parseClover(FIXTURE);
  assert.equal(gate.branches, null);
  const [row] = verdicts([gate], 95);
  assert.equal(row.pass, true);
});

test('verdicts fail exactly the files below the bar', () => {
  const rows = verdicts(parseClover(FIXTURE), 95);
  assert.deepEqual(
    rows.map((row) => [row.name.split('/').pop(), row.pass]),
    [
      ['CoverageGate.php', true],
      ['Partial.php', false],
    ],
  );
  assert.ok(verdicts(parseClover(FIXTURE), 50).every((row) => row.pass));
});

test('an empty or non-Clover document yields no rows', () => {
  assert.deepEqual(parseClover('<coverage/>'), []);
});
