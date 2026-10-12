/* ==========================================================================
   The playable phone — Snake drawn onto the LCD of images/phone.webp, with
   invisible hit areas over every printed key.

   Keyboard input is captured only while the phone is ACTIVE (clicked, tapped
   or focused): on a scrolling page the arrow keys belong to the page until
   the visitor reaches for the game. Scrolling it out of view pauses a game
   in progress.
   ========================================================================== */

import { Engine } from './engine.js';
import { Screen, W, H } from './screen.js';
import { sound } from './sound.js';

// The phone photo is 480 x 1168. Hit areas are centre x, centre y, width,
// height in photo pixels, placed over the keys printed in the photo.
const PHOTO_W = 480;
const PHOTO_H = 1168;
const LCD = { x: 83, y: 274, w: 311, h: 223 };

// Canvas pixels per LCD pixel; each dot is drawn slightly smaller to show the grid.
const DOT = 5;

const KEY_X = [109, 239, 369];
const KEY_Y = [736, 824, 911, 996];
const KEYPAD = [
  ['1', '1'], ['2', '2'], ['3', '3'],
  ['4', '4'], ['5', '5'], ['6', '6'],
  ['7', '7'], ['8', '8'], ['9', '9'],
  ['*', 'Star'], ['0', '0'], ['#', 'Hash'],
];

const SPOTS = [
  { id: 'navi', key: 'navi', label: 'Navi key', box: [239, 561, 170, 44] },
  { id: 'c', key: 'c', label: 'C key', box: [126, 608, 90, 80] },
  { id: 'ok', key: 'navi', label: 'Select key', box: [354, 608, 90, 80] },
  { id: 'up', key: 'up', label: 'Scroll up', box: [239, 631, 86, 40] },
  { id: 'down', key: 'down', label: 'Scroll down', box: [239, 671, 86, 40] },
  ...KEYPAD.map(([key, label], i) => ({
    id: key,
    key,
    label: `Key ${label}`,
    box: [KEY_X[i % 3], KEY_Y[Math.floor(i / 3)], 100, 58],
  })),
];

const KEYBOARD = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: '4', ArrowRight: '6',
  w: 'up', s: 'down', a: '4', d: '6',
  Enter: 'navi', ' ': 'navi',
  Escape: 'c', Backspace: 'c', c: 'c',
  0: '0', 1: '1', 2: '2', 3: '3', 4: '4',
  5: '5', 6: '6', 7: '7', 8: '8', 9: '9', '*': '*', '#': '#',
};

const pct = (v, of) => `${(v / of) * 100}%`;

function place(el, x, y, w, h) {
  el.style.left = pct(x, PHOTO_W);
  el.style.top = pct(y, PHOTO_H);
  el.style.width = pct(w, PHOTO_W);
  el.style.height = pct(h, PHOTO_H);
}

function mount(root) {
  const phone = document.createElement('div');
  phone.className = 'phone';
  phone.tabIndex = 0;
  phone.setAttribute('role', 'application');
  phone.setAttribute('aria-label', 'Snake on a Nokia phone. Click to play; arrow keys steer.');

  const photo = document.createElement('img');
  photo.className = 'phone__photo';
  photo.src = 'images/phone.webp';
  photo.alt = '';
  photo.width = PHOTO_W;
  photo.height = PHOTO_H;
  photo.draggable = false;
  photo.decoding = 'async';
  photo.loading = 'lazy';
  phone.appendChild(photo);

  const lcd = document.createElement('div');
  lcd.className = 'phone__lcd';
  place(lcd, LCD.x, LCD.y, LCD.w, LCD.h);
  const canvas = document.createElement('canvas');
  canvas.width = W * DOT;
  canvas.height = H * DOT;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Snake game screen');
  lcd.appendChild(canvas);
  phone.appendChild(lcd);

  const screen = new Screen();
  const engine = new Engine(screen);

  const keys = new Map();
  let held = null;
  function hold(id) {
    if (held) keys.get(held)?.classList.remove('is-held');
    held = id;
    if (held) keys.get(held)?.classList.add('is-held');
  }

  SPOTS.forEach(({ id, key, label, box: [cx, cy, w, h] }) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'phone__key';
    b.tabIndex = -1;
    b.setAttribute('aria-label', label);
    place(b, cx - w / 2, cy - h / 2, w, h);
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      phone.focus({ preventScroll: true });
      hold(id);
      engine.press(key);
    });
    b.addEventListener('pointerup', () => hold(null));
    b.addEventListener('pointerleave', () => hold(null));
    keys.set(id, b);
    phone.appendChild(b);
  });

  root.appendChild(phone);
  phone.engine = engine; // for tests and the console

  // Arrow keys belong to the page until the phone has focus.
  phone.addEventListener('pointerdown', () => phone.focus({ preventScroll: true }));
  phone.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = KEYBOARD[e.key] ?? KEYBOARD[e.key.toLowerCase()];
    if (!k) return;
    e.preventDefault();
    hold(SPOTS.find((s) => s.key === k)?.id ?? null);
    if (!e.repeat) engine.press(k);
  });
  phone.addEventListener('keyup', () => hold(null));

  // Per-dot darkness, eased toward the framebuffer to mimic slow LCD response.
  const g = canvas.getContext('2d');
  const level = new Float32Array(W * H);
  let last = performance.now();
  engine.update(last);
  engine.modeAt = last;
  let raf = 0;
  let visible = false;

  function draw(now) {
    const dt = Math.min(100, now - last);
    last = now;
    engine.update(now);
    engine.render();

    const on = 1 - Math.pow(1 - 0.55, (dt * 60) / 1000);
    const off = 1 - Math.pow(1 - 0.3, (dt * 60) / 1000);
    g.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < level.length; i++) {
      const target = screen.buf[i];
      level[i] += (target - level[i]) * (target > level[i] ? on : off);
      const a = 0.04 + level[i] * 0.84;
      g.fillStyle = `rgba(24, 36, 22, ${a.toFixed(3)})`;
      g.fillRect((i % W) * DOT, Math.floor(i / W) * DOT, DOT - 0.6, DOT - 0.6);
    }
    raf = visible ? requestAnimationFrame(draw) : 0;
  }

  // Only animate while on screen, and pause a running game that scrolls away.
  function setVisible(v) {
    visible = v;
    if (v && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(draw);
    }
    if (!v && engine.mode === 'play') engine.press('navi');
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => setVisible(entries[0].isIntersecting), {
      threshold: 0.25,
    }).observe(phone);
  } else {
    setVisible(true);
  }

  // Sound toggle, remembered per browser.
  const toggle = root.parentElement?.querySelector('[data-sound-toggle]');
  try {
    sound.enabled = localStorage.getItem('snake.muted') !== '1';
  } catch {
    // Storage unavailable; sound stays on.
  }
  function label() {
    if (toggle) toggle.textContent = `Sound: ${sound.enabled ? 'on' : 'off'}`;
  }
  label();
  toggle?.addEventListener('click', () => {
    sound.enabled = !sound.enabled;
    try {
      localStorage.setItem('snake.muted', sound.enabled ? '0' : '1');
    } catch {
      // Storage unavailable; the setting lasts for this visit only.
    }
    label();
  });
}

document.querySelectorAll('[data-snake]').forEach(mount);
