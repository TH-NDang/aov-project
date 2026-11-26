import { useCallback, useState } from "react"
import { formatNumber } from "@/lib/text"

export type Sound = { volume: number; muted: boolean }

const SOUND_KEY = "esports:studio:sound"
const RATE_KEY = "esports:studio:rate"
export const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]

export const rateLabel = (rate: number) => `${formatNumber(rate)}×`
export const isSilent = (sound: Sound) => sound.muted || sound.volume === 0
/** Silent when it was heard, and heard again when it was silent. */
export const otherSound = (sound: Sound): Sound => ({ volume: sound.volume || 100, muted: !isSilent(sound) })

function savedSound(): Sound {
  try {
    const value = JSON.parse(localStorage.getItem(SOUND_KEY) ?? "null") as Partial<Sound> | null
    const volume = Number(value?.volume)
    return {
      volume: Number.isFinite(volume) && volume >= 0 && volume <= 100 ? Math.round(volume) : 100,
      muted: value?.muted === true,
    }
  } catch {
    return { volume: 100, muted: false }
  }
}

function savedRate(): number {
  try {
    const value = Number(sessionStorage.getItem(RATE_KEY))
    return RATES.includes(value) ? value : 1
  } catch {
    return 1
  }
}

/** How this viewer listens: the sound for good, the speed until the tab is closed. */
export function useVideoSettings(): {
  sound: Sound
  setSound: (next: Sound) => void
  rate: number
  setRate: (next: number) => void
} {
  const [sound, keepSound] = useState(savedSound)
  const [rate, keepRate] = useState(savedRate)
  const setSound = useCallback((next: Sound) => {
    keepSound(next)
    try {
      localStorage.setItem(SOUND_KEY, JSON.stringify(next))
    } catch {
      // Without storage the sound starts from full volume next time.
    }
  }, [])
  const setRate = useCallback((next: number) => {
    keepRate(next)
    try {
      sessionStorage.setItem(RATE_KEY, String(next))
    } catch {
      // Without storage the speed starts from 1× after a reload.
    }
  }, [])
  return { sound, setSound, rate, setRate }
}
