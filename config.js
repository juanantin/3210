/* ==========================================================================
   SITE CONFIGURATION — $3210
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
  version: '1',

  /* ---- Token ---------------------------------------------------------- */

  // TODO: the $3210 contract address on Base. The CA button copies this, the
  // chart button links to it, and DexScreener is searched by it. Nothing on
  // the dashboard resolves without it.
  contractAddress: '',

  // TODO: the token holders are paid in (the quote side of the pair on
  // platforms that pay in it). Prices "total distributed" in USD. Read it off
  // the discover workflow's output rather than assuming it.
  rewardTokenAddress: null,

  // TODO: matched as a substring of the reward token's own symbol(), and
  // shown after the reward amounts on the dashboard. Read it on chain.
  rewardTokenSymbol: null,

  // Free, keyless, CORS-enabled. The last price source, because it covers
  // tokens DexScreener has no pair for.
  geckoterminalBase: 'https://api.geckoterminal.com/api/v2',

  chain: 'base',    // DexScreener chain slug
  chainId: 8453,    // EVM chain id

  // TODO: the block $3210 launched at. The chain scan starts here and is
  // skipped while this is null — never put another token's block here.
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
    pool: null,
    rewardPool: null,
    feeLocker: null,
    rewardsIndex: null,
  },

  /* ---- Links ---------------------------------------------------------- */

  links: {
    x: 'https://x.com/3210token',

    // Leave null to auto-build a DexScreener link from the contract address.
    chart: null,

    // TODO: the two lockups in the footer panel — the token's own page on the
    // launch platform and its rewards index. Until set they point at the
    // platforms' home pages.
    launchedIn: null,
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
