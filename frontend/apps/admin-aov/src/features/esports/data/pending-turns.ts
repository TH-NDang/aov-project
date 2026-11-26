import { useCallback, useEffect, useRef, useState } from "react"
import type { DraftTurn, GameContent } from "@aov/community-contracts"
import type { ContentChange } from "../model/desk"

const keyOf = (gameId: string) => `esports:pending-turns:${gameId}`

const isTurn = (value: unknown): value is DraftTurn => {
  const turn = value as Partial<DraftTurn> | null
  return (
    typeof turn?.order === "number" &&
    (turn.kind === "BAN" || turn.kind === "PICK") &&
    (turn.side === "BLUE" || turn.side === "RED")
  )
}

function stored(gameId: string): DraftTurn[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(keyOf(gameId)) ?? "[]")
    return Array.isArray(value) && value.every(isTurn) ? value : []
  } catch {
    return []
  }
}

/**
 * Turns typed for a game whose line-ups were recorded without them. They are kept in this browser until they name every
 * recorded ban and hero, because the service refuses a game that has some turns and leaves one of those out.
 */
export function usePendingTurns(gameId: string) {
  const [turns, setTurns] = useState(() => stored(gameId))
  const latest = useRef(turns)
  const keep = useCallback(
    (change: (turns: DraftTurn[]) => DraftTurn[]) => {
      const next = change(latest.current)
      latest.current = next
      setTurns(next)
      try {
        if (next.length) localStorage.setItem(keyOf(gameId), JSON.stringify(next))
        else localStorage.removeItem(keyOf(gameId))
      } catch {
        // Private mode or blocked storage: the turns last as long as the page.
      }
    },
    [gameId],
  )
  return [turns, keep] as const
}

/**
 * The game with the changes just made already in it. Turns are typed faster than they are saved, and each one takes the
 * place after the one before it. When a change is refused the game goes back to what is saved.
 */
export function useShownGame(content: GameContent) {
  const [shown, setShown] = useState(content)
  const latest = useRef(content)
  const saved = useRef(content)
  const waiting = useRef(0)
  const refused = useRef(false)

  useEffect(() => {
    saved.current = content
    if (waiting.current > 0) return
    latest.current = content
    setShown(content)
  }, [content])

  const show = useCallback(async (change: ContentChange, send: () => Promise<boolean>) => {
    latest.current = change(latest.current)
    setShown(latest.current)
    waiting.current += 1
    const accepted = await send()
    waiting.current -= 1
    if (!accepted) refused.current = true
    if (waiting.current === 0 && refused.current) {
      refused.current = false
      latest.current = saved.current
      setShown(saved.current)
    }
    return accepted
  }, [])
  return [shown, show] as const
}
