// src/audio/sfx.ts
type Name = 'win' | 'lose'

// Prefer m4a (AAC), then mp3, then wav
const SOURCES: Record<Name, string[]> = {
  win: ['/sounds/win.m4a', '/sounds/win.mp3', '/sounds/win.wav'],
  lose: ['/sounds/lose.m4a', '/sounds/lose.mp3', '/sounds/lose.wav'],
}

function pickPlayable(srcs: string[]): string {
  const a = document.createElement('audio')
  for (const src of srcs) {
    const ext = src.split('.').pop()?.toLowerCase()
    const type =
      ext === 'm4a' || ext === 'mp4' || ext === 'aac' ? 'audio/mp4; codecs="mp4a.40.2"' :
      ext === 'mp3' ? 'audio/mpeg' :
      ext === 'wav' ? 'audio/wav' :
      ''
    const can = a.canPlayType(type)
    if (can === 'probably' || can === 'maybe') return src
  }
  return srcs[0] // fallback anyway
}

const cache: Partial<Record<Name, HTMLAudioElement>> = {}

export function playSfx(name: Name, volume = 0.9) {
  try {
    if (!cache[name]) {
      const src = pickPlayable(SOURCES[name])
      cache[name] = new Audio(src)
    }
    const node = cache[name]!.cloneNode(true) as HTMLAudioElement
    node.volume = volume
    node.play().catch(() => { /* autoplay might be blocked until a click */ })
  } catch { /* ignore */ }
}
