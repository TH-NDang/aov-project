import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Link, MemoryRouter, Route, Routes } from "react-router"
import "@aov/ui/styles.css"
import type { DocumentView, GameContent } from "@aov/community-contracts"
import { EDITOR, matchBackend } from "./esports-backend"
import * as data from "./esports-data"
import { fakeBackend, json } from "./network"

/*
 * The recording screen over the fixture match. Every request is answered here; this page never reads or writes real
 * tournament data. Options in its address: `view` opens it for viewing, `start` names another address of the app, and
 * `match` another state of the match.
 */
const options = new URLSearchParams(location.search)

const without = (entry: DocumentView<GameContent>, change: Partial<GameContent>): DocumentView<GameContent> => ({
  ...entry,
  content: { ...entry.content, ...change },
})
const unlinked = data.series.map((entry) => ({ ...entry, content: { ...entry.content, sourceUrl: undefined } }))
const noVideo = (entry: DocumentView<GameContent>) =>
  without(entry, { sourceUrl: undefined, sourceTimestampSeconds: undefined })
const drafting = without(data.game2, {
  winner: null,
  durationSeconds: null,
  sourceTimestampSeconds: undefined,
  sides: data.game2.content.sides.map((side) => ({
    ...side,
    bans: side.bans.map(() => ({ id: null, name: null })),
    participants: side.participants.map((entry) => ({ ...entry, hero: { id: null, name: null } })),
  })),
  draft: { startSecond: 1500, lockedSecond: null, turns: [] },
})

/** States of the match a person may want to look at. */
const STATES: Record<string, Parameters<typeof matchBackend>[0]> = {
  // Nothing is recorded yet, with and without a video.
  new: { games: [] },
  "new-unlinked": { games: [], series: unlinked },
  // Games without any video.
  unlinked: { games: [noVideo(data.game), noVideo(data.game2)], series: unlinked },
  // Game 2 is being drafted; game 1 is being played.
  drafting: { games: [data.game, drafting] },
  live: { games: [without(data.game, { winner: null, durationSeconds: null })] },
  // Line-ups that were imported without turns and without a place in the video.
  imported: {
    games: [without(data.game, { draft: undefined, timeline: undefined, sourceTimestampSeconds: undefined })],
  },
  // Each game has a video of its own.
  videos: { games: [data.game, without(data.game2, { sourceUrl: "https://youtu.be/j8AvYygkzm4" })] },
  // The video of the match is not on YouTube any more.
  gone: { games: [without(data.game, { sourceUrl: "https://youtu.be/aaaaaaaaaaa" })], series: unlinked },
  // The winners of the games contradict the score of the match.
  score: {
    series: data.series.map((entry) =>
      entry.id === data.SERIES_ID
        ? { ...entry, content: { ...entry.content, result: { ...entry.content.result!, scoreA: 1, scoreB: 3 } } }
        : entry,
    ),
  },
  // The second game starts before the first one ends.
  clash: { games: [data.game, without(data.game2, { sourceTimestampSeconds: 1200, draft: undefined })] },
}

const match = matchBackend(STATES[options.get("match") ?? ""])
const backend = fakeBackend((request) => {
  if (request.pathname === "/auth/refresh") return json({ accessToken: "fixture-only", expiresIn: 3600 })
  if (request.pathname === "/admin/me")
    return json(
      request.service === "community"
        ? { capabilities: EDITOR }
        : {
            issuer: "fixture",
            subject: "editor",
            type: "HUMAN",
            displayName: "UI fixture",
            capabilities: ["catalog:read"],
          },
    )
  if (request.pathname === "/users/me") return json({ locale: "vi-VN" })
  return match.answer(request)
})
window.fetch = backend.fetch

const { verifySession } = await import("../../src/app/auth/session")
await verifySession()
const { ConfirmDialogHost } = await import("../../src/components/confirm-dialog")
const { TournamentHubPage } = await import("../../src/features/esports/pages/tournament-hub-page")
const { MatchPage } = await import("../../src/features/esports/pages/match-page")
const { GamePage } = await import("../../src/features/esports/pages/game-page")
const matchPage = `/tournaments/${data.TOURNAMENT_ID}/matches/${data.SERIES_ID}`
const start = options.get("start") ?? `${matchPage}${options.has("view") ? "" : "?edit=1"}`

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[start]}>
      <main className="flex h-svh flex-col overflow-hidden bg-background text-foreground">
        <div className="border-b bg-muted/40 px-4 py-2 text-xs">
          Kiểm thử UI · dữ liệu giả lập · không ghi dữ liệu thật
          <Link className="ml-3 underline" to="/tournaments">
            Giải đấu
          </Link>
          <Link className="ml-3 underline" to={matchPage}>
            Trang trận
          </Link>
        </div>
        {/* The same region Admin gives its pages. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
          <Routes>
            <Route path="/tournaments" element={<TournamentHubPage />} />
            <Route path="/tournaments/:tournamentId/matches/:seriesId" element={<MatchPage />} />
            <Route path="/tournaments/:tournamentId/matches/:seriesId/games/:gameId" element={<GamePage />} />
          </Routes>
        </div>
      </main>
      <ConfirmDialogHost />
    </MemoryRouter>
  </QueryClientProvider>,
)
