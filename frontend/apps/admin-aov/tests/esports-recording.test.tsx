import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import { MemoryRouter } from "react-router"
import type { GameContent } from "@aov/community-contracts"
import type { TimelineEvent } from "../src/features/esports/model/timeline"
import { deskOf, emptyGame, recordedGame, selection } from "./fixtures/esports-desk"
import { inPage, popoverGlobals, settle, type, button, game } from "./fixtures/esports-ui"

test("recording a moment takes the broadcast position and stores the game clock", async () => {
  await inPage(async (document, render) => {
    const { EventComposer } = await import("../src/features/esports/components/game/event-composer")
    const { gameToVideo, videoToGame } = await import("../src/features/esports/model/vod")
    const sync = { url: "", startSecond: 1800, pauses: [{ atSeconds: 300, durationSeconds: 60 }] }
    const saved: TimelineEvent[] = []
    await render(
      <EventComposer
        game={game}
        at={100}
        video={{
          now: 2000,
          toVideo: (second) => gameToVideo(sync, second)!,
          toGame: (second) => (second < 1800 ? null : videoToGame(sync, second)),
        }}
        knownDuration={900}
        items={[]}
        initialKind="NOTE"
        snapshotsFor={() => []}
        events={[]}
        onSave={(event) => saved.push(event)}
        onCancel={() => {}}
      />,
    )
    const time = document.querySelector<HTMLInputElement>('input[inputmode="numeric"]')!
    assert.equal(time.value, "33:20", "a new moment starts at the player position")
    assert.equal(time.getAttribute("aria-label"), "Lúc, mốc video")
    assert.match(document.body.textContent ?? "", /3:20 trong ván/)

    type(time, "37:00")
    type(document.querySelector<HTMLInputElement>('input[placeholder^="Ví dụ"]')!, "Giao tranh Rồng")
    await settle()
    const window = document.defaultView!
    await act(async () =>
      document.querySelector("form")!.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })),
    )
    assert.equal(saved[0]?.at, 360, "37:00 in the video is 6:00 of game time after the one-minute pause")

    type(time, "29:00")
    await settle()
    assert.match(document.body.textContent ?? "", /trước khi ván 1 bắt đầu/)
    assert.equal(button(document, "Lưu diễn biến").disabled, true)
  }, popoverGlobals)
})

test("pauses and the end of a game are entered as broadcast positions", async () => {
  await inPage(async (document, render) => {
    const { GameTool } = await import("../src/features/esports/pages/tools/game-tool")
    const desk = deskOf({ content: recordedGame({ sourceTimestampSeconds: 1800, durationSeconds: 900 }), at: 2100 })
    await render(
      <MemoryRouter>
        <desk.kept.Host>
          {(current) => <GameTool desk={current} target={null} issues={[]} onVideo={() => {}} />}
        </desk.kept.Host>
      </MemoryRouter>,
    )
    const pauses = document.querySelector('[role="group"][aria-label="Tạm dừng"]')!
    await act(async () => [...pauses.querySelectorAll("button")].find((entry) => entry.textContent === "Lấy")!.click())
    assert.equal(document.querySelector<HTMLInputElement>('[aria-label="Mốc video bắt đầu tạm dừng"]')!.value, "35:00")
    type(document.querySelector<HTMLInputElement>('[aria-label="Mốc video tiếp tục ván"]')!, "36:30")
    await settle()
    await act(async () => button(document, "Thêm").click())
    assert.deepEqual(desk.kept.content().timeline?.pauses, [{ atSeconds: 300, durationSeconds: 90 }])
    await settle()
    const end = document.querySelector('[role="group"][aria-label="Kết thúc"]')!
    assert.match(end.textContent ?? "", /15:00/, "the length stays; the end moves by the pause")
    assert.match(end.textContent ?? "", /▸46:30/)
  }, popoverGlobals)
})

test("a game is closed in the game tool: its end and its winner are recorded each on its own", async () => {
  await inPage(async (document, render) => {
    const { GameTool } = await import("../src/features/esports/pages/tools/game-tool")
    const draw = async (change: Partial<GameContent>, at = 2700) => {
      const desk = deskOf({ content: recordedGame({ sourceTimestampSeconds: 1800, draft: undefined, ...change }), at })
      await render(
        <MemoryRouter>
          <desk.kept.Host key={JSON.stringify([change, at])}>
            {(current) => <GameTool desk={current} target={null} issues={[]} onVideo={() => {}} />}
          </desk.kept.Host>
        </MemoryRouter>,
      )
      return desk.kept
    }
    const row = (label: string) => document.querySelector<HTMLElement>(`[role="group"][aria-label="${label}"]`)!
    const winner = (name: string) =>
      [...row("Đội thắng ván 2").querySelectorAll<HTMLButtonElement>("[aria-pressed]")].find((entry) =>
        entry.textContent?.includes(name),
      )!
    const take = () =>
      [...row("Kết thúc").querySelectorAll("button")].find((entry) => entry.textContent?.startsWith("Lấy"))!

    // A game with no end yet ends where the video is being watched: 45:00, fifteen minutes after its start.
    const open = await draw({ durationSeconds: null, winner: null })
    assert.match(take().textContent ?? "", /▸45:00/)
    await act(async () => take().click())
    await settle()
    assert.deepEqual([open.content().durationSeconds, open.content().winner ?? null], [900, null])
    await act(async () => winner("CRI").click())
    await settle()
    assert.deepEqual([open.content().durationSeconds, open.content().winner], [900, "RED"])
    assert.equal(winner("CRI").getAttribute("aria-pressed"), "true")

    // An end before the start is refused in words.
    const early = await draw({ durationSeconds: 900, winner: "RED" }, 1740)
    await act(async () => take().click())
    assert.equal(early.content().durationSeconds, 900)
    assert.match(early.said.at(-1) ?? "", /Ván phải kết thúc sau lúc vào trận/)

    // Without a position in the video the winner alone can still be recorded.
    const unplaced = await draw({ sourceTimestampSeconds: undefined, durationSeconds: null, winner: null })
    assert.equal(document.querySelector<HTMLInputElement>('[aria-label="Thời lượng ván"]')!.value, "")
    await act(async () => winner("AZU").click())
    await settle()
    assert.deepEqual([unplaced.content().durationSeconds ?? null, unplaced.content().winner], [null, "BLUE"])
  }, popoverGlobals)
})

test("ban/pick turns are recorded per team in order and only suggest heroes the rules still allow", async () => {
  await inPage(async (document, render) => {
    const { DraftTool } = await import("../src/features/esports/pages/tools/draft-tool")
    const names = ["Florentino", "Aoi", "Murad", "Lauriel", "Nakroth", "Capheny", "Elsu", "Omen"]
    const turn = (order: number, side: "BLUE" | "RED", name: string, atSecond: number) => ({
      order,
      kind: "BAN" as const,
      side,
      hero: selection(name),
      atSecond,
    })
    const desk = deskOf({
      content: emptyGame({
        draft: {
          startSecond: 100,
          lockedSecond: null,
          turns: [
            turn(1, "BLUE", "Aoi", 110),
            turn(2, "RED", "Nakroth", 112),
            turn(3, "BLUE", "Capheny", 114),
            turn(4, "RED", "Elsu", 116),
          ],
        },
      }),
      heroes: names.map((name) => ({ ...selection(name), code: name.toLowerCase() })),
      locks: {
        decider: false,
        byTeam: new Map([["a", [{ gameNumber: 1, hero: selection("Florentino") }]]]),
      },
      at: 130,
    })
    await render(<desk.kept.Host>{(current) => <DraftTool desk={current} />}</desk.kept.Host>)
    assert.ok(document.querySelector('[aria-label="Tướng Azure đã dùng ở ván trước"]'), "game 2 shows game 1 picks")

    // Turn 5 is Azure's first pick: no hero banned this game and none Azure played in game 1.
    assert.match(document.querySelector(".esp-draft-ask")?.textContent ?? "", /Lượt 5AZU chọn/)
    const options = [...document.querySelectorAll('[role="option"]')].map((option) => option.getAttribute("title"))
    assert.deepEqual(options, ["Murad", "Lauriel", "Omen"])
    const search = document.querySelector<HTMLInputElement>("[data-hero-search]")!
    type(search, "florentino")
    await settle()
    assert.equal(document.querySelector('[role="alert"]')?.textContent, "Florentino: AZU đã dùng ở ván 1.")
    type(search, "")
    await settle()
    await act(async () => document.querySelector<HTMLElement>('[role="option"][title="Murad"]')!.click())
    await settle()

    const next = desk.kept.content()
    assert.deepEqual(next.draft!.turns.at(-1), {
      order: 5,
      kind: "PICK",
      side: "BLUE",
      hero: selection("Murad"),
      atSecond: 130,
    })
    assert.deepEqual(
      next.sides[0]!.bans.map((ban) => ban.name),
      ["Aoi", "Capheny", null, null],
      "bans follow the team's ban turns",
    )
    assert.equal(next.sides[0]!.participants[0]!.hero.name, "Murad", "a new pick takes the first empty lane for now")
    assert.equal(next.sides[0]!.participants[0]!.playerId ?? null, null, "picks are not tied to a player")
  }, popoverGlobals)
})

test("the progress panel opens the step to fix and confirms only after a summary", async () => {
  await inPage(async (document, render) => {
    const { ProgressPanel } = await import("../src/features/esports/pages/progress-panel")
    const opened: string[] = []
    let confirmed = 0
    const progress = {
      done: 5,
      total: 5,
      state: "ready" as const,
      publishable: true,
      missing: [],
      steps: [
        {
          id: "spells",
          label: "Phụ trợ",
          detail: "10/10",
          status: "done" as const,
          required: true,
          target: "loadout" as const,
        },
        {
          id: "arcana",
          label: "Bảng ngọc",
          detail: "Chưa ghi",
          status: "todo" as const,
          required: false,
          target: "loadout" as const,
        },
      ],
    }
    await render(
      <ProgressPanel
        progress={progress}
        game={game}
        content={{ sides: [] }}
        canPublish
        onOpen={(step) => opened.push(step.id)}
        onConfirm={async () => {
          confirmed++
          return true
        }}
      />,
    )
    await act(async () => document.querySelector<HTMLElement>('[data-step="arcana"]')!.click())
    assert.deepEqual(opened, ["arcana"])
    assert.match(document.body.textContent ?? "", /tùy nguồn/)

    await act(async () => button(document, "Xuất bản ván 1").click())
    await settle()
    assert.equal(confirmed, 0, "a question first shows what will be published")
    assert.match(document.querySelector('[role="alertdialog"]')?.textContent ?? "", /Azure/)
    const answer = document.querySelector('[role="alertdialog"]')!
    await act(async () =>
      [...answer.querySelectorAll("button")].find((entry) => entry.textContent === "Xuất bản")!.click(),
    )
    await settle()
    assert.equal(confirmed, 1)
  }, popoverGlobals)
})

test("the schedule strip shows each game's progress, games nobody recorded and opens the right game", async () => {
  await inPage(async (document, render) => {
    const { MatchRecordingStrip } = await import("../src/features/esports/components/match-recording-strip")
    const progress = (state: "recording" | "confirmed", done: number) => ({
      steps: [],
      done,
      total: 6,
      state,
      publishable: done === 6,
      missing: [],
    })
    const opened: (string | undefined)[] = []
    await render(
      <MatchRecordingStrip
        recording={{
          state: "missing",
          expected: 4,
          confirmed: 1,
          games: [
            { id: "g1", number: 1, progress: progress("confirmed", 6) },
            { id: "g3", number: 3, progress: progress("recording", 4) },
          ],
          gaps: [
            { text: "Thiếu 2/4 ván", kind: "missing" },
            { text: "Ván 3: thiếu kết quả", kind: "missing", gameId: "g3" },
          ],
        }}
        onOpen={(gameId) => opened.push(gameId)}
      />,
    )
    const text = document.body.textContent ?? ""
    assert.match(text, /Cần bổ sung/)
    assert.match(text, /V1Đã xuất bản/)
    assert.match(text, /V34\/6/)
    assert.match(text, /V2 chưa ghi/, "the first unrecorded number is game 2")
    assert.match(text, /V4 chưa ghi/)
    await act(async () => button(document, "Ván 3: thiếu kết quả").click())
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Mở ván 1"]')!.click())
    assert.deepEqual(opened, ["g3", "g1"])
  })
})
