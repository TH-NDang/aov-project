/**
 * The tournament service as the match screen tests see it: the fixture tournament with its teams, players, rosters
 * and matches, and games kept in memory so a save goes through the same versioned flow as the real API. Every write is
 * recorded; `reset` puts the two recorded games of the final back, or the games a test names.
 */
import type { DocumentView, GameContent } from "@aov/community-contracts"
import * as data from "./esports-data"
import { json, page, type ApiRequest, type Handler } from "./network"

const lists: Record<string, DocumentView<object>[]> = {
  teams: data.teams,
  players: data.players,
  tournaments: [data.tournament],
  series: data.series,
  "roster-memberships": data.rosters,
}

export function esportsBackend() {
  let games: DocumentView<GameContent>[] = []
  let created = 0
  const writes: ApiRequest[] = []
  const reset = (stored = [data.game, data.game2]) => {
    games = stored
    created = 0
    writes.length = 0
  }
  reset()

  const save = (request: ApiRequest, id: string) => {
    const index = games.findIndex((entry) => entry.id === id)
    const body = request.body as { version: number; content: GameContent }
    if (index < 0) return json({ code: "NOT_FOUND", detail: "Missing game" }, 404)
    if (games[index].version !== body.version)
      return json({ code: "TOURNAMENT_VERSION_CONFLICT", detail: "Version conflict" }, 409)
    games[index] = { ...games[index], version: body.version + 1, content: body.content }
    return json(games[index])
  }

  const routes: Handler = (request) => {
    if (request.service === "wiki") {
      if (request.pathname === "/admin/reference-catalog") return json({ items: data.references })
      if (request.pathname === "/users/me") return json({ locale: "vi-VN" })
      return undefined
    }
    if (request.service !== "community") return undefined
    if (request.method !== "GET") writes.push(request)

    const gameId = request.pathname.match(/^\/admin\/games\/([\w-]+)$/)?.[1]
    if (gameId && request.method === "PUT") return save(request, gameId)
    if (gameId) {
      const entry = games.find((game) => game.id === gameId)
      return entry ? json(entry) : json({ code: "NOT_FOUND", detail: "Missing game" }, 404)
    }
    if (request.pathname === "/admin/games" && request.method === "POST") {
      const { content } = request.body as { content: GameContent }
      const entry: DocumentView<GameContent> = {
        id: `fx-created-${++created}`,
        version: 1,
        createdAt: "2026-11-01T00:00:00Z",
        updatedAt: "2026-11-01T00:00:00Z",
        missingFields: [],
        content,
      }
      games = [...games, entry]
      return json(entry)
    }
    if (request.method !== "GET") return json({ detail: `Fixture has no ${request.method} ${request.path}` }, 405)

    if (request.pathname === "/admin/catalog") return json(data.catalog)
    if (request.pathname === "/admin/reference-catalog") return page([])
    if (request.pathname === "/admin/games") {
      const seriesId = request.url.searchParams.get("seriesId")
      return page(games.filter((entry) => !seriesId || entry.content.seriesId === seriesId))
    }
    const kind = request.pathname.match(/^\/admin\/([a-z-]+)$/)?.[1]
    if (kind && lists[kind]) {
      const tournamentId = request.url.searchParams.get("tournamentId")
      return page(
        lists[kind].filter(
          (entry) => !tournamentId || ("tournamentId" in entry.content && entry.content.tournamentId === tournamentId),
        ),
      )
    }
    return undefined
  }

  return { routes, writes, reset, games: () => games }
}
