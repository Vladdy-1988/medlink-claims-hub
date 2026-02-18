#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildDefaults(gate) {
  if (gate === 'soak') {
    return {
      minRequests: 500,
      p95MaxMs: 400,
      p99MaxMs: 1000,
      errorRateMax: 0.01,
      checkRateMin: 0.95,
    };
  }

  return {
    minRequests: 200,
    p95MaxMs: 400,
    p99MaxMs: 1000,
    errorRateMax: 0.01,
    checkRateMin: 0.95,
  };
}

function readMetricValue(metrics, metricName, valueName) {
  const metric = metrics?.[metricName];
  if (!metric || typeof metric !== 'object') {
    return null;
  }

  const values = metric.values;
  if (values && typeof values[valueName] === 'number') {
    return values[valueName];
  }

  if (typeof metric[valueName] === 'number') {
    return metric[valueName];
  }

  // k6 summary-export may represent rate metrics as { value }.
  if (valueName === 'rate' && typeof metric.value === 'number') {
    return metric.value;
  }

  return null;
}

function isThresholdFailure(result) {
  // k6 summary exports have used both boolean and { ok: boolean } formats.
  if (typeof result === 'boolean') {
    return result;
  }

  if (result && typeof result === 'object') {
    if (typeof result.ok === 'boolean') {
      return !result.ok;
    }
    if (typeof result.pass === 'boolean') {
      return !result.pass;
    }
  }

  return false;
}

export function evaluateK6Summary(summary, options = {}) {
  const gate = options.gate ?? 'load';
  const defaults = buildDefaults(gate);
  const thresholds = {
    minRequests: parseNumber(options.minRequests, defaults.minRequests),
    p95MaxMs: parseNumber(options.p95MaxMs, defaults.p95MaxMs),
    p99MaxMs: parseNumber(options.p99MaxMs, defaults.p99MaxMs),
    errorRateMax: parseNumber(options.errorRateMax, defaults.errorRateMax),
    checkRateMin: parseNumber(options.checkRateMin, defaults.checkRateMin),
  };

  const metrics = summary?.metrics ?? {};

  const measured = {
    totalRequests: readMetricValue(metrics, 'http_reqs', 'count'),
    durationP95Ms: readMetricValue(metrics, 'http_req_duration', 'p(95)'),
    durationP99Ms: readMetricValue(metrics, 'http_req_duration', 'p(99)'),
    errorRate: readMetricValue(metrics, 'http_req_failed', 'rate'),
    checksRate: readMetricValue(metrics, 'checks', 'rate'),
  };

  const failedThresholds = [];
  for (const [metricName, metric] of Object.entries(metrics)) {
    const thresholdMap = metric?.thresholds ?? {};
    for (const [expr, result] of Object.entries(thresholdMap)) {
      if (isThresholdFailure(result)) {
        failedThresholds.push(`${metricName}:${expr}`);
      }
    }
  }

  const failures = [];

  if (measured.totalRequests === null) {
    failures.push('Missing http_reqs.count metric');
  } else if (measured.totalRequests < thresholds.minRequests) {
    failures.push(
      `Insufficient request sample: http_reqs.count=${measured.totalRequests} (min ${thresholds.minRequests})`
    );
  }

  if (measured.durationP95Ms === null) {
    failures.push('Missing http_req_duration p(95) metric');
  } else if (measured.durationP95Ms > thresholds.p95MaxMs) {
    failures.push(
      `p95 duration ${measured.durationP95Ms.toFixed(2)}ms exceeds ${thresholds.p95MaxMs}ms`
    );
  }

  if (measured.durationP99Ms === null) {
    failures.push('Missing http_req_duration p(99) metric');
  } else if (measured.durationP99Ms > thresholds.p99MaxMs) {
    failures.push(
      `p99 duration ${measured.durationP99Ms.toFixed(2)}ms exceeds ${thresholds.p99MaxMs}ms`
    );
  }

  if (measured.errorRate === null) {
    failures.push('Missing http_req_failed.rate metric');
  } else if (measured.errorRate > thresholds.errorRateMax) {
    failures.push(
      `Error rate ${(measured.errorRate * 100).toFixed(2)}% exceeds ${(thresholds.errorRateMax * 100).toFixed(2)}%`
    );
  }

  if (measured.checksRate === null) {
    failures.push('Missing checks.rate metric');
  } else if (measured.checksRate < thresholds.checkRateMin) {
    failures.push(
      `Checks rate ${(measured.checksRate * 100).toFixed(2)}% below ${(thresholds.checkRateMin * 100).toFixed(2)}%`
    );
  }

  if (failedThresholds.length > 0) {
    failures.push(
      `k6 threshold failures: ${failedThresholds.join(', ')}`
    );
  }

  return {
    gate,
    pass: failures.length === 0,
    thresholds,
    measured,
    failedThresholds,
    failures,
    evaluatedAt: new Date().toISOString(),
  };
}

function printUsageAndExit() {
  console.error(
    'Usage: node scripts/validate-k6-summary.mjs --summary <summary.json> [--out <output.json>] [--gate load|soak] [--min-requests N] [--p95-max-ms N] [--p99-max-ms N] [--error-rate-max N] [--check-rate-min N]'
  );
  process.exit(2);
}

function parseArgs(argv) {
  const args = {
    summaryPath: '',
    outPath: '',
    gate: 'load',
    minRequests: undefined,
    p95MaxMs: undefined,
    p99MaxMs: undefined,
    errorRateMax: undefined,
    checkRateMin: undefined,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === '--summary' && next) {
      args.summaryPath = next;
      i += 1;
    } else if (token === '--out' && next) {
      args.outPath = next;
      i += 1;
    } else if (token === '--gate' && next) {
      args.gate = next;
      i += 1;
    } else if (token === '--min-requests' && next) {
      args.minRequests = next;
      i += 1;
    } else if (token === '--p95-max-ms' && next) {
      args.p95MaxMs = next;
      i += 1;
    } else if (token === '--p99-max-ms' && next) {
      args.p99MaxMs = next;
      i += 1;
    } else if (token === '--error-rate-max' && next) {
      args.errorRateMax = next;
      i += 1;
    } else if (token === '--check-rate-min' && next) {
      args.checkRateMin = next;
      i += 1;
    } else {
      printUsageAndExit();
    }
  }

  if (!args.summaryPath) {
    printUsageAndExit();
  }

  return args;
}

function main() {
  const args = parseArgs(process.argv);
  const summaryPath = path.resolve(args.summaryPath);
  const raw = fs.readFileSync(summaryPath, 'utf8');
  const summary = JSON.parse(raw);

  const result = evaluateK6Summary(summary, {
    gate: args.gate,
    minRequests: args.minRequests,
    p95MaxMs: args.p95MaxMs,
    p99MaxMs: args.p99MaxMs,
    errorRateMax: args.errorRateMax,
    checkRateMin: args.checkRateMin,
  });

  if (args.outPath) {
    fs.writeFileSync(path.resolve(args.outPath), JSON.stringify(result, null, 2));
  }

  console.log(JSON.stringify(result, null, 2));
  if (!result.pass) {
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
