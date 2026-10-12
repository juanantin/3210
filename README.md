# $3310 — the phone that never dies

The site for the $3310 token on Base — *buy $3310, get $NOKc*: the banner, a
live dashboard, and classic Snake playable on a Nokia-style phone right on
the page. Static
HTML/CSS/JS — no dependencies, no framework, and no build beyond copying
the served files into `dist/`.

Built on the template of [`juanantin/blue`](https://github.com/juanantin/blue)
(which was itself copied from `juanantin/box`): the dashboard, its data
sources, the indexer and the deploy setup are that site's, re-pointed. Where a
lesson below quotes another token's numbers, those numbers are the evidence —
the behaviour they describe is the platform's.

**Status: pre-launch, as $3310.** The site was first pointed at a $3210
contract; the ticker is now **$3310**, a new token, so that contract and
everything read off it (pool, launch block) were cleared rather than shown
under the new name. The dashboard reads "Live data starts at launch" until
`config.js` has the $3310 address. X is now @3310onbase. Still the same: the domain,
and **$NOKc** (`0xB200…409c`, 8 decimals) as the reward token. The header,
the share card and the icons are the $3310 artwork. [`SETUP.md`](SETUP.md) is the checklist.

```
index.html            markup
config.js             ← the only file you need to edit to point it at the token
assets/css/styles.css
assets/js/app.js      the dashboard
assets/js/snake/      the game: engine, LCD framebuffer, bitmap font, beeps,
                      and phone.js, which mounts it over images/phone.webp
images/               the banner, the phone, icons, partner marks, the social card
images/src/           the originals everything above is derived from
data/rewards.json     protocol figures the dashboard reads
scripts/              GitHub Actions indexer, discovery and probes
worker/               the same indexer as a Cloudflare Worker (optional)
```

Live at **https://3210nokc.xyz** (Vercel).

## What's on the page

- **The first screen is the header and the dashboard, exactly.** They share
  `.fold`, at least one viewport tall (`100svh` — the height with a phone's
  toolbars showing), so the game starts just below the fold rather than
  peeking in. Every visit opens at the top: scroll restoration is off and a
  `#hash` in the address is dropped on load, and "Play Snake" scrolls to the
  game without writing `#play` into the address.

- **Hero** — the header clip (`images/header.mp4`, H.264, and
  `images/header.webm`, VP9 — the page picks whichever the browser plays),
  1080×720, 5s, looping silently: the $3310 wordmark, "The phone that never
  dies." and "Buy $3310. Get $NOKc.", the phone's screen cycling through
  Snake, BUY and $3310. The poster is its own first frame; visitors with
  `prefers-reduced-motion: reduce` get the poster as a still and the video
  never downloads. The hero tops out at 960px wide and scales to the
  viewport height. Its edges are faded into the page navy inside the video
  file itself (`images/src/header_mask.png`), around the type, so there is
  no frame to see and no CSS mask to keep in step with it.
- **Actions** — three buttons: X, the chart, and a button that copies the CA
  and flashes a confirmation. Before launch the chart and copy buttons say so
  instead of opening an empty page.
- **Dashboard** — six live cards: total $NOKc distributed (USD beneath), total fees collected, holders, market cap, liquidity
  and 24h volume. The reward ticker and the "% to holder rewards" note come
  from `config.js` (`rewardTokenSymbol`, `holderShare`) and stay blank until
  set. A `—` means no source produced a number — never a guess.
- **Play Snake** — the phone. A recreation of classic Nokia Snake on an 84×48
  monochrome LCD with slow-LCD ghosting: menus (New game, Level 1–9, Top
  score, Instructions), the death blink, square-wave beeps, top score and
  level saved per browser. Tap the keys on the photo, or click the phone and
  use the keyboard (arrows or 2/4/6/8 steer, Enter selects and pauses, Esc
  goes back). The arrow keys belong to the page until the phone has focus,
  and a game pauses itself when it scrolls out of view.
- **Token facts** — supply, network and ticker, written in the markup.
  Supply is 1,000,000,000 (1B).
- **Ecosystem** — two partner lockups whose hrefs come from `config.js`.
- **Footer** — the non-affiliation notice (the phone artwork resembles a
  Nokia handset; $3310 has nothing to do with Nokia or HMD Global).

## Design

The banner's world, on the template's bones. A near-black navy page
(`--page` #000e27, the banner's own edge colour, so the hero has no seam) lit
by a blue glow from the top; cards a shade lighter, square-cornered and lifted
by a stepped block shadow; one bright blue (`--accent` #2a9bfc, sampled from
"BUY $3310. GET $NOKc."), a lighter tint for text (`--accent-deep` #7cc2ff),
and the LCD's green (`--lcd`) on the game card. Cubes drift in the gutters in
both colours.

Two faces from Google Fonts: **Silkscreen**, a pixel face in the banner's
spirit, for headings, labels, figures and keys; **Inter** for anything read as
a sentence. Silkscreen draws lowercase as small capitals, so "$NOKc" keeps its
case (`.ticker`) but its "c" reads as a small C. Dark theme only.

## Data sources

Everything configurable lives in `config.js`. Each source fills in the fields it
knows about and they merge in order, so a later source overrides an earlier one.
Whatever no source provides falls back to `stats`, and anything still missing
renders as `—` rather than as a number that isn't real.

| Metric | Source | Status |
|---|---|---|
| Market cap, liquidity, 24h volume | DexScreener | live, no key |
| Holders | Blockscout → GeckoTerminal → … | live, no key |
| Total fees collected | the indexer (see below) | live, scheduled |
| Total rewards distributed | the indexer (see below) | live, scheduled |

### Market data — DexScreener, and the pool itself

$3310's only pair is quoted in $NOKc, which DexScreener cannot price — so it
resolves the pair and its 24h volume but reports no dollar market cap or
liquidity. When that happens the page derives both rather than showing
dashes: the pool's own price gives $3310 in $NOKc, the $NOKc dollar price
comes from GeckoTerminal (the reward-price chain below), the supply is fixed
(`totalSupply` in `config.js`), and the pool's balance of each side is read
off Base with two `balanceOf` calls (`tokenDecimals` / `rewardTokenDecimals`).
Anything DexScreener does report outranks the derived figures.


The configured pool is queried first — `GET /latest/dex/pairs/base/<pool>` —
falling back to the token search, `GET /latest/dex/tokens/<contract>`. Public,
no key, CORS-enabled.

Pool-first matters when a token trades against something other than a usual
quote: the token search can come back empty for a pair like that while the pool
itself resolves fine. **The corollary is a trap** — a stale or wrong pool
address silently reports another token's market cap, liquidity and volume, and
the contract address above it makes no difference. Leave `contracts.pool` null
until you are sure of it.

Of any list of pairs, the deepest-liquidity one on `chain` wins; `marketCap` is
preferred over `fdv`. Override the pool with `sources.dexscreener.pairAddress`.

### Holders

DexScreener does not report holder counts, and no explorer is dependable for a
freshly launched token — for $BOX, GeckoTerminal answered 21 against a project
that had made 365 wallet payments, and Blockscout returned 500s. So the default
provider is **`onchain`**, which does not ask anyone: it folds the token's own
`Transfer` logs into a balance per address in the browser, exactly as the
indexer does, and counts the addresses left holding something, less the pool,
the fee locker and the rewards index.

That scan is budgeted and cached. A load spends at most `maxCallsPerLoad`
requests against the first RPC in `onchain.rpcUrls` that answers, banks its
progress in `localStorage`, and the next load resumes. **The count is published
only once the scan reaches the head** — a partial fold has seen sends whose
matching receives are in unread blocks, so it under-counts, and a dash beats a
wrong number. `holders` from `data/rewards.json` is merged last and wins, so
running the indexer retires the client-side scan without a config change.

The explorer providers below still work and can be chained after it by listing
them in `sources.holders.providers`. They are tried **in order**, and the first
to return a count above zero wins:

| Provider | Key | Notes |
|---|---|---|
| `blockscout` | none | `base.blockscout.com`. Reads `holders_count`, `holders`, then `token_holders_count` on `…/counters` |
| `geckoterminal` | none | Token info route. Only has a count for tokens it has indexed |
| `etherscan` | `etherscanApiKey` | Etherscan V2 multichain. Its `tokenholdercount` action needs a **paid** plan |
| `moralis` | `moralisApiKey` | Free tier is enough |

**A zero is treated as no answer** and falls through to the next provider — a
launched token with liquidity cannot have zero holders, so a zero is an
un-indexed explorer, not data. Providers with no key configured are skipped, so
the two key-free ones run first and the rest only engage once you add a key.

**The dependable answer is the indexer, not any explorer.** It counts holders
from the token's own transfer history — every transfer folded into a running
balance per address, then addresses with a positive balance counted, with the
pool and fee contracts excluded. Once it is running it supplies `holders` and
this chain becomes a fallback. The count is withheld until the backfill
finishes, since a partial scan under-counts.

Run with `?debug=1` to see which provider answered.

### Rewards — feeding fees and distribution

Fees collected and rewards distributed are protocol figures. No explorer knows
them, so they have to be fed in. Three ways, cheapest first.

**1. Edit the committed file.** `sources.rewards.url` already points at
`data/rewards.json`. Put numbers in it, push, done — same origin, no CORS, no
infrastructure:

```json
{ "totalFeesCollected": 1284.37, "totalDistributed": 8412906.5 }
```

Leave `totalDistributedUsd` out and it is derived from the live reward-token
price. Any field left `null` shows as an em dash, so the file is safe to publish
half-filled. Fine for a launch; it is a manual number, so it goes stale between
pushes. Set `sources.rewards.enabled: true` once the file holds real figures.

> **Watch the merge order.** This source is merged **last**, so anything it
> returns overrides DexScreener. Stale figures here will quietly override the
> live market cap, liquidity and volume — which is why it ships disabled.

**2. Let GitHub Actions index it — no accounts, no infrastructure. This is
the plan for $3310.**
[`.github/workflows/index-rewards.yml`](.github/workflows/index-rewards.yml)
runs [`scripts/index-rewards.mjs`](scripts/index-rewards.mjs), scans Base, and
commits the refreshed `data/rewards.json` — the file the site already reads. It
counts holders too, so that stops depending on explorers.

Fill in `worker/src/config.js` first (`TOKENS`, `CONTRACTS`, `START_BLOCK`,
both decimals) — `scripts/index-rewards.mjs` refuses to scan while that file's
`MISSING` list is non-empty, because a run against an unset index commits nulls
every quarter hour and the page cannot tell that from being broken.

State lives in `data/rewards-state.json`, which is **committed and seeded with
`cursor` = `START_BLOCK`**. That file is the only thing carrying a backfill
between runs — Actions runners are ephemeral — and `loadState()` falls back to
`START_BLOCK` only when it is *absent*, so a templated `cursor: 0` in a present
file is read as gospel and scans Base from genesis.

The schedule runs four times an hour, off the :00/:15/:30/:45 boundary where
GitHub's scheduler is most oversubscribed. Optionally set an `RPC_URL` secret
to a private Base endpoint — the public one works but rate-limits, which only
means the backfill takes longer.

**3. Or run it as a Cloudflare Worker — [`worker/`](worker/).** Same scan logic,
serving over HTTP instead of committing a file. Better if you want sub-minute
freshness or would rather not commit state to the repo.

It scans `eth_getLogs` for reward-token Transfer events, filtered by
counterparty, from `START_BLOCK` forward — so the range is bounded, not all of
chain history. Only the standard Transfer event is used, so none of it needs the
distributor's ABI. Deploy instructions, routes and tests are in
[`worker/README.md`](worker/README.md). Once it is up:

```js
url: ['https://<your-worker>.workers.dev', 'data/rewards.json'],
```

**Verify the streams before you trust them.** Which on-chain flow is "fees
collected" and which is "distributed" differs per platform, and two mistakes are
easy to make: watching a fee locker that every token on the platform shares
(which sums the whole platform, not you), and treating everything leaving the
distributor as "distributed" when part of it is the protocol's cut.
`HOLDER_SHARE` in `worker/src/config.js` carries that split. Compare `/debug`
against whatever panel the platform publishes before going live.

And check the distributor on Basescan first: if it is verified and exposes a
cumulative total as a view function, one `eth_call` replaces the whole log scan.

### Verifying from a sandbox with no network

The changes here are written somewhere with no route to Base, DexScreener or
the deployed site, so nothing can be confirmed locally. Two workflows exist to
ask a machine that does have a route:

| Workflow | Asks |
|---|---|
| [`discover.yml`](.github/workflows/discover.yml) | what the chain and the platform say this token IS — pool, reward token, decimals, launch block, fee routing |
| [`probe.yml`](.github/workflows/probe.yml) | what the PAGE does with that — the committed site in a real browser, as a returning visitor, as a cold phone, and against the deployed URL |

Both run on a push to the paths they watch, because `workflow_dispatch` needs
a permission the automation token does not carry. Their summaries print **last**:
job logs come back as a tail, and the browser passes are thousands of lines of
retry noise.

### Debugging

Append `?debug=1` to the URL. A panel under the dashboard lists every source and
what it returned, and the same detail goes to the console:

```
✓ ok     dexscreener:token:0x…
· empty  holders:blockscout
✓ ok     holders:blockscout:counters
```

Reading it:

- **`Failed to fetch`** — CORS, a blocked host, or the page opened over `file://`.
  Serve it over `http://` (see Running it) rather than double-clicking the file.
- **`HTTP 404`** — wrong address or route.
- **`ok, empty`** — the request worked but that source has nothing for this
  token; the next fallback takes over.

If a card shows `—`, no source produced a number for it. That is the intended
behaviour, not a bug: nothing invented is shown as real.

`refreshSeconds` controls the poll interval (default 60).

## Deploying

**This site deploys to Vercel.** `vercel.json` sets the build to
`npm run build` and the output to `dist/`; that build
([`scripts/build.mjs`](scripts/build.mjs)) only copies the served files —
`index.html`, `config.js`, the icons, `assets/`, `images/` minus its
originals, and `data/`. It exists because the Vercel project was created
while this repo was a Vite app, and a project keeps running `npm run build`
into `dist/`: with no `package.json` that failed on every push and the old
app stayed live. Now the deploy is right under either preset. Any static host
would work, but two details are not optional wherever it lands, and both are
in `vercel.json`:

- **`index.html` must send `Cache-Control: must-revalidate`.** It carries the
  `?v=` cache-busters below, so a cached shell pins a visitor to an old build:
  the busting scheme only works if the document naming the versions is itself
  fresh. `data/rewards.json` is the same — it is the file the dashboard reads.
- **`vercel.json` takes only keys Vercel knows** — today `buildCommand`,
  `outputDirectory` and `headers`. It rejects unknown top-level keys, and a `"//"` comment key once failed every production deploy
  for eighteen hours while the data behind it updated perfectly. Validate the
  key names, not just that the JSON parses.

`index.html` loads `config.js` and `app.js` with a `?v=` cache buster, and
`config.js` carries a matching `version`. **Run `node scripts/stamp.mjs` before
every deploy** — it moves all of them together. Skip it and a CDN keeps serving
the previous JS for hours after the HTML updates, which looks exactly like a
push that never landed.

To check what a browser actually has, load the site with `?debug=1`: the first
line of the panel is the build stamp. If it is not the version you just pushed,
the problem is the deploy or a cache, not the code — hard-refresh, purge the
CDN, and confirm the host is building the right branch.

## Running it

```bash
python3 -m http.server 8000
```

then open <http://localhost:8000>. (Clipboard copy needs `https://` or
`localhost`; the page falls back to `execCommand` elsewhere.)

The worker's tests need no network:

```bash
cd worker && npm test
```

## Notes

- Every icon (`favicon.ico` at the root, `images/favicon.png`, the two
  manifest icons and `images/apple-touch-icon.png`) is the phone's head from
  the header — earpiece, NOKIA and the Snake screen — cut to a circle and
  left transparent, except the Apple one, flattened onto the page navy
  because iOS renders a transparent home-screen icon as black. Bump the `?v=`
  with `node scripts/stamp.mjs` when the mark changes; the crop is in
  `images/src/README.md`.
- The share card and `og:url` are absolute URLs on `https://3210nokc.xyz` —
  change them in `index.html` if the domain ever moves.
- `images/social.jpg` is the 1200×630 share card: the 3:2 header whole at
  full height, centred on a blurred stretch of itself.
- `images/stonkex_button.png` and `images/stockify_logo.png` are the partner
  lockups with their dark wordmarks turned white for the dark page (the icons
  are untouched), matching how the banner shows them. Once the site has its final domain, make the `og:image`,
  `twitter:image` and an `og:url` in `index.html` absolute — some scrapers do
  not resolve a relative path.
- `images/phone.webp` is the phone, cut out of its studio background. The
  LCD rectangle and every key's hit area in `assets/js/snake/phone.js` are in
  that photo's own pixels (480×1168), so a different photo means re-measuring
  those numbers and nothing else.
- The game is plain ES modules with no dependencies: `engine.js` (state,
  menus, rules and drawing to the framebuffer), `screen.js` (the 84×48
  framebuffer and text), `font.js` (the bitmap font), `sound.js` (Web Audio
  beeps).
