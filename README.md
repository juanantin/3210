# 3210

Classic Nokia Snake, recreated in the browser on a Nokia 3210 screen.

- 84 × 48 monochrome LCD drawn to a canvas, with visible pixel dots and slow-LCD ghosting
- Hand-drawn bitmap font and Nokia-style menus: New game, Level (1–9), Top score, Instructions
- Grows one segment per bite, scores the level number per bite, walls and tail are deadly
- Death blink, buzzer beeps, top score and level saved in the browser
- A photorealistic phone image (`public/phone.webp`) with tappable keys, so it plays on mobile too

This is a from-scratch recreation of the game's look and feel, not an emulation of the original firmware.

## Controls

| Action | Keyboard | Phone |
| --- | --- | --- |
| Steer | Arrow keys, WASD, or 2 4 6 8 | 2 4 6 8 |
| Select / pause | Enter or Space | Navi key |
| Back | Esc or Backspace | C |

## Develop

```sh
npm install
npm run dev      # local dev server
npm run build    # production build in dist/
npm run lint
```

## Layout

- `src/snake/engine.ts` – game state, menus and rendering to the 84 × 48 framebuffer
- `src/snake/screen.ts` – framebuffer drawing helpers (pixels, rectangles, text)
- `src/snake/font.ts` – bitmap font
- `src/snake/sound.ts` – square-wave beeps via Web Audio
- `src/snake/phone.css` – page layout, photo, LCD overlay and key hit areas
- `src/App.tsx` – the page: photo, key hit areas, LCD renderer and input handling
