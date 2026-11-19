import assert from "node:assert/strict"
import { test } from "node:test"
import { act, useState } from "react"
import { intersectionHarness } from "./fixtures/intersection-observer"
import type { Catalog, SeriesContent } from "@aov/community-contracts"
import {
  emptyParticipant,
  emptySnapshot,
  initialGame,
  minuteLabel,
  parseGameTime,
  selectionName,
} from "../src/features/tournaments/model/tournament-model"
import { button, choose, click, QuietResizeObserver, render, withDom, withGlobals } from "./fixtures/dom"

withDom({
  url: "http://localhost:5175/tournaments",
  globals: () => ({ ResizeObserver: QuietResizeObserver, IntersectionObserver: intersectionHarness().Observer }),
})
const select = (selector: string) => document.querySelector<HTMLSelectElement>(selector)!

const series: SeriesContent = {
  code: "final",
  tournamentId: "tournament",
  teamAId: "team-a",
  teamBId: "team-b",
  bestOf: 7,
}
const catalog: Catalog = { heroes: [], items: [], arcana: [], enchantments: [], spells: [] }

test("each game starts independently with four bans, five distinct lanes and explicit unknown loadouts", () => {
  const first = initialGame("series", series, 1)
  const second = initialGame("series", series, 2)
  assert.equal(first.sides.length, 2)
  for (const side of first.sides) {
    assert.equal(side.bans.length, 4)
    assert.equal(side.participants.length, 5)
    assert.equal(new Set(side.participants.map((player) => player.lane)).size, 5)
    assert.ok(
      side.participants.every(
        (player) =>
          !player.playerId &&
          !player.hero.id &&
          !player.spell.id &&
          player.arcana.status === "UNKNOWN" &&
          player.enchantments.status === "UNKNOWN",
      ),
    )
  }
  first.sides[0].participants[0].hero = { name: "Observed hero" }
  first.patchVariantId = "patch-one"
  assert.equal(second.patchVariantId, null)
  assert.equal(second.sides[0].participants[0].hero.name, null)
  const multiMarket = initialGame("series", series, 3, "TW/HK/MO")
  assert.equal(multiMarket.region, "GLOBAL")
  assert.equal(multiMarket.seasonId, null)
  assert.equal(multiMarket.patchVariantId, null)
})

test("inventory observations number all six slots and keep unobserved distinct from verified empty", () => {
  const snapshot = emptySnapshot(330)
  assert.deepEqual(
    snapshot.slots.map((slot) => slot.slot),
    [1, 2, 3, 4, 5, 6],
  )
  assert.ok(snapshot.slots.every((slot) => !slot.known && slot.item === null))
  snapshot.slots[0] = { slot: 1, known: true, item: null }
  assert.equal(snapshot.slots[0].known, true)
  assert.equal(snapshot.slots[1].known, false)
  assert.equal(parseGameTime("05:30"), 330)
  assert.equal(minuteLabel(330), "05:30")
  for (const value of ["5.5", "05:99", "-1:00", "garbage"]) assert.equal(parseGameTime(value), null)
})

test("ID-only references resolve visible and accessible labels from their loaded catalog", async () => {
  const heroes = [{ id: "hero", code: "errol", name: "Errol", iconUrl: "https://img.example/errol.webp" }]
  assert.equal(selectionName({ id: "hero" }, heroes), "Errol")
  assert.equal(selectionName({ name: "Recorded hero" }, heroes), "Recorded hero")
  const { CatalogPicker } = await import("../src/features/tournaments/components/catalog-picker")
  await render(<CatalogPicker value={{ id: "hero" }} options={heroes} label="Cấm 1" onChange={() => {}} />)
  const trigger = document.querySelector<HTMLButtonElement>(".tournament-catalog-trigger")
  assert.equal(trigger?.getAttribute("aria-label"), "Cấm 1: Errol")
  assert.equal(trigger?.title, "Cấm 1: Errol")
  assert.equal(trigger?.querySelector(".tournament-catalog-label")?.textContent, "Errol")
  assert.equal(trigger?.querySelector("img")?.getAttribute("src"), heroes[0].iconUrl)
})

test("equipment editor saves a six-slot observation without fabricating purchases or treating unknown as empty", async () => {
  const { EquipmentEditor } = await import("../src/features/tournaments/components/equipment-editor")
  let latest = emptyParticipant("TOP")
  function Host() {
    const [value, setValue] = useState(latest)
    return (
      <EquipmentEditor
        participant={value}
        catalog={catalog}
        onChange={(value) => {
          latest = value
          setValue(value)
        }}
      />
    )
  }
  await render(<Host />)
  await click(button("Thêm mốc 6 ô"), "add snapshot button")
  assert.equal(latest.equipmentSnapshots.length, 1)
  assert.equal(latest.equipmentEvents.length, 0)
  assert.equal(document.querySelectorAll('[aria-label^="Trạng thái ô"]').length, 6)
  await choose(select('[aria-label="Trạng thái ô 1"]'), "empty")
  assert.deepEqual(latest.equipmentSnapshots[0].slots[0], { slot: 1, known: true, item: null })
  assert.equal(latest.equipmentSnapshots[0].slots[1].known, false)
  await click(button("Thêm mốc 6 ô"), "add snapshot button")
  assert.match(document.querySelector('[role="alert"]')?.textContent ?? "", /đã có/)
  assert.equal(latest.equipmentSnapshots.length, 1)
})

test("changing one game's season keeps its already observed picks and leaves other games untouched", async () => {
  const fetch = async () =>
    Response.json({
      seasons: [{ id: "s3", name: "S3 2026", patches: [{ id: "p3", code: "s3-final", title: "Baseline" }] }],
    })
  await withGlobals({ fetch }, async () => {
    const { GameScope } = await import("../src/features/tournaments/components/game-scope")
    let latest = initialGame("series", series, 1)
    latest.sides[0].participants[0].hero = { id: "hero", name: "Airi" }
    const other = initialGame("series", series, 2)
    function Host() {
      const [value, setValue] = useState(latest)
      return (
        <GameScope
          content={value}
          disabled={false}
          onChange={(value) => {
            latest = value
            setValue(value)
          }}
        />
      )
    }
    await render(<Host />)
    await choose(select("select:nth-of-type(1)"), "VN")
    await choose(select('select[aria-label="Mùa"]'), "s3")
    assert.equal(latest.seasonId, "s3")
    assert.equal(latest.patchVariantId, null)
    assert.deepEqual(latest.sides[0].participants[0].hero, { id: "hero", name: "Airi" })
    assert.equal(other.seasonId, null)
  })
})

test("tournament list opens the selected record and displays recorded match counts", async () => {
  const { TournamentList } = await import("../src/features/tournaments/components/tournament-list")
  let opened = ""
  await render(
    <TournamentList
      entries={[
        {
          id: "cup",
          version: 0,
          createdAt: "",
          updatedAt: "",
          missingFields: [],
          content: {
            code: "cup",
            name: "Test Cup",
            region: "VN",
            startsOn: "2026-10-01",
            status: "ONGOING",
            tier: "A",
          },
        },
      ]}
      stats={new Map([["cup", { teams: 4, matches: 6, played: 2 }]])}
      onOpen={(entry) => {
        opened = entry.id
      }}
    />,
  )
  const opener = document.querySelector<HTMLButtonElement>('[aria-label="Mở giải Test Cup"]')!
  assert.ok(opener)
  assert.match(document.body.textContent ?? "", /Từ 01\/10\/2026/)
  assert.match(document.body.textContent ?? "", /2\/6 trận đã đấu/)
  assert.match(document.body.textContent ?? "", /4 đội tham dự/)
  await act(async () => opener.click())
  assert.equal(opened, "cup")
})
