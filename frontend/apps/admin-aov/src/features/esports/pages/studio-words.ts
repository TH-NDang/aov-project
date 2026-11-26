import { useCallback, useEffect, useState } from "react"
import type { DeskChange } from "./desk-changes"
import type { Arrival } from "./studio-video"

/** How long a refusal stays in the status line. */
const REFUSAL_MS = 4000

/**
 * What the foot tells beside the changes of the game on the desk: why a key did nothing, for a few seconds; where a link
 * just written points; a game the desk made; and how many turns of each game are typed and not saved yet.
 */
export function useStudioWords() {
  const [refusal, setRefusal] = useState<{ text: string } | null>(null)
  useEffect(() => {
    if (!refusal) return
    const timer = window.setTimeout(() => setRefusal(null), REFUSAL_MS)
    return () => window.clearTimeout(timer)
  }, [refusal])
  const [arrival, setArrival] = useState<Arrival | null>(null)
  /** A game the desk made, for the foot of its own desk to tell. */
  const [made, setMade] = useState<{ gameId: string; done: DeskChange } | null>(null)
  const onMade = useCallback(() => setMade(null), [])
  /** Turns of a game typed in this browser and not saved yet, which its tab counts. */
  const [typedTurns, setTypedTurns] = useState<Record<string, number>>({})
  const onTypedTurns = useCallback(
    (id: string, turns: number) =>
      setTypedTurns((current) => ((current[id] ?? 0) === turns ? current : { ...current, [id]: turns })),
    [],
  )

  return {
    refusal: refusal?.text ?? null,
    say: (text: string) => setRefusal({ text }),
    arrival,
    setArrival,
    made,
    setMade,
    onMade,
    typedTurns,
    onTypedTurns,
    /** Something was done: what the line said before gives way to it. */
    onDone: () => {
      setRefusal(null)
      setArrival(null)
    },
  }
}
