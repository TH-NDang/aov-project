import assert from "node:assert/strict"
import { test } from "node:test"
import { act, useState } from "react"
import type {
  BuildStep,
  Catalog,
  EquipmentSnapshot,
  GameContent,
  Participant,
  Reference,
} from "@aov/community-contracts"
import { itemIndex } from "../src/features/esports/model/build"
import type { GameView } from "../src/features/esports/model/game-view"
import { answerConfirm, button, click, QuietResizeObserver, render, type, waitFor, withDom } from "./fixtures/dom"
import { catalog as deskCatalog, deskOf, recordedGame, type Kept } from "./fixtures/esports-desk"
import { completeGame, view as record } from "./fixtures/match-records"

withDom({
  url: "http://localhost:5175/tournaments",
  globals: () => ({ ResizeObserver: QuietResizeObserver, CSS: { escape: (value: string) => value } }),
})

const { BuildEditor } = await import("../src/features/esports/pages/build-editor")
const { EquipmentEditor } = await import("../src/features/tournaments/components/equipment-editor")
const { LineupBoard } = await import("../src/features/esports/components/game/lineup-board")
const { SeatStrip } = await import("../src/features/esports/components/game/seat-head")
const { buildGameView } = await import("../src/features/esports/model/game-view")
const { LineupTool } = await import("../src/features/esports/pages/tools/lineup-tool")

const reference = (code: string, name: string, tier: number, components: string[] = []): Reference => ({
  id: code,
  code,
  name,
  tier,
  components,
})
const ITEMS = [
  reference("short", "Kiếm ngắn", 1),
  reference("sword", "Kiếm dài", 2, ["short"]),
  reference("gauntlet", "Găng bạch kim", 2),
  reference("greaves", "Giáp chân", 2),
  reference("boots", "Giày hộ vệ", 2),
  reference("holy", "Thánh kiếm", 3, ["sword"]),
  reference("aegis", "Khiên thánh quang", 3, ["gauntlet", "greaves"]),
  reference("fang", "Nanh Fenrir", 3, ["sword"]),
  reference("revive", "Giáp hộ mệnh", 3, ["sword"]),
  reference("rage", "Giáp cuồng nộ", 3, ["greaves"]),
]
const index = itemIndex(ITEMS)
const pick = (id: string) => ({ id, name: ITEMS.find((item) => item.id === id)!.name })
const step = (id: string, place: BuildStep["place"] = "KEPT", more: Partial<BuildStep> = {}): BuildStep => ({
  item: pick(id),
  from: [],
  place,
  atSeconds: null,
  ...more,
})
const snapshot = (atSeconds: number, ids: string[]): EquipmentSnapshot => ({
  atSeconds,
  slots: ids.map((id, slot) => ({ slot: slot + 1, known: true, item: pick(id) })),
})
const player = (more: Partial<Participant> = {}): Participant => ({
  lane: "TOP",
  hero: { id: "hero", name: "Biron" },
  arcana: { status: "UNKNOWN", entries: [] },
  enchantments: { status: "UNKNOWN", entries: [] },
  equipmentSnapshots: [],
  equipmentEvents: [],
  ...more,
})

/** The top laner of the blue team on the recording desk, with the items open; what is recorded is kept. */
async function onDesk(more: Partial<Participant>) {
  const start = recordedGame()
  const content = {
    ...start,
    sides: start.sides.map((side) =>
      side.side === "BLUE"
        ? { ...side, participants: side.participants.map((entry, at) => (at ? entry : { ...entry, ...more })) }
        : side,
    ),
  }
  const { kept } = deskOf({ content, catalog: { ...deskCatalog, items: ITEMS }, items: ITEMS })
  const target = { seat: "BLUE:TOP", part: "equipment" } as const
  await render(<kept.Host>{(desk) => <LineupTool desk={desk} target={target} />}</kept.Host>)
  return kept
}
const top = (kept: Kept) => kept.content().sides[0]!.participants[0]!

/** The editor over one player of a fifteen-minute game; `latest` is what it wrote and `said` what it said of it. */
let latest = player()
let said = ""
function Host({ start, nowGame, inline }: { start: Participant; nowGame?: number; inline?: boolean }) {
  const [value, setValue] = useState(start)
  const [stamp, setStamp] = useState(false)
  latest = value
  return (
    <BuildEditor
      participant={value}
      index={index}
      duration={900}
      nowGame={nowGame}
      stamp={stamp}
      inline={inline}
      onStamp={setStamp}
      onEdit={(change, text) => {
        latest = change(latest)
        said = text
        setValue(latest)
      }}
    />
  )
}
const edit = (more: Partial<Participant> = {}, nowGame?: number, inline?: boolean) =>
  render(<Host start={player(more)} nowGame={nowGame} inline={inline} />)

const one = <T extends HTMLElement = HTMLElement>(selector: string) => {
  const element = document.querySelector<T>(selector)
  assert.ok(element, `nothing matches ${selector}`)
  return element
}
const listed = (place?: BuildStep["place"]) =>
  (latest.build ?? []).filter((entry) => !place || entry.place === place).map((entry) => entry.item.id)
const stepOf = (id: string) => (latest.build ?? []).find((entry) => entry.item.id === id)
const menu = () => document.querySelector<HTMLElement>('[role="dialog"]')
const catalogue = () => document.querySelector<HTMLElement>('[role="listbox"]')
const search = () => one<HTMLInputElement>('[aria-label="Tìm trang bị"]')
const openItem = (id: string) => click(one(`[data-item="${id}"]`))
const openPlace = (place: BuildStep["place"]) => click(one(`[data-place="${place}"] [data-add]`))
const choose = (code: string) => click(one(`[data-option="${code}"]`))
const inMenu = (label: string) => click(button(label, menu()!), label)
const press = async (key: string) => {
  await act(async () => search().dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true })))
}
const alertText = () => document.querySelector('[role="alert"]')?.textContent ?? ""

test("without a list of its own the editor says which moment it reads, and the first edit writes a list", async () => {
  await edit({ equipmentSnapshots: [snapshot(900, ["holy", "boots"])] })
  assert.match(one('[data-source="snapshot"]').textContent ?? "", /Đang đọc từ mốc 15:00/)
  assert.deepEqual(listed(), [], "nothing is written by looking")

  await openPlace("SITUATIONAL")
  await choose("revive")
  assert.deepEqual(listed(), ["holy", "boots", "revive"])
  assert.equal(document.querySelector('[data-source="snapshot"]'), null)
  assert.equal(said, "Đã thêm Giáp hộ mệnh vào “Tình huống”, ghi thành danh sách riêng")
})

test("a moment of the middle of the game starts no list, and its items are offered with it", async () => {
  await edit({ equipmentSnapshots: [snapshot(300, ["boots"])] })
  assert.equal(document.querySelector('[data-source="snapshot"]'), null)
  assert.equal(document.querySelector('[data-item="boots"]'), null)

  await openPlace("KEPT")
  assert.match(catalogue()!.textContent ?? "", /Đã thấy ở các mốc.*Giày hộ vệ5:00/)
  await choose("boots")
  assert.equal(stepOf("boots")?.atSeconds, 300)
})

test("the items of a moment are written down as they are in one press", async () => {
  await edit({ equipmentSnapshots: [snapshot(900, ["holy", "boots"])] })
  await click(button("Ghi danh sách này"))
  assert.deepEqual(listed("KEPT"), ["holy", "boots"])
})

test("the first edit can be taken back, and the items are read from the moment again", async () => {
  const kept = await onDesk({ equipmentSnapshots: [snapshot(900, ["holy", "boots"])] })
  await openItem("boots")
  await inMenu("Đã đổi")
  assert.deepEqual(
    top(kept)
      .build?.filter((entry) => entry.place === "REPLACED")
      .map((entry) => entry.item.id),
    ["boots"],
  )
  await act(async () => kept.undo())
  assert.equal(top(kept).build?.length ?? 0, 0)
  assert.ok(document.querySelector('[data-source="snapshot"]'))
})

test("the six slots are filled in a row from the open catalogue, which closes with the sixth", async () => {
  await edit()
  assert.equal(document.querySelectorAll('[data-place="KEPT"] [data-add]').length, 6)
  await openPlace("KEPT")
  for (const code of ["boots", "holy", "aegis", "fang", "revive"]) await choose(code)
  assert.ok(catalogue(), "it stays open while a slot is free")
  await choose("rage")
  assert.equal(catalogue(), null)
  assert.deepEqual(listed("KEPT"), ["boots", "holy", "aegis", "fang", "revive", "rage"])
  assert.equal(document.querySelectorAll('[data-place="KEPT"] [data-add]').length, 0)
})

test("without room beside the list the catalogue opens under it, takes items and is closed there", async () => {
  await edit({}, undefined, true)
  await openPlace("KEPT")
  assert.equal(menu(), null, "nothing lies over the rest of the screen")
  assert.ok(one('[data-place="KEPT"]').contains(catalogue()))
  await choose("holy")
  await choose("boots")
  assert.deepEqual(listed("KEPT"), ["holy", "boots"])
  await click(button("Đóng danh mục"))
  assert.equal(catalogue(), null)
  assert.ok(document.activeElement?.hasAttribute("data-add"), "the focus is back on the next free slot")
})

test("the catalogue offers no item of tier 1 and lists finished items first", async () => {
  await edit()
  await openPlace("KEPT")
  assert.equal(document.querySelector('[data-option="short"]'), null)
  assert.deepEqual(
    [...catalogue()!.querySelectorAll("h5")].map((heading) => heading.textContent),
    ["Cấp 3", "Cấp 2"],
  )
})

test("an item that is listed elsewhere is marked with its place and moves instead of being listed twice", async () => {
  await edit({ build: [step("boots"), step("holy")] })
  await openPlace("REPLACED")
  assert.match(one('[data-option="boots"]').textContent ?? "", /Cuối ván/)
  await choose("boots")
  assert.deepEqual(listed(), ["boots", "holy"])
  assert.deepEqual(listed("REPLACED"), ["boots"])
})

test("an item pressed again in its own place is taken out", async () => {
  await edit({ build: [step("holy")] })
  await openPlace("KEPT")
  assert.equal(one('[data-option="holy"]').getAttribute("aria-selected"), "true")
  await choose("holy")
  assert.deepEqual(listed(), [])
})

test("a name typed without accents is taken with Enter, and a second Enter does not take it out again", async () => {
  await edit()
  await openPlace("KEPT")
  await type(search(), "thanh k")
  await press("Enter")
  assert.deepEqual(listed(), ["holy"], "the name that begins with the text, before one that only holds it")
  await press("Enter")
  assert.deepEqual(listed(), ["holy"])
})

test("arrow keys walk the catalogue from the search and Enter takes what they reach", async () => {
  await edit()
  await openPlace("KEPT")
  await press("ArrowRight")
  assert.equal(document.querySelector("[data-marked]"), null, "sideways keys move the text cursor at first")
  await press("ArrowDown")
  await press("ArrowRight")
  const marked = one("[data-marked]")
  assert.equal(search().getAttribute("aria-activedescendant"), marked.id)
  await press("Enter")
  assert.deepEqual(listed(), [marked.dataset.option])
})

test("a name the catalogue does not have can be written by hand", async () => {
  await edit()
  await openPlace("SITUATIONAL")
  await type(search(), "Món cũ")
  await click(button("Dùng tên “Món cũ”"))
  assert.deepEqual(latest.build, [
    { item: { id: null, name: "Món cũ" }, from: [], place: "SITUATIONAL", atSeconds: null },
  ])
})

test("a search that finds only items of tier 1 says why none is offered", async () => {
  await edit()
  await openPlace("KEPT")
  await type(search(), "kiem ngan")
  assert.match(catalogue()!.textContent ?? "", /Chỉ ghi trang bị cấp 2 và cấp 3/)
})

test("an item seen at an earlier moment is offered first and brings that moment along", async () => {
  await edit({
    equipmentSnapshots: [snapshot(300, ["boots"]), snapshot(900, ["holy"])],
  })
  await openPlace("REPLACED")
  assert.equal(catalogue()!.querySelector("h5")?.textContent, "Đã thấy ở các mốc")
  await click(catalogue()!.querySelector('[data-option="boots"]'))
  assert.deepEqual(stepOf("boots"), step("boots", "REPLACED", { atSeconds: 300 }))
})

test("items are added with the time of the video only while that is asked for", async () => {
  await edit({}, 400)
  await openPlace("SITUATIONAL")
  await choose("revive")
  await click(one('[role="checkbox"]'))
  await choose("holy")
  assert.equal(stepOf("revive")!.atSeconds, null)
  assert.equal(stepOf("holy")!.atSeconds, 400)
})

test("the words of the video stamp turn it on and hand the box no click, which would take the focus", async () => {
  await edit({}, 400)
  await openPlace("SITUATIONAL")
  const box = one('[role="checkbox"]')
  let clicks = 0
  box.addEventListener("click", () => clicks++)
  search().focus()
  await click(box.closest("label"), "the words of the stamp")
  assert.equal(box.getAttribute("aria-checked"), "true")
  assert.equal(document.activeElement, search())
  assert.equal(clicks, 0)
})

test("a seventh item kept to the end is refused where it was asked for, with the reason", async () => {
  const six = ["boots", "holy", "aegis", "fang", "revive", "rage"].map((id) => step(id))
  await edit({ build: [...six, step("sword", "REPLACED")] })
  await openItem("sword")
  await inMenu("Cuối ván")
  assert.match(alertText(), /Đã đủ sáu ô/)
  assert.deepEqual(listed("REPLACED"), ["sword"])
})

test("an item of tier 2 is upgraded into one it goes into and stays as its part", async () => {
  await edit({ build: [step("boots"), step("sword", "KEPT", { atSeconds: 180 })] })
  await openItem("sword")
  await inMenu("Thánh kiếm")
  assert.deepEqual(latest.build, [step("boots"), step("holy", "KEPT", { from: [pick("sword")] })])
  assert.equal(menu(), null, "the item the menu was about is another one now")
  assert.ok(one('[data-item="holy"]').querySelector('[data-parts="1"]'), "the part is drawn over the item")
  assert.match(one('[data-item="holy"]').getAttribute("aria-label") ?? "", /lên từ Kiếm dài/)
})

test("a finished item offers no upgrade", async () => {
  await edit({ build: [step("holy")] })
  await openItem("holy")
  assert.ok(menu()!.querySelector('[aria-label="Lên từ"]'))
  assert.equal(menu()!.querySelector('[aria-label="Nâng lên"]'), null)
})

test("an item of tier 2 that is made of tier 1 alone offers no parts", async () => {
  await edit({ build: [step("sword")] })
  await openItem("sword")
  assert.ok(menu()!.querySelector('[aria-label="Nâng lên"]'))
  assert.equal(menu()!.querySelector('[aria-label="Lên từ"]'), null)
})

test("an upgrade that is listed already comes first and takes the lower item over", async () => {
  await edit({ build: [step("sword"), step("holy")] })
  await openItem("sword")
  assert.match(menu()!.querySelector('[aria-label="Nâng lên"] button')!.textContent ?? "", /Thánh kiếm.*đang có/)
  await inMenu("Thánh kiếm")
  assert.deepEqual(latest.build, [step("holy", "KEPT", { from: [pick("sword")] })])
})

test("the parts of an item are switched on and off, and any other item can be chosen", async () => {
  await edit({ build: [step("holy")] })
  await openItem("holy")
  await inMenu("Kiếm dài")
  assert.deepEqual(stepOf("holy")!.from, [pick("sword")])
  await inMenu("Món khác")
  await choose("greaves")
  assert.deepEqual(stepOf("holy")!.from, [pick("sword"), pick("greaves")])
  await inMenu("Quay lại")
  await inMenu("Kiếm dài")
  assert.deepEqual(stepOf("holy")!.from, [pick("greaves")])
})

test("a fourth part is refused in the list it was chosen from", async () => {
  await edit({ build: [step("holy", "KEPT", { from: ["sword", "greaves", "boots"].map(pick) })] })
  await openItem("holy")
  await inMenu("Món khác")
  await choose("gauntlet")
  assert.match(alertText(), /nhiều nhất 3 món/)
  assert.equal(stepOf("holy")!.from!.length, 3)
})

const timeField = () => one<HTMLInputElement>('[aria-label^="Thời điểm có món này"]')
const typeTime = async (text: string) => {
  await act(async () => timeField().focus())
  await type(timeField(), text)
  await act(async () => timeField().blur())
}

test("the time of an item is typed, taken from the video and cleared", async () => {
  await edit({ build: [step("holy")] }, 600)
  await openItem("holy")
  await typeTime("8:32")
  assert.equal(stepOf("holy")!.atSeconds, 512)
  await typeTime("915")
  assert.equal(stepOf("holy")!.atSeconds, 555, "a keyboard without a colon is enough")
  await inMenu("Lấy lúc video 10:00")
  assert.equal(stepOf("holy")!.atSeconds, 600)
  assert.equal(timeField().value, "10:00")
  await inMenu("Xóa thời điểm")
  assert.equal(stepOf("holy")!.atSeconds, null)
})

test("a time that cannot be read or lies after the end of the game is refused beside the field", async () => {
  await edit({ build: [step("holy")] })
  await openItem("holy")
  await typeTime("8")
  assert.match(alertText(), /Nhập phút:giây/)
  await typeTime("20:00")
  assert.match(alertText(), /nằm trong ván/)
  assert.equal(stepOf("holy")!.atSeconds, null)
})

test("no time is taken from a video that shows what follows the game", async () => {
  await edit({ build: [step("holy")] }, 1200)
  await openItem("holy")
  assert.equal(button("Lấy lúc video", menu()!), undefined)
})

test("an item moves earlier and later among those of its place", async () => {
  await edit({ build: [step("boots"), step("sword", "REPLACED"), step("holy")] })
  await openItem("holy")
  await inMenu("Sớm hơn")
  assert.deepEqual(listed(), ["holy", "boots", "sword"])
  assert.equal(one('[aria-label="Sớm hơn"]').getAttribute("aria-disabled"), "true")
  await inMenu("Muộn hơn")
  assert.deepEqual(listed("KEPT"), ["boots", "holy"])
})

test("an item that is taken out comes back, with all that was recorded, when that is undone", async () => {
  const build = [step("boots"), step("holy", "KEPT", { from: [pick("sword")], atSeconds: 400 })]
  const kept = await onDesk({ build })
  await openItem("holy")
  await inMenu("Bỏ Thánh kiếm")
  assert.deepEqual(top(kept).build, [build[0]])
  assert.equal(kept.changes.at(-1)?.text, "Đã bỏ Thánh kiếm của AZU Top")
  await act(async () => kept.undo())
  assert.deepEqual(top(kept).build, build)
})

test("every edit says what it did", async () => {
  await edit({ build: [step("boots"), step("holy")] }, 400)
  await openItem("holy")
  await inMenu("Sớm hơn")
  assert.equal(said, "Đã đổi thứ tự Thánh kiếm")
  await inMenu("Kiếm dài")
  assert.equal(said, "Thánh kiếm lên từ Kiếm dài")
  await inMenu("Lấy lúc video 6:40")
  assert.equal(said, "Đã ghi lúc có Thánh kiếm: 6:40")
  await inMenu("Tình huống")
  assert.equal(said, "Đã chuyển Thánh kiếm sang “Tình huống”")
})

test("the focus stays beside an item that was taken out, and with the one another went into", async () => {
  await edit({ build: [step("boots"), step("sword"), step("holy")] })
  await openItem("boots")
  await inMenu("Bỏ Giày hộ vệ")
  assert.equal((document.activeElement as HTMLElement).dataset.item, "sword")
  await openItem("sword")
  await inMenu("Nanh Fenrir")
  assert.equal((document.activeElement as HTMLElement).dataset.item, "fang")
})

test("a moved item keeps its menu open in its new place", async () => {
  await edit({ build: [step("boots"), step("holy")] })
  await openItem("holy")
  await inMenu("Tình huống")
  assert.deepEqual(listed("SITUATIONAL"), ["holy"])
  assert.equal(menu()!.getAttribute("aria-label"), "Thánh kiếm")
})

test("the last item over a moment is not taken out, since an empty list reads that moment again", async () => {
  await edit({ build: [step("boots")], equipmentSnapshots: [snapshot(900, ["holy"])] })
  await openItem("boots")
  await inMenu("Bỏ Giày hộ vệ")
  assert.match(alertText(), /Danh sách trống sẽ lại đọc từ mốc/)
  assert.deepEqual(listed(), ["boots"])
})

test("a list is given up for the moment beneath it only after a question", async () => {
  await edit({ build: [step("boots")], equipmentSnapshots: [snapshot(900, ["holy"])] })
  await click(button("Đọc lại từ mốc 15:00"))
  assert.deepEqual(listed(), ["boots"])
  await answerConfirm("Bỏ danh sách")
  await waitFor(() => latest.build?.length === 0, "the list is given up")
  assert.ok(document.querySelector('[data-item="holy"]'))
})

test("an item the service would refuse is named with the reason", async () => {
  await edit({ build: [step("holy", "KEPT", { atSeconds: 2000 }), step("short", "REPLACED")] })
  assert.deepEqual(
    [...one('[aria-label="Cần sửa"]').children].map((line) => line.textContent),
    ["Thánh kiếm: Thời điểm phải nằm trong ván.", "Kiếm ngắn: Chỉ ghi trang bị cấp 2 và cấp 3."],
  )
})

test("the moments of the equipment stay folded under the list and say how many there are", async () => {
  const catalog: Catalog = { heroes: [], items: ITEMS, arcana: [], enchantments: [], spells: [] }
  await render(
    <EquipmentEditor
      participant={player({
        equipmentSnapshots: [snapshot(300, ["boots"]), snapshot(900, ["holy"])],
        equipmentEvents: [{ atSeconds: 200, type: "BUY", item: pick("boots"), toSlot: 1 }],
      })}
      catalog={catalog}
      onChange={() => {}}
    />,
  )
  const part = one<HTMLDetailsElement>("details")
  assert.equal(part.open, false)
  assert.match(part.querySelector("summary")!.textContent ?? "", /Mốc trang bị theo thời gian.*2 mốc, 1 lần mua bán/)
})

const catalog: Catalog = { heroes: [], items: ITEMS, arcana: [], enchantments: [], spells: [] }
const withTop = (more: Partial<Participant>): GameContent => {
  const { content } = completeGame(1, "a")
  return {
    ...content,
    sides: content.sides.map((side) =>
      side.side !== "BLUE"
        ? side
        : {
            ...side,
            participants: side.participants.map((entry) => (entry.lane === "TOP" ? { ...entry, ...more } : entry)),
          },
    ),
  }
}
const viewOf = (content: GameContent): GameView => buildGameView(record("g1", content), [], [], catalog)

test("the items of a player are counted at once, and edits made before the last one is saved are kept", async () => {
  const kept = await onDesk({ build: [step("boots")] })
  const tab = () => document.querySelector('nav[aria-label="Phần của tuyển thủ"] [aria-pressed="true"]')?.textContent
  const saved = () => top(kept).build!.map((entry) => entry.item.id)
  assert.equal(tab(), "Trang bị1")

  const answer = kept.hold()
  await openPlace("KEPT")
  await choose("holy")
  await choose("aegis")
  assert.equal(tab(), "Trang bị3", "shown at once")
  assert.deepEqual(saved(), ["boots"], "while the service has not answered yet")
  answer()
  await waitFor(() => saved().length === 3, "both are saved")
  assert.deepEqual(saved(), ["boots", "holy", "aegis"])
})

test("the face of each player says whether their items are written down, read from a moment or missing", async () => {
  const content = withTop({ build: [step("boots")] })
  const [blue] = content.sides
  blue!.participants[1] = { ...blue!.participants[1]!, equipmentSnapshots: [snapshot(900, ["holy"])] }
  await render(
    <SeatStrip
      game={viewOf(content)}
      content={content}
      index={index}
      chosen="BLUE:TOP"
      onChoose={() => {}}
      onBack={() => {}}
    />,
  )
  assert.deepEqual(
    [...document.querySelectorAll('[data-side="BLUE"] button')]
      .slice(0, 3)
      .map((face) => face.getAttribute("aria-label")!.split(", ").at(-1)),
    ["trang bị đã ghi", "trang bị đọc từ mốc", "trang bị chưa ghi"],
  )
})

const board = (content: GameContent, at: number | null) => (
  <LineupBoard
    game={viewOf(content)}
    events={[]}
    at={at}
    lookups={{ itemIcon: () => null, itemTier: () => null }}
    locks={{ decider: false, byTeam: new Map() }}
    roster={() => []}
    picks={() => []}
  />
)
const slots = () =>
  [...document.querySelectorAll('[data-seat="BLUE:TOP"] .esp-seat-item')]
    .map((slot) => slot.getAttribute("aria-label"))
    .filter((label) => !label?.includes("chưa quan sát"))

test("the six slots read the kept items, each from its time on, where no source showed the equipment", async () => {
  const content = withTop({
    build: [step("boots"), step("sword", "REPLACED"), step("holy", "KEPT", { atSeconds: 400 })],
  })
  const rendered = await render(board(content, 100))
  assert.deepEqual(slots(), ["Giày hộ vệ"])
  await rendered.rerender(board(content, 500))
  assert.deepEqual(slots(), ["Giày hộ vệ", "Thánh kiếm"])
})

test("what a source showed at a moment stands until the game ends with the kept items", async () => {
  const content = withTop({ build: [step("holy")], equipmentSnapshots: [snapshot(300, ["boots"])] })
  const rendered = await render(board(content, 600))
  assert.deepEqual(slots(), ["Giày hộ vệ"])
  await rendered.rerender(board(content, 900))
  assert.deepEqual(slots(), ["Thánh kiếm"])
  assert.equal(document.querySelector("[data-changed]"), null, "the end of the game is no purchase")
})

test("a list read off a moment is not shown before that moment", async () => {
  const content = withTop({ equipmentSnapshots: [snapshot(700, ["holy"])] })
  await render(board(content, 600))
  assert.deepEqual(slots(), [])
})

test("at the end of the game a player seen only in its middle holds nothing known", async () => {
  await render(board(withTop({ equipmentSnapshots: [snapshot(300, ["boots"])] }), null))
  assert.match(document.body.textContent ?? "", /Trang bị cuối ván/)
  assert.deepEqual(slots(), [])
})

test("at the end of the game an inventory seen in its last minute is the one it ended with", async () => {
  await render(board(withTop({ equipmentSnapshots: [snapshot(850, ["boots"])] }), null))
  assert.deepEqual(slots(), ["Giày hộ vệ"])
})

test("the last second of the game is read as its end, not as a moment of it", async () => {
  const content = withTop({ equipmentSnapshots: [snapshot(300, ["boots"])] })
  await render(board(content, content.durationSeconds!))
  assert.match(document.body.textContent ?? "", /Trang bị cuối ván/)
  assert.deepEqual(slots(), [])
})
