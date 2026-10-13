/* ==========================================================================
   What the indexer watches — $3310 on Base.
   --------------------------------------------------------------------------
   Every TODO here is read from the network by .github/workflows/discover.yml
   (scripts/discover-token.mjs) once config.js has the contract address —
   never carried over from another token. scripts/index-rewards.mjs refuses
   to scan while MISSING below is non-empty.

   ⚠ Which on-chain flow is "fees collected" versus "distributed" is not
   self-evident: reconcile against what the launch platform and the rewards
   index publish for $3310 before trusting a number — the traps are in
   worker/README.md.
   ========================================================================== */

export const CHAIN_ID = 8453;                    // Base

export const TOKENS = {
  // The token people buy — $3310
  STR: '0x5bC16E5322578114EaDC9eF9B94731B5a17d13B9',
  // $NOKc, the reward token holders are paid in. symbol() "NOKc", name()
  // "Nokia Corporation", decimals() 8 — read on chain by discover.yml.
  KEX: '0xB2000000000000000000005ac674f707E357409c',
};

export const CONTRACTS = {
  // $3310/$NOKc on Aerodrome Slipstream, the token's only pair.
  pool: '0xb51A37a046f7DF48a9a81534e9217aF0d4399e11',
  // Where trading fees accrue, from /api/coins. SHARED BY EVERY COIN launched
  // on this venue, so no stream may sum it — it is only excluded from holders.
  feeLocker: '0x43555104f569d17026037e5637691b95c79fd03a',
  // The $3310 Stockify index — the distributor holders are paid from, the one
  // address here that is $3310's alone. Every stream below watches it.
  rewardsIndex: '0xdad6D69e44e2601eaFeb550c9B63aF222aA7692e',
};

// The block $3310 launched at — /api/coins block_number, read by
// discover.yml. Nothing relevant happened before it.
export const START_BLOCK = 52559259;

/* Decimals, per token, READ FROM EACH CONTRACT rather than assumed — two
   constants, not one, because they can differ: a sibling site's reward token
   returns 8 where its token returns 18, and sharing one constant published a
   figure ten billion times too small. */
export const STR_DECIMALS = 18;
export const KEX_DECIMALS = 8;   // $NOKc: decimals() returns 8, read on chain

/* Everything that has to be real before a scan means anything. index-rewards
   and the worker both refuse to run while this list is non-empty, because the
   alternative is a run that sums nothing and publishes nulls on a schedule —
   which looks, on the page, exactly like a site that is broken. */
export const MISSING = Object.entries({
  'TOKENS.STR': TOKENS.STR,
  'TOKENS.KEX': TOKENS.KEX,
  'CONTRACTS.pool': CONTRACTS.pool,
  'CONTRACTS.rewardsIndex': CONTRACTS.rewardsIndex,
  START_BLOCK,
  KEX_DECIMALS,
}).filter(([, v]) => v === null || v === undefined || v === '').map(([k]) => k);

/* The three flows the totals are built from:

     `feesIn`   reward tokens ARRIVING at the distributor — "fees collected"
     `paidOut`  everything LEAVING it: holder payments plus the protocol's cut,
                so it is not the "distributed" figure on its own
     `holders`  every token transfer folded into a running balance per address;
                addresses left holding something are the holder count

   Verify these against the platform's own panel before trusting them. */
export const STREAMS = [
  { id: 'feesIn', kind: 'sum', token: TOKENS.KEX, to: CONTRACTS.rewardsIndex, decimals: KEX_DECIMALS },
  { id: 'paidOut', kind: 'sum', token: TOKENS.KEX, from: CONTRACTS.rewardsIndex, decimals: KEX_DECIMALS },
  { id: 'holders', kind: 'balances', token: TOKENS.STR, decimals: STR_DECIMALS },
];

/* Share of the outflow that reaches holders — the rest is the protocol's cut.

   From $3310's own Stockify panel, read by the probe workflow: "Holders 90% ·
   Protocol 10% · Creator 0%" — and borne out by its totals once payouts began
   (2026-10-13, 17:00 UTC, after 6 rounds):

       panel   FEES COLLECTED   183.89 NOKc ($1.81K)
       panel   PAID TO HOLDERS  165.51 NOKc ($1.63K)   = 0.9 × 183.89

   Compare data/rewards.json against the panel after the indexer next syncs:
   its feesIn also counts NOKc that reached the index before the panel's first
   "fees in" entry, so a small difference there is expected, not a fault. Better still, set
   PROTOCOL_ADDRESS if the protocol's address turns up, since the cut is then
   subtracted exactly and survives the percentage changing. */
export const HOLDER_SHARE = 0.9;
export const PROTOCOL_ADDRESS = null;

// Without a share or the protocol's address, "distributed" cannot be computed.
if (HOLDER_SHARE === null && !PROTOCOL_ADDRESS) MISSING.push('HOLDER_SHARE');

if (PROTOCOL_ADDRESS) {
  STREAMS.push({
    id: 'protocolOut', kind: 'sum', token: TOKENS.KEX,
    from: CONTRACTS.rewardsIndex, to: PROTOCOL_ADDRESS, decimals: KEX_DECIMALS,
  });
}

/** Tokens that actually reached holders. */
export function holderPayout(totals) {
  const paidOut = totals.paidOut ?? 0;
  if (PROTOCOL_ADDRESS) return Math.max(0, paidOut - (totals.protocolOut ?? 0));
  return paidOut * HOLDER_SHARE;
}

/* Addresses that hold supply but are not holders in the sense the tile means:
   the pool itself, the fee locker, the rewards contract. */
export const EXCLUDE_FROM_HOLDERS = [
  CONTRACTS.pool,
  CONTRACTS.feeLocker,
  CONTRACTS.rewardsIndex,
].filter(Boolean).map((a) => a.toLowerCase());

/* Scan pacing. A Worker run is short, so it takes bites and resumes. Raise
   MAX_CHUNKS_PER_RUN to backfill faster; lower CHUNK_SIZE if the RPC complains
   (it halves automatically anyway). */
export const CHUNK_SIZE = 2000;
export const MAX_CHUNKS_PER_RUN = 60;
export const CONFIRMATIONS = 5;

// Price the token totals in USD. Public, no key.
export const DEXSCREENER_PAIR =
  'https://api.dexscreener.com/latest/dex/pairs/base/' + CONTRACTS.pool;
export const DEXSCREENER_KEX_TOKEN =
  'https://api.dexscreener.com/latest/dex/tokens/' + TOKENS.KEX;
