/* ==========================================================================
   The shared leaderboard (api/ticket.js, api/scores.js).

   Before each game the phone holds a one-use ticket from the server — the
   seed that decides where the food falls. When a game ends, the run (seed,
   level, every turn) can be sent with a name and, optionally, a wallet; the
   server replays it and records the score the replay reaches. With no ticket
   (offline, or the API is down) the game plays exactly the same, unranked.
   ========================================================================== */

const API = 'api';
const NAME_KEY = 'snake.name';
const WALLET_KEY = 'snake.wallet';

const get = (k) => {
  try {
    return localStorage.getItem(k) || '';
  } catch {
    return '';
  }
};
const put = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    // Storage unavailable; the form just starts empty next time.
  }
};

async function call(path, init) {
  const res = await fetch(`${API}/${path}`, init);
  let body = null;
  try {
    body = await res.json();
  } catch {
    // Not JSON: no API behind this host.
  }
  if (!res.ok || !body) throw new Error(body?.error || `HTTP ${res.status}`);
  return body;
}

/* ---- tickets ---- */

let ticket = null;
let fetching = null;
function refill() {
  if (ticket || fetching) return;
  fetching = call('ticket', { method: 'POST' })
    .then((t) => {
      if (t && typeof t.id === 'string' && Number.isInteger(t.seed)) ticket = t;
    })
    .catch(() => {})
    .finally(() => {
      fetching = null;
    });
}
function take() {
  const t = ticket;
  ticket = null;
  refill();
  return t;
}

/* ---- the board ---- */

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

let data = null;
let tab = 'week';

function untilText(iso) {
  const ms = new Date(iso) - Date.now();
  if (!(ms > 0)) return '';
  const h = Math.floor(ms / 3600000);
  return h >= 48 ? `${Math.floor(h / 24)}d left` : `${h}h left`;
}

function render(root) {
  const list = root.querySelector('[data-board-list]');
  const note = root.querySelector('[data-board-note]');
  root.querySelectorAll('[data-board-tab]').forEach((b) => {
    b.setAttribute('aria-selected', String(b.dataset.boardTab === tab));
  });
  list.replaceChildren();
  if (!data) {
    list.append(el('li', 'board__empty', 'Leaderboard offline — scores stay on this phone for now.'));
    note.textContent = '';
    return;
  }
  const rows = tab === 'week' ? data.week : data.all;
  if (!rows.length) {
    list.append(el('li', 'board__empty', tab === 'week' ? 'No scores this week yet. Be first.' : 'No scores yet. Be first.'));
  }
  rows.forEach((r, i) => {
    const li = el('li', 'board__row');
    li.append(el('span', 'board__rank', String(i + 1)));
    const who = el('span', 'board__who');
    who.append(el('span', 'board__name', r.name));
    if (r.holder) {
      const badge = el('span', 'board__holder', '$3310');
      badge.title = 'Holds $3310';
      who.append(badge);
    }
    if (r.wallet) who.append(el('span', 'board__wallet', r.wallet));
    li.append(who);
    li.append(el('span', 'board__level', r.level ? `L${r.level}` : ''));
    li.append(el('span', 'board__score', String(r.score)));
    list.append(li);
  });
  const parts = [];
  if (tab === 'week') parts.push(`Week ${data.weekId.split('-W')[1]} · ${untilText(data.weekEndsAt)}`);
  parts.push(`${data.games.toLocaleString()} verified games`);
  note.textContent = parts.filter(Boolean).join(' · ');
}

async function load(root) {
  try {
    data = await call('scores');
  } catch {
    data = null;
  }
  render(root);
}

/* ---- the submit form under the phone ---- */

function mountForm(host, boardRoot) {
  const form = el('form', 'score-form');
  form.hidden = true;
  form.noValidate = true;
  form.innerHTML = `
    <p class="score-form__head"><span data-f-score></span></p>
    <label class="score-form__field"><span>Name</span>
      <input name="name" maxlength="12" autocomplete="nickname" spellcheck="false" required></label>
    <label class="score-form__field"><span>Wallet <em>(optional — for prizes &amp; holder badge)</em></span>
      <input name="wallet" maxlength="42" autocomplete="off" spellcheck="false" placeholder="0x…"></label>
    <div class="score-form__row">
      <button type="submit" class="score-form__send">Submit score</button>
      <button type="button" class="score-form__skip">Skip</button>
    </div>
    <p class="score-form__msg" role="status" aria-live="polite"></p>`;
  host.after(form);

  const scoreEl = form.querySelector('[data-f-score]');
  const msg = form.querySelector('.score-form__msg');
  const send = form.querySelector('.score-form__send');
  // form.name is the form's own name attribute, so the inputs are looked up.
  const nameIn = form.querySelector('input[name=name]');
  const walletIn = form.querySelector('input[name=wallet]');
  let run = null;

  form.querySelector('.score-form__skip').addEventListener('click', () => {
    form.hidden = true;
    run = null;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!run) return;
    const name = nameIn.value.trim();
    const wallet = walletIn.value.trim();
    if (!name) {
      msg.textContent = 'Enter a name first.';
      nameIn.focus();
      return;
    }
    put(NAME_KEY, name);
    put(WALLET_KEY, wallet);
    send.disabled = true;
    msg.textContent = 'Checking your run…';
    try {
      const r = await call('scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...run, name, wallet }),
      });
      run = null;
      const bits = [`Verified: ${r.score}.`];
      if (r.weekRank) bits.push(`#${r.weekRank} this week`);
      if (r.rank) bits.push(`#${r.rank} all-time`);
      if (!r.weeklyBest) bits.push('(your best still stands)');
      msg.textContent = bits.join(' ');
      load(boardRoot);
      setTimeout(() => {
        if (!run) form.hidden = true;
      }, 6000);
    } catch (err) {
      msg.textContent = String(err.message || err);
    } finally {
      send.disabled = false;
    }
  });

  return (r) => {
    if (!r.score) return;
    if (!r.ticket) {
      run = null;
      scoreEl.textContent = `Score ${r.score} — not ranked (leaderboard offline).`;
      form.querySelectorAll('label, .score-form__row').forEach((n) => (n.hidden = true));
      msg.textContent = '';
      form.hidden = false;
      return;
    }
    run = { ticket: r.ticket, level: r.level, steps: r.steps, turns: r.turns, score: r.score };
    scoreEl.textContent = `Score ${r.score} at level ${r.level}. Put it on the board?`;
    form.querySelectorAll('label, .score-form__row').forEach((n) => (n.hidden = false));
    nameIn.value = nameIn.value || get(NAME_KEY);
    walletIn.value = walletIn.value || get(WALLET_KEY);
    msg.textContent = '';
    form.hidden = false;
    // On a phone the form lands under the handset, below the fold.
    setTimeout(() => form.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 1900);
  };
}

/* ---- wiring ---- */

export function attach(phone) {
  const engine = phone.engine;
  const boardRoot = document.querySelector('[data-board]');
  engine.ticketSource = take;
  const show = mountForm(phone, boardRoot);
  engine.onOver = show;
  refill();

  if (!boardRoot) return;
  boardRoot.querySelectorAll('[data-board-tab]').forEach((b) =>
    b.addEventListener('click', () => {
      tab = b.dataset.boardTab;
      render(boardRoot);
    }),
  );
  load(boardRoot);
  setInterval(() => {
    if (!document.hidden) load(boardRoot);
  }, 60000);
}
