/* ==========================================================================
   "What does holding pay?" — an estimate of a wallet's weekly $NOKc

     weekly fees      = weekly volume × the pool's fee (read from the pool)
     to holders       = weekly fees × holderShare (config.js, 90%)
     your share       = your $3310 ÷ the supply holders own
                        (total supply less what sits in the pool)
     your week        = to holders × your share, in $ and in $NOKc

   Volume, market cap and the $NOKc price come from data/rewards.json (the
   indexer); the fee and the pool's balance are read off Base on load. Every
   figure the estimate rests on is printed under it.
   ========================================================================== */

const CFG = window.SITE_CONFIG || {};
const root = document.querySelector('[data-earn]');

const SEL_FEE = '0xddca3f43'; // fee() — uint24, in millionths
const SEL_BALANCE_OF = '0x70a08231';
const FALLBACK_FEE = 0.01;

const supply = Number(CFG.totalSupply) || 0;
const holderShare = Number(CFG.holderShare) || 0.9;
const cap = Number(CFG.champion?.bonusCap) || 0;

const state = {
  fee: null, // fraction, e.g. 0.01
  feeRead: false,
  inPool: null, // $3310 held by the pool
  vol24: null, // $
  mcap: null, // $
  nokc: null, // $ per NOKc
};

const nf = (d) => new Intl.NumberFormat('en-US', { maximumFractionDigits: d });
const usd = (n) => (n >= 100 ? `$${nf(0).format(n)}` : `$${nf(2).format(n)}`);
const tok = (n) => (n >= 100 ? nf(0).format(n) : n >= 1 ? nf(2).format(n) : nf(3).format(n));
const short = (n) =>
  n >= 1e9 ? `${nf(2).format(n / 1e9)}B` : n >= 1e6 ? `${nf(2).format(n / 1e6)}M` : n >= 1e3 ? `${nf(1).format(n / 1e3)}K` : nf(0).format(n);

// "500k", "1.2m", "$300,000", "10000000" -> number.
function parse(v) {
  const m = String(v).trim().toLowerCase().replace(/[$,\s_]/g, '').match(/^(\d*\.?\d+)([kmb]?)$/);
  if (!m) return NaN;
  return Number(m[1]) * { '': 1, k: 1e3, m: 1e6, b: 1e9 }[m[2]];
}

async function rpc(data, to) {
  const urls = CFG.sources?.holders?.onchain?.rpcUrls || [];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }),
      });
      const out = await res.json();
      if (typeof out.result === 'string' && out.result !== '0x') return BigInt(out.result);
    } catch {
      // Next node.
    }
  }
  return null;
}

async function loadChain() {
  const pool = CFG.contracts?.pool;
  if (!pool || typeof BigInt !== 'function') return;
  const [fee, bal] = await Promise.all([
    rpc(SEL_FEE, pool),
    CFG.contractAddress ? rpc(SEL_BALANCE_OF + '0'.repeat(24) + pool.slice(2).toLowerCase(), CFG.contractAddress) : null,
  ]);
  // A fee above 10% is not a fee this pool could have; keep the fallback.
  if (fee !== null && fee > 0n && fee <= 100000n) {
    state.fee = Number(fee) / 1e6;
    state.feeRead = true;
  }
  if (bal !== null) state.inPool = Number(bal / 10n ** BigInt(Number(CFG.tokenDecimals) || 18));
}

async function loadMarket() {
  try {
    const d = await (await fetch(CFG.sources?.rewards?.url || 'data/rewards.json', { cache: 'no-store' })).json();
    if (d.volume24h > 0) state.vol24 = d.volume24h;
    if (d.marketCap > 0) state.mcap = d.marketCap;
    const p = d.meta?.kexPriceUsd || (d.totalDistributedUsd > 0 && d.totalDistributed > 0 ? d.totalDistributedUsd / d.totalDistributed : null);
    if (p > 0) state.nokc = p;
  } catch {
    // The estimate still works in dollars from the inputs alone.
  }
}

function compute(holding, weekVol) {
  const fee = state.fee ?? FALLBACK_FEE;
  const eligible = Math.max(1, supply - (state.inPool || 0));
  const share = Math.min(1, holding / eligible);
  const toHolders = weekVol * fee * holderShare;
  const weekUsd = toHolders * share;
  const weekNokc = state.nokc ? weekUsd / state.nokc : null;
  const bag = state.mcap && supply ? (holding / supply) * state.mcap : null;
  return { fee, eligible, share, toHolders, weekUsd, weekNokc, bag };
}

function mount() {
  if (!root) return;
  const $ = (s) => root.querySelector(s);
  const holdIn = $('[name=hold]');
  const volIn = $('[name=vol]');

  function paint() {
    const holding = parse(holdIn.value);
    const vol = parse(volIn.value);
    const ok = holding > 0 && vol > 0 && supply > 0;
    holdIn.toggleAttribute('aria-invalid', !(holding > 0));
    volIn.toggleAttribute('aria-invalid', !(vol > 0));
    $('[data-e-pct]').textContent = holding > 0 && supply ? `${nf(3).format((holding / supply) * 100)}% of supply` : '';
    if (!ok) return;
    const r = compute(holding, vol);
    $('[data-e-week]').textContent = r.weekNokc !== null ? `${tok(r.weekNokc)} $NOKc` : usd(r.weekUsd);
    $('[data-e-week-usd]').textContent = r.weekNokc !== null ? `≈ ${usd(r.weekUsd)} a week` : 'a week';
    $('[data-e-month]').textContent = r.weekNokc !== null ? tok(r.weekNokc * 4.345) : usd(r.weekUsd * 4.345);
    $('[data-e-month-usd]').textContent = r.weekNokc !== null ? `$NOKc ≈ ${usd(r.weekUsd * 4.345)}` : '';
    const champ = r.weekNokc !== null ? (cap > 0 ? Math.min(r.weekNokc, cap) : r.weekNokc) : null;
    $('[data-e-champ]').textContent = champ !== null ? `+${tok(champ)}` : `+${usd(r.weekUsd)}`;
    $('[data-e-champ-sub]').textContent = champ !== null ? '$NOKc bonus: rewards doubled' : 'bonus: rewards doubled';
    $('[data-e-yield]').textContent = r.bag ? `${nf(1).format((r.weekUsd / r.bag) * 100)}%` : '—';
    $('[data-e-bag]').textContent = r.bag ? `of a ${usd(r.bag)} bag, per week` : 'per week';
    $('[data-e-why]').textContent = [
      `$${short(vol)} volume × ${nf(2).format(r.fee * 100)}% pool fee${state.feeRead ? '' : ' (assumed)'} = ${usd(vol * r.fee)} in fees`,
      `${nf(0).format(holderShare * 100)}% to holders = ${usd(r.toHolders)}`,
      `your share: ${short(holding)} of ${short(r.eligible)} $3310 held outside the pool = ${nf(3).format(r.share * 100)}%`,
      state.nokc ? `$NOKc at ${usd(state.nokc)}` : null,
    ].filter(Boolean).join(' · ');
  }

  root.querySelectorAll('[data-hold]').forEach((b) =>
    b.addEventListener('click', () => {
      holdIn.value = nf(0).format((Number(b.dataset.hold) / 100) * supply);
      paint();
    }),
  );
  root.querySelectorAll('[data-vol]').forEach((b) =>
    b.addEventListener('click', () => {
      const v = b.dataset.vol === 'live' ? (state.vol24 || 0) * 7 : Number(b.dataset.vol);
      if (v > 0) volIn.value = `$${nf(0).format(v)}`;
      paint();
    }),
  );
  holdIn.addEventListener('input', paint);
  volIn.addEventListener('input', paint);

  holdIn.value = nf(0).format(supply / 100); // 1%
  volIn.value = '$500,000';
  paint();

  Promise.all([loadMarket(), loadChain()]).then(() => {
    const live = root.querySelector('[data-vol=live]');
    if (live && state.vol24) live.textContent = `Now: ${short(state.vol24 * 7).replace(/^/, '$')}/wk`;
    paint();
  });
}

mount();
