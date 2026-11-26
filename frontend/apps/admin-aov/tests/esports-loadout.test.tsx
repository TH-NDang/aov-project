import assert from "node:assert/strict"
import { test } from "node:test"
import React, { act, useState } from "react"
import type { Catalog, GameContent, Participant, Reference } from "@aov/community-contracts"
import {
  arcanaColorLocked,
  arcanaLabel,
  arcanaStatus,
  enchantmentBranches,
  enchantmentStatus,
  pickArcana,
  pickEnchantment,
  lostEnchantments,
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
  assert.equal(arcanaLabel("Đỏ III Công vật lý/Xuyên giáp"), "Công vật lý/Xuyên giáp")
  assert.equal(arcanaLabel("ĐỎ I CÔNG PHÉP/TỐC ĐÁNH"), "Công phép/Tốc đánh", "capitals in the catalogue are evened out")
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

  assert.deepEqual(
    ids(lostEnchantments(entries, emblems.abyss3)),
    ["light-1b", "light-2"],
    "another main branch discards the picks of the other tiers",
  )
  assert.deepEqual(lostEnchantments(entries, emblems.light1), [], "another pick of the same branch discards nothing")
  assert.deepEqual(
    lostEnchantments(pickEnchantment([], emblems.light3, true), emblems.abyss3),
    [],
    "one main emblem for another discards nothing else",
  )
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
/** The editors of the emblems and the arcana of one player; `latest` is what they wrote. */
async function loadoutOf(start: Participant, all = true) {
  const { ArcanaEditor } = await import("../src/features/esports/components/game/arcana-editor")
  const { EnchantmentEditor } = await import("../src/features/esports/components/game/enchantment-editor")
  const kept = { latest: start }
  function Host() {
    const [value, setValue] = useState(start)
    const [allSlots, setAllSlots] = useState(all)
    const update = (change: (value: Participant) => Participant) => {
      kept.latest = change(kept.latest)
      setValue(kept.latest)
    }
    return (
      <>
        <EnchantmentEditor
          value={value.enchantments}
          catalog={catalog}
          allSlots={allSlots}
          onAllSlots={setAllSlots}
          onChange={(change) => update((entry) => ({ ...entry, enchantments: change(entry.enchantments) }))}
        />
        <ArcanaEditor
          value={value.arcana}
          catalog={catalog}
          onChange={(change) => update((entry) => ({ ...entry, arcana: change(entry.arcana) }))}
        />
      </>
    )
  }
  return { kept, Host }
}

const confirmButton = (document: Document, label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')].find(
    (entry) => entry.textContent?.trim() === label,
  )

test("arcana and emblems are picked on pictures and their status follows what is recorded", async () => {
  await withDom(async ({ document, render, click }) => {
    const { ConfirmDialogHost } = await import("../src/components/confirm-dialog")
    const { kept, Host } = await loadoutOf(participant("JUNGLE"))
    await render(
      <>
        <Host />
        <ConfirmDialogHost />
      </>,
    )
    assert.equal(document.querySelector("select"), null, "no dropdown asks how well the loadout was observed")
    assert.equal(document.querySelector('[data-stone="r1-ap"]'), null, "only tier III stones are offered")
    assert.equal(document.querySelector('[aria-label="Cấp ngọc"]'), null, "no switch offers a lower tier")
    assert.match(document.querySelector('[data-stone="r-ad"]')!.textContent ?? "", /Công vật lý\/Xuyên giáp/)

    await click('[data-stone="r-ad"]')
    assert.deepEqual(kept.latest.arcana.entries, [
      { selection: { id: "r-ad", name: stones.attack.name }, color: "RED", count: 10 },
    ])
    assert.equal(kept.latest.arcana.status, "PARTIAL")
    await click('[data-stone="p-hp"]')
    await click('[data-stone="g-armor"]')
    assert.equal(kept.latest.arcana.status, "KNOWN", "three clicks record the usual page")
    assert.match(document.querySelector('[data-part="arcana"] [data-status]')!.textContent ?? "", /Đủ 30\/30/)

    await click('[aria-label="Bớt một viên Công vật lý/Xuyên giáp"]')
    assert.equal(kept.latest.arcana.entries[0]!.count, 9)
    assert.equal(kept.latest.arcana.status, "PARTIAL")
    await click('[aria-label="Bỏ Máu tối đa"]')
    assert.deepEqual(ids(kept.latest.arcana.entries), ["r-ad", "g-armor"])

    await click('[data-enchantment="light-1"]')
    await click('[data-enchantment="light-3"]')
    assert.deepEqual(ids(kept.latest.enchantments.entries), ["light-1", "light-3"])
    assert.equal(kept.latest.enchantments.status, "PARTIAL")
    assert.equal(
      document.querySelector('[data-secondary-branch="thap-quang-minh"]'),
      null,
      "the main branch is not offered for the secondary picks",
    )
    await click('[data-secondary-branch="vuc-hon-mang"] [data-enchantment="abyss-1"]')
    assert.deepEqual(
      kept.latest.enchantments.entries.map((entry) => entry.primary),
      [true, true, false],
    )
    assert.equal(document.querySelectorAll('[aria-label="Phù hiệu đã ghi"] [data-filled]').length, 3)
    assert.equal(
      document.querySelectorAll('[aria-label="Phù hiệu đã ghi"] li').length,
      5,
      "the two slots still missing stay visible with a question mark",
    )
    await click('[aria-label="Bỏ Ma hỏa"]')
    assert.deepEqual(ids(kept.latest.enchantments.entries), ["light-1", "light-3"])

    // Another main branch throws recorded picks away, so it asks first.
    await act(async () =>
      [...document.querySelectorAll<HTMLButtonElement>('[aria-label="Nhánh chính"] button')]
        .find((entry) => entry.textContent?.includes("Vực Hỗn Mang"))!
        .click(),
    )
    assert.deepEqual(
      ids(kept.latest.enchantments.entries),
      ["light-1", "light-3"],
      "looking at a branch changes nothing",
    )
    await click('[data-enchantment="abyss-3"]')
    await waitFor(() => document.querySelector('[role="alertdialog"]'), "the main branch question opens")
    assert.match(document.querySelector('[role="alertdialog"]')?.textContent ?? "", /Đổi nhánh chính sang Vực Hỗn Mang/)
    assert.deepEqual(ids(kept.latest.enchantments.entries), ["light-1", "light-3"])
    await act(async () => confirmButton(document, "Đổi nhánh chính")!.click())
    await waitFor(() => ids(kept.latest.enchantments.entries).join() === "abyss-3", "the new main branch is recorded")
    assert.deepEqual(ids(kept.latest.enchantments.entries), ["abyss-3"])

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
    await waitFor(() => kept.latest.arcana.status === "NOT_SHOWN", "the arcana are recorded as not shown")
    assert.equal(kept.latest.arcana.status, "NOT_SHOWN")
    assert.deepEqual(kept.latest.arcana.entries, [])
    assert.match(document.querySelector('[data-part="arcana"]')!.textContent ?? "", /không xem đây là bảng trống/)
    assert.equal(document.querySelector('[data-stone="r-ad"]'), null)
  })
})

test("a lower-tier stone recorded earlier stays listed and can be removed, though it is no longer offered", async () => {
  await withDom(async ({ document, render, click }) => {
    const { kept, Host } = await loadoutOf(
      participant("MID", {
        arcana: {
          status: "PARTIAL",
          entries: [{ selection: { id: "r1-ap", name: stones.magic.name }, color: "RED", count: 2 }],
        },
      }),
    )
    await render(<Host />)
    assert.equal(document.querySelector('[data-stone="r1-ap"]'), null, "tier I is not among the choices")
    const earlier = document.querySelector('[aria-label="Ngọc Đỏ đã ghi ngoài cấp III"]')
    assert.match(earlier?.textContent ?? "", /Công phép\/Tốc đánh.*cấp I/)
    await click('[aria-label="Bỏ Công phép/Tốc đánh"]')
    assert.deepEqual(kept.latest.arcana.entries, [])
  })
})

const lanes = ["TOP", "JUNGLE", "MID", "DRAGON", "SUPPORT"] as const
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

test("rows recorded without a name are removed one at a time, and it is the clicked one that goes", async () => {
  await withDom(async ({ document, render }) => {
    const { kept, Host } = await loadoutOf(
      participant("MID", {
        arcana: {
          status: "PARTIAL",
          entries: [
            { selection: {}, color: "GREEN", count: 2 },
            { selection: {}, color: "GREEN", count: 3 },
          ],
        },
      }),
    )
    const rows = () => [...document.querySelectorAll<HTMLButtonElement>('[aria-label="Bỏ Chưa rõ loại ngọc"]')]
    await render(<Host />)
    assert.equal(rows().length, 2, "older rows without a stone stay listed so they can be taken out")
    await act(async () => rows()[1]!.click())
    assert.deepEqual(
      kept.latest.arcana.entries.map((entry) => entry.count),
      [2],
    )
    await act(async () => rows()[0]!.click())
    assert.deepEqual(kept.latest.arcana.entries, [])
    assert.equal(kept.latest.arcana.status, "UNKNOWN")
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

test("the main emblem of tier III is one press among the twelve, and all five slots are another", async () => {
  await withDom(async ({ document, render, click }) => {
    const { kept, Host } = await loadoutOf(participant("MID"), false)
    await render(<Host />)
    const shown = () =>
      [...document.querySelectorAll("[data-enchantment]")].map((tile) => tile.getAttribute("data-enchantment"))
    assert.deepEqual(shown(), ["light-3", "abyss-3"], "tier III alone, branch by branch")
    assert.equal(document.querySelector('[aria-pressed="true"][data-enchantment]'), null, "nothing is guessed")

    await click('[data-enchantment="light-3"]')
    assert.deepEqual(ids(kept.latest.enchantments.entries), ["light-3"])
    assert.equal(kept.latest.enchantments.status, "PARTIAL")
    await click('[data-enchantment="abyss-3"]')
    assert.deepEqual(ids(kept.latest.enchantments.entries), ["abyss-3"], "a wrong one is corrected without a question")

    await act(async () =>
      [...document.querySelectorAll("button")].find((entry) => entry.textContent === "Đủ năm ô")!.click(),
    )
    assert.equal(document.querySelectorAll('[aria-label="Phù hiệu đã ghi"] li').length, 5)
  })
})

test("the cards of a player list every slot of the emblems and every colour of the arcana", async () => {
  await withDom(async ({ document, render }) => {
    const { ArcanaCard, EnchantmentCard } = await import("../src/features/esports/components/game/loadout-summary")
    await render(
      <>
        <div id="emblems">
          <EnchantmentCard
            loadout={{ status: "PARTIAL", entries: [{ id: "light-3", name: "Thần quang", primary: true, level: 3 }] }}
          />
        </div>
        <div id="stones">
          <ArcanaCard
            loadout={{
              status: "PARTIAL",
              entries: [{ id: "r-ad", name: stones.attack.name, count: 10, color: "RED" }],
            }}
          />
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
      /10\/10.*×10.*Công vật lý\/Xuyên giáp/,
    )
    assert.match(document.querySelector('#stones [data-arcana="GREEN"]')!.textContent ?? "", /0\/10.*Chưa ghi/)
    assert.match(document.querySelector("#hidden")!.textContent ?? "", /Video không hiện bảng ngọc/)
  })
})
