import assert from "node:assert/strict"
import { after, test } from "node:test"
import { act, useState, type ReactNode } from "react"
import { MemoryRouter, useLocation } from "react-router"
import type { DocumentView, GameContent, SeriesContent } from "@aov/community-contracts"
import type { RecordedChange } from "../src/features/esports/model/desk"
import type { RosterOption } from "../src/features/esports/model/line-up"
import {
  answerConfirm,
  button,
  click,
  confirmDialog,
  flush,
  QuietResizeObserver,
  render,
  type,
  waitFor,
  withDom,
} from "./fixtures/dom"
import { completeGame, game, match, seat, team, view } from "./fixtures/match-records"

withDom({
  url: "http://localhost:5175/tournaments/t",
  globals: () => ({ ResizeObserver: QuietResizeObserver, CSS: { escape: (value: string) => value } }),
})

const { tournamentApi } = await import("../src/features/tournaments/api/tournament-api")
const { competitionApi } = await import("../src/features/competition/competition-api")
const { CarryOverBar } = await import("../src/features/esports/components/game/carry-over-bar")
const { NextStep } = await import("../src/features/esports/components/series/next-step")
const { createPlayhead } = await import("../src/features/esports/model/playhead")
const { EditMatchButton } = await import("../src/features/esports/pages/edit-match-button")
const { MatchPublishPanel } = await import("../src/features/esports/pages/match-publish-panel")
const { MatchSwitcher } = await import("../src/features/esports/components/series/match-switcher")
const { QuickGamesPanel } = await import("../src/features/esports/pages/quick-games-panel")
const { ScoreCheck } = await import("../src/features/esports/pages/score-check")
const { ApiError } = await import("../src/lib/api/errors")

const original = { ...tournamentApi }
const originalPlan = competitionApi.read
after(() => {
  Object.assign(tournamentApi, original)
  competitionApi.read = originalPlan
})

type Written = { kind: string; content: unknown; version?: number }
/** Answers reads with the given records and keeps what is written. */
function service(records: DocumentView<unknown>[]) {
  const written: Written[] = []
  tournamentApi.read = (async (_kind: string, id: string) =>
    records.find((record) => record.id === id)) as typeof tournamentApi.read
  tournamentApi.save = (async (kind: string, entry: DocumentView<unknown>, content: unknown) => {
    written.push({ kind, content, version: entry.version })
    return { ...entry, content, version: entry.version + 1 }
  }) as typeof tournamentApi.save
  tournamentApi.create = (async (kind: string, content: unknown) => {
    written.push({ kind, content })
    return view("new", content)
  }) as typeof tournamentApi.create
  return written
}

const routed = (node: ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>)

test("quick games are created in order with the winner clicked for each and the length typed", async () => {
  const written = service([])
  const done: string[] = []
  await render(<QuickGamesPanel series={match([2, 1])} games={[]} team={team} onDone={() => done.push("done")} />)
  await click(button("Ván 1: Azure thắng"))
  await click(button("Ván 2: Crimson thắng"))
  await type(document.querySelector<HTMLInputElement>('[aria-label="Thời lượng ván 1"]')!, "14:05")
  await click(button("Tạo 3 ván"))

  await waitFor(() => done.length === 1)
  const games = written.map((entry) => entry.content as GameContent)
  assert.deepEqual(
    games.map((content) => [content.number, content.winner, content.durationSeconds]),
    [
      [1, "BLUE", 845],
      [2, "RED", null],
      [3, "BLUE", null],
    ],
  )
})

test("quick games leave a game that already names its winner alone", async () => {
  service([])
  await render(<QuickGamesPanel series={match([2, 0])} games={[game(1, "a")]} team={team} onDone={() => {}} />)
  assert.equal(button("Ván 1: Crimson thắng")!.disabled, true)
})

test("quick games say when the picked winners give another score than the match", async () => {
  service([])
  await render(<QuickGamesPanel series={match([2, 1])} games={[]} team={team} onDone={() => {}} />)
  await click(button("Ván 1: Crimson thắng"))
  await click(button("Ván 2: Crimson thắng"))
  assert.match(document.body.textContent ?? "", /Các ván cho tỷ số 1 – 2, trận đang ghi 2 – 1/)
})

const lost = [game(1, "b"), game(2, "a"), game(3, "b"), game(4, "b")]

test("a score that differs from the games is set only after the old and the new one are confirmed", async () => {
  const record = match([3, 1])
  const written = service([record])
  await routed(<ScoreCheck record={record} games={lost} team={team} />)
  await click(button("Đặt tỷ số 1 – 3"))
  assert.match(confirmDialog()?.textContent ?? "", /3 – 1 → 1 – 3/)
  assert.equal(written.length, 0)

  await answerConfirm("Đặt tỷ số 1 – 3")
  await waitFor(() => written.length === 1)
  const result = (written[0]!.content as SeriesContent).result
  assert.deepEqual([result?.scoreA, result?.scoreB, result?.verification], [1, 3, "PRIMARY"])
})

test("a score somebody edited meanwhile is not overwritten", async () => {
  const record = match([3, 1])
  const written = service([match([3, 2])])
  await routed(<ScoreCheck record={record} games={lost} team={team} />)
  await click(button("Đặt tỷ số 1 – 3"))
  await answerConfirm("Đặt tỷ số 1 – 3")
  await waitFor(() => document.querySelector('[role="alert"]')?.textContent?.includes("vừa được sửa ở nơi khác"))
  assert.equal(written.length, 0)
})

test("games that cannot be a score of this format lead to the schedule instead", async () => {
  service([])
  const games = [game(1, "a"), game(2, "a"), game(3, "b"), game(4, "b")]
  await routed(<ScoreCheck record={match([3, 1])} games={games} team={team} />)
  assert.equal(button("Đặt tỷ số"), undefined)
  const link = [...document.querySelectorAll("a")].find((entry) => entry.textContent?.includes("Mở lịch"))
  assert.equal(link?.getAttribute("href"), "/tournaments/t?step=schedule&match=s")
})

const publishPanel = (games: DocumentView<GameContent>[], opened: string[] = []) =>
  render(
    <MatchPublishPanel
      games={games}
      team={team}
      canPublish
      beforePublish={async () => {}}
      onOpenStep={(gameId, step) => opened.push(`${gameId}:${step.id}`)}
    />,
  )

test("publishing a match lists the ready games and publishes them one after another once confirmed", async () => {
  const games = [completeGame(1, "a"), game(2, "b"), completeGame(3, "b")]
  service(games)
  const published: number[] = []
  tournamentApi.publish = async (entry) => {
    published.push(entry.content.number)
    return entry
  }
  await publishPanel(games)
  await click(button("Xuất bản 2 ván đủ dữ liệu"))
  assert.match(confirmDialog()?.textContent ?? "", /Ván 1Azure thắng.*Ván 3Crimson thắng/)
  assert.deepEqual(published, [])

  await answerConfirm("Xuất bản 2 ván")
  await waitFor(() => published.length === 2)
  assert.deepEqual(published, [1, 3])
})

test("a game that could not be published says why on its own line", async () => {
  const games = [completeGame(1, "a"), completeGame(2, "b")]
  service(games)
  tournamentApi.publish = async (entry) => {
    if (entry.content.number === 1)
      throw new ApiError({ status: 422, code: "X", ...{ missingFields: ["number.exceedsBestOf"] } })
    return entry
  }
  await publishPanel(games)
  await click(button("Xuất bản 2 ván đủ dữ liệu"))
  await answerConfirm("Xuất bản 2 ván")
  const alert = await waitFor(() => document.querySelector('[role="alert"]'))
  assert.match(alert.closest("li[data-publish]")?.textContent ?? "", /^Ván 1.*Số ván vượt quá thể thức BO/)
})

test("a missing part opens its panel in the game it belongs to", async () => {
  const opened: string[] = []
  await publishPanel([game(1, "a"), game(2)], opened)
  const line = [...document.querySelectorAll("li[data-publish]")][1]!
  await click(button("Phụ trợ", line))
  assert.deepEqual(opened, ["g2:spells"])
})

const starters: Record<string, RosterOption[]> = {
  a: [{ id: "azure-mid", name: "Mid A", lane: "MID", status: "ACTIVE" }],
  b: [{ id: "crimson-mid", name: "Mid B", lane: "MID", status: "ACTIVE" }],
}

/** The bar over one game that keeps what it records. */
function Carry({ start, previous }: { start: GameContent; previous: GameContent | null }) {
  const [content, setContent] = useState(start)
  const [done, setDone] = useState<RecordedChange | null>(null)
  return (
    <>
      <CarryOverBar
        content={content}
        previous={previous}
        roster={(teamId) => starters[teamId] ?? []}
        onRecord={(change) => {
          setContent(change.apply)
          setDone(change)
        }}
      />
      <p role="status">{done?.text}</p>
      <button type="button" onClick={() => setContent(done!.revert!)}>
        Hoàn tác
      </button>
      <output>
        {content.sides.map((side) => side.participants.map((entry) => entry.playerId ?? "-").join(",")).join(" | ")}
      </output>
    </>
  )
}
const seats = () => document.querySelector("output")!.textContent

test("both line-ups are filled from the roster in one click and the fill can be undone", async () => {
  await render(<Carry start={game(2).content} previous={null} />)
  await click(button("Điền theo đội hình đăng ký"))
  assert.equal(seats(), "-,-,azure-mid,-,- | -,-,crimson-mid,-,-")
  await click(button("Hoàn tác"))
  assert.equal(seats(), "-,-,-,-,- | -,-,-,-,-")
})

test("filling from the previous game keeps a seat already recorded", async () => {
  const previous = seat(seat(game(1), "BLUE", "MID", { playerId: "azure-mid" }), "BLUE", "TOP", { playerId: "top" })
  const start = seat(game(2), "BLUE", "MID", { playerId: "sub" })
  await render(<Carry start={start.content} previous={previous.content} />)
  await click(button("Đội hình như ván 1"))
  assert.equal(confirmDialog(), null)
  assert.equal(seats(), "top,-,sub,-,- | -,-,-,-,-")
  assert.match(document.querySelector('[role="status"]')?.textContent ?? "", /1 chỗ khác giữ nguyên/)
})

test("the bar is gone while nothing is left to fill, also where the game before differs", async () => {
  const previous = seat(game(1), "BLUE", "MID", { playerId: "azure-mid" })
  const start = seat(game(2), "BLUE", "MID", { playerId: "azure-mid" })
  const other = seat(start, "RED", "MID", { playerId: "crimson-mid" })
  const differs = seat(previous, "RED", "MID", { playerId: "crimson-sub" })
  await render(<Carry start={other.content} previous={differs.content} />)
  assert.equal(document.querySelector('[aria-label="Điền nhanh hai đội"]'), null)
})

test("the next step names the second it would write, and where it is refused says why instead of writing", async () => {
  const playhead = createPlayhead(599)
  const run: unknown[] = []
  const refused: string[] = []
  await render(
    <NextStep
      playhead={playhead}
      read={() => {
        const second = Math.floor(playhead.get())
        const refusal = second < 600 ? "Đang trong ván 1." : null
        const action = { kind: "create" as const, number: 2, second }
        return { outlined: false, lead: 0, buttons: [{ label: "Cấm chọn ván 2", second, refusal, action }] }
      }}
      pending={false}
      keycap
      onRun={(action) => run.push(action)}
      onRefuse={(why) => refused.push(why)}
    />,
  )
  assert.equal(button("Cấm chọn ván 2")!.getAttribute("aria-disabled"), "true")
  await click(button("Cấm chọn ván 2"))
  assert.deepEqual([run, refused], [[], ["Đang trong ván 1."]])

  await act(async () => playhead.set(605))
  assert.match(button("Cấm chọn ván 2")!.textContent ?? "", /▸10:05/)
  await click(button("Cấm chọn ván 2"))
  assert.deepEqual(run, [{ kind: "create", number: 2, second: 605 }])
})

const schedule = ["early", "middle", "late"].map((id, index) =>
  match(undefined, { scheduledAt: `2026-09-1${index}T10:00:00Z` }, id),
)
function Where() {
  const { pathname, search } = useLocation()
  return <output>{pathname + search}</output>
}
const press = async (key: string, target: EventTarget = window) => {
  await act(async () => {
    target.dispatchEvent(new window.KeyboardEvent("keydown", { key, shiftKey: true, bubbles: true, cancelable: true }))
  })
  await flush()
}
const switcher = (editing: boolean) =>
  routed(
    <>
      <MatchSwitcher records={schedule} seriesId="middle" team={team} editing={editing} />
      <input aria-label="Ô đang gõ" />
      <Where />
    </>,
  )

test("Shift + N opens the next match and keeps the recording mode", async () => {
  await switcher(true)
  await press("N")
  assert.equal(seats(), "/tournaments/t/matches/late?edit=1")
})

test("Shift + P opens the previous match, read-only when it was read-only", async () => {
  await switcher(false)
  await press("P")
  assert.equal(seats(), "/tournaments/t/matches/early")
})

test("a capital letter typed in a field does not leave the match", async () => {
  await switcher(true)
  await press("N", document.querySelector('[aria-label="Ô đang gõ"]')!)
  assert.equal(seats(), "/")
})

const planned = (seriesIds: string[]) => {
  competitionApi.read = (async () => ({
    content: { plan: { matches: seriesIds.map((seriesId) => ({ seriesId })) } },
  })) as unknown as typeof competitionApi.read
}

test("a match of the schedule is edited on its line there", async () => {
  planned(["s"])
  await routed(<EditMatchButton record={match([3, 1])} actorKey="editor" />)
  const link = await waitFor(() => document.querySelector('a[aria-label="Sửa trong lịch"]'))
  assert.equal(link.getAttribute("href"), "/tournaments/t?step=schedule&match=s")
})

test("a match outside the schedule keeps the form of its own record", async () => {
  planned(["another"])
  await routed(<EditMatchButton record={match([3, 1])} actorKey="editor" />)
  await waitFor(() => button("Sửa trận")?.disabled === false)
  assert.equal(document.querySelector("a"), null)
})
