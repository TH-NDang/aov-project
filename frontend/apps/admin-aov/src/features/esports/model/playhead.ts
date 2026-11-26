/**
 * Where the video is, in seconds, kept outside React: the player reports it four times a second, and only the parts of
 * the screen that show it draw again (`usePlayhead`, `usePlayheadValue`).
 */
export type Playhead = { get(): number; set(second: number): void; subscribe(listener: () => void): () => void }

export function createPlayhead(initial: number): Playhead {
  let now = Math.max(0, initial)
  const listeners = new Set<() => void>()
  return {
    get: () => now,
    set(second) {
      if (!Number.isFinite(second)) return
      const next = Math.max(0, second)
      if (next === now) return
      now = next
      for (const listener of [...listeners]) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
