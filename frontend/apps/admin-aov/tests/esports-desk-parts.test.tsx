import assert from "node:assert/strict"
import { beforeEach, test } from "node:test"
import { act, useState } from "react"
import type { DraftTurn, GameContent, Participant } from "@aov/community-contracts"
import { DRAFT_ORDER, moveTurn } from "../src/features/esports/model/draft"
import type { GameDesk } from "../src/features/esports/pages/game-desk"
import { button, click, flush, render, type, withDom } from "./fixtures/dom"
import { catalog, deskOf, emptyGame, recordedGame, selection } from "./fixtures/esports-desk"
import { popoverGlobals } from "./fixtures/esports-ui"

withDom({ url: "http://localhost:5175/tournaments/t/matches/s", globals: popoverGlobals })
beforeEach(() => localStorage.clear())

const { DraftTool } = await import("../src/features/esports/pages/tools/draft-tool")
const { LineupTool } = await import("../src/features/esports/pages/tools/lineup-tool")
const { EnchantmentEditor } = await import("../src/features/esports/components/game/enchantment-editor")
const { EquipmentEditor } = await import("../src/features/tournaments/components/equipment-editor")

const turns = (...names: string[]): DraftTurn[] =>
  names.map((name, index) => ({
    ...DRAFT_ORDER[index]!,
    order: index + 1,
    hero: selection(name),
    atSecond: 100 + index,
  }))
/** Every player of the game without a name, as a game recorded before its line-ups. */
const unnamed = (content: GameContent): GameContent => ({
  ...content,
  sides: content.sides.map((side) => ({
    ...side,
    participants: side.participants.map((participant) => ({ ...participant, playerId: null })),
  })),
})

test("a turn typed while a drag of another turn is being saved keeps the drag", async () => {
  const desk = deskOf({
    content: emptyGame({
      draft: { startSecond: 90, lockedSecond: null, turns: turns("Aoi", "Elsu", "Keera", "Omen", "Yena", "Ryoma") },
    }),
    at: 130,
  })
  let shown: GameDesk = desk
  await render(
    <desk.kept.Host>
      {(current) => {
        shown = current
        return <DraftTool desk={current} />
      }}
    </desk.kept.Host>,
  )
  const release = desk.kept.hold()
  const dragged = shown.record({ text: "Đã dời lượt 5", apply: (content) => moveTurn(content, 5, 140)!, revert: null })
  const search = document.querySelector<HTMLInputElement>("[data-hero-search]")!
  await type(search, "biron")
  await act(async () =>
    search.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })),
  )
  release()
  await act(async () => void (await dragged))
  await flush()
  const saved = desk.kept.content().draft!.turns
  assert.deepEqual([saved[4]?.atSecond, saved[6]?.hero?.name], [140, "Biron"])
})

test("a seat of a team without a registered line-up says why nobody can be chosen", async () => {
  const desk = deskOf({ content: unnamed(recordedGame()), roster: () => [] })
  await render(<desk.kept.Host>{(current) => <LineupTool desk={current} target={null} />}</desk.kept.Host>)
  const list = document.querySelector<HTMLSelectElement>('select[aria-label^="Tuyển thủ"]')!
  assert.equal(list.options[0]?.textContent, "Chưa có đội hình đăng ký ở giải")
})

test("a second seen before the game has its 0:00 is told, with no way to go to it", async () => {
  const content = recordedGame({ sourceTimestampSeconds: undefined })
  const seen = {
    ...content,
    sides: content.sides.map((side, index) =>
      index === 0
        ? {
            ...side,
            participants: side.participants.map((value, lane) =>
              lane === 0 ? { ...value, spellObservedAtSeconds: 0 } : value,
            ),
          }
        : side,
    ),
  }
  const desk = deskOf({ content: seen })
  await render(
    <desk.kept.Host>
      {(current) => <LineupTool desk={current} target={{ seat: "BLUE:TOP", part: "spell" }} />}
    </desk.kept.Host>,
  )
  assert.match(document.querySelector(".esp-seen")?.textContent ?? "", /thấy lúc0:00/)
  assert.equal(
    document.querySelector('.esp-seen button[aria-label^="Tới lúc video hiện"]')?.getAttribute("aria-label"),
    undefined,
  )
})

test("the moments of the six slots offer no purchase of their own", async () => {
  const player: Participant = {
    ...recordedGame().sides[0]!.participants[0]!,
    equipmentSnapshots: [],
    equipmentEvents: [],
  }
  await render(<EquipmentEditor participant={player} catalog={catalog} nowGame={60} onChange={() => {}} />)
  assert.ok(button("Thêm mốc 6 ô"), "the moments of the slots are still added here")
  assert.equal(button("Ghi mua bán")?.textContent, undefined)
})

test("a note of the emblems whose save is refused stays as it was typed", async () => {
  let refuse = () => {}
  function Host() {
    const [value, setValue] = useState(recordedGame().sides[0]!.participants[0]!.enchantments)
    return (
      <EnchantmentEditor
        value={value}
        catalog={catalog}
        allSlots={false}
        onAllSlots={() => {}}
        onChange={(change) => {
          const saved = value
          // Shown at once, as the desk does, and back to what is saved once the service refuses it.
          setValue(change(value))
          return new Promise<boolean>((answer) => {
            refuse = () => {
              setValue(saved)
              answer(false)
            }
          })
        }}
      />
    )
  }
  await render(<Host />)
  await click(button("Ghi chú phù hiệu"))
  const note = document.querySelector<HTMLTextAreaElement>("textarea")!
  await type(note, "Dùng bộ phù hiệu khác")
  await act(async () => note.blur())
  await act(async () => refuse())
  await flush()
  assert.equal(document.querySelector<HTMLTextAreaElement>("textarea")?.value, "Dùng bộ phù hiệu khác")
})
