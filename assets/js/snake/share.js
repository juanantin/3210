/* ==========================================================================
   The share card — a 1200 x 675 PNG (X's large-image size) drawn as a Nokia
   LCD: the board the game ended on, and the score in the phone's own pixel
   font, with $3310 and @3310onbase around it.

   Sharing: where the browser can share files (phones), the image and text go
   to the system share sheet. Elsewhere the image is copied to the clipboard
   (or saved, if that is refused) and X opens with the text filled in, so the
   picture is one paste away.
   ========================================================================== */

import { Screen, W, H } from './screen.js';
import { rng } from './rules.js';

export const HANDLE = '@3310onbase';
const CARD_W = 1200;
const CARD_H = 675;

const NAVY = '#000e27';
const LCD = '#b4c99a';
const LCD_EDGE = '#8fa877';
const INK = [24, 36, 22];
const GREEN = '#8bd06b';

// The board as it was when the game ended, in a framebuffer of its own.
export function snapshot(engine) {
  const shot = new Screen();
  const live = engine.screen;
  engine.screen = shot;
  try {
    engine.renderGame(true);
  } finally {
    engine.screen = live;
  }
  return shot.buf.slice();
}

function scorePanel({ score, level, rank, tier }) {
  const s = new Screen();
  s.center(tier?.lcd ?? 'Score', rank ? 0 : 1);
  const n = String(score);
  const scale = s.textWidth(n, 3) <= W - 4 ? 3 : 2;
  // Rows: label 1-7, number 9-29 (or 11-31), level, then the rank if any.
  const top = rank ? 9 : 11;
  s.center(n, scale === 3 ? top : top + 3, 1, scale);
  s.center(`Level ${level}`, rank ? 32 : 33);
  if (rank) s.center(rank, 41);
  return s.buf;
}

function drawLcd(g, buf, x, y, dot) {
  for (let i = 0; i < W * H; i++) {
    const a = buf[i] ? 0.88 : 0.05;
    g.fillStyle = `rgba(${INK.join(',')},${a})`;
    g.fillRect(x + (i % W) * dot, y + Math.floor(i / W) * dot, dot - 1, dot - 1);
  }
}

async function pixelFont(px) {
  const face = `${px}px Silkscreen`;
  try {
    await Promise.race([document.fonts.load(face), new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    // Fall back to monospace below.
  }
  return document.fonts?.check?.(face) ? face : `bold ${px}px "Courier New", monospace`;
}

/* ---- high scores get a card of their own ---- */

const GOLD = '#ffd23f';

/* The best thing this run achieved, or null for an ordinary game.
   result is the API's answer once the score is submitted (api/scores.js). */
export function tierFor({ score, newRecord }, result) {
  if (result?.personalBest && result.rank === 1) {
    return { label: 'ALL-TIME HIGH SCORE', lcd: 'Record!', color: GOLD,
      text: `New ALL-TIME high score on Snake: ${score} 🏆 #1 of everyone on the $3310 phone.` };
  }
  if (result?.weeklyBest && result.weekRank === 1) {
    return { label: '#1 THIS WEEK', lcd: '#1 week', color: GOLD,
      text: `#1 on this week's Snake board with ${score} 🏆 on the $3310 phone.` };
  }
  if (result?.personalBest && result.rank <= 10) {
    return { label: `TOP 10 EVER · #${result.rank}`, lcd: `#${result.rank} ever`, color: GREEN,
      text: `Top 10 all-time on Snake: ${score} (#${result.rank}) 🐍 on the $3310 phone.` };
  }
  if (newRecord) {
    return { label: 'NEW PERSONAL BEST', lcd: 'New best!', color: '#7cc2ff',
      text: `New personal best on Snake: ${score} 🐍📱 on the $3310 phone.` };
  }
  return null;
}

// An 11 x 11 pixel trophy.
const TROPHY = [
  '###########',
  '#.#######.#',
  '#.#######.#',
  '.##.###.##.',
  '...#####...',
  '....###....',
  '.....#.....',
  '.....#.....',
  '....###....',
  '...#####...',
  '...#####...',
];

function drawTrophy(g, x, y, px, color) {
  g.fillStyle = color;
  TROPHY.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') g.fillRect(x + rx * px, y + ry * px, px, px);
  });
}

// Pixel confetti in the margins, the same for the same score.
function confetti(g, score, colors) {
  const r = rng(score * 2654435761);
  const zones = [[640, 18, 520, 108], [0, 0, 44, 675], [1156, 0, 44, 675], [700, 640, 460, 30]];
  for (let i = 0; i < 70; i++) {
    const [zx, zy, zw, zh] = zones[Math.floor(r() * zones.length)];
    const size = 6 + Math.floor(r() * 3) * 3;
    g.globalAlpha = 0.5 + r() * 0.5;
    g.fillStyle = colors[Math.floor(r() * colors.length)];
    g.fillRect(Math.round(zx + r() * (zw - size)), Math.round(zy + r() * (zh - size)), size, size);
  }
  g.globalAlpha = 1;
}

/* info: { score, level, board (snapshot), rank? ('#2 this week'), tier?, host } */
export async function renderCard(info) {
  const c = document.createElement('canvas');
  c.width = CARD_W;
  c.height = CARD_H;
  const g = c.getContext('2d');

  g.fillStyle = NAVY;
  g.fillRect(0, 0, CARD_W, CARD_H);
  // A faint pixel grid, like the site's background.
  g.fillStyle = 'rgba(42,155,252,.06)';
  for (let x = 0; x < CARD_W; x += 24) g.fillRect(x, 0, 1, CARD_H);
  for (let y = 0; y < CARD_H; y += 24) g.fillRect(0, y, CARD_W, 1);

  const tier = info.tier;
  if (tier) {
    const glow = g.createRadialGradient(600, 320, 60, 600, 320, 700);
    glow.addColorStop(0, `${tier.color}55`);
    glow.addColorStop(1, `${tier.color}00`);
    g.fillStyle = glow;
    g.fillRect(0, 0, CARD_W, CARD_H);
    confetti(g, info.score, [tier.color, GREEN, '#7cc2ff', '#ffffff']);
  }

  // Headline.
  g.textBaseline = 'alphabetic';
  g.font = await pixelFont(46);
  if (tier) {
    drawTrophy(g, 60, 52, 5, tier.color);
    g.fillStyle = tier.color;
    g.fillText(tier.label, 132, 100);
    g.fillStyle = '#ffffff';
    g.font = await pixelFont(30);
    g.fillText(`SNAKE · ${info.score} PTS`, 132, 128);
  } else {
    g.fillStyle = '#ffffff';
    g.fillText('SNAKE', 60, 100);
    const snakeW = g.measureText('SNAKE ').width;
    g.fillStyle = GREEN;
    g.fillText(`${info.score} PTS`, 60 + snakeW, 100);
  }

  // The LCD: board on the left, score on the right.
  const dot = 6;
  const pad = 30;
  const lw = W * dot;
  const lh = H * dot;
  const px = 60;
  const py = tier ? 160 : 146;
  const pw = CARD_W - 120;
  const ph = lh + pad * 2;
  const edge = tier ? 10 : 6;
  g.fillStyle = tier?.color ?? LCD_EDGE;
  g.fillRect(px - edge, py - edge, pw + edge * 2, ph + edge * 2);
  const grad = g.createLinearGradient(0, py, 0, py + ph);
  grad.addColorStop(0, '#c3d6aa');
  grad.addColorStop(1, LCD);
  g.fillStyle = grad;
  g.fillRect(px, py, pw, ph);
  const gap = pw - lw * 2 - pad * 2;
  drawLcd(g, info.board, px + pad, py + pad, dot);
  drawLcd(g, scorePanel(info), px + pad + lw + gap, py + pad, dot);

  // Footer.
  g.font = await pixelFont(28);
  g.fillStyle = '#ffffff';
  const fy = tier ? 590 : 578;
  g.fillText('$3310 · THE PHONE THAT NEVER DIES', 60, fy);
  g.fillStyle = '#7d92bf';
  g.font = await pixelFont(22);
  g.fillText(`PLAY ON ${info.host.toUpperCase()}`, 60, fy + 40);
  g.textAlign = 'right';
  g.fillStyle = '#7cc2ff';
  g.font = await pixelFont(34);
  g.fillText(HANDLE, CARD_W - 60, fy + 22);
  g.textAlign = 'left';

  return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
}

export function shareText({ score, level, tier }, url) {
  if (tier) return `${tier.text}\nThe phone that never dies. Beat me 👇\n${url}\n${HANDLE}`;
  return `I scored ${score} on Snake (level ${level}) on the $3310 phone 🐍📱\nThe phone that never dies. Beat me 👇\n${url}\n${HANDLE}`;
}

export function save(blob, score) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `3310-snake-${score}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function canShareFiles() {
  try {
    return Boolean(
      navigator.canShare?.({ files: [new File([''], 'x.png', { type: 'image/png' })] }) &&
        matchMedia('(pointer: coarse)').matches,
    );
  } catch {
    return false;
  }
}

/* Must be called straight from the click, with the card already rendered:
   the X window has to open before anything is awaited or it gets blocked.
   Returns a message for the visitor. */
export function share(blob, info, url) {
  const text = shareText(info, url);
  if (canShareFiles()) {
    const file = new File([blob], `3310-snake-${info.score}.png`, { type: 'image/png' });
    return navigator
      .share({ files: [file], text })
      .then(() => 'Shared!')
      .catch((e) => (e?.name === 'AbortError' ? '' : 'Sharing failed. Use "Save image" instead.'));
  }

  let copied = Promise.resolve(false);
  try {
    copied = navigator.clipboard
      .write([new ClipboardItem({ 'image/png': blob })])
      .then(() => true)
      .catch(() => false);
  } catch {
    // No image clipboard here; the image gets saved instead.
  }
  window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  return copied.then((ok) => {
    if (ok) return 'Image copied: paste it into your post (Ctrl/⌘ + V).';
    save(blob, info.score);
    return 'Image saved: attach it to your post.';
  });
}
