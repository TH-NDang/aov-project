import { useState, useSyncExternalStore } from "react"
import { isCancelledError, useQueryClient, type QueryClient } from "@tanstack/react-query"
import type { DocumentView, GameContent } from "@aov/community-contracts"
import { isApiError } from "@/lib/api/errors"
import {
  tournamentApi,
  tournamentError,
  tournamentIssueFields,
  tournamentKeys,
} from "@/features/tournaments/api/tournament-api"
import { gameFieldWords } from "@/features/tournaments/model/game-field-words"
import type { ContentChange } from "../model/desk"

/** What the line under a game says of its writes. */
export type SaverState = {
  saving: boolean
  /**
   * The write that was refused, as the sentence an editor reads. Writes queued behind it and their success leave it
   * standing: it goes only when another change is asked for or the newer version is read.
   */
  error: string | null
  /** The same sentence naming the game, for while another game is on the desk. */
  away: string | null
  /** Whether reading the game again is what the refusal asks for: another version was saved meanwhile, or reading failed. */
  stale: boolean
  savedAt: Date | null
}

/** The queue of writes of one game; every write is applied to the version the one before it left. */
export type GameSaver = {
  state: () => SaverState
  subscribe: (listener: () => void) => () => void
  /** Takes a copy of the game read elsewhere, when it is not older than the one the saver writes on. */
  seen: (entry: DocumentView<GameContent>) => void
  /** `what` names the change in the sentence of a refusal. */
  save: (change: ContentChange, what?: string) => Promise<boolean>
  publish: () => Promise<boolean>
  withdraw: () => Promise<boolean>
  reload: () => Promise<void>
  /** Resolves once every queued write was answered. */
  settled: () => Promise<void>
}

const GAMES = { queryKey: tournamentKeys.kind("games") }

/**
 * Puts a written game into every list of games. A list read that was under way left the service before the write, so
 * it would bring the older copy back: it is cancelled, and read again after.
 */
async function showSaved(client: QueryClient, saved: DocumentView<GameContent>) {
  const reading = client.isFetching(GAMES) > 0
  if (reading) await client.cancelQueries(GAMES)
  client.setQueriesData<DocumentView<GameContent>[]>(GAMES, (rows) =>
    rows?.map((row) => (row.id === saved.id ? saved : row)),
  )
  if (reading) void client.invalidateQueries(GAMES)
}

const fieldsOf = (error: unknown, content: GameContent) =>
  tournamentIssueFields(error).map((field) => gameFieldWords(field, content))

/** A write refused because the game was saved elsewhere since it was read. */
const isConflict = (error: unknown) =>
  isApiError(error, "TOURNAMENT_VERSION_CONFLICT") || isApiError(error, "VERSION_CONFLICT")

function gameSaver(client: QueryClient, entry: DocumentView<GameContent>, onChange: () => void): GameSaver {
  let latest = entry
  let queue: Promise<unknown> = Promise.resolve()
  let waiting = 0
  let state: SaverState = { saving: false, error: null, away: null, stale: false, savedAt: null }
  const listeners = new Set<() => void>()

  const set = (change: Partial<SaverState>) => {
    state = { ...state, ...change }
    for (const listener of listeners) listener()
    onChange()
  }
  const refuse = (verb: string, what: string | null, reason: string, error: unknown) => {
    const deed = what ? `${what}. ` : ""
    set({
      error: `Không ${verb} được: ${deed}${reason}`,
      away: `Không ${verb} được ván ${latest.content.number}: ${deed}${reason}`,
      stale: isConflict(error),
    })
  }
  /** Something new is asked for, so a refusal told before has been read. */
  const asked = () => {
    if (state.error) set({ error: null, away: null, stale: false })
  }
  const queued = (write: () => Promise<boolean>) => {
    asked()
    waiting++
    if (!state.saving) set({ saving: true })
    const run = queue.then(write).finally(() => {
      if (--waiting === 0) set({ saving: false })
    })
    queue = run
    return run
  }
  const answered = async (next: DocumentView<GameContent>) => {
    latest = next
    await showSaved(client, next)
    set({ savedAt: new Date() })
  }

  return {
    state: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    seen: (copy) => {
      if (copy.version >= latest.version) latest = copy
    },
    save: (change, what) =>
      queued(async () => {
        const current = latest
        let next = current.content
        try {
          next = change(current.content)
          // A change that changes nothing, such as taking back a write that was refused, sends nothing.
          if (next === current.content) return true
          const saved = await tournamentApi.save("games", current, next)
          await answered(saved)
          // A service build without timeline or draft support silently drops the unknown field.
          const dropped =
            next.timeline && !saved.content.timeline
              ? "dòng thời gian"
              : next.draft && !saved.content.draft
                ? "giai đoạn cấm chọn"
                : null
          if (dropped) {
            const words = "máy chủ giải đấu chưa nhận phần này. Khởi động lại community-service bản mới."
            set({
              error: `Không lưu được ${dropped}: ${words}`,
              away: `Không lưu được ${dropped} của ván ${saved.content.number}: ${words}`,
              stale: false,
            })
            return false
          }
          return true
        } catch (error) {
          const fields = fieldsOf(error, next)
          const reason = [tournamentError(error), ...(fields.length ? [fields.join("; ")] : [])].join(" ")
          refuse("lưu", what ?? null, reason, error)
          return false
        }
      }),
    publish: () =>
      queued(async () => {
        try {
          await answered(await tournamentApi.publish(latest))
          return true
        } catch (error) {
          const fields = fieldsOf(error, latest.content)
          refuse("xuất bản", null, fields.length ? fields.join("; ") : tournamentError(error), error)
          return false
        }
      }),
    withdraw: () =>
      queued(async () => {
        try {
          await answered(await tournamentApi.withdraw(latest))
          return true
        } catch (error) {
          refuse("ngừng xuất bản", null, tournamentError(error), error)
          return false
        }
      }),
    reload: async () => {
      try {
        await client.invalidateQueries(GAMES, { throwOnError: true })
        set({ error: null, away: null, stale: false })
      } catch (error) {
        // A save that answered meanwhile read the list again itself.
        if (isCancelledError(error)) return set({ error: null, away: null, stale: false })
        set({
          error: `Không tải được bản mới: ${tournamentError(error)}`,
          away: `Không tải được bản mới của ván ${latest.content.number}: ${tournamentError(error)}`,
          stale: true,
        })
      }
    },
    settled: () => queue.then(() => undefined),
  }
}

/** A refusal of a game, for the desk of the match. */
export type Refusal = { gameId: string; text: string }

/**
 * The savers of the games of one match, kept while the match is open: a write outlives the desk it was made on, so its
 * answer is still told, and a game that comes back to the desk goes on from the version its last write left.
 */
function gameSavers(client: QueryClient) {
  const savers = new Map<string, GameSaver>()
  const listeners = new Set<() => void>()
  let refused: Refusal[] = []
  const changed = () => {
    const next = [...savers.entries()].flatMap(([gameId, saver]) => {
      const { away } = saver.state()
      return away ? [{ gameId, text: away }] : []
    })
    if (next.length === refused.length && next.every((value, index) => value.text === refused[index]!.text)) return
    refused = next
    for (const listener of listeners) listener()
  }
  return {
    /** The saver of a game, made the first time it is asked for. */
    of(entry: DocumentView<GameContent>) {
      let saver = savers.get(entry.id)
      if (!saver) {
        saver = gameSaver(client, entry, changed)
        savers.set(entry.id, saver)
      }
      return saver
    },
    /** Takes the copies of a list of games that was read again. */
    seen(entries: DocumentView<GameContent>[]) {
      for (const entry of entries) savers.get(entry.id)?.seen(entry)
    },
    settled: () => Promise.all([...savers.values()].map((saver) => saver.settled())).then(() => undefined),
    /** The writes that were refused, one a game. */
    refused: () => refused,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export type GameSavers = ReturnType<typeof gameSavers>

export function useGameSavers() {
  const client = useQueryClient()
  const [savers] = useState(() => gameSavers(client))
  return savers
}

/** What a game's saver says now. */
export const useSaverState = (saver: GameSaver) => useSyncExternalStore(saver.subscribe, saver.state)
