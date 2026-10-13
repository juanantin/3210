/* Small shared helpers for the API routes. */

import { redis } from './redis.js';

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

export function clientIp(request) {
  const fwd = request.headers.get('x-forwarded-for') || '';
  return fwd.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
}

// At most `limit` calls per minute per address for `bucket`. True when allowed.
export async function allow(request, bucket, limit) {
  const key = `rl:${bucket}:${clientIp(request)}:${Math.floor(Date.now() / 60000)}`;
  const n = await redis('INCR', key);
  if (n === 1) await redis('EXPIRE', key, 90);
  return n <= limit;
}

// ISO week in UTC, e.g. "2026-W42", and when it ends.
export function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + (7 - (date.getUTCDay() || 7)) + 1));
  return { id: `${year}-W${String(week).padStart(2, '0')}`, endsAt: end.toISOString() };
}
