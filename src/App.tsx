import { useEffect, useRef, useState } from 'react'
import { Engine, type Key } from './snake/engine'
import { Screen, W, H } from './snake/screen'
import { sound } from './snake/sound'
import './snake/phone.css'

// Canvas pixels per LCD pixel; each LCD dot is drawn slightly smaller to show the grid.
const DOT = 5

// The phone photo is 480 x 1168. Hit areas are centre x, centre y, width, height in
// photo pixels, placed over the keys printed in the photo.
const PHOTO_W = 480
const PHOTO_H = 1168
const LCD = { x: 83, y: 274, w: 311, h: 223 }

type Spot = { id: string; key: Key; label: string; box: [number, number, number, number] }

const KEY_X = [109, 239, 369]
const KEY_Y = [736, 824, 911, 996]
const KEYPAD: [Key, string][] = [
  ['1', '1'], ['2', '2'], ['3', '3'],
  ['4', '4'], ['5', '5'], ['6', '6'],
  ['7', '7'], ['8', '8'], ['9', '9'],
  ['*', 'Star'], ['0', '0'], ['#', 'Hash'],
]

const SPOTS: Spot[] = [
  { id: 'navi', key: 'navi', label: 'Navi key', box: [239, 561, 170, 44] },
  { id: 'c', key: 'c', label: 'C key', box: [126, 608, 90, 80] },
  { id: 'ok', key: 'navi', label: 'Select key', box: [354, 608, 90, 80] },
  { id: 'up', key: 'up', label: 'Scroll up', box: [239, 631, 86, 40] },
  { id: 'down', key: 'down', label: 'Scroll down', box: [239, 671, 86, 40] },
  ...KEYPAD.map(([key, label], i): Spot => ({
    id: key,
    key,
    label: `Key ${label}`,
    box: [KEY_X[i % 3], KEY_Y[Math.floor(i / 3)], 100, 58],
  })),
]

const pct = (v: number, of: number) => `${(v / of) * 100}%`

const KEYBOARD: Record<string, Key> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: '4', ArrowRight: '6',
  w: 'up', s: 'down', a: '4', d: '6',
  Enter: 'navi', ' ': 'navi',
  Escape: 'c', Backspace: 'c', c: 'c',
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
  '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', '*': '*', '#': '#',
}

function loadMuted() {
  try {
    return localStorage.getItem('snake.muted') === '1'
  } catch {
    return false
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<Engine | null>(null)
  const [held, setHeld] = useState<string | null>(null)
  const [muted, setMuted] = useState(loadMuted)

  useEffect(() => {
    sound.enabled = !muted
    try {
      localStorage.setItem('snake.muted', muted ? '1' : '0')
    } catch {
      // Storage unavailable; the setting lasts for this visit only.
    }
  }, [muted])

  useEffect(() => {
    const canvas = canvasRef.current!
    const g = canvas.getContext('2d')!
    const screen = new Screen()
    const engine = new Engine(screen)
    engineRef.current = engine

    // Per-dot darkness, eased toward the framebuffer to mimic slow LCD response.
    const level = new Float32Array(W * H)
    let last = performance.now()
    engine.update(last)
    engine.modeAt = last
    let raf = 0

    const draw = (now: number) => {
      const dt = Math.min(100, now - last)
      last = now
      engine.update(now)
      engine.render()

      const on = 1 - Math.pow(1 - 0.55, (dt * 60) / 1000)
      const off = 1 - Math.pow(1 - 0.3, (dt * 60) / 1000)
      g.clearRect(0, 0, canvas.width, canvas.height)
      for (let i = 0; i < level.length; i++) {
        const target = screen.buf[i]
        level[i] += (target - level[i]) * (target > level[i] ? on : off)
        const a = 0.04 + level[i] * 0.84
        g.fillStyle = `rgba(24, 36, 22, ${a.toFixed(3)})`
        g.fillRect((i % W) * DOT, Math.floor(i / W) * DOT, DOT - 0.6, DOT - 0.6)
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    const down = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = KEYBOARD[e.key] ?? KEYBOARD[e.key.toLowerCase()]
      if (!k) return
      e.preventDefault()
      setHeld(SPOTS.find((spot) => spot.key === k)?.id ?? null)
      if (!e.repeat) engine.press(k)
    }
    const up = () => setHeld(null)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  return (
    <main className="nk-page">
      <header className="nk-brand">
        <img src="/logo.webp" alt="" width={56} height={56} />
        <h1>3210</h1>
      </header>
      <div className="nk-phone">
        <img className="nk-photo" src="/phone.webp" alt="" draggable={false} />
        <div
          className="nk-lcd"
          style={{
            left: pct(LCD.x, PHOTO_W),
            top: pct(LCD.y, PHOTO_H),
            width: pct(LCD.w, PHOTO_W),
            height: pct(LCD.h, PHOTO_H),
          }}
        >
          <canvas
            ref={canvasRef}
            width={W * DOT}
            height={H * DOT}
            role="img"
            aria-label="Snake game screen"
          />
        </div>
        {SPOTS.map(({ id, key, label, box: [cx, cy, w, h] }) => (
          <button
            type="button"
            key={id}
            aria-label={label}
            className={`nk-key ${held === id ? 'is-held' : ''}`}
            style={{
              left: pct(cx - w / 2, PHOTO_W),
              top: pct(cy - h / 2, PHOTO_H),
              width: pct(w, PHOTO_W),
              height: pct(h, PHOTO_H),
            }}
            onPointerDown={(e) => {
              e.preventDefault()
              setHeld(id)
              engineRef.current?.press(key)
            }}
            onPointerUp={() => setHeld(null)}
            onPointerLeave={() => setHeld(null)}
          />
        ))}
      </div>

      <div className="nk-help">
        <p>
          <kbd>2</kbd> <kbd>4</kbd> <kbd>6</kbd> <kbd>8</kbd> or arrow keys steer ·{' '}
          <kbd>Enter</kbd> is the Navi key · <kbd>Esc</kbd> is C
        </p>
        <button type="button" className="nk-sound" onClick={() => setMuted((m) => !m)}>
          Sound: {muted ? 'off' : 'on'}
        </button>
      </div>
    </main>
  )
}
