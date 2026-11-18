import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import type { GameContent } from "@aov/community-contracts"
import type { TimelineEvent } from "../src/features/esports/model/timeline"
import { inPage, popoverGlobals, settle, type, button, team, game } from "./fixtures/esports-ui"

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
    assert.match(document.body.textContent ?? "", /Mốc video/)
    assert.match(document.body.textContent ?? "", /Lưu thành ⏱3:20 trong ván 1/)

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
    assert.equal(button(document, "Lưu sự kiện").disabled, true)
  }, popoverGlobals)
})

test("pauses and the end of a game are entered as broadcast positions", async () => {
  await inPage(async (document, render) => {
    const { VodSyncPanel } = await import("../src/features/esports/components/game/vod-sync-panel")
    const changes: unknown[] = []
    const teams = { BLUE: game.sides.BLUE.team, RED: game.sides.RED.team }
    await render(
      <VodSyncPanel
        url=""
        startSecond={1800}
        pauses={[]}
        recordedDuration={900}
        gameAt={100}
        videoNow={2100}
        number={1}
        teams={teams}
        winner="BLUE"
        onChange={(change) => changes.push(change)}
      />,
    )
    assert.equal(document.querySelector<HTMLInputElement>('[aria-label="Mốc video bắt đầu tạm dừng"]')!.value, "35:00")
    type(document.querySelector<HTMLInputElement>('[aria-label="Mốc video tiếp tục ván"]')!, "36:30")
    await settle()
    await act(async () => button(document, "Thêm").click())
    assert.deepEqual(changes.at(-1), { pauses: [{ atSeconds: 300, durationSeconds: 90 }] })
    assert.match(document.body.textContent ?? "", /Thời lượng ván ⏱15:00/)
  }, popoverGlobals)
})

test("a game is closed in the video panel: its end and its winner are saved together, only when changed", async () => {
  await inPage(async (document, render) => {
    const { VodSyncPanel } = await import("../src/features/esports/components/game/vod-sync-panel")
    const changes: unknown[] = []
    const teams = { BLUE: game.sides.BLUE.team, RED: game.sides.RED.team }
    const panel = (recordedDuration: number | null, winner: "BLUE" | "RED" | null, startSecond: number | null) => (
      <VodSyncPanel
        key={`${recordedDuration}-${winner}-${startSecond}`}
        url=""
        startSecond={startSecond}
        pauses={[]}
        recordedDuration={recordedDuration}
        gameAt={100}
        videoNow={2700}
        number={2}
        teams={teams}
        winner={winner}
        focus="end"
        onChange={(change) => changes.push(change)}
      />
    )
    const end = () => document.querySelector<HTMLFieldSetElement>("[data-game-end]")!
    const save = () => button(document, "Lưu kết thúc ván")
    const winner = (name: string) =>
      [...end().querySelectorAll<HTMLButtonElement>("[aria-pressed]")].find((entry) =>
        entry.textContent?.includes(name),
      )!

    // A game with no end yet ends where the video is being watched: 45:00, fifteen minutes after its start.
    await render(panel(null, null, 1800))
    assert.match(end().textContent ?? "", /Kết thúc ván 2/)
    assert.equal(end().querySelector<HTMLInputElement>("input")!.value, "45:00")
    assert.match(end().textContent ?? "", /Thời lượng ván ⏱15:00/)
    await act(async () => winner("Crimson").click())
    await act(async () => save().click())
    assert.deepEqual(changes.at(-1), { duration: 900, winner: "RED" })

    // A recorded game shows what is stored; nothing can be saved until something differs.
    await render(panel(900, "RED", 1800))
    assert.equal(winner("Crimson").getAttribute("aria-pressed"), "true")
    assert.equal(save().disabled, true)
    type(end().querySelector<HTMLInputElement>("input")!, "44:00")
    await settle()
    await act(async () => save().click())
    assert.deepEqual(changes.at(-1), { duration: 840 }, "the winner is not sent again when it did not change")
    type(end().querySelector<HTMLInputElement>("input")!, "29:00")
    await settle()
    assert.equal(save().disabled, true, "an end before the start cannot be saved")
    assert.match(end().textContent ?? "", /Mốc kết thúc phải sau mốc bắt đầu/)

    // Without a position in the video the length is typed, and the winner alone can still be recorded.
    await render(panel(null, null, null))
    assert.equal(end().querySelector<HTMLInputElement>("input")!.value, "")
    await act(async () => winner("Azure").click())
    await act(async () => save().click())
    assert.deepEqual(changes.at(-1), { winner: "BLUE" })
  }, popoverGlobals)
})

test("ban/pick turns are recorded per team in order and only suggest heroes the rules still allow", async () => {
  await inPage(async (document, render) => {
    const { DraftEditor } = await import("../src/features/esports/components/game/draft-editor")
    const lanes = ["TOP", "JUNGLE", "MID", "DRAGON", "SUPPORT"] as const
    const empty = { id: null, name: null }
    const sideOf = (code: "BLUE" | "RED", teamId: string) => ({
      side: code,
      teamId,
      bans: [empty, empty, empty, empty],
      participants: lanes.map((lane) => ({
        lane,
        hero: empty,
        spell: empty,
        arcana: { status: "UNKNOWN" as const, entries: [] },
        enchantments: { status: "UNKNOWN" as const, entries: [] },
        equipmentSnapshots: [],
        equipmentEvents: [],
      })),
    })
    const pick = (name: string) => ({ id: name.toLowerCase(), name })
    const content = {
      seriesId: "s",
      number: 2,
      region: "VN",
      locale: "vi-VN",
      sides: [sideOf("BLUE", "a"), sideOf("RED", "b")],
      draft: {
        startSecond: 100,
        lockedSecond: null,
        turns: [
          { order: 1, kind: "BAN" as const, side: "BLUE" as const, hero: pick("Aoi"), atSecond: 110 },
          { order: 2, kind: "BAN" as const, side: "RED" as const, hero: pick("Nakroth"), atSecond: 112 },
          { order: 3, kind: "BAN" as const, side: "BLUE" as const, hero: pick("Capheny"), atSecond: 114 },
          { order: 4, kind: "BAN" as const, side: "RED" as const, hero: pick("Elsu"), atSecond: 116 },
        ],
      },
    }
    const heroes = ["Florentino", "Aoi", "Murad", "Lauriel", "Nakroth", "Capheny", "Elsu", "Omen"].map((name) => ({
      ...pick(name),
      code: name.toLowerCase(),
    }))
    const locks = {
      decider: false,
      byTeam: new Map([["a", [{ gameNumber: 1, hero: { id: "florentino", name: "Florentino" } }]]]),
    }
    const results: (typeof content)[] = []
    await render(
      <DraftEditor
        content={content}
        view={{
          ...game,
          sides: {
            BLUE: { ...game.sides.BLUE, team: team("a", "Azure") },
            RED: { ...game.sides.RED, team: team("b", "Crimson") },
          },
        }}
        heroes={heroes}
        spells={[]}
        roster={() => []}
        locks={locks}
        videoNow={130}
        onChange={(change) => results.push(change(content) as typeof content)}
      />,
    )
    assert.ok(document.querySelector('[aria-label="Tướng Azure đã dùng ở ván trước"]'), "game 2 shows game 1 picks")

    // Turn 5 is Azure's first pick: no hero banned this game and none Azure played in game 1.
    await act(async () => document.querySelector<HTMLElement>('[aria-label^="Lượt 5 · Chọn · Azure"]')!.click())
    await settle()
    const options = [...document.querySelectorAll('[role="option"]')].map(
      (option) => option.lastElementChild?.textContent,
    )
    assert.deepEqual(options, ["Murad", "Lauriel", "Omen"])
    type(document.querySelector<HTMLInputElement>('[aria-label^="Tìm lượt 5"]')!, "florentino")
    await settle()
    assert.match(document.querySelector('[role="alert"]')?.textContent ?? "", /Azure đã dùng ở ván 1/)
    type(document.querySelector<HTMLInputElement>('[aria-label^="Tìm lượt 5"]')!, "")
    await settle()
    await act(async () =>
      [...document.querySelectorAll<HTMLElement>('[role="option"]')]
        .find((option) => option.textContent?.includes("Murad"))!
        .click(),
    )

    const next = results.at(-1)!
    assert.deepEqual(next.draft.turns.at(-1), {
      order: 5,
      kind: "PICK",
      side: "BLUE",
      hero: pick("Murad"),
      atSecond: 130,
    })
    assert.deepEqual(
      next.sides[0]!.bans.map((ban) => ban.name),
      ["Aoi", "Capheny", null, null],
      "bans follow the team's ban turns",
    )
    assert.equal(next.sides[0]!.participants[0]!.hero.name, "Murad", "a new pick takes the first empty lane for now")
    assert.equal(
      (next.sides[0]!.participants[0] as { playerId?: string | null }).playerId,
      undefined,
      "picks are not tied to a player",
    )
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
        canPublish
        onOpen={(target) => opened.push(target)}
        onConfirm={async () => {
          confirmed++
          return true
        }}
      />,
    )
    await act(async () => document.querySelector<HTMLElement>('[data-step="arcana"]')!.click())
    assert.deepEqual(opened, ["loadout"])
    assert.match(document.body.textContent ?? "", /tùy nguồn/)

    await act(async () => button(document, "Xác nhận hoàn tất ván 1").click())
    await settle()
    assert.equal(confirmed, 0, "confirming first shows what will be published")
    assert.match(document.querySelector('[role="alertdialog"]')?.textContent ?? "", /Azure/)
    await act(async () => button(document, "Xác nhận và xuất bản").click())
    await settle()
    assert.equal(confirmed, 1)
  }, popoverGlobals)
})

test("the loadout panel marks a whole team at the broadcast moment and keeps unknown loadouts apart", async () => {
  await inPage(async (document, render) => {
    const { LoadoutPanel } = await import("../src/features/esports/pages/loadout-panel")
    const lanes = ["TOP", "JUNGLE", "MID", "DRAGON", "SUPPORT"] as const
    const empty = { id: null, name: null }
    const sideOf = (code: "BLUE" | "RED") => ({
      side: code,
      teamId: code,
      bans: [],
      participants: lanes.map((lane, index) => ({
        lane,
        hero: { id: null, name: `Hero ${index}` },
        spell: empty,
        arcana: index === 0 ? { status: "KNOWN" as const, entries: [] } : { status: "UNKNOWN" as const, entries: [] },
        enchantments: { status: "UNKNOWN" as const, entries: [] },
        equipmentSnapshots: [],
        equipmentEvents: [],
      })),
    })
    const content: GameContent = {
      seriesId: "s",
      number: 1,
      region: "VN",
      locale: "vi-VN",
      sides: [sideOf("BLUE"), sideOf("RED")],
    }
    const results: GameContent[] = []
    const fiveSeats = (side: "BLUE" | "RED") =>
      lanes.map((lane, index) => ({
        ...game.sides[side].seats[0]!,
        key: `${side}:${lane}` as const,
        lane,
        playerName: `P${index}`,
      }))
    await render(
      <LoadoutPanel
        content={content}
        view={{
          ...game,
          sides: {
            BLUE: { ...game.sides.BLUE, seats: fiveSeats("BLUE") },
            RED: { ...game.sides.RED, seats: fiveSeats("RED") },
          },
        }}
        catalog={{ heroes: [], items: [], arcana: [], enchantments: [], spells: [] }}
        roster={() => []}
        clock={{ videoNow: 1827, toGame: (second) => second - 1800, toVideo: (second) => second + 1800 }}
        onSeekGame={() => {}}
        onChange={(change) => results.push(change(content) as typeof content)}
      />,
    )
    await act(async () => button(document, "Mốc bảng ngọc cả đội").click())
    assert.deepEqual(
      results.at(-1)!.sides[0]!.participants.map((participant) => participant.arcana.observedAtSeconds),
      [27, 27, 27, 27, 27],
      "the mark is the game second at the player position",
    )
    assert.equal(
      results.at(-1)!.sides[1]!.participants[0]!.arcana.observedAtSeconds,
      undefined,
      "the other team is untouched",
    )

    await act(async () => button(document, "Bảng ngọc không hiển thị").click())
    assert.deepEqual(
      results.at(-1)!.sides[0]!.participants.map((participant) => participant.arcana.status),
      ["KNOWN", "NOT_SHOWN", "NOT_SHOWN", "NOT_SHOWN", "NOT_SHOWN"],
      "recorded loadouts are never overwritten as not shown",
    )
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
    assert.match(text, /V1Đã xác nhận/)
    assert.match(text, /V34\/6/)
    assert.match(text, /V2 chưa ghi/, "the first unrecorded number is game 2")
    assert.match(text, /V4 chưa ghi/)
    await act(async () => button(document, "Ván 3: thiếu kết quả").click())
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Mở ván 1"]')!.click())
    assert.deepEqual(opened, ["g3", "g1"])
  })
})
