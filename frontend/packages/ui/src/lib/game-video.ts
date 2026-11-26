type Pauses = readonly { atSeconds: number; durationSeconds: number }[] | null | undefined

/** The pauses of a broadcast that hold the game clock, in the order they came. */
export const orderedPauses = <Pause extends { atSeconds: number; durationSeconds: number }>(
  pauses: readonly Pause[] | null | undefined,
): Pause[] =>
  (pauses ?? [])
    .filter((pause) => pause.durationSeconds > 0 && pause.atSeconds >= 0)
    .sort((a, b) => a.atSeconds - b.atSeconds)

/** The second of the video that shows a second of the game: every pause before it pushes it back. */
export function gameToVideo(zero: number, pauses: Pauses, at: number): number {
  return orderedPauses(pauses)
    .filter((pause) => pause.atSeconds < at)
    .reduce((second, pause) => second + pause.durationSeconds, zero + at)
}

/** The game clock at a second of the video: 0 before the game begins, held while the broadcast is paused. */
export function videoToGame(zero: number, pauses: Pauses, second: number): number {
  let left = second - zero
  if (left <= 0) return 0
  for (const pause of orderedPauses(pauses)) {
    if (left <= pause.atSeconds) return left
    if (left <= pause.atSeconds + pause.durationSeconds) return pause.atSeconds
    left -= pause.durationSeconds
  }
  return left
}
