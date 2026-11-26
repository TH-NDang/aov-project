import type { DocumentView, GameContent } from "@aov/community-contracts"
import * as data from "./esports-data"
import { json, page, type Handler } from "./network"

/** What the signed-in editor may do with tournaments. */
export const EDITOR = ["tournament:read", "tournament:write", "tournament:publish"]

/**
 * The services of one match, kept in memory: its records are read, and its games are made, saved and published through
 * the same versioned flow as the real API. `saves` keeps every content the page sent.
 */
export function matchBackend({
  games = [data.game, data.game2],
  series = data.series,
}: {
  games?: DocumentView<GameContent>[]
  series?: typeof data.series
} = {}) {
  const records = [...games]
  const saves: GameContent[] = []
  const lists: Record<string, readonly { id: string; content: object }[]> = {
    teams: data.teams,
    players: data.players,
    tournaments: [data.tournament],
    series,
    "roster-memberships": data.rosters,
  }
  /** Writes a game at the version the page saw, as the service does. */
  function write(id: string, version: number, next: (game: DocumentView<GameContent>) => DocumentView<GameContent>) {
    const index = records.findIndex((entry) => entry.id === id)
    if (index < 0) return json({ detail: "Missing game" }, 404)
    const game = records[index]!
    if (game.version !== version) return json({ code: "TOURNAMENT_VERSION_CONFLICT", detail: "Version conflict" }, 409)
    records[index] = { ...next(game), version: version + 1, updatedAt: new Date().toISOString() }
    return json(records[index])
  }

  const answer: Handler = ({ method, pathname, url, service, body }) => {
    const game = pathname.match(/^\/admin\/games\/([\w-]+)(\/publish|\/withdraw)?$/)
    const { version = 0, content } = (body ?? {}) as { version?: number; content?: GameContent }
    if (game && method === "GET" && !game[2]) return json(records.find((entry) => entry.id === game[1]) ?? null)
    if (game && method === "PUT") {
      saves.push(content!)
      return write(game[1]!, version, (entry) => ({ ...entry, content: content! }))
    }
    if (game?.[2] === "/publish" && method === "POST")
      return write(game[1]!, version, (entry) => ({ ...entry, publishedAt: new Date().toISOString() }))
    if (game?.[2] === "/withdraw" && method === "POST")
      return write(game[1]!, version, (entry) => ({ ...entry, publishedAt: null }))
    if (pathname === "/admin/games" && method === "POST") {
      const made = (content ?? body) as GameContent
      saves.push(made)
      const entry = { ...data.game, id: `fx-made-${made.number}`, version: 1, content: made }
      records.push(entry)
      return json(entry, 201)
    }
    if (method !== "GET") return undefined
    if (pathname === "/admin/reference-catalog") return service === "wiki" ? json({ items: data.references }) : page([])
    if (pathname === "/admin/catalog") return json(data.catalog)
    if (/^\/admin\/tournaments\/[\w-]+\/game-patches$/.test(pathname)) return json([])
    const wanted = (name: string) => url.searchParams.get(name)
    if (pathname === "/admin/games")
      return page(records.filter((entry) => !wanted("seriesId") || entry.content.seriesId === wanted("seriesId")))
    const list = lists[pathname.match(/^\/admin\/([a-z-]+)$/)?.[1] ?? ""]
    return list
      ? page(
          list.filter(
            ({ content: record }) =>
              !wanted("tournamentId") || !("tournamentId" in record) || record.tournamentId === wanted("tournamentId"),
          ),
        )
      : undefined
  }
  return { answer, saves, games: records }
}
