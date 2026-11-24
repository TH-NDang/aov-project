import assert from "node:assert/strict"
import { test } from "node:test"
import React, { act, useState } from "react"
import type { Catalog, GameContent, Participant, Reference } from "@aov/community-contracts"
import type { GameSeat, GameView } from "../src/features/esports/model/game-view"
import {
  arcanaColorLocked,
  arcanaLabel,
  arcanaStatus,
  enchantmentBranches,
  enchantmentStatus,
  pickArcana,
  pickEnchantment,
  replacedMainPicks,
  stepArcana,
} from "../src/features/esports/model/loadout"
import { createWindow, installWindow, waitFor } from "./fixtures/dom"

const stone = (code: string, name: string, color: string, tier = 3): Reference => ({
  id: code,
  code,
  name,
  color,
  tier,
})
const emblem = (code: string, name: string, branchCode: string, tier: number): Reference => ({
  id: code,
  code,
  name,
  branchCode,
  tier,
})
const stones = {
  attack: stone("r-ad", "Đỏ III Công vật lý/Xuyên giáp", "RED"),
  crit: stone("r-crit", "Đỏ III Tỉ lệ chí mạng", "RED"),
  health: stone("p-hp", "Tím III Máu tối đa", "PURPLE"),
  armor: stone("g-armor", "Xanh III Giáp", "GREEN"),
  magic: stone("r1-ap", "ĐỎ I CÔNG PHÉP/TỐC ĐÁNH", "RED", 1),
}
const emblems = {
  light1: emblem("light-1", "Sung mãn", "thap-quang-minh", 1),
  light1b: emblem("light-1b", "Thánh châu", "thap-quang-minh", 1),
  light2: emblem("light-2", "Bí quyết", "thap-quang-minh", 2),
  light3: emblem("light-3", "Thần quang", "thap-quang-minh", 3),
  abyss1: emblem("abyss-1", "Ma hỏa", "vuc-hon-mang", 1),
  abyss2: emblem("abyss-2", "Cường công", "vuc-hon-mang", 2),
  abyss3: emblem("abyss-3", "Đấu khí", "vuc-hon-mang", 3),
  forest1: emblem("forest-1", "Ám kích", "rung-nguyen-sinh", 1),
  forest2: emblem("forest-2", "Bơm máu", "rung-nguyen-sinh", 2),
}
const catalog: Catalog = {
  heroes: [],
  items: [],
  spells: [],
  arcana: Object.values(stones),
  enchantments: Object.values(emblems),
}
const ids = (entries: { selection: { id?: string | null } }[]) => entries.map((entry) => entry.selection.id)

test("an arcana stone reads as the stats a broadcast prints next to it", () => {
  assert.equal(arcanaLabel("Đỏ III Công vật lý/Xuyên giáp"), "Công vật lý · Xuyên giáp")
  assert.equal(
    arcanaLabel("ĐỎ I CÔNG PHÉP/TỐC ĐÁNH"),
    "Công phép · Tốc đánh",
    "capitals in the catalogue are evened out",
  )
  assert.equal(arcanaLabel("Đỏ III Công Vật lý"), "Công vật lý")
  assert.equal(arcanaLabel("Tím III Máu tối đa"), "Máu tối đa")
  assert.equal(arcanaLabel("Ngọc ghi tay"), "Ngọc ghi tay", "a manual name without the colour prefix is kept")
  assert.equal(arcanaLabel(null), "Chưa rõ loại ngọc")
})

test("one click fills a colour, another kind swaps a whole colour and a split colour is kept", () => {
  let entries = pickArcana([], stones.attack)
  assert.deepEqual(entries, [{ selection: { id: "r-ad", name: stones.attack.name }, color: "RED", count: 10 }])
  assert.equal(arcanaStatus(entries, "UNKNOWN"), "PARTIAL")

  entries = pickArcana(entries, stones.crit)
  assert.deepEqual(ids(entries), ["r-crit"], "a colour held by one kind swaps to the clicked kind")
  assert.equal(entries[0]!.count, 10)

  entries = stepArcana(entries, 0, -4)
  entries = pickArcana(entries, stones.attack)
  assert.deepEqual(
    entries.map((entry) => [entry.selection.id, entry.count]),
    [
      ["r-crit", 6],
      ["r-ad", 4],
    ],
    "a second kind takes the slots that are free",
  )
  assert.equal(arcanaColorLocked(entries, "RED"), true)
  assert.equal(pickArcana(entries, stones.magic), entries, "a full, split colour is not replaced by a click")
  assert.equal(stepArcana(entries, 1, 3)[1]!.count, 4, "a colour never holds more than ten stones")

  entries = stepArcana(entries, 0, -2)
  entries = pickArcana(entries, stones.attack)
  assert.equal(entries[1]!.count, 6, "clicking a stone already on the page tops it up")
  assert.deepEqual(ids(stepArcana(entries, 0, -4)), ["r-ad"], "a stone stepped down to nothing leaves the page")

  const whole = [stones.attack, stones.health, stones.armor].reduce(pickArcana, [] as ReturnType<typeof pickArcana>)
  assert.equal(arcanaStatus(whole, "UNKNOWN"), "KNOWN", "ten of each colour is a whole page")
  assert.equal(arcanaStatus([], "KNOWN"), "UNKNOWN", "an empty page is never claimed as known")
  assert.equal(arcanaStatus([], "NOT_SHOWN"), "NOT_SHOWN")
  const none: ReturnType<typeof pickArcana> = []
  assert.equal(pickArcana(none, { ...stones.attack, color: null }), none, "a stone without a colour cannot be placed")
})

test("emblem picks stay a set the service accepts while it is built", () => {
  let entries = pickEnchantment([], emblems.light1, true)
  entries = pickEnchantment(entries, emblems.light1b, true)
  assert.deepEqual(ids(entries), ["light-1b"], "one main pick per tier")
  entries = pickEnchantment(entries, emblems.light3, true)
  entries = pickEnchantment(entries, emblems.light2, true)
  assert.deepEqual(ids(entries), ["light-1b", "light-2", "light-3"], "main picks are kept in tier order")
  assert.deepEqual(
    ids(pickEnchantment(entries, emblems.light2, true)),
    ["light-1b", "light-3"],
    "a click on a pick removes it",
  )

  assert.equal(
    pickEnchantment(entries, emblems.light1, false),
    entries,
    "a secondary pick cannot sit in the main branch",
  )
  assert.equal(pickEnchantment(entries, emblems.abyss3, false), entries, "a secondary pick is tier I or II")

  entries = pickEnchantment(entries, emblems.abyss1, false)
  entries = pickEnchantment(entries, emblems.abyss2, false)
  assert.deepEqual(ids(entries).slice(3), ["abyss-1", "abyss-2"], "tiers I and II of one branch go together")
  assert.equal(enchantmentStatus(entries, "UNKNOWN"), "KNOWN")

  entries = pickEnchantment(entries, emblems.forest1, false)
  assert.deepEqual(ids(entries).slice(3), ["abyss-1", "forest-1"], "two branches go together on tier I only")
  entries = pickEnchantment(entries, emblems.forest2, false)
  assert.deepEqual(ids(entries).slice(3), ["forest-1", "forest-2"])
  assert.equal(entries.length, 5)

  assert.deepEqual(ids(replacedMainPicks(entries, emblems.abyss3)), ["light-1b", "light-2", "light-3"])
  assert.deepEqual(replacedMainPicks(entries, emblems.light1), [], "another pick of the same branch discards nothing")
  const switched = pickEnchantment(pickEnchantment(entries, emblems.abyss1, false), emblems.abyss3, true)
  assert.deepEqual(
    ids(switched),
    ["abyss-3", "forest-1"],
    "a new main branch drops the old main picks and its own side picks",
  )
  assert.equal(enchantmentStatus(switched, "KNOWN"), "PARTIAL")
  assert.deepEqual(enchantmentBranches(catalog.enchantments), ["thap-quang-minh", "vuc-hon-mang", "rung-nguyen-sinh"])
})

async function withDom(
  run: (context: {
    document: Document
    render: (node: React.ReactNode) => Promise<void>
    click: (selector: string) => Promise<void>
  }) => Promise<void>,
) {
  const dom = createWindow("http://localhost:5175/tournaments")
  const window = dom.window
  const values = {
    React,
    window,
    document: window.document,
    navigator: window.navigator,
    HTMLElement: window.HTMLElement,
    HTMLInputElement: window.HTMLInputElement,
    HTMLButtonElement: window.HTMLButtonElement,
    Element: window.Element,
    Node: window.Node,
    NodeFilter: window.NodeFilter,
    DocumentFragment: window.DocumentFragment,
    MutationObserver: window.MutationObserver,
    CustomEvent: window.CustomEvent,
    Event: window.Event,
    CSS: { escape: (value: string) => value },
    getComputedStyle: window.getComputedStyle.bind(window),
    requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0),
    cancelAnimationFrame: clearTimeout,
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    IS_REACT_ACT_ENVIRONMENT: true,
  }
  let restoreGlobals = () => {}
  restoreGlobals = installWindow(window, values)
  const { createRoot } = await import("react-dom/client")
  const root = createRoot(window.document.getElementById("root")!)
  try {
    await run({
      document: window.document,
      render: async (node) => {
        await act(async () => root.render(node))
      },
      click: async (selector) => {
        const element = window.document.querySelector<HTMLElement>(selector)
        assert.ok(element, `nothing matches ${selector}`)
        await act(async () => element.click())
      },
    })
  } finally {
    await act(async () => root.unmount())
    restoreGlobals()
    window.close()
  }
}

const participant = (lane: Participant["lane"], overrides: Partial<Participant> = {}): Participant => ({
  lane,
  hero: { id: null, name: `Hero ${lane}` },
  spell: { id: null, name: null },
  arcana: { status: "UNKNOWN", entries: [] },
  enchantments: { status: "UNKNOWN", entries: [] },
  equipmentSnapshots: [],
  equipmentEvents: [],
  ...overrides,
})
const confirmButton = (document: Document, label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')].find(
    (entry) => entry.textContent?.trim() === label,
  )

test("arcana and emblems are picked on pictures and their status follows what is recorded", async () => {
  await withDom(async ({ document, render, click }) => {
    const { LoadoutEditor } = await import("../src/features/esports/pages/loadout-editor")
    const { ConfirmDialogHost } = await import("../src/components/confirm-dialog")
    let latest = participant("JUNGLE")
    function Host() {
      const [value, setValue] = useState(latest)
      return (
        <>
          <LoadoutEditor
            participant={value}
            catalog={catalog}
            onChange={(change) => {
              latest = change(latest)
              setValue(latest)
            }}
          />
          <ConfirmDialogHost />
        </>
      )
    }
    await render(<Host />)
    assert.equal(document.querySelector("select"), null, "no dropdown asks how well the loadout was observed")
    assert.equal(document.querySelector('[data-stone="r1-ap"]'), null, "only tier III stones are offered")
    assert.equal(document.querySelector('[aria-label="Cấp ngọc"]'), null, "no switch offers a lower tier")
    assert.match(document.querySelector('[data-stone="r-ad"]')!.textContent ?? "", /Công vật lý · Xuyên giáp/)

    await click('[data-stone="r-ad"]')
    assert.deepEqual(latest.arcana.entries, [
      { selection: { id: "r-ad", name: stones.attack.name }, color: "RED", count: 10 },
    ])
    assert.equal(latest.arcana.status, "PARTIAL")
    await click('[data-stone="p-hp"]')
    await click('[data-stone="g-armor"]')
    assert.equal(latest.arcana.status, "KNOWN", "three clicks record the usual page")
    assert.match(document.querySelector('[data-part="arcana"] [data-status]')!.textContent ?? "", /Đủ 30\/30/)

    await click('[aria-label="Bớt một viên Công vật lý · Xuyên giáp"]')
    assert.equal(latest.arcana.entries[0]!.count, 9)
    assert.equal(latest.arcana.status, "PARTIAL")
    await click('[aria-label="Bỏ Máu tối đa"]')
    assert.deepEqual(ids(latest.arcana.entries), ["r-ad", "g-armor"])

    await click('[data-enchantment="light-1"]')
    await click('[data-enchantment="light-3"]')
    assert.deepEqual(ids(latest.enchantments.entries), ["light-1", "light-3"])
    assert.equal(latest.enchantments.status, "PARTIAL")
    assert.equal(
      document.querySelector('[data-secondary-branch="thap-quang-minh"]'),
      null,
      "the main branch is not offered for the secondary picks",
    )
    await click('[data-secondary-branch="vuc-hon-mang"] [data-enchantment="abyss-1"]')
    assert.deepEqual(
      latest.enchantments.entries.map((entry) => entry.primary),
      [true, true, false],
    )
    assert.equal(document.querySelectorAll('[aria-label="Phù hiệu đã ghi"] [data-filled]').length, 3)
    assert.equal(
      document.querySelectorAll('[aria-label="Phù hiệu đã ghi"] li').length,
      5,
      "the two slots still missing stay visible with a question mark",
    )
    await click('[aria-label="Bỏ Ma hỏa"]')
    assert.deepEqual(ids(latest.enchantments.entries), ["light-1", "light-3"])

    // Another main branch throws recorded picks away, so it asks first.
    await act(async () =>
      [...document.querySelectorAll<HTMLButtonElement>('[aria-label="Nhánh chính"] button')]
        .find((entry) => entry.textContent?.includes("Vực Hỗn Mang"))!
        .click(),
    )
    assert.deepEqual(ids(latest.enchantments.entries), ["light-1", "light-3"], "looking at a branch changes nothing")
    await click('[data-enchantment="abyss-3"]')
    await waitFor(() => document.querySelector('[role="alertdialog"]'), "the main branch question opens")
    assert.match(document.querySelector('[role="alertdialog"]')?.textContent ?? "", /Đổi nhánh chính sang Vực Hỗn Mang/)
    assert.deepEqual(ids(latest.enchantments.entries), ["light-1", "light-3"])
    await act(async () => confirmButton(document, "Đổi nhánh chính")!.click())
    await waitFor(() => ids(latest.enchantments.entries).join() === "abyss-3", "the new main branch is recorded")
    assert.deepEqual(ids(latest.enchantments.entries), ["abyss-3"])

    // "Not shown" is said with its own button and never leaves entries behind.
    await act(async () =>
      document
        .querySelector<HTMLButtonElement>('[data-part="arcana"] button[aria-pressed="false"][title^="Đánh dấu"]')!
        .click(),
    )
    await waitFor(
      () => /2 loại ngọc đã ghi/.test(document.querySelector('[role="alertdialog"]')?.textContent ?? ""),
      "the not-shown question opens",
    )
    assert.match(document.querySelector('[role="alertdialog"]')?.textContent ?? "", /2 loại ngọc đã ghi/)
    await act(async () => confirmButton(document, "Bỏ và đánh dấu")!.click())
    await waitFor(() => latest.arcana.status === "NOT_SHOWN", "the arcana are recorded as not shown")
    assert.equal(latest.arcana.status, "NOT_SHOWN")
    assert.deepEqual(latest.arcana.entries, [])
    assert.match(document.querySelector('[data-part="arcana"]')!.textContent ?? "", /không xem đây là bảng trống/)
    assert.equal(document.querySelector('[data-stone="r-ad"]'), null)
  })
})

test("a lower-tier stone recorded earlier stays listed and can be removed, though it is no longer offered", async () => {
  await withDom(async ({ document, render, click }) => {
    const { LoadoutEditor } = await import("../src/features/esports/pages/loadout-editor")
    let latest = participant("MID", {
      arcana: {
        status: "PARTIAL",
        entries: [{ selection: { id: "r1-ap", name: stones.magic.name }, color: "RED", count: 2 }],
      },
    })
    function Host() {
      const [value, setValue] = useState(latest)
      return (
        <LoadoutEditor
          participant={value}
          catalog={catalog}
          onChange={(change) => {
            latest = change(latest)
            setValue(latest)
          }}
        />
      )
    }
    await render(<Host />)
    assert.equal(document.querySelector('[data-stone="r1-ap"]'), null, "tier I is not among the choices")
    const earlier = document.querySelector('[aria-label="Ngọc Đỏ đã ghi ngoài cấp III"]')
    assert.match(earlier?.textContent ?? "", /Công phép · Tốc đánh.*cấp I/)
    await click('[aria-label="Bỏ Công phép · Tốc đánh"]')
    assert.deepEqual(latest.arcana.entries, [])
  })
})

const lanes = ["TOP", "JUNGLE", "MID", "DRAGON", "SUPPORT"] as const
const seatView = (side: "BLUE" | "RED", lane: (typeof lanes)[number], index: number): GameSeat => ({
  key: `${side}:${lane}`,
  side,
  lane,
  playerName: `${side === "BLUE" ? "B" : "R"}${index}`,
  hero: { name: `Hero ${lane}` },
  spell: null,
  enchantments: { status: "UNKNOWN", entries: [] },
  arcana: { status: "UNKNOWN", entries: [] },
})
const view = (seats: Partial<Record<string, Partial<GameSeat>>> = {}): GameView => {
  const side = (code: "BLUE" | "RED") => ({
    side: code,
    team: { id: code, name: code === "BLUE" ? "Azure" : "Crimson", shortName: code.slice(0, 3) },
    bans: [],
    seats: lanes.map((lane, index) => ({ ...seatView(code, lane, index), ...seats[`${code}:${lane}`] })),
  })
  return {
    id: "g1",
    number: 1,
    winner: null,
    durationSeconds: 900,
    published: false,
    missingFields: [],
    sides: { BLUE: side("BLUE"), RED: side("RED") },
    snapshots: {},
  } as unknown as GameView
}
const gameContent = (first: Partial<Participant> = {}): GameContent =>
  ({
    seriesId: "s",
    number: 1,
    region: "VN",
    locale: "vi-VN",
    sides: (["BLUE", "RED"] as const).map((side) => ({
      side,
      teamId: side,
      bans: [],
      participants: lanes.map((lane, index) => participant(lane, side === "BLUE" && index === 0 ? first : {})),
    })),
  }) as GameContent

test("edits made before the previous one is saved do not undo each other", async () => {
  await withDom(async ({ document, render, click }) => {
    const { LoadoutPanel } = await import("../src/features/esports/pages/loadout-panel")
    const start = gameContent({
      arcana: {
        status: "PARTIAL",
        entries: [
          { selection: { id: "r-ad", name: stones.attack.name }, color: "RED", count: 3 },
          { selection: { id: "r-crit", name: stones.crit.name }, color: "RED", count: 3 },
          { selection: { id: "p-hp", name: stones.health.name }, color: "PURPLE", count: 2 },
        ],
      },
    })
    let server = start
    let accept = true
    let show: (content: GameContent) => void = () => {}
    let queue: Promise<unknown> = Promise.resolve()
    // The service: answers once told to, one change at a time, each applied to what it holds.
    let answer = () => {}
    let held = Promise.resolve()
    const hold = () => (held = new Promise((resolve) => (answer = resolve)))
    const send = (change: (content: GameContent) => GameContent) =>
      (queue = queue.then(async () => {
        await held
        if (!accept) return false
        server = change(server)
        show(server)
        return true
      }))
    function Host({ error }: { error?: string }) {
      const [content, setContent] = useState(start)
      show = setContent
      return (
        <LoadoutPanel
          content={content}
          view={view()}
          catalog={catalog}
          roster={() => []}
          error={error}
          onSeekGame={() => {}}
          onChange={send}
        />
      )
    }
    const recorded = () => ids(server.sides[0]!.participants[0]!.arcana.entries)
    const listed = () =>
      [...document.querySelectorAll('[data-part="arcana"] [aria-label^="Bỏ "]')].map((entry) =>
        entry.getAttribute("aria-label"),
      )
    await render(<Host />)
    assert.equal(listed().length, 3)

    hold()
    await click('[aria-label="Bỏ Tỉ lệ chí mạng"]')
    assert.deepEqual(listed(), ["Bỏ Công vật lý · Xuyên giáp", "Bỏ Máu tối đa"], "the row leaves at once")
    assert.deepEqual(recorded(), ["r-ad", "r-crit", "p-hp"], "while the service has not answered yet")
    await click('[aria-label="Bỏ Công vật lý · Xuyên giáp"]')
    answer()
    await waitFor(() => recorded().join() === "p-hp", "both removals are saved")
    assert.deepEqual(recorded(), ["p-hp"], "the second removal did not bring the first row back")
    assert.deepEqual(listed(), ["Bỏ Máu tối đa"])
    assert.equal(server.sides[0]!.participants[0]!.arcana.status, "PARTIAL")

    // A refused change is taken back, and the reason is told inside the panel.
    accept = false
    hold()
    await click('[aria-label="Bỏ Máu tối đa"]')
    assert.deepEqual(listed(), [])
    answer()
    await waitFor(() => listed().length === 1, "the refused removal is taken back")
    assert.deepEqual(listed(), ["Bỏ Máu tối đa"], "the panel returns to what is saved")
    await render(<Host error="Phiên bản đã đổi." />)
    assert.match(document.querySelector('[role="alert"]')?.textContent ?? "", /chưa lưu được.*Phiên bản đã đổi\./)
  })
})

test("a player row names the player and shows lane, spell, main emblem and arcana as icons that open for editing", async () => {
  await withDom(async ({ document, render, click }) => {
    const { Scoreboard } = await import("../src/features/esports/components/game/scoreboard")
    const { ArcanaCard, EnchantmentCard } = await import("../src/features/esports/components/game/loadout-summary")
    const recorded: Partial<GameSeat> = {
      spell: { id: "flicker", name: "Tốc biến" },
      enchantments: {
        status: "PARTIAL",
        entries: [{ id: "light-3", name: "Thần quang", primary: true, level: 3 }],
      },
      arcana: {
        status: "PARTIAL",
        entries: [{ id: "r-ad", name: stones.attack.name, count: 10, color: "RED" }],
      },
    }
    const game = view({ "BLUE:MID": recorded })
    const opened: string[] = []
    const board = (editable: boolean) => (
      <Scoreboard
        game={game}
        events={[]}
        at={0}
        focusSeat={null}
        onFocusSeat={() => {}}
        itemIcon={() => null}
        onEditLoadout={editable ? (seat, part) => opened.push(`${seat} ${part}`) : undefined}
      />
    )
    await render(board(false))
    const row = document.querySelector('[data-seat-loadout="BLUE:MID"]')!.closest("li")!
    assert.match(row.textContent ?? "", /B2/)
    assert.doesNotMatch(row.textContent ?? "", /Hero MID/, "the hero is its portrait, not a second line of text")
    assert.ok(row.querySelector('[aria-label="Đường: Đường giữa"], [aria-label^="Đường: "]'))
    assert.ok(row.querySelector('[aria-label="Phụ trợ: Tốc biến"]'))
    assert.ok(row.querySelector('[aria-label="Phù hiệu: 1 trên 5 ô"]'))
    assert.ok(row.querySelector('[aria-label="Bảng ngọc: 10 trên 30 viên"]'))
    assert.equal(row.querySelector("[data-seat-loadout] button"), null, "outside recording the icons only show")
    const empty = document.querySelector('[data-seat-loadout="RED:TOP"]')!
    assert.ok(empty.querySelector('[aria-label="Phụ trợ: chưa ghi"]'))
    assert.match(empty.querySelector('[aria-label="Phù hiệu: 0 trên 5 ô"]')!.textContent ?? "", /\?/)

    await render(board(true))
    await click('[data-seat-loadout="BLUE:MID"] button[aria-label^="Bảng ngọc"]')
    await click('[data-seat-loadout="RED:TOP"] button[aria-label^="Phù hiệu"]')
    await click('[data-seat-loadout="RED:TOP"] button[aria-label^="Phụ trợ"]')
    assert.deepEqual(opened, ["BLUE:MID arcana", "RED:TOP enchantments", "RED:TOP spell"])
    assert.equal(
      document.querySelector('[data-seat-loadout="BLUE:MID"] button[aria-label^="Đường"]'),
      null,
      "the lane is set in the draft, not here",
    )

    await render(
      <>
        <div id="emblems">
          <EnchantmentCard loadout={recorded.enchantments!} />
        </div>
        <div id="stones">
          <ArcanaCard loadout={recorded.arcana!} />
        </div>
        <div id="hidden">
          <ArcanaCard loadout={{ status: "NOT_SHOWN", entries: [] }} />
        </div>
      </>,
    )
    const slots = [...document.querySelectorAll("#emblems li")]
    assert.equal(slots.length, 5, "three main slots and two secondary ones")
    assert.match(slots[2]!.textContent ?? "", /Chính III.*Thần quang/)
    assert.equal(slots.filter((slot) => /\?.*Chưa ghi/.test(slot.textContent ?? "")).length, 4)
    assert.match(document.querySelector("#stones")!.textContent ?? "", /10\/30 viên/)
    assert.match(
      document.querySelector('#stones [data-arcana="RED"]')!.textContent ?? "",
      /10\/10.*×10.*Công vật lý · Xuyên giáp/,
    )
    assert.match(document.querySelector('#stones [data-arcana="GREEN"]')!.textContent ?? "", /0\/10.*Chưa ghi/)
    assert.match(document.querySelector("#hidden")!.textContent ?? "", /Video không hiện bảng ngọc/)
  })
})

test("the panel opens on the player and part asked from the scoreboard", async () => {
  await withDom(async ({ document, render }) => {
    const { LoadoutPanel } = await import("../src/features/esports/pages/loadout-panel")
    const panel = (target?: { seat: "BLUE:MID" | "RED:SUPPORT"; part: "arcana" }) => (
      <LoadoutPanel
        content={gameContent()}
        view={view()}
        catalog={catalog}
        roster={() => []}
        target={target}
        onSeekGame={() => {}}
        onChange={() => true}
      />
    )
    // A seat without a player marks its chip as unrecorded instead of a name; the chip title still names the seat.
    const selected = () => document.querySelector('button[aria-pressed="true"][title]')?.getAttribute("title")
    await render(panel({ seat: "RED:SUPPORT", part: "arcana" }))
    assert.match(selected() ?? "", /R4/)
    await render(panel({ seat: "BLUE:MID", part: "arcana" }))
    assert.match(selected() ?? "", /B2/, "a new request moves a panel that is already open")
    assert.ok(document.querySelector('[data-part="spell"]'))
    assert.ok(document.querySelector('[data-part="enchantments"]'))
    assert.ok(document.querySelector('[data-part="arcana"]'))
  })
})

test("rows recorded without a name are removed one at a time, and it is the clicked one that goes", async () => {
  await withDom(async ({ document, render }) => {
    const { LoadoutEditor } = await import("../src/features/esports/pages/loadout-editor")
    let latest = participant("MID", {
      arcana: {
        status: "PARTIAL",
        entries: [
          { selection: {}, color: "GREEN", count: 2 },
          { selection: {}, color: "GREEN", count: 3 },
        ],
      },
    })
    function Host() {
      const [value, setValue] = useState(latest)
      return (
        <LoadoutEditor
          participant={value}
          catalog={catalog}
          onChange={(change) => {
            latest = change(latest)
            setValue(latest)
          }}
        />
      )
    }
    const rows = () => [...document.querySelectorAll<HTMLButtonElement>('[aria-label="Bỏ Chưa rõ loại ngọc"]')]
    await render(<Host />)
    assert.equal(rows().length, 2, "older rows without a stone stay listed so they can be taken out")
    await act(async () => rows()[1]!.click())
    assert.deepEqual(
      latest.arcana.entries.map((entry) => entry.count),
      [2],
    )
    await act(async () => rows()[0]!.click())
    assert.deepEqual(latest.arcana.entries, [])
    assert.equal(latest.arcana.status, "UNKNOWN")
  })
})

test("side by side, the red team's panel mirrors the blue one", async () => {
  await withDom(async ({ document, render }) => {
    const { Scoreboard } = await import("../src/features/esports/components/game/scoreboard")
    await render(
      <Scoreboard game={view()} events={[]} at={0} focusSeat={null} onFocusSeat={() => {}} itemIcon={() => null} />,
    )
    // The mirror applies only where the board itself is wide enough for two panels, which it measures as a container.
    assert.ok(document.querySelector('section[data-side="BLUE"]')!.closest(".\\@container\\/board"))
    const classes = (selector: string) => document.querySelector(selector)!.className
    const mirrored = /@5xl\/board:flex-row-reverse/
    assert.match(classes('section[data-side="RED"] header'), mirrored)
    assert.doesNotMatch(classes('section[data-side="BLUE"] header'), mirrored)
    assert.match(classes('section[data-side="RED"] li'), /@5xl\/board:\[direction:rtl\]/)
    assert.doesNotMatch(classes('section[data-side="BLUE"] li'), /direction:rtl/)
    assert.match(classes('[data-seat-loadout="RED:TOP"]'), mirrored, "the icons of a row are mirrored too")
    assert.doesNotMatch(classes('[data-seat-loadout="BLUE:TOP"]'), mirrored)
  })
})

test("filling from the roster seats a starter before a substitute, never a player who left, and never one twice", async () => {
  const { fillFromRoster } = await import("../src/features/esports/model/line-up")
  type Option = Parameters<typeof fillFromRoster>[1] extends (teamId: string) => (infer T)[] ? T : never
  const blue: Option[] = [
    { id: "sub-mid", name: "Bench", lane: "MID", status: "SUBSTITUTE" },
    { id: "left-top", name: "Gone", lane: "TOP", status: "INACTIVE" },
    { id: "mid", name: "Starter", lane: "MID", status: "ACTIVE" },
    { id: "jungle", name: "Jungler", lane: "JUNGLE" },
  ]
  const roster = (teamId: string): Option[] =>
    teamId === "BLUE" ? blue : [{ id: "red-top", name: "Red", lane: "TOP", status: "ACTIVE" }]
  const seatOf = (content: GameContent, side: number, lane: string) =>
    content.sides[side]!.participants.find((entry) => entry.lane === lane)!.playerId ?? null

  const filled = fillFromRoster(gameContent(), roster)
  assert.equal(seatOf(filled, 0, "MID"), "mid", "a starter before a substitute")
  assert.equal(seatOf(filled, 0, "TOP"), null, "a player who left is not seated")
  assert.equal(seatOf(filled, 0, "JUNGLE"), "jungle")
  assert.equal(seatOf(filled, 1, "TOP"), "red-top")
  assert.deepEqual(fillFromRoster(filled, roster), filled, "nothing more to fill")

  const starterOnTop = gameContent({ playerId: "mid" })
  assert.equal(seatOf(fillFromRoster(starterOnTop, roster), 0, "MID"), "sub-mid", "a seated player is not seated again")
})

test("the panel names who played a seat, fills a team from its roster and opens on equipment", async () => {
  await withDom(async ({ document, render }) => {
    const { LoadoutPanel } = await import("../src/features/esports/pages/loadout-panel")
    const roster = (teamId: string) =>
      teamId === "BLUE"
        ? [
            { id: "p-top", name: "Topper", lane: "TOP" as const, status: "ACTIVE" as const },
            { id: "p-bench", name: "Bench", lane: "TOP" as const, status: "SUBSTITUTE" as const },
          ]
        : []
    let latest = gameContent()
    function Host({ part }: { part?: "equipment" }) {
      const [content, setContent] = useState(latest)
      return (
        <LoadoutPanel
          content={content}
          view={view()}
          catalog={catalog}
          roster={roster}
          target={{ seat: "BLUE:TOP", part }}
          onSeekGame={() => {}}
          onChange={(change) => {
            latest = change(latest)
            setContent(latest)
            return true
          }}
        />
      )
    }
    await render(<Host />)
    const picker = () => document.querySelector<HTMLSelectElement>('[data-part="player"] select')!
    assert.equal(picker().value, "", "an empty seat says so")
    assert.deepEqual(
      [...picker().options].map((option) => option.textContent),
      ["Chưa ghi tuyển thủ", "Topper", "Bench · dự bị"],
    )
    const fillButton = () =>
      [...document.querySelectorAll("button")].find((button) =>
        button.textContent?.includes("Điền tuyển thủ theo đội hình"),
      )
    await act(async () => fillButton()!.click())
    assert.equal(latest.sides[0]!.participants[0]!.playerId, "p-top", "the starter takes the seat")

    await act(async () => {
      picker().value = "p-bench"
      picker().dispatchEvent(new document.defaultView!.Event("change", { bubbles: true }))
    })
    assert.equal(latest.sides[0]!.participants[0]!.playerId, "p-bench", "a substitute is chosen by hand")

    assert.equal(document.querySelector('[aria-label="Thời điểm trang bị trong ván"]'), null)
    await render(<Host part="equipment" />)
    assert.ok(document.querySelector('[aria-label="Thời điểm trang bị trong ván"]'), "equipment opens straight away")
  })
})

test("while recording, an empty seat asks for its player and a button beside the slots opens equipment", async () => {
  await withDom(async ({ document, render }) => {
    const { Scoreboard } = await import("../src/features/esports/components/game/scoreboard")
    const opened: string[] = []
    const board = (recording: boolean) => (
      <Scoreboard
        game={view({ "BLUE:TOP": { playerId: "p1" } })}
        events={[]}
        at={0}
        focusSeat={null}
        onFocusSeat={() => {}}
        itemIcon={() => null}
        onEditLoadout={recording ? (seat, part) => opened.push(`${seat} ${part}`) : undefined}
      />
    )
    await render(board(false))
    assert.equal(document.querySelector('button[title="Chọn tuyển thủ chơi vị trí này"]'), null, "reading only")
    assert.equal(document.querySelector('button[aria-label^="Ghi trang bị"]'), null)

    await render(board(true))
    const rows = [...document.querySelectorAll('section[data-side="BLUE"] li')]
    assert.equal(rows[0]!.querySelector('button[title="Chọn tuyển thủ chơi vị trí này"]'), null, "a named seat")
    await act(async () =>
      rows[1]!.querySelector<HTMLButtonElement>('button[title="Chọn tuyển thủ chơi vị trí này"]')!.click(),
    )
    await act(async () =>
      rows[0]!.querySelector<HTMLButtonElement>('button[aria-label="Ghi trang bị của B0"]')!.click(),
    )
    assert.deepEqual(opened, ["BLUE:JUNGLE player", "BLUE:TOP equipment"])
  })
})
