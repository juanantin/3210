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

function scorePanel({ score, level, rank }) {
  const s = new Screen();
  s.center('Score', 1);
  const n = String(score);
  const scale = s.textWidth(n, 3) <= W - 4 ? 3 : 2;
  s.center(n, scale === 3 ? 11 : 14, 1, scale);
  s.center(`Level ${level}`, 33);
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

/* info: { score, level, board (snapshot), rank? ('#2 this week'), host } */
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

  // Headline.
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#ffffff';
  g.font = await pixelFont(46);
  g.fillText('SNAKE', 60, 100);
  const snakeW = g.measureText('SNAKE ').width;
  g.fillStyle = GREEN;
  g.fillText(`${info.score} PTS`, 60 + snakeW, 100);

  // The LCD: board on the left, score on the right.
  const dot = 6;
  const pad = 30;
  const lw = W * dot;
  const lh = H * dot;
  const px = 60;
  const py = 146;
  const pw = CARD_W - 120;
  const ph = lh + pad * 2;
  g.fillStyle = LCD_EDGE;
  g.fillRect(px - 6, py - 6, pw + 12, ph + 12);
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
  g.fillText('$3310 · THE PHONE THAT NEVER DIES', 60, 578);
  g.fillStyle = '#7d92bf';
  g.font = await pixelFont(22);
  g.fillText(`PLAY ON ${info.host.toUpperCase()}`, 60, 618);
  g.textAlign = 'right';
  g.fillStyle = '#7cc2ff';
  g.font = await pixelFont(34);
  g.fillText(HANDLE, CARD_W - 60, 600);
  g.textAlign = 'left';

  return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
}

export function shareText({ score, level }, url) {
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
