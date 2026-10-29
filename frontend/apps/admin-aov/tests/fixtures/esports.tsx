import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Link, MemoryRouter, Route, Routes } from "react-router"
import "@aov/ui/styles.css"
import * as data from "./esports-data"

// Every request is answered here; this page never reads or writes real tournament data.
const lists: Record<string, { id: string }[]> = {
  teams: data.teams,
  players: data.players,
  tournaments: [data.tournament],
  series: data.series,
  "roster-memberships": data.rosters,
}
const page = <T,>(items: T[]) => Response.json({ items, totalElements: items.length, page: 0, size: 100 })
// Games live in memory so recording on the page exercises the same versioned save flow as the real API.
const games = [data.game, data.game2]
window.fetch = async (input, init) => {
  const url = new URL(String(input), location.origin)
  const path = url.pathname.replace(/^\/api\/(wiki|community)\/v1/, "")
  const gameId = path.match(/^\/admin\/games\/([\w-]+)$/)?.[1]
  if (gameId && init?.method === "PUT") {
    const index = games.findIndex((entry) => entry.id === gameId)
    const body = JSON.parse(String(init.body)) as { version: number; content: (typeof games)[number]["content"] }
    if (index < 0) return Response.json({ detail: "Missing game" }, { status: 404 })
    if (games[index].version !== body.version)
      return Response.json({ code: "TOURNAMENT_VERSION_CONFLICT", detail: "Version conflict" }, { status: 409 })
    games[index] = {
      ...games[index],
      version: body.version + 1,
      content: body.content,
      updatedAt: new Date().toISOString(),
    }
    return Response.json(games[index])
  }
  const publishing = path.match(/^\/admin\/games\/([\w-]+)\/publish$/)?.[1]
  if (publishing && init?.method === "POST") {
    const index = games.findIndex((entry) => entry.id === publishing)
    const body = JSON.parse(String(init.body)) as { version: number }
    if (index < 0) return Response.json({ detail: "Missing game" }, { status: 404 })
    if (games[index].version !== body.version)
      return Response.json({ code: "TOURNAMENT_VERSION_CONFLICT", detail: "Version conflict" }, { status: 409 })
    const now = new Date().toISOString()
    games[index] = { ...games[index], version: body.version + 1, publishedAt: now, updatedAt: now }
    return Response.json(games[index])
  }
  if (init?.method && init.method !== "GET" && !path.startsWith("/auth"))
    return Response.json({ detail: "UI fixture is read-only" }, { status: 405 })
  if (path === "/auth/refresh") return Response.json({ accessToken: "fixture-only", expiresIn: 3600 })
  if (url.pathname.startsWith("/api/community/v1/admin/me"))
    return Response.json({ capabilities: ["tournament:read", "tournament:write", "tournament:publish"] })
  if (path === "/admin/me")
    return Response.json({
      issuer: "fixture",
      subject: "editor",
      type: "HUMAN",
      displayName: "UI fixture",
      capabilities: ["catalog:read"],
    })
  if (path === "/users/me") return Response.json({ locale: "vi-VN" })
  if (url.pathname === "/api/wiki/v1/admin/reference-catalog") return Response.json({ items: data.references })
  if (url.pathname === "/api/community/v1/admin/reference-catalog") return page([])
  if (path === "/admin/catalog") return Response.json(data.catalog)
  if (path === "/admin/games") {
    const seriesId = url.searchParams.get("seriesId")
    return page(games.filter((entry) => !seriesId || entry.content.seriesId === seriesId))
  }
  const kind = path.match(/^\/admin\/([a-z-]+)$/)?.[1]
  if (kind && lists[kind]) {
    const tournamentId = url.searchParams.get("tournamentId")
    return page(
      lists[kind].filter(
        (entry) =>
          !tournamentId || (entry as { content: { tournamentId?: string } }).content.tournamentId === tournamentId,
      ),
    )
  }
  return Response.json({ detail: `Fixture has no ${path}` }, { status: 404 })
}

const options = new URLSearchParams(location.search)

const { verifySession } = await import("../../src/app/auth/session")
await verifySession()
const { TournamentHubPage } = await import("../../src/features/esports/pages/tournament-hub-page")
const { TournamentPage } = await import("../../src/features/esports/pages/tournament-page")
const { MatchPage } = await import("../../src/features/esports/pages/match-page")
const { GamePage } = await import("../../src/features/esports/pages/game-page")
const start =
  options.get("start") ??
  `/tournaments/${data.TOURNAMENT_ID}/matches/${data.SERIES_ID}${options.has("view") ? "" : "?edit=1"}`

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[start]}>
      <main className="min-h-svh bg-background text-foreground">
        <div className="border-b bg-muted/40 px-4 py-2 text-xs">
          Kiểm thử UI · dữ liệu giả lập · không ghi dữ liệu thật
          <Link className="ml-3 underline" to="/tournaments">
            Giải đấu
          </Link>
          <Link className="ml-3 underline" to={`/tournaments/${data.TOURNAMENT_ID}`}>
            Trang giải
          </Link>
          <Link className="ml-3 underline" to={`/tournaments/${data.TOURNAMENT_ID}/matches/${data.SERIES_ID}`}>
            Trang trận
          </Link>
        </div>
        <Routes>
          <Route path="/tournaments" element={<TournamentHubPage />} />
          <Route path="/tournaments/:tournamentId" element={<TournamentPage />} />
          <Route path="/tournaments/:tournamentId/matches/:seriesId" element={<MatchPage />} />
          <Route path="/tournaments/:tournamentId/matches/:seriesId/games/:gameId" element={<GamePage />} />
        </Routes>
      </main>
    </MemoryRouter>
  </QueryClientProvider>,
)
