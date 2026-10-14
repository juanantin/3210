/* scripts/champion.mjs against a fake Base and a fake leaderboard: it must
   pick the best score that has a wallet, sum only that week's payouts to it,
   cap the bonus, and never touch a week already paid. */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'champ-')), 'champions.json');
process.env.CHAMPIONS_FILE = file;
process.env.WEEK = '2026-W41';
process.env.SITE_URL = 'https://site.test';

const T0 = Date.UTC(2026, 8, 20) / 1000; // block 0's timestamp, seconds
const START = Date.UTC(2026, 9, 5) / 1000;
const END = Date.UTC(2026, 9, 12) / 1000;
const blockOf = (ts) => Math.ceil((ts - T0) / 2);
const HEAD = blockOf(Date.UTC(2026, 9, 13) / 1000);
const WALLET = '0x' + 'ab'.repeat(20);
// Payouts to the champion: one before the week, two inside, one after.
const PAYOUTS = [[blockOf(START) - 1, 5], [blockOf(START), 3], [blockOf(END) - 1, 4], [blockOf(END), 7]];
let logCalls = 0;

globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://site.test')) {
    return new Response(JSON.stringify({ weekId: '2026-W41', week: [
      { name: 'NOWALLET', score: 999, address: null },
      { name: 'CONAN', score: 500, address: WALLET },
      { name: 'OTHER', score: 100, address: '0x' + 'cd'.repeat(20) },
    ] }));
  }
  const { method, params } = JSON.parse(init.body);
  if (method === 'eth_getBlockByNumber') {
    const n = params[0] === 'latest' ? HEAD : parseInt(params[0], 16);
    return new Response(JSON.stringify({ result: { number: '0x' + n.toString(16), timestamp: '0x' + (T0 + n * 2).toString(16) } }));
  }
  if (method === 'eth_getLogs') {
    logCalls++;
    const [{ fromBlock, toBlock, topics }] = params;
    const lo = parseInt(fromBlock, 16), hi = parseInt(toBlock, 16);
    if (hi - lo + 1 > 5000) return new Response(JSON.stringify({ error: { message: 'block range too large' } }));
    assert.equal(topics[2], '0x' + '0'.repeat(24) + WALLET.slice(2));
    const logs = PAYOUTS.filter(([b]) => b >= lo && b <= hi)
      .map(([, nokc]) => ({ data: '0x' + (BigInt(nokc) * 10n ** 8n).toString(16) }));
    return new Response(JSON.stringify({ result: logs }));
  }
  throw new Error('unexpected ' + method);
};

const { main } = await import('../scripts/champion.mjs');

test('the champion is the best score with a wallet, paid for that week only', async () => {
  await main();
  const out = JSON.parse(fs.readFileSync(file, 'utf8'));
  const w = out.weeks[0];
  assert.equal(w.week, '2026-W41');
  assert.equal(w.name, 'CONAN');
  assert.equal(w.wallet, WALLET);
  assert.equal(w.earnedNokc, 7, 'only the two payouts inside the week');
  assert.equal(w.bonusNokc, 7);
  assert.equal(w.tx, null);
  assert.ok(logCalls > 1, 'a refused range was split');
});

test('a paid week is left alone', async () => {
  const out = JSON.parse(fs.readFileSync(file, 'utf8'));
  out.weeks[0].earnedNokc = 999;
  out.weeks[0].tx = '0xpaid';
  fs.writeFileSync(file, JSON.stringify(out));
  await main();
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).weeks[0].earnedNokc, 999);

  const { weekStart } = await import('../scripts/champion.mjs');
  assert.equal(new Date(weekStart('2026-W42')).toISOString(), '2026-10-12T00:00:00.000Z');
});
