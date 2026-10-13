/* POST /api/ticket — a one-use seed for the next game.

   The server picks where the food falls (the seed), so a run can only be
   submitted once, against a seed it was handed, and no sooner than the game
   could really have been played (api/scores.js checks both). */

import { randomUUID, randomInt } from 'node:crypto';
import { configured, redis } from './_lib/redis.js';
import { allow, json } from './_lib/http.js';

export const TICKET_TTL = 6 * 3600; // seconds

export async function POST(request) {
  if (!configured()) return json({ error: 'leaderboard offline' }, 503);
  try {
    if (!(await allow(request, 'ticket', 30))) return json({ error: 'slow down' }, 429);
    const id = randomUUID();
    const seed = randomInt(0, 2 ** 32 - 1);
    await redis('SET', `t:${id}`, JSON.stringify({ seed, ts: Date.now() }), 'EX', TICKET_TTL);
    return json({ id, seed });
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
}
