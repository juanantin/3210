/* ==========================================================================
   The rules of Snake, and nothing else — no screen, no sound, no clock.

   Shared by the game in the browser (engine.js) and by the leaderboard API
   (api/scores.js), which replays every submitted run move by move with this
   same code before it accepts the score. Food is placed by a seeded generator,
   so a seed plus the list of turns reproduces a game exactly.
   ========================================================================== */

// Playfield: 20 x 11 cells.
export const COLS = 20;
export const ROWS = 11;

// Milliseconds per step for levels 1-9.
export const SPEED = [0, 500, 420, 350, 290, 235, 190, 150, 115, 85];

export const DIRS = {
  up: { x: 0, y: -1, code: 'u' },
  down: { x: 0, y: 1, code: 'd' },
  left: { x: -1, y: 0, code: 'l' },
  right: { x: 1, y: 0, code: 'r' },
};
export const BY_CODE = { u: DIRS.up, d: DIRS.down, l: DIRS.left, r: DIRS.right };

// mulberry32: small, fast, and identical in every JavaScript engine.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Board {
  constructor(seed, level) {
    this.rand = rng(seed);
    this.level = level;
    const y = Math.floor(ROWS / 2);
    this.snake = [];
    for (let i = 0; i < 5; i++) this.snake.push({ x: 8 - i, y });
    this.dir = DIRS.right;
    this.food = { x: 0, y: 0 };
    this.score = 0;
    this.steps = 0;
    this.alive = true;
    this.placeFood();
  }

  placeFood() {
    const free = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!this.snake.some((s) => s.x === x && s.y === y)) free.push({ x, y });
      }
    }
    if (free.length === 0) return false;
    this.food = free[Math.floor(this.rand() * free.length)];
    return true;
  }

  // One step in direction d. Returns 'move', 'eat' or 'die'.
  step(d = this.dir) {
    this.dir = d;
    this.steps++;
    const head = { x: this.snake[0].x + d.x, y: this.snake[0].y + d.y };
    const eating = head.x === this.food.x && head.y === this.food.y;
    // The tail vacates its cell this step unless the snake is growing.
    const body = eating ? this.snake : this.snake.slice(0, -1);
    if (
      head.x < 0 ||
      head.y < 0 ||
      head.x >= COLS ||
      head.y >= ROWS ||
      body.some((s) => s.x === head.x && s.y === head.y)
    ) {
      this.alive = false;
      return 'die';
    }
    this.snake.unshift(head);
    if (!eating) {
      this.snake.pop();
      return 'move';
    }
    this.score += this.level;
    if (!this.placeFood()) this.alive = false; // the board is full: a perfect game
    return this.alive ? 'eat' : 'die';
  }
}

/* Replays a recorded run. `turns` is [[step, code], ...]: before step number
   `step` (0-based) the snake turned to direction `code`. Returns the score
   and step count the game really ended on, or why the record is impossible. */
export const MAX_STEPS = 250000;

export function replay({ seed, level, turns, steps }) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) return { error: 'bad seed' };
  if (!Number.isInteger(level) || level < 1 || level > 9) return { error: 'bad level' };
  if (!Number.isInteger(steps) || steps < 1 || steps > MAX_STEPS) return { error: 'bad steps' };
  if (!Array.isArray(turns) || turns.length > steps) return { error: 'bad turns' };

  const board = new Board(seed, level);
  let t = 0;
  let prev = -1;
  while (board.alive) {
    if (board.steps >= steps) return { error: 'run did not end where it says' };
    let d = board.dir;
    if (t < turns.length && turns[t][0] === board.steps) {
      const [at, code] = turns[t++];
      const next = BY_CODE[code];
      if (!next || !Number.isInteger(at) || at <= prev) return { error: 'bad turn' };
      // A turn must change direction, and can never reverse into the neck.
      if (next === d || (next.x === -d.x && next.y === -d.y)) return { error: 'impossible turn' };
      prev = at;
      d = next;
    }
    board.step(d);
  }
  if (t !== turns.length) return { error: 'turns after the end' };
  if (board.steps !== steps) return { error: 'run did not end where it says' };
  return { score: board.score, steps: board.steps };
}
