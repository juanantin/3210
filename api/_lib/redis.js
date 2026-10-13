/* Upstash Redis over its REST API — plain fetch, no SDK, no dependencies.
   The Vercel ▸ Storage ▸ Upstash integration sets KV_REST_API_URL and
   KV_REST_API_TOKEN on the project (newer stores name them UPSTASH_REDIS_REST_*);
   either pair works. */

// A store connected with a custom prefix names them <PREFIX>_REST_API_URL etc.
const suffixed = (end) => Object.keys(process.env).find((k) => k.endsWith(end) && !k.includes('READ_ONLY'));
const env = (...names) => names.map((n) => n && process.env[n]).find(Boolean);

const URL_ = env('KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL', suffixed('_REST_API_URL'));
const TOKEN = env('KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN', suffixed('_REST_API_TOKEN'));

export const configured = () => Boolean(URL_ && TOKEN);

// Runs commands in one round trip; returns each command's result in order.
export async function pipeline(commands) {
  if (!configured()) throw new Error('leaderboard storage is not connected');
  const res = await fetch(`${URL_.replace(/\/$/, '')}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`storage answered ${res.status}`);
  const out = await res.json();
  return out.map((r) => {
    if (r.error) throw new Error(r.error);
    return r.result;
  });
}

export const redis = async (...command) => (await pipeline([command]))[0];
