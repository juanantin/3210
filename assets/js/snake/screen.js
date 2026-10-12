import { glyph } from './font.js';
// The Nokia 3310 has an 84 x 48 monochrome LCD.
export const W = 84;
export const H = 48;
export class Screen {
  buf = new Uint8Array(W * H);
  clear() {
    this.buf.fill(0);
  }
  set(x, y, v = 1) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    this.buf[y * W + x] = v;
  }
  fill(x, y, w, h, v = 1) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, v);
  }
  frame(x, y, w, h, v = 1) {
    this.fill(x, y, w, 1, v);
    this.fill(x, y + h - 1, w, 1, v);
    this.fill(x, y, 1, h, v);
    this.fill(x + w - 1, y, 1, h, v);
  }
  textWidth(s, scale = 1) {
    let w = 0;
    for (const ch of s) w += glyph(ch).w + 1;
    return Math.max(0, w - 1) * scale;
  }
  text(s, x, y, v = 1, scale = 1) {
    let cx = x;
    for (const ch of s) {
      const g = glyph(ch);
      g.rows.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) {
          if (row[rx] === '#') this.fill(cx + rx * scale, y + ry * scale, scale, scale, v);
        }
      });
      cx += (g.w + 1) * scale;
    }
  }
  center(s, y, v = 1, scale = 1) {
    this.text(s, Math.floor((W - this.textWidth(s, scale)) / 2), y, v, scale);
  }
  wrap(s, maxW) {
    const lines = [];
    for (const para of s.split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        const next = line ? line + ' ' + word : word;
        if (this.textWidth(next) <= maxW) line = next;
        else {
          if (line) lines.push(line);
          line = word;
        }
      }
      lines.push(line);
    }
    return lines;
  }
}
