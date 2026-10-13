# Launch checklist — $3310

Done: the page, the game, the artwork, X (@3310onbase), and everything for
the token — contract, pool, launch block, $NOKc and its decimals, the
Stockify index and both partner links — in `config.js` and
`worker/src/config.js`, read off the network by `discover.yml`.
`data/rewards-state.json` is seeded at the launch block.

**Left: the holders' share.** Read it off the index's Stockify panel ("TO
HOLDERS 90%" on $BLUE's), then:

1. set `holderShare` in `config.js` and `HOLDER_SHARE` in
   `worker/src/config.js` (0.9 for 90%) — `MISSING` empties
2. uncomment the schedule in `.github/workflows/index-rewards.yml`

Until then fees collected is measured live in the browser and $NOKc
distributed shows a dash: an unset share is unknown, not zero.

## 0. Let the network answer first

Most of step 1 is discoverable from the contract address alone, and guessing
any of it has a known cost. **Run the discovery workflow before editing
anything:**

```
.github/workflows/discover.yml  →  scripts/discover-token.mjs
```

Push a change to either path and it runs (`workflow_dispatch` needs a
permission not every token carries). From the contract address it reports:

- every DexScreener pair on Base, deepest first — **the pool**
- the deepest pair's other side — **the reward token**
- `symbol()`, `name()`, `decimals()` and `totalSupply()` for both, read off
  chain and each failure labelled, so a throttled call can never be mistaken
  for a reading
- **the launch block**, from a timestamp search for the pool's `pairCreatedAt`
- the platform's own entry for the token: fee locker, launch block, the
  official image and banner, and `/api/fee-routing`'s **rewards index**
- whether a candidate address really is the distributor — set `CANDIDATES` and
  it reports the reward-token flow in and out of it

It prints a paste-ready block at the end. Read the job log with
`get_job_logs`; the summary is deliberately last, because logs come back as a
tail.

Only two things are not discoverable: **`holderShare`**, which is a per-token
setting on the platform's panel, and artwork.

## 1. Addresses and links

`config.js`
- `contractAddress` — **required.** The token people buy: the CA button copies
  it, the chart button links to it, and DexScreener is searched by it. Nothing
  on the dashboard resolves until it is set.
- `rewardTokenAddress` — the token holders are paid in, used to price
  distributed rewards in USD. Leave `null` if there is no separate one.
- `rewardTokenSymbol` — matched as a **substring** against each token's own
  `symbol()`, because platforms decorate the ticker they wrap: $BOX's reward
  token answers `AMZNc`, not `AMZN`. There is no default — with this null the
  configured address is used instead, never a ticker inherited from whatever
  token this repo was copied from.
- `launchBlock` — the chain scan starts here. **Never leave it null and never
  leave a sibling token's block in it**; both mean scanning blocks that have
  nothing to do with this token.
- `contracts.pool` — the trading pair. **Leave it null unless you are certain.**
  DexScreener is asked about this pool *before* it searches by token address,
  so a wrong pool reports another token's market cap, liquidity and volume no
  matter what `contractAddress` says. Name it once you are sure, because the
  search is a coin flip when a token has a deep pool and a dust one.
- `contracts.feeLocker` — **shared by every token on the platform.** It is
  recorded so it can be excluded from the holder count, never summed.
- `contracts.rewardsIndex` — the per-token distributor, and the only one of
  these that is yours. Not derivable on chain.
- `links.x`, `links.launchedIn`, `links.rewardsBy`.
- `holderShare` — **check the token's own Stockify panel.** It is the one
  multiplier between the measured outflow and the figure on the tile.

## 2. Branding

Done. For the record of how each file is made:

- `images/src/header_master.mp4` is the $3310 header clip (the hero's mp4,
  webm and poster); `images/src/header_still_master.webp` the same header as
  a still, which the share card `images/social.jpg` and every icon come from,
  and `index.html` points `og:image`, `twitter:image` and `og:url` at
  https://3210nokc.xyz. After changing any of them run
  `node scripts/stamp.mjs`, which moves every `?v=` so browsers drop the
  cached files.
- `images/phone.webp` — the phone the game is drawn on. Its LCD and key hit
  areas are measured in `assets/js/snake/phone.js`.
- Supply in `<section class="facts">` is **1,000,000,000 (1B)**.
- The two ecosystem lockups at the bottom of `index.html` are Stonks.Exchange
  and Stockify, as on the banner; their hrefs come from `config.js`
  `links.launchedIn` / `links.rewardsBy` once the token's own pages exist.
- The reward ticker is `$NOKc` (`rewardTokenSymbol` in `config.js`, and the
  first card's label in `index.html`). Confirm it against the reward token's
  `symbol()` when discovery runs.

## 3. Live figures

Market cap, liquidity, volume and holders come in on their own once
`contractAddress` is set. Fees collected and rewards distributed do not — they
are protocol figures. See **Rewards** in [`README.md`](README.md).

To index them, fill in `worker/src/config.js`:
- `TOKENS` and `CONTRACTS`
- **`START_BLOCK`** — the block the token was deployed in. Left at `0` the
  scan starts at genesis and will never finish.
- **`STR_DECIMALS` and `KEX_DECIMALS`** — read from each contract, and kept as
  two constants even when they agree. $BOX's reward token returns 8 where the
  token itself is 18; sharing one constant there published 25.244695737 as
  2.5244695737e-9 — every digit right, the scale out by ten billion.
- `STREAMS` and `HOLDER_SHARE` encode one assumption: fees arrive at
  `rewardsIndex` in the reward token, and holders receive `HOLDER_SHARE` of
  what leaves it. Check that against the platform's own published figures
  before trusting a single number on the page.

`MISSING` at the top of that file lists whatever is still null, and
`scripts/index-rewards.mjs` refuses to scan while it is non-empty: a run
against an unset index sums nothing and publishes nulls, which on the page is
indistinguishable from a site that is broken.

Then **seed `data/rewards-state.json` with `cursor` = `START_BLOCK` and commit
it.** Two independent failures hide here, and both look identical to a broken
site:

- `loadState()` falls back to `START_BLOCK` only when that file is **absent**.
  A present file carrying a templated `cursor: 0` is read as gospel, and the
  indexer scans Base from genesis — six hundred runs' worth of work before it
  reaches a block that matters. (There is now a clamp against exactly this,
  but the seed is what makes the first run right.)
- It is the **only** thing carrying the backfill between runs, because Actions
  runners are ephemeral. Gitignore it and every run starts over.

The schedule in [`.github/workflows/index-rewards.yml`](.github/workflows/index-rewards.yml)
**is on** — it runs four times an hour, off the :00/:15/:30/:45 boundary where
GitHub's scheduler is most oversubscribed. Comment it out again if you point
this repo at a token whose addresses are not yet filled in.

## 4. Repo settings

- **Deployment is Vercel, not GitHub Pages.** Import the repo as a Vercel
  project with any preset: `vercel.json` sets the build (`npm run build`,
  which only copies the served files) and the output (`dist/`), plus the
  cache headers. Keep it to keys Vercel knows: that file rejects unknown
  top-level keys, and
  a `"//"` comment key once failed every production deploy for eighteen hours
  while the data behind it updated perfectly. Validate the key names, not just
  that the JSON parses.
- Set the **`SITE_URL` repository variable** to `https://3210nokc.xyz` (Settings ▸ Secrets and variables
  ▸ Actions ▸ Variables) to the deployment's public URL. The probe workflow's
  live-site pass skips itself while it is unset, because there is genuinely
  nothing to probe; once set, it is the only pass that proves what a visitor
  is actually served.
- Add an `RPC_URL` secret if you have a private Base RPC. Without it the
  indexer falls back to the public `mainnet.base.org`, which works but
  rate-limits — the backfill just takes more runs.

## 5. Before you announce it

- Run the probe workflow and read all four passes, the live-site one included.
  **A local pass proves the code is right, never that it is live** — that
  distinction hid a broken deploy for a full day on $BOX.
- Load the site with `?debug=1` and read the source panel: every line should
  be `ok`, and any `—` should be a figure you know is not fed yet. The first
  line is the build stamp; if it is not the version you just pushed, the
  problem is the deploy or a cache, not the code.
- Check the CA button copies the full address, and that the chart button opens
  the right token.
- **Reconcile fees, distribution and holders against the platform's own
  panels** before quoting any of them. Do not publish a number you have not
  cross-checked.
