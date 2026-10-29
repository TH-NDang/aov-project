import { useCallback, useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { DocumentView, GameContent } from "@aov/community-contracts"
import {
  tournamentApi,
  tournamentError,
  tournamentIssueFields,
  tournamentKeys,
} from "@/features/tournaments/tournament-api"
import { missingFieldLabel } from "@/features/tournaments/tournament-model"

export type SaveState = { status: "idle" | "saving" | "saved" | "error"; error?: string; savedAt?: Date }

/**
 * Saves edits of one game through the versioned admin API. Changes are queued and each one is applied to the latest
 * saved version, so recording several moments quickly never sends a stale version; a real conflict with another
 * editor still surfaces as an error instead of overwriting their work.
 */
export function useGameSaver(entry: DocumentView<GameContent>) {
  const client = useQueryClient()
  const latest = useRef(entry)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const [state, setState] = useState<SaveState>({ status: "idle" })

  useEffect(() => {
    if (entry.version >= latest.current.version) latest.current = entry
  }, [entry])

  const save = useCallback(
    (change: (content: GameContent) => GameContent) => {
      const run = queue.current.then(async () => {
        setState({ status: "saving" })
        try {
          const current = latest.current
          const next = change(current.content)
          const saved = await tournamentApi.save("games", current, next)
          latest.current = saved
          client.setQueriesData<DocumentView<GameContent>[]>({ queryKey: [...tournamentKeys.all, "games"] }, (rows) =>
            rows?.map((row) => (row.id === saved.id ? saved : row)),
          )
          // A service build without timeline or draft support silently drops the unknown field.
          const dropped =
            next.timeline && !saved.content.timeline
              ? "dòng thời gian"
              : next.draft && !saved.content.draft
                ? "giai đoạn cấm chọn"
                : null
          if (dropped) {
            setState({
              status: "error",
              error: `Máy chủ giải đấu chưa lưu được ${dropped}. Khởi động lại community-service bản mới.`,
            })
            return false
          }
          setState({ status: "saved", savedAt: new Date() })
          return true
        } catch (error) {
          const fields = tournamentIssueFields(error)
          setState({
            status: "error",
            error: fields.length
              ? `${tournamentError(error)} ${fields.map(missingFieldLabel).join("; ")}`
              : tournamentError(error),
          })
          return false
        }
      })
      queue.current = run
      return run
    },
    [client],
  )

  /** Confirms the game by publishing its latest saved version, after any queued saves. */
  const publish = useCallback(() => {
    const run = queue.current.then(async () => {
      setState({ status: "saving" })
      try {
        const published = await tournamentApi.publish(latest.current)
        latest.current = published
        client.setQueriesData<DocumentView<GameContent>[]>({ queryKey: [...tournamentKeys.all, "games"] }, (rows) =>
          rows?.map((row) => (row.id === published.id ? published : row)),
        )
        setState({ status: "saved", savedAt: new Date() })
        return true
      } catch (error) {
        const fields = tournamentIssueFields(error)
        setState({
          status: "error",
          error: fields.length
            ? `Chưa xác nhận được: ${fields.map(missingFieldLabel).join("; ")}`
            : tournamentError(error),
        })
        return false
      }
    })
    queue.current = run
    return run
  }, [client])

  const reload = useCallback(async () => {
    await client.invalidateQueries({ queryKey: [...tournamentKeys.all, "games"] })
    setState({ status: "idle" })
  }, [client])

  return { save, publish, state, reload }
}
