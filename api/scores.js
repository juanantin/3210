/* GET  /api/scores — the boards: all-time and this week, top 10 each.
        ?week=2026-W42 returns that week instead of this one (kept 120 days).
   POST /api/scores — submit a finished run for the boards.

   A run is not taken on trust. It names the ticket (api/ticket.js) whose seed
   it was played on, and lists every turn; the server replays it with the
   game's own rules (assets/js/snake/rules.js) and records the score the
   replay reaches, never the one claimed. A ticket is spent on first use, and
   a run is refused if it arrives sooner than its steps take to play.

   Storage (Upstash Redis):
     lb:all, lb:w:<week>            sorted sets, player -> best score
     lb:all:meta, lb:w:<week>:meta  hashes, player -> JSON of that best run
     lb:games                       count of verified runs
   A player is their wallet when they give one, otherwise their name. To
   remove an entry: ZREM the board and HDEL its :meta in the Upstash console. */

import { replay, SPEED } from '../assets/js/snake/rules.js';
import { configured, pipeline, redis } from './_lib/redis.js';
import { allow, isoWeek, json } from './_lib/http.js';

const TOP = 10;
const WEEK_TTL = 120 * 86400;

// $3310 on Base — a wallet holding any is marked as a holder on the board.
const TOKEN = (process.env.TOKEN_ADDRESS || '0x5bC16E5322578114EaDC9eF9B94731B5a17d13B9').toLowerCase();
const RPCS = [process.env.RPC_URL, 'https://mainnet.base.org', 'https://base.drpc.org', 'https://base-rpc.publicnode.com'].filter(Boolean);

const short = (w) => (w ? `${w.slice(0, 6)}…${w.slice(-4)}` : null);

async function board(key) {
  const [ranked, meta] = await pipeline([
    ['ZRANGE', key, '0', String(TOP - 1), 'REV', 'WITHSCORES'],
    ['HGETALL', `${key}:meta`],
  ]);
  const info = {};
  for (let i = 0; i < (meta || []).length; i += 2) info[meta[i]] = meta[i + 1];
  const rows = [];
  for (let i = 0; i < (ranked || []).length; i += 2) {
    let m = {};
    try {
      m = JSON.parse(info[ranked[i]] || '{}');
    } catch {
      // A damaged entry still shows its score.
    }
    rows.push({
      name: m.name || '???',
      score: Number(ranked[i + 1]),
      level: m.level ?? null,
      wallet: short(m.wallet),
      // The full address too: the weekly champion's bonus is paid to it
      // (scripts/champion.mjs). Players chose to publish it.
      address: m.wallet || null,
      holder: Boolean(m.holder),
      at: m.at ?? null,
    });
  }
  return rows;
}

export async function GET(request) {
  if (!configured()) return json({ error: 'leaderboard offline' }, 503);
  try {
    const asked = new URL(request?.url || 'http://x/').searchParams.get('week');
    if (asked && !/^\d{4}-W\d{2}$/.test(asked)) return json({ error: 'week looks like 2026-W42' }, 400);
    const week = asked ? { id: asked, endsAt: null } : isoWeek();
    const [all, weekly, games] = await Promise.all([board('lb:all'), board(`lb:w:${week.id}`), redis('GET', 'lb:games')]);
    return json(
      { all, week: weekly, weekId: week.id, weekEndsAt: week.endsAt, games: Number(games) || 0 },
      200,
      { 'Cache-Control': 'public, max-age=0, s-maxage=10, stale-while-revalidate=30' },
    );
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
}

async function holds(wallet) {
  const data = `0x70a08231${wallet.slice(2).toLowerCase().padStart(64, '0')}`;
  for (const url of RPCS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: TOKEN, data }, 'latest'] }),
        signal: AbortSignal.timeout(2500),
      });
      const out = await res.json();
      if (typeof out.result === 'string') return BigInt(out.result === '0x' ? 0 : out.result) > 0n;
    } catch {
      // Try the next node.
    }
  }
  return false;
}

// Keeps `entry` on `key` only if it beats that player's best there.
async function record(key, player, entry, ttl) {
  const best = await redis('ZSCORE', key, player);
  if (best !== null && Number(best) >= entry.score) return false;
  const cmds = [
    ['ZADD', key, String(entry.score), player],
    ['HSET', `${key}:meta`, player, JSON.stringify(entry)],
  ];
  if (ttl) cmds.push(['EXPIRE', key, String(ttl)], ['EXPIRE', `${key}:meta`, String(ttl)]);
  await pipeline(cmds);
  return true;
}

export async function POST(request) {
  if (!configured()) return json({ error: 'leaderboard offline' }, 503);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad request' }, 400);
  }
  try {
    if (!(await allow(request, 'score', 12))) return json({ error: 'slow down' }, 429);

    const name = String(body.name ?? '').trim().toUpperCase().replace(/[^A-Z0-9 _.\-]/g, '').slice(0, 12).trim();
    if (!name) return json({ error: 'enter a name' }, 400);
    let wallet = String(body.wallet ?? '').trim();
    if (wallet && !/^0x[0-9a-fA-F]{40}$/.test(wallet)) return json({ error: 'that wallet address is not valid' }, 400);
    wallet = wallet.toLowerCase() || null;

    const id = String(body.ticket ?? '');
    if (!/^[0-9a-f-]{36}$/.test(id)) return json({ error: 'this run has no ticket' }, 400);
    const raw = await redis('GETDEL', `t:${id}`);
    if (!raw) return json({ error: 'this run was already submitted, or is too old' }, 410);
    const ticket = JSON.parse(raw);

    const level = Number(body.level);
    const steps = Number(body.steps);
    const result = replay({ seed: ticket.seed, level, turns: body.turns, steps });
    if (result.error) return json({ error: `run rejected: ${result.error}` }, 422);
    if (result.score <= 0) return json({ error: 'no score to record' }, 422);

    // Every step takes SPEED[level] ms; allow for timer slack and catch-up.
    const minMs = steps * SPEED[level] * 0.8;
    if (Date.now() - ticket.ts < minMs) return json({ error: 'run rejected: played faster than the game runs' }, 422);

    const holder = wallet ? await holds(wallet) : false;
    const entry = { name, score: result.score, level, steps, wallet, holder, at: new Date().toISOString() };
    const player = wallet || `n:${name}`;
    const week = isoWeek();

    await redis('INCR', 'lb:games');
    const bestAll = await record('lb:all', player, entry);
    const bestWeek = await record(`lb:w:${week.id}`, player, entry, WEEK_TTL);
    const [rankAll, rankWeek] = await pipeline([
      ['ZREVRANK', 'lb:all', player],
      ['ZREVRANK', `lb:w:${week.id}`, player],
    ]);
    return json({
      score: result.score,
      holder,
      personalBest: bestAll,
      weeklyBest: bestWeek,
      rank: rankAll === null ? null : rankAll + 1,
      weekRank: rankWeek === null ? null : rankWeek + 1,
    });
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
}
