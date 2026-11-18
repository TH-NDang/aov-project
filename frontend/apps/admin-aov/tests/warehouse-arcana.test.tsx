import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import { useSearchParams } from "react-router"
import type { WarehouseEntry } from "../src/features/warehouse/model/warehouse-types"
import type { ArcanaContent } from "@aov/ui/lib/warehouse-content"
import { withWarehouseUi, fixtureRevision, interceptFetch } from "./fixtures/warehouse-ui"

test("arcana keeps tier III visible, collapses lower tiers and reveals filtered results with circular icons", async () => {
  await withWarehouseUi(async ({ document, client, render }) => {
    const { ArcanaCollection } = await import("../src/features/warehouse/components/arcana-cards")
    client.setQueryData(["media", "asset", "arcana-icon", "content"], { currentUrl: "/arcana.webp" })
    const records: WarehouseEntry<ArcanaContent>[] = [1, 2, 3].map((tier) => ({
      id: `tier-${tier}`,
      code: `tier-${tier}`,
      revision: fixtureRevision(`tier-${tier}`),
      changeKinds: ["INHERITED"],
      content: {
        iconAssetId: "arcana-icon",
        notes: null,
        translations: [{ locale: "vi-VN", name: `Ngọc ${tier}` }],
        color: "RED",
        tier,
        stats: [],
      },
    }))
    let opened: string | undefined
    const props = {
      records,
      locale: "vi-VN",
      selectedId: "",
      onOpen: (entry: WarehouseEntry<ArcanaContent>) => {
        opened = entry.id
      },
    }
    await render(<ArcanaCollection {...props} />)
    assert.ok(document.querySelector('button[aria-label="Xem Ngọc 3"]'))
    assert.equal(document.querySelector('[data-catalog-change="INHERITED"]'), null)
    assert.equal(document.querySelector('button[aria-label="Xem Ngọc 1"]'), null)
    assert.equal(document.querySelector('button[aria-label="Xem Ngọc 2"]'), null)
    const tiers = [...document.querySelectorAll<HTMLButtonElement>('[data-slot="collapsible-trigger"]')]
    assert.match(tiers[0].textContent!, /Ngọc bậc II/)
    assert.match(tiers[1].textContent!, /Ngọc bậc I/)
    const toggle = tiers[1]
    await act(async () => toggle.click())
    const card = document.querySelector<HTMLButtonElement>('button[aria-label="Xem Ngọc 1"]')!
    assert.ok(card)
    assert.ok(card.querySelector("img")?.parentElement?.classList.contains("rounded-full"))
    await act(async () => card.click())
    assert.equal(opened, "tier-1")
    await act(async () => toggle.click())
    assert.equal(document.querySelector('button[aria-label="Xem Ngọc 1"]'), null)
    await render(<ArcanaCollection key="filtered" {...props} records={[records[1]]} revealLowerTiers />)
    assert.ok(document.querySelector('button[aria-label="Xem Ngọc 2"]'))
    assert.equal(document.querySelector('[data-slot="collapsible-trigger"]')?.getAttribute("aria-expanded"), "true")
  })
})

test("arcana groups colors consistently and shortens only matching name prefixes without losing stats", async () => {
  await withWarehouseUi(async ({ document, render }) => {
    const { ArcanaCollection } = await import("../src/features/warehouse/components/arcana-cards")
    const definitions: [ArcanaContent["color"], string][] = [
      ["GREEN", "Xanh III Giáp"],
      ["PURPLE", "Ngọc hỗ trợ"],
      ["RED", "Đỏ III Công phép/Tốc đánh"],
      ["RED", "Đỏ II Công phép"],
    ]
    const records: WarehouseEntry<ArcanaContent>[] = definitions.map(([color, name], index) => ({
      id: `grouped-${index}`,
      code: `grouped-${index}`,
      revision: fixtureRevision(`grouped-${index}`),
      content: {
        color,
        tier: 3,
        iconAssetId: null,
        notes: null,
        translations: [{ locale: "vi-VN", name, statLabels: { magic: "Công phép", speed: "Tốc đánh" } }],
        stats: [
          { key: "magic", value: 4.2, unit: null },
          { key: "speed", value: 0.6, unit: "%" },
        ],
      },
    }))
    await render(<ArcanaCollection records={records} locale="vi-VN" selectedId="grouped-2" onOpen={() => {}} />)

    assert.deepEqual(
      [...document.querySelectorAll("h3")].map((heading) => heading.textContent),
      ["Ngọc Đỏ", "Ngọc Tím", "Ngọc Xanh"],
    )
    const red = document.querySelector('[aria-label="Ngọc Đỏ bậc III"]')!
    assert.match(red.querySelector("header")!.textContent!, /2 ngọc/)
    const card = document.querySelector('button[aria-label="Xem Đỏ III Công phép/Tốc đánh"]')!
    assert.equal(card.querySelector("p")!.textContent, "Công phép / Tốc đánh")
    assert.equal(card.getAttribute("aria-pressed"), "true")
    assert.deepEqual(
      [...card.querySelectorAll("dt")].map((label) => label.textContent),
      ["Công phép", "Tốc đánh"],
    )
    assert.deepEqual(
      [...card.querySelectorAll("dd")].map((value) => value.textContent),
      ["+4.2", "+0.6%"],
    )
    assert.equal(document.querySelector('button[aria-label="Xem Xanh III Giáp"] p')!.textContent, "Giáp")
    assert.equal(document.querySelector('button[aria-label="Xem Ngọc hỗ trợ"] p')!.textContent, "Ngọc hỗ trợ")
    assert.equal(document.querySelector('button[aria-label="Xem Đỏ II Công phép"] p')!.textContent, "Đỏ II Công phép")
    assert.deepEqual(
      records.map((entry) => entry.content.translations[0].name),
      definitions.map(([, name]) => name),
    )
  })
})

test("arcana separates combat groups within each color and tier without duplicating hybrid or utility cards", async () => {
  await withWarehouseUi(async ({ document, render }) => {
    const { ArcanaCollection } = await import("../src/features/warehouse/components/arcana-cards")
    const definitions: [string, ArcanaContent["color"], number, string[]][] = [
      ["physical-defense", "RED", 3, ["physical-attack", "armor"]],
      ["magic-speed", "RED", 3, ["magicAttack", "attackSpeed"]],
      ["utility", "RED", 3, ["magic-defense", "critical-chance"]],
      ["hybrid", "RED", 3, ["physicalAttack", "magic-attack"]],
      ["translated-magic", "PURPLE", 3, ["legacy-stat"]],
      ["lower-physical", "GREEN", 2, ["armorPierce"]],
    ]
    const records: WarehouseEntry<ArcanaContent>[] = definitions.map(([id, color, tier, keys]) => ({
      id,
      code: id,
      revision: fixtureRevision(id),
      content: {
        color,
        tier,
        iconAssetId: null,
        notes: null,
        translations: [{ locale: "vi-VN", name: id, statLabels: { "legacy-stat": "Công phép" } }],
        stats: keys.map((key) => ({ key, value: 1, unit: null })),
      },
    }))
    const before = structuredClone(records)
    const props = { records, locale: "en-US", selectedId: "magic-speed", onOpen: () => {}, revealLowerTiers: true }
    await render(<ArcanaCollection {...props} />)
    const groupCards = (label: string) =>
      [...document.querySelectorAll(`[aria-label="${label}"] button[aria-label^="Xem "]`)].map((card) =>
        card.getAttribute("aria-label"),
      )
    const red = document.querySelector('[aria-label="Ngọc Đỏ bậc III"]')!
    assert.deepEqual(
      [...red.querySelectorAll("h4")].map((heading) => heading.textContent),
      ["Công vật lý", "Phép", "Trung tính"],
    )
    assert.deepEqual(groupCards("Công vật lý · Ngọc Đỏ bậc III"), ["Xem physical-defense"])
    assert.deepEqual(groupCards("Phép · Ngọc Đỏ bậc III"), ["Xem magic-speed"])
    assert.deepEqual(groupCards("Trung tính · Ngọc Đỏ bậc III"), ["Xem utility", "Xem hybrid"])
    assert.deepEqual(groupCards("Phép · Ngọc Tím bậc III"), ["Xem translated-magic"])
    assert.deepEqual(groupCards("Công vật lý · Ngọc Xanh bậc II"), ["Xem lower-physical"])
    assert.equal(document.querySelector('[aria-label="Công vật lý · Ngọc Tím bậc III"]'), null)
    assert.equal(document.querySelector('[aria-label="Xem magic-speed"]')!.getAttribute("aria-pressed"), "true")
    assert.deepEqual(
      [...document.querySelectorAll('[aria-label^="Xem "]')].map((card) => card.getAttribute("aria-label")).sort(),
      definitions.map(([id]) => `Xem ${id}`).sort(),
    )
    assert.deepEqual(records, before)
    await render(<ArcanaCollection {...props} records={[records[1]]} />)
    assert.deepEqual(
      [...document.querySelectorAll("h4")].map((heading) => heading.textContent),
      ["Phép"],
    )
  })
})

test("arcana filters follow the loaded patch and distinguish missing changes from filtered results", async () => {
  await withWarehouseUi(async ({ document, client, render, click }) => {
    const { BackendArcanaPage } = await import("../src/features/warehouse/components/secondary-pages")
    const { warehouseKeys } = await import("../src/features/warehouse/api/warehouse-api")
    const definitions: [string, ArcanaContent["color"], number, string][] = [
      ["red-magic", "RED", 3, "magicAttack"],
      ["red-physical", "RED", 3, "physicalAttack"],
      ["red-critical", "RED", 1, "criticalChance"],
      ["green-armor", "GREEN", 3, "armor"],
    ]
    const records: WarehouseEntry<ArcanaContent>[] = definitions.map(([id, color, tier, key]) => ({
      id,
      code: id,
      revision: fixtureRevision(id),
      content: {
        color,
        tier,
        iconAssetId: null,
        notes: null,
        translations: [{ locale: "vi-VN", name: id }],
        stats: [{ key, value: 1, unit: null }],
      },
    }))
    client.setQueryDefaults(["publishing-rulesets"], { staleTime: Infinity })
    client.setQueryData(["publishing-rulesets"], [{ id: "standard", code: "aov-standard" }])
    client.setQueryDefaults(["user-profile"], { staleTime: Infinity })
    client.setQueryData(["user-profile", "me", "fixture", "editor"], { locale: "vi-VN" })
    client.setQueryData(warehouseKeys.catalog("arcana", "standard", "vi-VN"), records)
    client.setQueryData(["warehouse", "changes", "arcana", "standard", "vi-VN"], [])
    let params = new URLSearchParams()
    let setFilters: (value: string) => void = () => {}
    function Harness() {
      const [current, setCurrent] = useSearchParams()
      params = current
      setFilters = (value) => setCurrent(new URLSearchParams(value))
      return <BackendArcanaPage />
    }
    const shown = () =>
      [...document.querySelectorAll('[aria-label^="Xem "]')].map((card) => card.getAttribute("aria-label"))
    const select = () => document.querySelector<HTMLButtonElement>('[aria-label="Lọc chỉ số ngọc"]')!
    await render(<Harness />)

    await act(async () => setFilters("color=RED&tier=3&stat=magicAttack"))
    assert.equal(params.get("stat"), "magicAttack")
    assert.deepEqual(shown(), ["Xem red-magic"])
    await act(async () => setFilters("color=RED&tier=3&stat=physicalAttack"))
    assert.equal(params.get("stat"), "physicalAttack")
    assert.deepEqual(shown(), ["Xem red-physical"])
    await act(async () => setFilters("color=RED&tier=3&stat=armor"))
    assert.equal(params.has("stat"), false)
    assert.equal(params.get("color"), "RED")
    assert.equal(params.get("tier"), "3")
    assert.deepEqual(shown(), ["Xem red-physical", "Xem red-magic"])

    await act(async () => setFilters("color=RED&stat=criticalChance"))
    assert.deepEqual(shown(), ["Xem red-critical"])
    await act(async () => setFilters("color=RED&tier=3&stat=criticalChance"))
    assert.equal(params.has("stat"), false)
    await act(async () => setFilters("color=RED&q=physical&stat=magicAttack"))
    assert.equal(params.has("stat"), false)
    assert.equal(params.get("q"), "physical")
    assert.deepEqual(shown(), ["Xem red-physical"])

    let resolveScope: (response: Response) => void = () => {}
    interceptFetch((input, init, delegate) => {
      const url = new URL(String(input), "http://localhost")
      if (url.pathname.endsWith("/admin/arcana") && url.searchParams.has("patchVariantId"))
        return new Promise<Response>((resolve) => {
          resolveScope = resolve
        })
      return delegate(input, init)
    })
    await act(async () => setFilters("patch=patch-fixture&stat=armor"))
    assert.equal(params.get("stat"), "armor", "A pending scope must not clear a deep-linked stat")
    assert.equal(select().disabled, true)
    await act(async () => {
      resolveScope(Response.json({ items: [records[3]], totalElements: 1, hasNext: false }))
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
    assert.equal(params.get("stat"), "armor")
    assert.equal(select().disabled, false)
    assert.deepEqual(shown(), ["Xem green-armor"])
    assert.doesNotMatch(document.body.textContent!, /0 mục thay đổi|trong phạm vi này/i)
    const changesKey = [...warehouseKeys.catalog("arcana", "standard", "vi-VN"), "scope", "", "patch-fixture", false]
    client.setQueryData(changesKey, [])
    await act(async () => setFilters("patch=patch-fixture&show=changes&color=GREEN"))
    assert.match(document.body.textContent!, /Chưa ghi nhận thay đổi về ngọc trong patch 2026-10-15/)
    await click("Xem tất cả ngọc")
    assert.equal(params.get("patch"), "patch-fixture")
    assert.equal(params.get("color"), "GREEN")
    assert.equal(params.get("show"), "all")
    assert.deepEqual(shown(), ["Xem green-armor"])

    client.setQueryData(changesKey, [records[3], records[0]])
    client.setQueryData(
      ["warehouse", "changes", "arcana", "standard", "vi-VN"],
      [
        { ownerId: records[0].id, patchVariantId: "patch-fixture", kinds: ["DATA_BASELINE"] },
        { ownerId: records[3].id, patchVariantId: "patch-fixture", kinds: ["BUFF"] },
      ],
    )
    await act(async () => setFilters("patch=patch-fixture&show=changes&color=RED"))
    assert.match(document.body.textContent!, /Không tìm thấy ngọc phù hợp với bộ lọc/)
    assert.doesNotMatch(document.body.textContent!, /Xem tất cả ngọc|Chưa ghi nhận thay đổi về ngọc/)
    await act(async () => setFilters("patch=patch-fixture&show=changes&color=GREEN"))
    assert.deepEqual(shown(), ["Xem green-armor"])
    assert.ok(document.querySelector('[data-catalog-change="BUFF"]'))
    await act(async () => setFilters("patch=patch-fixture&stat=armor"))
    assert.equal(document.querySelector('[data-catalog-change="DATA_BASELINE"]'), null)
    await act(async () => {
      client.setQueryData(
        [...warehouseKeys.catalog("arcana", "standard", "vi-VN"), "scope", "", "patch-fixture", true],
        [],
      )
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    assert.equal(params.has("stat"), false)
    assert.equal(select().disabled, true)
    assert.deepEqual(shown(), [])
    const draftKey = [...warehouseKeys.catalog("arcana", "standard", "vi-VN"), "drafts"]
    await act(async () => {
      client.setQueryData(draftKey, [
        records[0],
        { ...records[1], revision: { ...records[1].revision, effectiveFromPatchVariantId: "another-patch" } },
      ])
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    assert.deepEqual(shown(), ["Xem red-magic"])
    assert.match(document.body.textContent!, /Nháp · Chưa gắn patch/)
    assert.ok(document.querySelector('[aria-label="Mở danh sách bản nháp (2)"]'))
    assert.equal(document.querySelector('[data-catalog-change="INHERITED"]'), null)
    await act(async () => setFilters("patch=patch-fixture&show=changes&color=RED"))
    assert.deepEqual(shown(), [])
    assert.ok(document.querySelector('[aria-label="Mở danh sách bản nháp (2)"]'))
  })
})

test("arcana uses terminology colors and live overrides without adding hover or nested button controls", async () => {
  await withWarehouseUi(async ({ document, client, render }) => {
    const { ArcanaCollection } = await import("../src/features/warehouse/components/arcana-cards")
    const { createArcanaStatColors } = await import("@aov/ui/lib/arcana-stat-colors")
    const { defaultSettings } = await import("../src/features/terminology/settings-api")
    const colors = createArcanaStatColors(defaultSettings.entities)
    assert.equal(colors("Công phép"), "light-dark(#7e22ce, #d8b4fe)")
    assert.equal(colors("Xuyên thủ phép"), colors("Công phép"))
    assert.equal(colors("Công vậy lý", "physicalAttack"), "light-dark(#c2410c, #fdba74)")
    assert.equal(colors("Hồi máu/5s"), "light-dark(#15803d, #86efac)")
    assert.equal(colors("Custom stat", "magicAttack"), colors("Công phép"))
    assert.equal(colors("Unknown stat"), undefined)

    const record: WarehouseEntry<ArcanaContent> = {
      id: "colored-arcana",
      code: "colored-arcana",
      revision: fixtureRevision("colored-arcana"),
      content: {
        color: "RED",
        tier: 3,
        iconAssetId: null,
        notes: null,
        translations: [
          { locale: "vi-VN", name: "Đỏ III Công phép/Tốc đánh", statLabels: { magicAttack: "Công phép" } },
        ],
        stats: [{ key: "magicAttack", value: 4.2, unit: null }],
      },
    }
    let opened = false
    await render(
      <ArcanaCollection
        records={[record]}
        locale="vi-VN"
        selectedId=""
        onOpen={() => {
          opened = true
        }}
      />,
    )
    const settings = {
      ...defaultSettings,
      entities: defaultSettings.entities.map((entity) =>
        entity.id === "cong-phep" ? { ...entity, display: { ...entity.display, color: "#123456" } } : entity,
      ),
    }
    await act(async () => {
      client.setQueryData(["rich-text-settings"], { settings, version: 2 })
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    const card = document.querySelector<HTMLButtonElement>('[aria-label="Xem Đỏ III Công phép/Tốc đánh"]')!
    assert.equal(card.querySelector<HTMLElement>("p")!.style.color, "")
    assert.equal(card.querySelector("p [style]"), null)
    assert.equal(card.querySelector<HTMLElement>("dl > div")!.style.color, "rgb(18, 52, 86)")
    assert.equal(card.querySelector("dd")!.textContent, "+4.2")
    assert.equal(card.querySelector("button, a, [title], [data-slot='tooltip-trigger']"), null)
    assert.equal(card.hasAttribute("aria-describedby"), false)
    await act(async () => card.click())
    assert.equal(opened, true)
  })
})
