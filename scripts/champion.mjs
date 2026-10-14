#!/usr/bin/env node
/* ==========================================================================
   The weekly Snake champion, and the bonus that doubles their rewards
   --------------------------------------------------------------------------
   Runs every Monday (.github/workflows/champion.yml) once the week before has
   closed:

     1. asks the site's leaderboard (api/scores.js ?week=) for that week's
        board, and takes the highest score that came with a wallet;
     2. adds up every $NOKc transfer from the rewards index to that wallet
        during the week, read off Base — what holding paid them;
     3. writes data/champions.json: the champion, what they earned, and the
        bonus to send (the same again, up to config.js champion.bonusCap; 0 = no cap).

   The bonus is sent BY HAND from a team wallet. Then paste the transaction
   hash into that week's "tx" in data/champions.json and the site shows the
   week as paid, linked to Basescan. A week that already has a tx is never
   recomputed.

   Run:  SITE_URL=https://www.3310nok.xyz node scripts/champion.mjs
         WEEK=2026-W42 to (re)work out a particular week.
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isoWeek } from '../api/_lib/http.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.CHAMPIONS_FILE || path.join(ROOT, 'data', 'champions.json');

const window = {};
new Function('window', fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8'))(window);
const CFG = window.SITE_CONFIG;

const SITE = (process.env.SITE_URL || 'https://www.3310nok.xyz').replace(/\/$/, '');
const CAP = Number(CFG.champion?.bonusCap) || 0;
const REWARD = CFG.rewardTokenAddress;
const INDEX = CFG.contracts?.rewardsIndex;
const DECIMALS = Number(CFG.rewardTokenDecimals);
const RPCS = [process.env.RPC_URL, ...(CFG.sources?.holders?.onchain?.rpcUrls || [])]
  .filter((u, i, a) => u && a.indexOf(u) === i);
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

/* ---- weeks ---- */

// Monday 00:00 UTC of an ISO week such as "2026-W42", in ms.
export function weekStart(id) {
  const [, y, w] = id.match(/^(\d{4})-W(\d{2})$/).map(Number);
  const jan4 = Date.UTC(y, 0, 4);
  const dow = new Date(jan4).getUTCDay() || 7;
  return jan4 - (dow - 1) * 86400000 + (w - 1) * 7 * 86400000;
}

/* ---- Base, through whichever public node answers ---- */

let at = 0;
async function rpc(method, params) {
  let last;
  for (let n = 0; n < RPCS.length * 2; n++) {
    const url = RPCS[(at + n) % RPCS.length];
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: AbortSignal.timeout(15000),
      });
      const out = await res.json();
      if (out.error) throw new Error(out.error.message || JSON.stringify(out.error));
      at = (at + n) % RPCS.length;
      return out.result;
    } catch (e) {
      last = e;
      if (/range|limit|too many|exceed/i.test(e.message) && method === 'eth_getLogs') throw e;
    }
  }
  throw last;
}

const block = async (tag) => {
  const b = await rpc('eth_getBlockByNumber', [typeof tag === 'number' ? `0x${tag.toString(16)}` : tag, false]);
  return { n: parseInt(b.number, 16), ts: parseInt(b.timestamp, 16) * 1000 };
};

// The first block at or after time t. Base makes a block every 2 seconds.
async function blockAt(t, head) {
  if (t >= head.ts) return head.n + 1;
  let n = head.n - Math.floor((head.ts - t) / 2000);
  for (let i = 0; i < 6; i++) {
    const b = await block(n);
    const off = Math.round((b.ts - t) / 2000);
    if (off === 0) break;
    n -= off;
  }
  while ((await block(n)).ts < t) n++;
  while (n > 0 && (await block(n - 1)).ts >= t) n--;
  return n;
}

const topic = (a) => `0x${'0'.repeat(24)}${a.toLowerCase().slice(2)}`;

// Sum of reward-token transfers index -> wallet in blocks [from, to].
async function paidTo(wallet, from, to) {
  let total = 0n;
  let size = 10000;
  for (let lo = from; lo <= to; ) {
    const hi = Math.min(to, lo + size - 1);
    let logs;
    try {
      logs = await rpc('eth_getLogs', [{
        address: REWARD,
        topics: [TRANSFER, topic(INDEX), topic(wallet)],
        fromBlock: `0x${lo.toString(16)}`,
        toBlock: `0x${hi.toString(16)}`,
      }]);
    } catch (e) {
      if (size <= 250) throw e;
      size = Math.floor(size / 2);
      continue;
    }
    for (const l of logs) total += BigInt(l.data);
    lo = hi + 1;
  }
  return Number(total) / 10 ** DECIMALS;
}

/* ---- the week ---- */

export async function main() {
  const id = process.env.WEEK || isoWeek(new Date(Date.now() - 7 * 86400000)).id;
  const start = weekStart(id);
  const end = start + 7 * 86400000;
  if (end > Date.now()) throw new Error(`${id} has not ended yet`);

  const file = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { weeks: [] };
  const prior = file.weeks.find((w) => w.week === id);
  if (prior?.tx) {
    console.log(`${id}: already paid (${prior.tx}) — leaving it alone`);
    return;
  }

  const res = await fetch(`${SITE}/api/scores?week=${id}`);
  if (!res.ok) throw new Error(`leaderboard answered ${res.status}`);
  const board = await res.json();
  // An older API ignores ?week= and answers with the current week: never
  // crown this week's leader as last week's champion.
  if (board.weekId !== id) throw new Error(`asked for ${id}, the leaderboard answered ${board.weekId}`);
  const top = (board.week || []).find((r) => r.address);
  if (!top) {
    console.log(`${id}: no score with a wallet — no champion`);
    return;
  }

  const entry = {
    week: id,
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    name: top.name,
    score: top.score,
    wallet: top.address,
    earnedNokc: null,
    bonusNokc: null,
    cap: CAP,
    tx: prior?.tx ?? null,
  };

  {
    const head = await block('latest');
    const from = await blockAt(start, head);
    const to = (await blockAt(end, head)) - 1;
    const earned = await paidTo(top.address, from, to);
    entry.earnedNokc = Math.round(earned * 1e6) / 1e6;
    entry.bonusNokc = Math.round((CAP > 0 ? Math.min(earned, CAP) : earned) * 1e6) / 1e6;
    entry.blocks = [from, to];
  }

  file.__doc = [
    'Weekly Snake champions, written by scripts/champion.mjs every Monday.',
    'bonusNokc is what to send the champion: the $NOKc the rewards index paid',
    'their wallet that week, up to cap. Send it by hand, then paste the',
    'transaction hash into "tx" and the site shows the week as paid.',
  ];
  file.cap = CAP;
  file.weeks = [entry, ...file.weeks.filter((w) => w.week !== id)].sort((a, b) => (a.week < b.week ? 1 : -1));
  fs.writeFileSync(OUT, `${JSON.stringify(file, null, 2)}\n`);

  const line = `${id}: ${top.name} (${top.score} pts) · ${top.address} earned ${entry.earnedNokc} NOKc → send ${entry.bonusNokc} NOKc`;
  console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Snake champion ${id}\n\n${line}\n`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
