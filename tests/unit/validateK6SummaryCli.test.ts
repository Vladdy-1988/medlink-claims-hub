import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function runValidator(summary: Record<string, any>, extraArgs: string[] = []) {
  const dir = mkdtempSync(path.join(tmpdir(), 'k6-gate-test-'));
  const summaryPath = path.join(dir, 'summary.json');
  const outPath = path.join(dir, 'gate.json');

  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  const result = spawnSync(
    'node',
    ['scripts/validate-k6-summary.mjs', '--summary', summaryPath, '--out', outPath, ...extraArgs],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    }
  );

  let gate: Record<string, any> | null = null;
  try {
    gate = JSON.parse(readFileSync(outPath, 'utf8'));
  } catch {
    gate = null;
  }

  rmSync(dir, { recursive: true, force: true });

  return { result, gate };
}

describe('validate-k6-summary CLI', () => {
  it('passes for healthy metrics and thresholds', () => {
    const summary = {
      metrics: {
        http_reqs: { values: { count: 1200 } },
        http_req_duration: {
          values: { 'p(95)': 210, 'p(99)': 420 },
          thresholds: {
            'p(95)<400': { ok: true },
            'p(99)<1000': { ok: true },
          },
        },
        http_req_failed: {
          values: { rate: 0.002 },
          thresholds: { 'rate<0.01': { ok: true } },
        },
        checks: {
          values: { rate: 0.99 },
          thresholds: { 'rate>0.95': { ok: true } },
        },
      },
    };

    const { result, gate } = runValidator(summary, ['--gate', 'load', '--min-requests', '100']);
    expect(result.status).toBe(0);
    expect(gate).toBeTruthy();
    expect(gate?.pass).toBe(true);
    expect(gate?.failures).toHaveLength(0);
    expect(gate?.failedThresholds).toHaveLength(0);
  });

  it('fails when k6 threshold reports a failed check', () => {
    const summary = {
      metrics: {
        http_reqs: { values: { count: 1500 } },
        http_req_duration: {
          values: { 'p(95)': 250, 'p(99)': 500 },
          thresholds: {
            'p(95)<400': { ok: false },
          },
        },
        http_req_failed: { values: { rate: 0.001 } },
        checks: { values: { rate: 0.99 } },
      },
    };

    const { result, gate } = runValidator(summary, ['--gate', 'load', '--min-requests', '100']);
    expect(result.status).toBe(1);
    expect(gate).toBeTruthy();
    expect(gate?.pass).toBe(false);
    expect(gate?.failedThresholds).toContain('http_req_duration:p(95)<400');
  });

  it('fails when request sample size is below minimum', () => {
    const summary = {
      metrics: {
        http_reqs: { values: { count: 42 } },
        http_req_duration: { values: { 'p(95)': 100, 'p(99)': 150 } },
        http_req_failed: { values: { rate: 0 } },
        checks: { values: { rate: 1 } },
      },
    };

    const { result, gate } = runValidator(summary, ['--gate', 'soak', '--min-requests', '500']);
    expect(result.status).toBe(1);
    expect(gate).toBeTruthy();
    expect(gate?.pass).toBe(false);
    expect((gate?.failures || []).some((line: string) => line.includes('Insufficient request sample'))).toBe(
      true
    );
  });

  it('supports k6 summary-export boolean threshold format', () => {
    const summary = {
      metrics: {
        http_reqs: { count: 900 },
        http_req_duration: {
          'p(95)': 180,
          'p(99)': 350,
          thresholds: {
            'p(95)<400': false,
          },
        },
        http_req_failed: {
          rate: 0.004,
          thresholds: { 'rate<0.01': false },
        },
        checks: {
          rate: 0.98,
          thresholds: { 'rate>0.95': false },
        },
      },
    };

    const { result, gate } = runValidator(summary, ['--gate', 'load', '--min-requests', '100']);
    expect(result.status).toBe(0);
    expect(gate?.pass).toBe(true);
    expect(gate?.failedThresholds).toHaveLength(0);
  });
});
