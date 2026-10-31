import assert from "node:assert/strict"
import { test } from "node:test"
import React, { act, useState } from "react"
import { JSDOM } from "jsdom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { Catalog, GameContent, Participant, SeriesContent } from "@aov/community-contracts"
import {
  emptyParticipant,
  emptySnapshot,
  initialGame,
  minuteLabel,
  parseGameTime,
  selectionName,
} from "../src/features/tournaments/tournament-model"

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
  await withUi(async ({ render, document }) => {
    const { CatalogPicker } = await import("../src/features/tournaments/catalog-picker")
    await render(<CatalogPicker value={{ id: "hero" }} options={heroes} label="Cấm 1" onChange={() => {}} />)
    const trigger = document.querySelector<HTMLButtonElement>(".tournament-catalog-trigger")
    assert.equal(trigger?.getAttribute("aria-label"), "Cấm 1: Errol")
    assert.equal(trigger?.title, "Cấm 1: Errol")
    assert.equal(trigger?.querySelector(".tournament-catalog-label")?.textContent, "Errol")
    assert.equal(trigger?.querySelector("img")?.getAttribute("src"), heroes[0].iconUrl)
  })
})

async function withUi(
  run: (context: {
    document: Document
    render: (node: React.ReactNode) => Promise<void>
    click: (text: string) => Promise<void>
    change: (selector: string, value: string) => Promise<void>
  }) => Promise<void>,
) {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost:5175/tournaments" })
  const values = {
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    BroadcastChannel: undefined,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLSelectElement: dom.window.HTMLSelectElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    MutationObserver: dom.window.MutationObserver,
    getComputedStyle: dom.window.getComputedStyle,
    requestAnimationFrame: (callback: () => void) => setTimeout(callback, 0),
    cancelAnimationFrame: clearTimeout,
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    IS_REACT_ACT_ENVIRONMENT: true,
  }
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries(values)) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { createRoot } = await import("react-dom/client")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const document = dom.window.document
  try {
    await run({
      document,
      render: async (node) => {
        await act(async () => root.render(node))
      },
      click: async (text) => {
        const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
          (button) => button.textContent?.trim() === text,
        )
        assert.ok(button, text)
        await act(async () => button.click())
      },
      change: async (selector, value) => {
        const element = document.querySelector<HTMLSelectElement>(selector)
        assert.ok(element, selector)
        await act(async () => {
          element.value = value
          element.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
        })
      },
    })
  } finally {
    await act(async () => root.unmount())
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
}

test("equipment editor saves a six-slot observation without fabricating purchases or treating unknown as empty", async () => {
  await withUi(async ({ render, click, change, document }) => {
    const { EquipmentEditor } = await import("../src/features/tournaments/equipment-editor")
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
    await click("Thêm mốc 6 ô")
    assert.equal(latest.equipmentSnapshots.length, 1)
    assert.equal(latest.equipmentEvents.length, 0)
    assert.equal(document.querySelectorAll('[aria-label^="Trạng thái ô"]').length, 6)
    await change('[aria-label="Trạng thái ô 1"]', "empty")
    assert.deepEqual(latest.equipmentSnapshots[0].slots[0], { slot: 1, known: true, item: null })
    assert.equal(latest.equipmentSnapshots[0].slots[1].known, false)
    await click("Thêm mốc 6 ô")
    assert.match(document.querySelector('[role="alert"]')?.textContent ?? "", /đã có/)
    assert.equal(latest.equipmentSnapshots.length, 1)
  })
})

test("missing broadcast loadouts stay explicit and do not become empty known configurations", async () => {
  await withUi(async ({ render, change, document }) => {
    const { LoadoutEditor } = await import("../src/features/tournaments/loadout-editor")
    let latest = emptyParticipant("JUNGLE")
    function Host() {
      const [value, setValue] = useState(latest)
      return (
        <LoadoutEditor
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
    await change('[aria-label="Mức độ quan sát bảng ngọc"]', "NOT_SHOWN")
    assert.equal(latest.arcana.status, "NOT_SHOWN")
    assert.deepEqual(latest.arcana.entries, [])
    assert.equal(latest.enchantments.status, "UNKNOWN")
    assert.match(document.body.textContent ?? "", /không xem đây là bảng trống/)
  })
})

test("changing one game's season keeps its already observed picks and leaves other games untouched", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () =>
    Response.json({
      seasons: [{ id: "s3", name: "S3 2026", patches: [{ id: "p3", code: "s3-final", title: "Baseline" }] }],
    })
  try {
    await withUi(async ({ render, change }) => {
      const { GameScope } = await import("../src/features/tournaments/game-scope")
      const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
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
      await render(
        <QueryClientProvider client={client}>
          <Host />
        </QueryClientProvider>,
      )
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20))
      })
      await change("select:nth-of-type(1)", "VN")
      await change('select[aria-label="Mùa"]', "s3")
      assert.equal(latest.seasonId, "s3")
      assert.equal(latest.patchVariantId, null)
      assert.deepEqual(latest.sides[0].participants[0].hero, { id: "hero", name: "Airi" })
      assert.equal(other.seasonId, null)
      client.clear()
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("team regions filter independently from name search", async () => {
  await withUi(async ({ render, document, change, click }) => {
    const { TeamRegistry } = await import("../src/features/tournaments/team-registry")
    const entry = <T,>(id: string, content: T) => ({
      id,
      content,
      version: 0,
      createdAt: "2026-10-26T00:00:00Z",
      updatedAt: "2026-10-26T00:00:00Z",
      missingFields: [],
    })
    const teams = [
      entry("team-vn", { code: "team-vn", name: "Vietnam Team", country: "VN" }),
      entry("team-th", { code: "team-th", name: "Thailand Team", country: "TH" }),
    ]
    let region = ""
    function Host() {
      const [country, setCountry] = useState("")
      return (
        <TeamRegistry
          teams={teams}
          country={country}
          search=""
          canWrite={false}
          onCountryChange={(country) => {
            region = country
            setCountry(country)
          }}
          onSearchChange={() => {}}
          onEdit={() => assert.fail("Read-only must not edit")}
        />
      )
    }
    await render(<Host />)
    assert.equal(document.querySelectorAll("tbody tr").length, 2)
    await change('[aria-label="Lọc khu vực đội tuyển"]', "TH")
    assert.equal(region, "TH")
    assert.equal(document.querySelectorAll("tbody tr").length, 1)
    assert.match(document.querySelector("tbody tr")?.textContent ?? "", /Thailand Team/)
    assert.equal(document.querySelectorAll('[aria-label^="Sửa đội"]').length, 0)
  })
})

test("team identities open the editor through alias search while roster actions remain separate", async () => {
  await withUi(async ({ render, document }) => {
    const { TeamRegistry } = await import("../src/features/tournaments/team-registry")
    let edited = ""
    let roster = ""
    await render(
      <TeamRegistry
        teams={[
          {
            id: "fw",
            version: 0,
            createdAt: "",
            updatedAt: "",
            missingFields: [],
            content: {
              code: "wanin-flashwolves",
              name: "WANIN FlashWolves",
              shortName: "FW",
              aliases: ["Flash Wolves"],
              country: "TW/HK/MO",
            },
          },
        ]}
        country=""
        search="flash wolves"
        canWrite
        onCountryChange={() => {}}
        onSearchChange={() => {}}
        onEdit={(entry) => {
          edited = entry.id
        }}
        onRoster={(entry) => {
          roster = entry.id
        }}
      />,
    )
    const card = document.querySelector<HTMLButtonElement>('[aria-label="Sửa đội WANIN FlashWolves"]')
    assert.ok(card)
    assert.equal(card.tagName, "BUTTON")
    assert.equal(card.querySelector("button"), null)
    assert.match(card.title, /Flash Wolves/)
    assert.match(card.textContent ?? "", /FW/)
    await act(async () => card.click())
    assert.equal(edited, "fw")
    edited = ""
    await act(async () =>
      document.querySelector<HTMLButtonElement>('[aria-label="Đội hình WANIN FlashWolves"]')!.click(),
    )
    assert.equal(roster, "fw")
    assert.equal(edited, "")
  })
})

test("player identities support alias search, optional photos and country badges without inferring a current team", async () => {
  await withUi(async ({ render, document }) => {
    const { PlayerRegistry } = await import("../src/features/tournaments/player-registry")
    let edited = ""
    await render(
      <PlayerRegistry
        players={[
          {
            id: "player",
            version: 0,
            createdAt: "",
            updatedAt: "",
            missingFields: [],
            content: {
              code: "pro",
              nickname: "Pro",
              fullName: "Đặng Văn A",
              aliases: ["Pro Old"],
              country: "VN",
              photoUrl: "https://img.example/player/version.png",
            },
          },
        ]}
        search="pro old"
        country=""
        canWrite
        onSearchChange={() => {}}
        onCountryChange={() => {}}
        onEdit={(entry) => {
          edited = entry.id
        }}
      />,
    )
    const card = document.querySelector<HTMLButtonElement>('[aria-label="Sửa tuyển thủ Pro"]')
    assert.ok(card)
    assert.equal(
      card.querySelector('[aria-label="Ảnh Pro"] img')?.getAttribute("src"),
      "https://img.example/player/version.png",
    )
    assert.match(card.textContent ?? "", /Việt Nam/)
    assert.match(card.textContent ?? "", /Đặng Văn A/)
    assert.equal(card.querySelector("button"), null)
    await act(async () => card.click())
    assert.equal(edited, "player")
  })
})

test("registry pagination resets for sorting and filters, and empty searches can be cleared without editing", async () => {
  await withUi(async ({ render, document, change, click }) => {
    const { PlayerRegistry } = await import("../src/features/tournaments/player-registry")
    const players = Array.from({ length: 31 }, (_, index) => ({
      id: `player-${index}`,
      version: 0,
      createdAt: "",
      updatedAt: "",
      missingFields: [],
      content: {
        code: `player-${index}`,
        nickname: `Player ${String(index).padStart(2, "0")}`,
        country: index === 30 ? "TH" : "VN",
        aliases: index === 30 ? ["Tuyển thủ cuối"] : [],
      },
    }))
    function Host({ search }: { search: string }) {
      const [country, setCountry] = useState("")
      const [cleared, setCleared] = useState(false)
      return (
        <PlayerRegistry
          players={players}
          search={cleared ? "" : search}
          country={country}
          canWrite={false}
          onCountryChange={setCountry}
          onSearchChange={() => setCleared(true)}
          onEdit={() => assert.fail("Read-only must not edit")}
        />
      )
    }
    const next = () => act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Trang sau"]')!.click())
    await render(<Host search="" />)
    assert.equal(document.querySelectorAll("tbody tr").length, 25)
    await next()
    assert.equal(document.querySelectorAll("tbody tr").length, 6)
    assert.match(document.querySelector("tbody tr")?.textContent ?? "", /Player 25/)

    await change('[aria-label="Sắp xếp tuyển thủ"]', "desc")
    assert.equal(document.querySelectorAll("tbody tr").length, 25)
    assert.match(document.querySelector("tbody tr")?.textContent ?? "", /Player 30/)
    await next()
    await render(<Host search="tuyen thu cuoi" />)
    assert.equal(document.querySelectorAll("tbody tr").length, 1)
    assert.match(document.querySelector("tbody tr")?.textContent ?? "", /Player 30/)

    await change('[aria-label="Lọc quốc gia tuyển thủ"]', "VN")
    assert.equal(document.querySelectorAll("tbody tr").length, 0)
    assert.match(document.body.textContent ?? "", /Không tìm thấy tuyển thủ/)
    await click("Xóa bộ lọc")
    assert.equal(document.querySelectorAll("tbody tr").length, 25)
    assert.equal(document.querySelectorAll('[aria-label^="Sửa tuyển thủ"]').length, 0)
  })
})

test("tournament list opens the selected record and displays recorded match counts", async () => {
  await withUi(async ({ render, document }) => {
    const { TournamentList } = await import("../src/features/tournaments/tournament-list")
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
})
