/* The leaderboard's guarantees: a run recorded by the real game replays to
   the same score on the server, a doctored one does not, and the API spends
   each ticket once.   Run:  node --test test/ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../assets/js/snake/engine.js';
import { Screen } from '../assets/js/snake/screen.js';
import { DIRS, SPEED, COLS, ROWS, replay } from '../assets/js/snake/rules.js';

// Plays one game in the real engine with a greedy bot; returns the run.
function play(seed, level, turnEvery = 1) {
  const engine = new Engine(new Screen());
  engine.level = level;
  let run = null;
  engine.ticketSource = () => ({ id: 'x', seed });
  engine.onOver = (r) => (run = r);
  let now = 1000;
  engine.update(now);
  engine.startGame();
  let i = 0;
  while (!run && i++ < 20000) {
    if (i % turnEvery === 0) {
      const h = engine.snake[0];
      const f = engine.food;
      const safe = Object.values(DIRS).filter((d) => {
        const x = h.x + d.x;
        const y = h.y + d.y;
        return x >= 0 && y >= 0 && x < COLS && y < ROWS && !engine.snake.slice(0, -1).some((s) => s.x === x && s.y === y);
      });
      const toward = safe.find((d) => (d.x && Math.sign(f.x - h.x) === d.x) || (d.y && Math.sign(f.y - h.y) === d.y));
      engine.turn(toward ?? safe[0] ?? engine.dir);
    }
    now += SPEED[level];
    engine.update(now);
  }
  assert.ok(run, 'game ended');
  return run;
}

test('a recorded game replays to the same score', () => {
  for (const [seed, level, every] of [[1, 5, 1], [42, 9, 1], [123456789, 1, 3], [4294967295, 7, 2]]) {
    const run = play(seed, level, every);
    assert.ok(run.score > 0, 'bot scored');
    const r = replay({ seed, level, turns: run.turns, steps: run.steps });
    assert.deepEqual(r, { score: run.score, steps: run.steps }, `seed ${seed}`);
  }
});

test('a doctored run is refused', () => {
  const run = play(7, 5);
  const base = { seed: 7, level: 5, turns: run.turns, steps: run.steps };
  assert.ok(replay({ ...base, seed: 8 }).error || replay({ ...base, seed: 8 }).score !== run.score);
  assert.ok(replay({ ...base, level: 9 }).score === undefined || replay({ ...base, level: 9 }).score !== run.score);
  assert.ok(replay({ ...base, steps: run.steps + 50 }).error);
  assert.ok(replay({ ...base, turns: [[0, 'l'], ...run.turns] }).error, 'reversal into the neck');
  assert.ok(replay({ ...base, turns: [...run.turns, [run.steps + 5, 'u']] }).error, 'turn after death');
  assert.ok(replay({ ...base, turns: 'nope' }).error);
});

/* ---- the API, against an in-memory stand-in for Upstash's REST pipeline ---- */

const store = new Map();
const zsets = new Map();
const hashes = new Map();
function exec([cmd, ...a]) {
  switch (cmd) {
    case 'SET': store.set(a[0], a[1]); return 'OK';
    case 'GET': return store.get(a[0]) ?? null;
    case 'GETDEL': { const v = store.get(a[0]) ?? null; store.delete(a[0]); return v; }
    case 'INCR': { const v = Number(store.get(a[0]) || 0) + 1; store.set(a[0], String(v)); return v; }
    case 'EXPIRE': return 1;
    case 'ZSCORE': { const z = zsets.get(a[0]); return z?.has(a[1]) ? String(z.get(a[1])) : null; }
    case 'ZADD': { const z = zsets.get(a[0]) ?? new Map(); z.set(a[2], Number(a[1])); zsets.set(a[0], z); return 1; }
    case 'HSET': { const h = hashes.get(a[0]) ?? new Map(); h.set(a[1], a[2]); hashes.set(a[0], h); return 1; }
    case 'HGETALL': return [...(hashes.get(a[0]) ?? new Map())].flat();
    case 'ZRANGE': return [...(zsets.get(a[0]) ?? new Map())].sort((x, y) => y[1] - x[1]).slice(0, 10).flatMap(([m, s]) => [m, String(s)]);
    case 'ZREVRANK': { const s = [...(zsets.get(a[0]) ?? new Map())].sort((x, y) => y[1] - x[1]).map((e) => e[0]); const i = s.indexOf(a[1]); return i < 0 ? null : i; }
    default: throw new Error(`unmocked ${cmd}`);
  }
}

test('the API verifies, records and ranks runs', async () => {
  process.env.KV_REST_API_URL = 'https://redis.test';
  process.env.KV_REST_API_TOKEN = 't';
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith('https://redis.test')) {
      return new Response(JSON.stringify(JSON.parse(init.body).map((c) => ({ result: exec(c) }))));
    }
    return new Response(JSON.stringify({ result: '0x' + '0'.repeat(63) + '1' })); // holds 1 wei
  };
  const { POST: ticketPost } = await import('../api/ticket.js');
  const { GET, POST } = await import('../api/scores.js');
  const req = (body) => new Request('https://x/api/scores', { method: 'POST', body: JSON.stringify(body), headers: { 'x-forwarded-for': '1.2.3.4' } });

  const t = await (await ticketPost(new Request('https://x/api/ticket', { method: 'POST' }))).json();
  const run = play(t.seed, 6);
  const sub = { ticket: t.id, level: 6, steps: run.steps, turns: run.turns, name: 'snk', wallet: '0x' + 'ab'.repeat(20) };

  // Too fast: the ticket was issued a moment ago.
  let res = await POST(req(sub));
  assert.equal(res.status, 422);
  assert.match((await res.json()).error, /faster/);

  // That attempt spent the ticket.
  res = await POST(req(sub));
  assert.equal(res.status, 410);

  // A fresh ticket, aged as if the game had been played.
  const t2 = await (await ticketPost(new Request('https://x/api/ticket', { method: 'POST' }))).json();
  const run2 = play(t2.seed, 6);
  store.set(`t:${t2.id}`, JSON.stringify({ seed: t2.seed, ts: Date.now() - run2.steps * SPEED[6] }));
  res = await POST(req({ ...sub, ticket: t2.id, steps: run2.steps, turns: run2.turns, score: 99999 }));
  const out = await res.json();
  assert.equal(res.status, 200, JSON.stringify(out));
  assert.equal(out.score, run2.score, 'the replayed score, not the claimed one');
  assert.equal(out.rank, 1);
  assert.equal(out.holder, true);

  const board = await (await GET()).json();
  assert.equal(board.all[0].name, 'SNK');
  assert.equal(board.all[0].score, run2.score);
  assert.equal(board.week[0].wallet, '0xabab…abab');
  assert.equal(board.games, 1);
});
