/**
 * The recording screen of the fixture match in one page: its services in memory, a signed-in editor and a stand-in for
 * YouTube. A test file calls `studioPage()` once at the top and opens the screen with the function it returns.
 */
import { before, type TestContext } from "node:test"
import { act, type ReactNode } from "react"
import { MemoryRouter, Route, Routes } from "react-router"
import { flush, QuietResizeObserver, render, waitFor, withDom } from "./dom"
import { EDITOR, matchBackend } from "./esports-backend"
import { game, SERIES_ID, TOURNAMENT_ID } from "./esports-data"
import { holdPoll, mockYouTube } from "./esports-ui"
import { fakeBackend, json, type ApiRequest, type Handler } from "./network"
import { sessionRoutes, signIn } from "./session"

export const MATCH = `/tournaments/${TOURNAMENT_ID}/matches/${SERIES_ID}`

/** Game 1 halfway through its ban/pick phase, with no 0:00 yet: its hero search is open and empty. */
export const draftingGame = {
  ...game,
  content: {
    ...game.content,
    winner: null,
    durationSeconds: null,
    sourceTimestampSeconds: undefined,
    timeline: undefined,
    draft: { ...game.content.draft!, lockedSecond: null, turns: game.content.draft!.turns.slice(0, 10) },
  },
}

/** Stands before the services: answers a request itself, or holds it, and calls `answer` for what they would say. */
export type Gate = (request: ApiRequest, answer: () => ReturnType<Handler>) => ReturnType<Handler>

/** A write of a game: a save, a publication or a withdrawal. */
export const isGameWrite = ({ method, pathname }: ApiRequest) => method !== "GET" && /^\/admin\/games\//.test(pathname)

export function studioPage() {
  let backend = matchBackend()
  const service: { down: boolean; gate: Gate | null } = { down: false, gate: null }
  const network = fakeBackend(sessionRoutes({ communityCapabilities: EDITOR }), (request) => {
    const answer = () => (service.down ? json({ detail: "Down" }, 503) : backend.answer(request))
    return service.gate ? service.gate(request, answer) : answer()
  })
  withDom({
    url: "http://localhost:5175/tournaments",
    globals: () => ({
      fetch: network.fetch,
      ResizeObserver: QuietResizeObserver,
      CSS: { escape: (value: string) => value },
    }),
  })
  before(signIn)

  /**
   * Opens the match at an address such as `?edit=1&t=300`; `around` wraps the screen in what a test adds to it, and
   * `video` is false for a match that has none, where no player is made. `service.down` stops the services answering,
   * and `service.gate` stands before them.
   */
  return async function open(
    search: string,
    {
      around = (node: ReactNode) => node,
      video = true,
      stored = {},
      ...records
    }: Parameters<typeof matchBackend>[0] & {
      around?: (node: ReactNode) => ReactNode
      video?: boolean
      /** What this browser kept from before, such as turns typed and not saved yet. */
      stored?: Record<string, string>
    } = {},
  ) {
    backend = matchBackend(records)
    service.down = false
    service.gate = null
    localStorage.clear()
    for (const [key, value] of Object.entries(stored)) localStorage.setItem(key, value)
    const players = mockYouTube()
    const { MatchPage } = await import("../../src/features/esports/pages/match-page")
    const { client } = await render(around(<MatchPage />), {
      wrap: (node) => (
        <MemoryRouter initialEntries={[MATCH + search]}>
          <Routes>
            <Route path="/tournaments/:tournamentId/matches/:seriesId" element={node} />
          </Routes>
        </MemoryRouter>
      ),
    })
    await waitFor(() => document.querySelector(".esp-games"), "The match did not open")
    if (video) {
      await waitFor(() => players.length > 0, "The player was not made")
      await act(async () => players[0]!.events.onReady({ target: players[0]! }))
    }
    await flush()
    return { players, saves: backend.saves, games: backend.games, service, client }
  }
}

/** Presses a key on an element, or on the page when none is named; true when the page took it for itself. */
export async function press(key: string, target: EventTarget = document.body, init: KeyboardEventInit = {}) {
  const event = new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init })
  await act(async () => {
    target.dispatchEvent(event)
  })
  await flush()
  return event.defaultPrevented
}

/** What the foot of the dock says. */
export const said = () => document.querySelector(".esp-said")?.textContent ?? ""

/** Every alert on the screen, in order. */
export const alerts = () => [...document.querySelectorAll('[role="alert"]')].map((node) => node.textContent ?? "")

/** The game on the desk, as its tab says it. */
export const current = () =>
  document.querySelector('.esp-games [aria-current="true"]')?.getAttribute("aria-label") ?? ""

/** The tab of a game, counted from the first. */
export const tab = (index: number) => document.querySelectorAll(".esp-games .esp-tab")[index]

/** The second of the video the position slider stands at. */
export const clock = () => document.querySelector('[role="slider"]')!.getAttribute("aria-valuetext")

/**
 * Holds every write of a game until the test answers it: `release` answers the oldest one with the response it is
 * given, or as the services would at that moment. Other requests are answered at once.
 */
export function holdWrites(service: { gate: Gate | null }) {
  const waiting: { request: ApiRequest; answer: (response?: Response) => void }[] = []
  service.gate = (request, answer) =>
    isGameWrite(request)
      ? new Promise<Response | undefined>((resolve) =>
          waiting.push({ request, answer: (response) => resolve(response ?? answer()) }),
        )
      : answer()
  return {
    waiting,
    release: async (response?: Response) => {
      await waitFor(() => waiting.length > 0, "No write is waiting")
      await act(async () => waiting.shift()!.answer(response))
      await flush()
    },
  }
}

/**
 * Takes the readings of the player out of the clock's hands until the test ends, so the video moves only when the test
 * says; each call of the answer is one reading. Called before the screen opens.
 */
export function heldReadings(t: TestContext) {
  const timed = window.setInterval
  t.after(() => {
    window.setInterval = timed
  })
  return holdPoll()
}

/** The answer of the services to content their rules refuse. */
export const refused = () =>
  json({ code: "TOURNAMENT_INVALID_CONTENT", detail: "Invalid", fields: ["timeline.events[0]"] }, 422)
