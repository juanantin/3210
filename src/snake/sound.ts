// Monophonic square-wave beeps, like the 3210's piezo buzzer.

let ctx: AudioContext | null = null

export const sound = {
  enabled: true,

  tone(freq: number, ms: number, delay = 0) {
    if (!this.enabled) return
    try {
      ctx ??= new AudioContext()
      if (ctx.state === 'suspended') void ctx.resume()
      const t = ctx.currentTime + delay / 1000
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.05, t)
      gain.gain.setValueAtTime(0, t + ms / 1000)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + ms / 1000 + 0.02)
    } catch {
      // Audio unavailable; play silently.
    }
  },

  key() {
    this.tone(1400, 45)
  },

  eat() {
    this.tone(2100, 35)
  },

  die() {
    this.tone(700, 110)
    this.tone(520, 110, 130)
    this.tone(360, 220, 260)
  },
}
