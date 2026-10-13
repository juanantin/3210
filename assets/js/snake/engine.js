import { W } from './screen.js';
import { sound } from './sound.js';
import { Board, DIRS, SPEED } from './rules.js';
// Playfield cells are 4 x 4 px inside a 1 px border with a 1 px gap.
const CELL = 4;
const OX = 2;
const OY = 2;
const MENU = ['New game', 'Level', 'Top score', 'Instructions'];
const HELP =
  'Guide the snake to the food. Every bite makes it longer and earns ' +
  "points - more on higher levels. Don't hit the walls or your own tail!\n" +
  'Steer with keys 2, 4, 6 and 8. Navi key pauses.';
const KEY_DIR = {
  2: 'up',
  up: 'up',
  8: 'down',
  down: 'down',
  4: 'left',
  6: 'right',
};
function load(key, fallback) {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) && v > 0 ? v : fallback;
  } catch {
    return fallback;
  }
}
function save(key, v) {
  try {
    localStorage.setItem(key, String(v));
  } catch {
    // Storage unavailable; keep it in memory only.
  }
}
export class Engine {
  mode = 'intro';
  modeAt = 0;
  now = 0;
  sel = 0;
  level = load('snake.level', 5);
  pendingLevel = this.level;
  topScore = load('snake.top', 0);
  helpScroll = 0;
  helpLines = [];
  board = null;
  queue = [];
  nextStep = 0;
  // The run being played: its seed, level and every turn, so the leaderboard
  // can replay it (rules.js). ticketSource() hands out a server-issued seed;
  // onOver(run) is told when a game ends.
  run = null;
  ticketSource = null;
  onOver = null;
  newRecord = false;
  prevTop = 0;
  screen;
  constructor(screen) {
    this.screen = screen;
    this.helpLines = screen.wrap(HELP, 78);
  }
  go(mode) {
    this.mode = mode;
    this.modeAt = this.now;
  }
  press(k) {
    if (this.mode !== 'play') sound.key();
    switch (this.mode) {
      case 'intro':
        this.go('menu');
        break;
      case 'menu': {
        const d = KEY_DIR[k];
        if (d === 'up') this.sel = (this.sel + MENU.length - 1) % MENU.length;
        else if (d === 'down') this.sel = (this.sel + 1) % MENU.length;
        else if (k === 'navi' || k === '5') {
          if (this.sel === 0) this.startGame();
          else if (this.sel === 1) {
            this.pendingLevel = this.level;
            this.go('level');
          } else if (this.sel === 2) this.go('top');
          else {
            this.helpScroll = 0;
            this.go('help');
          }
        } else if (k === 'c') this.go('intro');
        break;
      }
      case 'level': {
        const d = KEY_DIR[k];
        if (d === 'up' || d === 'right') this.pendingLevel = Math.min(9, this.pendingLevel + 1);
        else if (d === 'down' || d === 'left')
          this.pendingLevel = Math.max(1, this.pendingLevel - 1);
        else if (/^[1-9]$/.test(k) && k !== '2' && k !== '4' && k !== '6' && k !== '8') {
          this.pendingLevel = Number(k);
        } else if (k === 'navi') {
          this.level = this.pendingLevel;
          save('snake.level', this.level);
          this.go('menu');
        } else if (k === 'c') this.go('menu');
        break;
      }
      case 'top':
        if (k === 'navi' || k === 'c') this.go('menu');
        break;
      case 'help': {
        const d = KEY_DIR[k];
        const max = Math.max(0, this.helpLines.length - 4);
        if (d === 'up') this.helpScroll = Math.max(0, this.helpScroll - 1);
        else if (d === 'down') this.helpScroll = Math.min(max, this.helpScroll + 1);
        else if (k === 'navi' || k === 'c') this.go('menu');
        break;
      }
      case 'play': {
        const d = KEY_DIR[k];
        if (d) this.turn(DIRS[d]);
        else if (k === 'navi' || k === 'c') this.go('paused');
        break;
      }
      case 'paused':
        if (k === 'navi') {
          this.nextStep = this.now + SPEED[this.level];
          this.go('play');
        } else if (k === 'c') this.go('menu');
        break;
      case 'dying':
        break;
      case 'over':
        if (this.now - this.modeAt > 400 && (k === 'navi' || k === 'c')) this.go('menu');
        break;
    }
  }
  get snake() {
    return this.board?.snake ?? [];
  }
  get food() {
    return this.board?.food ?? { x: -9, y: -9 };
  }
  get score() {
    return this.board?.score ?? 0;
  }
  get dir() {
    return this.board?.dir ?? DIRS.right;
  }
  turn(d) {
    if (this.queue.length >= 2) return;
    const last = this.queue[this.queue.length - 1] ?? this.dir;
    if (last.x === -d.x && last.y === -d.y) return;
    if (last.x === d.x && last.y === d.y) return;
    this.queue.push(d);
  }
  startGame() {
    const ticket = this.ticketSource?.() ?? null;
    const seed = ticket ? ticket.seed : Math.floor(Math.random() * 2 ** 32);
    this.board = new Board(seed, this.level);
    this.run = { ticket: ticket?.id ?? null, seed, level: this.level, turns: [] };
    this.queue = [];
    this.newRecord = false;
    this.go('play');
    this.nextStep = this.now + SPEED[this.level];
  }
  step() {
    const b = this.board;
    const d = this.queue.shift() ?? b.dir;
    if (d !== b.dir) this.run.turns.push([b.steps, d.code]);
    const r = b.step(d);
    if (r === 'eat') sound.eat();
    if (r === 'die' || !b.alive) this.die();
  }
  die() {
    sound.die();
    this.prevTop = this.topScore;
    if (this.score > this.topScore) {
      this.topScore = this.score;
      this.newRecord = true;
      save('snake.top', this.topScore);
    }
    this.go('dying');
    const run = { ...this.run, steps: this.board.steps, score: this.score };
    try {
      this.onOver?.(run);
    } catch {
      // The leaderboard is optional; the game carries on without it.
    }
  }
  update(now) {
    this.now = now;
    if (this.mode === 'intro' && now - this.modeAt > 3000) this.go('menu');
    if (this.mode === 'play') {
      // Catch up if the tab stalled, but never run more than a few steps at once.
      let guard = 4;
      while (this.mode === 'play' && now >= this.nextStep && guard-- > 0) {
        this.step();
        this.nextStep += SPEED[this.level];
      }
      if (now > this.nextStep) this.nextStep = now + SPEED[this.level];
    }
    if (this.mode === 'dying' && now - this.modeAt > 1800) this.go('over');
  }
  render() {
    const s = this.screen;
    s.clear();
    switch (this.mode) {
      case 'intro':
        return this.renderIntro();
      case 'menu':
        return this.renderMenu();
      case 'level':
        return this.renderLevel();
      case 'top':
        s.center('Top score:', 4);
        s.center(String(this.topScore), 16, 1, 2);
        return this.softkey('OK');
      case 'help':
        return this.renderHelp();
      case 'play':
        return this.renderGame(true);
      case 'paused':
        this.renderGame(true);
        s.fill(17, 15, 50, 18, 0);
        s.frame(17, 15, 50, 18);
        s.center('Paused', 20);
        return;
      case 'dying':
        // The classic death blink.
        return this.renderGame(Math.floor((this.now - this.modeAt) / 225) % 2 === 1);
      case 'over':
        s.center('Game over!', 2);
        s.center(this.newRecord ? 'New top score:' : 'Your score:', 13);
        s.center(String(this.score), 24, 1, 2);
        return this.softkey('OK');
    }
  }
  softkey(label) {
    this.screen.center(label, 40);
  }
  renderIntro() {
    const s = this.screen;
    s.center('Snake', 4, 1, 2);
    // A little snake slithering along the bottom.
    const t = Math.floor((this.now - this.modeAt) / 90);
    const at = (x) => ({
      x: (((x % 110) + 110) % 110) - 14,
      y: 33 + Math.round(Math.sin(x / 5) * 3),
    });
    for (let i = 0; i < 9; i++) {
      const p = at(t - i * 3);
      s.fill(p.x, p.y, 3, 3);
    }
    const head = at(t);
    s.set(head.x + 1, head.y, 0);
  }
  renderMenu() {
    const s = this.screen;
    MENU.forEach((label, i) => {
      const y = i * 9;
      if (i === this.sel) {
        s.fill(0, y, 79, 9);
        s.text(label, 2, y + 1, 0);
      } else {
        s.text(label, 2, y + 1);
      }
    });
    this.scrollbar(this.sel, MENU.length);
    this.softkey('Select');
  }
  scrollbar(pos, count) {
    const s = this.screen;
    const top = 0;
    const h = 37;
    s.fill(82, top, 1, h);
    const th = Math.max(4, Math.floor(h / count));
    const ty = top + Math.round(((h - th) * pos) / Math.max(1, count - 1));
    s.fill(81, ty, 3, th);
  }
  renderLevel() {
    const s = this.screen;
    s.text('Level', 2, 1);
    const n = String(this.pendingLevel);
    s.text(n, 82 - s.textWidth(n, 2), 1, 1, 2);
    // A rising bar meter, one bar per level.
    for (let i = 0; i < 9; i++) {
      const x = 7 + i * 8;
      const h = Math.round(3 + i * 1.4);
      if (i < this.pendingLevel) s.fill(x, 36 - h, 6, h);
      else s.fill(x, 35, 6, 1);
    }
    this.softkey('OK');
  }
  renderHelp() {
    const s = this.screen;
    this.helpLines.slice(this.helpScroll, this.helpScroll + 4).forEach((line, i) => {
      s.text(line, 0, i * 9 + 1);
    });
    this.scrollbar(this.helpScroll, Math.max(1, this.helpLines.length - 3));
    this.softkey('Back');
  }
  renderGame(showSnake) {
    const s = this.screen;
    s.frame(0, 0, W, 48);
    const f = this.food;
    const fx = OX + f.x * CELL;
    const fy = OY + f.y * CELL;
    s.set(fx + 1, fy);
    s.set(fx, fy + 1);
    s.set(fx + 2, fy + 1);
    s.set(fx + 1, fy + 2);
    if (!showSnake) return;
    this.snake.forEach((seg, i) => {
      const x = OX + seg.x * CELL;
      const y = OY + seg.y * CELL;
      s.fill(x, y, 3, 3);
      // Bridge the 1 px gap to the next segment so the body reads as one line.
      const prev = this.snake[i - 1];
      if (prev) {
        if (prev.y === seg.y) s.fill(OX + Math.min(prev.x, seg.x) * CELL + 3, y, 1, 3);
        else s.fill(x, OY + Math.min(prev.y, seg.y) * CELL + 3, 3, 1);
      }
    });
    // An eye on the head, facing the direction of travel.
    const h = this.snake[0];
    const hx = OX + h.x * CELL;
    const hy = OY + h.y * CELL;
    if (this.dir.x !== 0) s.set(hx + 1, hy, 0);
    else s.set(hx, hy + 1, 0);
  }
}
