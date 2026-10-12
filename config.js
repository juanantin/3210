/* ==========================================================================
   SITE CONFIGURATION — $3310
   --------------------------------------------------------------------------
   This is the only file you need to edit to point the site at the token.
   Everything marked TODO has to be filled in before the dashboard shows live
   figures; until then every card shows "—" rather than a number that isn't
   real. SETUP.md is the checklist, and .github/workflows/discover.yml reads
   most of these off the network once contractAddress is set.
   ========================================================================== */

window.SITE_CONFIG = {
  /* Build stamp. Shown in the ?debug=1 panel, so you can confirm which version
     a browser actually has rather than guessing at a cache. Moved together
     with every ?v= in index.html by `node scripts/stamp.mjs`. */
  version: '12',

  /* ---- Token ---------------------------------------------------------- */

  // TODO: the $3310 contract address on Base. The CA button copies this, the
  // chart button links to it, and DexScreener is searched by it. Until it is
  // set the dashboard reads "Live data starts at launch". (The earlier $3210
  // contract was cleared deliberately: the page must never offer it as the
  // token to buy under the $3310 name.)
  contractAddress: '',

  // $NOKc, the token holders are paid in — the other side of the pool. Read
  // off Base by the discover workflow: symbol() "NOKc", name() "Nokia
  // Corporation", decimals() 8 (not 18 — the indexer keeps them apart).
  rewardTokenAddress: '0xB2000000000000000000005ac674f707E357409c',

  // The reward token's symbol() exactly, as read on chain — and as the banner
  // names it: "BUY $3310. GET $NOKc." Shown after the reward amounts.
  rewardTokenSymbol: 'NOKc',

  // 1,000,000,000 at 18 decimals, the platform's launch supply — confirm it
  // against totalSupply() when discovery runs on the $3310 address. Used to
  // turn the pool's price into a market cap when DexScreener has no dollar
  // figure for the pair — it cannot price $NOKc on its own.
  totalSupply: 1000000000,

  // decimals() of each, read on chain — used to read the pool's balances, so
  // liquidity can be valued when DexScreener has no dollar figure for it.
  tokenDecimals: 18,
  rewardTokenDecimals: 8,

  // Free, keyless, CORS-enabled. The last price source, because it covers
  // tokens DexScreener has no pair for.
  geckoterminalBase: 'https://api.geckoterminal.com/api/v2',

  chain: 'base',    // DexScreener chain slug
  chainId: 8453,    // EVM chain id

  // TODO: the block $3310 launched at, from the platform's /api/coins entry
  // (block_number) — discover.yml reads it. The holder scan starts here, and
  // is skipped while this is null.
  launchBlock: null,

  // TODO: holders' share of what leaves the rewards index; the rest is the
  // protocol's cut. Read it off the token's own rewards panel. While null the
  // "% to holder rewards" note stays hidden and distributed is not computed.
  holderShare: null,

  /* Related contracts. All optional, all TODO.
       pool         the trading pair — DexScreener is asked about THIS pool
                    first, so a wrong one reports another token's figures.
                    Leave null until certain; the search by contractAddress
                    is used instead.
       rewardPool   the reward token's own pair, used to price it
       feeLocker    where trading fees accrue — on launch platforms usually
                    SHARED by every token, so it is excluded, never summed
       rewardsIndex the distributor holders are paid from: the index */
  contracts: {
    // TODO: the $3310 pool, from discover.yml. Leave null until certain: a
    // wrong pool reports another token's figures.
    pool: null,
    rewardPool: null,
    // The platform's fee locker for this venue. Excluded from holders, never
    // summed: it is shared by every coin launched the same way.
    feeLocker: '0x43555104f569d17026037e5637691b95c79fd03a',
    // TODO: the Stockify index. The platform's /api/fee-routing had no route
    // for $3310 when discovery ran, so there is no distributor to watch yet.
    rewardsIndex: null,
  },

  /* ---- Links ---------------------------------------------------------- */

  links: {
    x: 'https://x.com/3310onbase',

    // Leave null to auto-build a DexScreener link from the contract address.
    chart: null,

    // The two lockups in the footer panel: the token's own page on
    // Stonks.Exchange, and (TODO) its Stockify index — until that is set the
    // Stockify lockup points at the platform's home page.
    launchedIn: null,   // TODO: the $3310 page on Stonks.Exchange
    rewardsBy: null,
  },

  /* ======================================================================
     DATA SOURCES
     Each source fills in the fields it knows about. Later sources win, so
     `rewards` can override anything. Whatever no source provides falls back
     to `stats` below, and anything still missing renders as "—".
     ====================================================================== */

  sources: {

    /* Market cap, liquidity, 24h volume, and the token price.
       Public API, no key, CORS-enabled. */
    dexscreener: {
      enabled: true,
    },

    /* Holder count. `onchain` folds the token's own Transfer logs into
       balances in the browser — right by construction rather than by an
       explorer's luck — and publishes only once the scan reaches the head.
       Add 'blockscout', 'geckoterminal', 'etherscan' or 'moralis' to chain
       explorers after it. README.md ▸ Holders has the trade-offs. */
    holders: {
      enabled: true,
      providers: ['onchain'],

      onchain: {
        /* Tried in order; the scan moves down the list on any refusal and
           carries on from the same block. All public, keyless, CORS-enabled. */
        rpcUrls: [
          'https://mainnet.base.org',
          'https://base.drpc.org',
          'https://base-mainnet.public.blastapi.io',
          'https://base.meowrpc.com',
          'https://1rpc.io/base',
          'https://base-rpc.publicnode.com',
          'https://base.llamarpc.com',
        ],

        // Defaults to launchBlock; set it here to scan a shorter window.
        startBlock: null,

        chunkSize: 10000,      // halves itself when a window is refused
        minChunkSize: 200,
        confirmations: 5,      // stay clear of a reorg

        // A load spends at most this many requests, banks progress in
        // localStorage, and the next load resumes.
        maxCallsPerLoad: 200,

        // Defaults to contracts.pool, feeLocker and rewardsIndex — they hold
        // supply without being holders.
        exclude: null,

        // Fallback reward-token addresses for nodes that refuse an unfiltered
        // eth_getLogs. rewardTokenAddress is tried first.
        feeTokenCandidates: [],
      },

      blockscoutBase: 'https://base.blockscout.com',
      geckoterminalBase: 'https://api.geckoterminal.com/api/v2',
      etherscanApiKey: '',
      moralisApiKey: '',
    },

    /* Rewards figures — total fees collected and total rewards distributed,
       published to data/rewards.json by the indexer
       (.github/workflows/index-rewards.yml). Merged LAST, so it overrides
       everything above; the file ships all-null, which renders as dashes. */
    rewards: {
      enabled: true,

      // A string, or an array of them — the first source with a number for a
      // metric wins:  url: ['https://<your-worker>.workers.dev', 'data/rewards.json'],
      url: 'data/rewards.json',

      fields: {
        totalFeesCollected: [
          'totalFeesCollected', 'totalFeesUsd', 'feesCollectedUsd', 'fees.totalUsd',
          'data.totalFeesCollected', 'stats.totalFeesCollected',
        ],
        totalFeesTokens: ['totalFeesTokens', 'feesTokens', 'data.totalFeesTokens'],
        totalDistributed: [
          'totalDistributed', 'totalRewardsDistributed', 'rewardsDistributed',
          'data.totalDistributed', 'stats.totalDistributed',
        ],
        totalDistributedUsd: [
          'totalDistributedUsd', 'totalRewardsDistributedUsd', 'rewardsDistributedUsd',
          'data.totalDistributedUsd', 'stats.totalDistributedUsd',
        ],
        holders: [
          'holders', 'holderCount', 'totalHolders', 'data.holders', 'stats.holders',
        ],
        marketCap: ['marketCap', 'marketCapUsd', 'data.marketCap'],
        liquidity: ['liquidity', 'liquidityUsd', 'data.liquidity'],
        volume24h: ['volume24h', 'volume24hUsd', 'volumeUsd24h', 'data.volume24h'],
      },
    },
  },

  // How often to refresh, in seconds. 0 disables auto-refresh.
  refreshSeconds: 60,

  /* ---- Fallbacks ------------------------------------------------------ */
  // Used only where no source supplies a value. Leave a field null and the
  // tile shows "—" rather than a number that isn't real.

  stats: {
    totalFeesCollected: null,
    totalFeesTokens: null,
    totalDistributed: null,
    totalDistributedUsd: null,
    holders: null,
    marketCap: null,
    liquidity: null,
    volume24h: null,
  },

};
