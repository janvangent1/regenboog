#!/usr/bin/env node
/**
 * Load test voor Regenboog Raspberry Pi server
 * Simuleert gelijktijdige spelers vanaf je PC.
 *
 * Gebruik:
 *   node scripts/load-test-pi.js <url> [aantal_gelijktijdige]
 *
 * Voorbeelden:
 *   node scripts/load-test-pi.js https://regenboog.jbouquet.be
 *   node scripts/load-test-pi.js http://192.168.1.10:3001 20
 *   node scripts/load-test-pi.js http://raspberrypi.local:3001 30
 *
 * Optioneel: MAX_CONCURRENT=50 node scripts/load-test-pi.js https://regenboog.jbouquet.be
 *   (test stopt wanneer meer dan de helft van de requests faalt)
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const BASE_URL = process.argv[2] || process.env.REGENBOOG_PI_URL || 'http://localhost:3000';
const CONCURRENT = parseInt(process.argv[3] || process.env.MAX_CONCURRENT || '10', 10);
const REQUEST_TIMEOUT_MS = 15000;
const PATHS = ['/', '/games/zebras.html', '/api/leaderboard/zebras'];

function fetchOne(baseUrl, path) {
  return new Promise((resolve) => {
    const url = new URL(path, baseUrl);
    const client = url.protocol === 'https:' ? https : http;
    const start = Date.now();
    const req = client.get(
      url.href,
      { timeout: REQUEST_TIMEOUT_MS },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 400,
            statusCode: res.statusCode,
            ms: Date.now() - start,
            path
          });
        });
      }
    );
    req.on('error', (err) => {
      resolve({ ok: false, error: err.message, ms: Date.now() - start, path });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'timeout', ms: REQUEST_TIMEOUT_MS, path });
    });
  });
}

/** Simuleer één "speler": meerdere requests na elkaar (zoals een echte pagina + API). */
async function simulateOnePlayer(baseUrl, playerId) {
  const results = [];
  for (const path of PATHS) {
    const r = await fetchOne(baseUrl, path);
    results.push(r);
    if (!r.ok) break;
  }
  return { playerId, results };
}

async function runLoadTest(baseUrl, concurrent) {
  const start = Date.now();
  const promises = [];
  for (let i = 0; i < concurrent; i++) {
    promises.push(simulateOnePlayer(baseUrl, i + 1));
  }
  const outcomes = await Promise.all(promises);
  const totalMs = Date.now() - start;

  let successCount = 0;
  let failCount = 0;
  const times = [];

  outcomes.forEach(({ playerId, results }) => {
    const allOk = results.every((r) => r.ok);
    if (allOk) {
      successCount++;
      const totalTime = results.reduce((s, r) => s + (r.ms || 0), 0);
      times.push(totalTime);
    } else {
      failCount++;
    }
  });

  times.sort((a, b) => a - b);
  const avgMs = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
  const p50 = times.length ? times[Math.floor(times.length * 0.5)] : 0;
  const p95 = times.length ? times[Math.floor(times.length * 0.95)] : 0;

  return {
    concurrent,
    successCount,
    failCount,
    totalMs,
    avgMs,
    p50,
    p95,
    outcomes
  };
}

function printResult(baseUrl, r) {
  console.log('\n--- Resultaat ---');
  console.log('Server:     ', baseUrl);
  console.log('Gelijktijdige "spelers":', r.concurrent);
  console.log('Geslaagd:   ', r.successCount);
  console.log('Gefaald:    ', r.failCount);
  console.log('Totale tijd:', (r.totalMs / 1000).toFixed(1), 's');
  if (r.successCount > 0) {
    console.log('Response (gem):', r.avgMs, 'ms');
    console.log('Response (mediaan):', r.p50, 'ms');
    console.log('Response (p95):', r.p95, 'ms');
  }
  if (r.failCount > 0) {
    const firstFail = r.outcomes.find((o) => !o.results.every((x) => x.ok));
    if (firstFail) {
      const bad = firstFail.results.find((x) => !x.ok);
      console.log('Voorbeeld fout:', bad?.error || bad?.statusCode, 'bij', bad?.path);
    }
  }
  console.log('');
}

async function main() {
  const baseUrl = BASE_URL.replace(/\/$/, '');
  const concurrent = Math.max(1, Math.min(500, CONCURRENT));

  console.log('Load test Regenboog Pi');
  console.log('URL:', baseUrl);
  console.log('Aantal gelijktijdige spelers:', concurrent);
  console.log('Bezig...');

  const r = await runLoadTest(baseUrl, concurrent);
  printResult(baseUrl, r);

  if (r.failCount > 0 && r.failCount < r.concurrent) {
    console.log('Tip: Verlaag het aantal (bijv. ' + Math.max(1, r.successCount) + ') voor stabiel gedrag.');
  }
  if (r.successCount === r.concurrent) {
    console.log('Tip: Voer opnieuw uit met een hoger getal om het maximum te vinden, bijv.:');
    console.log('  node scripts/load-test-pi.js "' + baseUrl + '" ' + (concurrent + 10));
  }
}

main().catch((err) => {
  console.error('Fout:', err.message);
  process.exit(1);
});
