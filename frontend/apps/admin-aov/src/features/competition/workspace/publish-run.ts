import { useSyncExternalStore } from "react"
import type { DocumentView, GameContent } from "@aov/community-contracts"

/** Which of the two groups of games a run publishes: those with every part, or those a reader finds parts unknown in. */
export type PublishBatch = "ready" | "partial"

/** A game the service refused to publish, and why in the words of the screens. */
export type PublishFailure = { game: DocumentView<GameContent>; reason: string }

export type PublishRun = {
  /** The group being published and how far it got; absent while nothing runs. */
  running?: { batch: PublishBatch; done: number; total: number }
  /** What the service refused in the last run, also while it goes on. */
  failures: PublishFailure[]
}

const IDLE: PublishRun = { failures: [] }

/**
 * The bulk publication of a tournament's games, by tournament. It runs for minutes and outlives the step that started
 * it: an editor who opens another step meanwhile finds its progress, or what it could not publish, on coming back, and
 * cannot start a second run beside it.
 */
const runs = new Map<string, PublishRun>()
const listeners = new Set<() => void>()

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const publishRunOf = (tournamentId: string): PublishRun => runs.get(tournamentId) ?? IDLE

export function updatePublishRun(tournamentId: string, change: (run: PublishRun) => PublishRun) {
  runs.set(tournamentId, change(publishRunOf(tournamentId)))
  for (const listener of listeners) listener()
}

export const usePublishRun = (tournamentId: string) => useSyncExternalStore(subscribe, () => publishRunOf(tournamentId))
