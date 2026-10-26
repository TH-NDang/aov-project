import assert from "node:assert/strict"
import { test } from "node:test"
import {
  crossesCard,
  itemEdges,
  recipeConnectionError,
  relatedItemEdges,
  selectedItemEdges,
  routeItemWire,
} from "../src/features/warehouse/item-graph"
import {
  warehouseBaselineMode,
  type ItemContent,
  type SpellContent,
  type WarehouseEntry,
} from "../src/features/warehouse/warehouse-types"

function item(
  id: string,
  components: string[] = [],
  status: ItemContent["recipeStatus"] = "VERIFIED",
): WarehouseEntry<ItemContent> {
  return {
    id,
    code: id,
    revision: {
      id: `revision-${id}`,
      ownerId: id,
      code: id,
      rulesetId: "ruleset",
      revisionNo: 1,
      version: 2,
      state: "DRAFT",
      publicationSequence: null,
      publishedAt: null,
      cause: "DATA_BASELINE",
      effectiveFromPatchVariantId: null,
      sourceRevisionId: null,
      createdAt: "",
      updatedAt: "",
    },
    content: {
      iconAssetId: null,
      tier: 1,
      price: 100,
      categoryCode: "attack",
      shopPositions: [],
      recipeStatus: status,
      components: components.map((itemId) => ({ itemId, quantity: 1 })),
      stats: [],
      translations: [{ locale: "vi-VN", name: id }],
      notes: null,
    },
  }
}
test("item connections reject direct and transitive cycles while preserving diamond recipes", () => {
  const records = [
    item("sword"),
    item("blade", ["sword"]),
    item("hammer", ["sword"]),
    item("final", ["blade", "hammer"]),
  ]
  assert.ok(recipeConnectionError(records, "final", "sword"))
  assert.ok(recipeConnectionError(records, "sword", "sword"))
  assert.equal(recipeConnectionError(records, "blade", "hammer"), null)
  assert.equal(recipeConnectionError(records, "sword", "final"), null)
})
test("graph follows confirmed direct recipes and includes every upstream diamond edge only once", () => {
  const records = [
    item("sword"),
    item("blade", ["sword"]),
    item("hammer", ["sword"]),
    item("final", ["blade", "hammer"]),
    item("unknown", ["final"], "UNKNOWN"),
  ]
  const edges = itemEdges(records)
  assert.equal(edges.length, 4)
  assert.equal(relatedItemEdges(edges, "final").length, 4)
  assert.equal(relatedItemEdges(edges, "sword").length, 4)
  assert.equal(relatedItemEdges(edges, "unknown").length, 0)
})

test("selection highlights only direct ingredients and keeps intermediate and upgrade edges dashed", () => {
  const records = [
    item("base"),
    item("left", ["base"]),
    item("right", ["base"]),
    item("final", ["left", "right"]),
    item("upgrade", ["final"]),
    item("unrelated"),
  ]
  const edges = itemEdges(records)
  assert.deepEqual(selectedItemEdges(edges, null), [])
  const selected = selectedItemEdges(edges, "final")
  assert.equal(selected.length, 5)
  assert.deepEqual(
    selected
      .filter((edge) => edge.direct)
      .map((edge) => edge.from)
      .sort(),
    ["left", "right"],
  )
  assert.equal(selected.find((edge) => edge.from === "final" && edge.to === "upgrade")?.direct, false)
  assert.equal(selected.find((edge) => edge.from === "base" && edge.to === "left")?.direct, false)
  assert.ok(selectedItemEdges(edges, "base").every((edge) => !edge.direct))
})

test("wire arrowheads can end outside card borders without crossing other cards", () => {
  const source = { left: 0, right: 220, top: 0, bottom: 80 }
  const target = { left: 300, right: 520, top: 100, bottom: 180 }
  const route = routeItemWire(source, target, [source, target], 0, 12)
  assert.ok(route)
  assert.equal(route[0].x, 232)
  assert.equal(route.at(-1)?.x, 288)
  for (let i = 1; i < route.length; i++)
    assert.equal(
      [source, target].some((card) => crossesCard(route[i - 1], route[i], card)),
      false,
    )
})
test("orthogonal wires route around intervening cards without crossing their interiors", () => {
  const source = { left: 20, right: 120, top: 50, bottom: 110 },
    target = { left: 380, right: 480, top: 50, bottom: 110 }
  const obstacle = { left: 180, right: 300, top: 20, bottom: 140 }
  const cards = [source, target, obstacle]
  const route = routeItemWire(source, target, cards)
  assert.ok(route)
  assert.ok(route.length > 2)
  for (let i = 1; i < route.length; i++) {
    assert.ok(route[i - 1].x === route[i].x || route[i - 1].y === route[i].y)
    assert.equal(
      cards.some((card) => crossesCard(route[i - 1], route[i], card)),
      false,
    )
  }
})
test("same-column and backwards recipes keep the output and input ports attached", () => {
  const source = { left: 200, right: 300, top: 20, bottom: 80 }
  for (const target of [
    { left: 200, right: 300, top: 140, bottom: 200 },
    { left: 20, right: 120, top: 140, bottom: 200 },
  ]) {
    const route = routeItemWire(source, target, [source, target])
    assert.ok(route)
    assert.equal(route[0].x, source.right)
    assert.equal(route.at(-1)!.x, target.left)
    for (let i = 1; i < route.length; i++)
      assert.equal(
        [source, target].some((card) => crossesCard(route[i - 1], route[i], card)),
        false,
      )
  }
})
test("backend warehouse adapter loads all pages and preserves optimistic version and translation isolation", async () => {
  const broadcast = globalThis.BroadcastChannel
  Object.defineProperty(globalThis, "BroadcastChannel", { configurable: true, value: undefined })
  const { createWarehouseApi } = await import("../src/features/warehouse/warehouse-api")
  Object.defineProperty(globalThis, "BroadcastChannel", { configurable: true, value: broadcast })
  const calls: { path: string; init?: RequestInit }[] = []
  const entry = item("sword")
  const api = createWarehouseApi(async <T>(path: string, init?: RequestInit): Promise<T> => {
    calls.push({ path, init })
    if (init?.method === "PUT") return entry as T
    return { items: [entry], page: calls.length - 1, size: 100, totalElements: 2 } as T
  })
  const rows = await api.list("items", "ruleset", "vi-VN")
  assert.equal(rows.length, 2)
  assert.match(calls[0].path, /page=0/)
  assert.match(calls[1].path, /page=1/)
  await api.save("items", entry, {
    ...entry.content,
    translations: [...entry.content.translations, { locale: "en-US", name: "Sword" }],
  })
  const payload = JSON.parse(String(calls[2].init?.body))
  assert.equal(payload.expectedVersion, 2)
  assert.equal(payload.content.components.length, 0)
  assert.equal(payload.content.translations.length, 2)
  assert.equal(payload.content.translations[0].locale, "vi-VN")
  calls.length = 0
  const signal = new AbortController().signal
  await api.list("enchantments", "ruleset", "vi-VN", signal, { seasonId: "s4", patchVariantId: "september" })
  assert.equal(calls.length, 2)
  for (const call of calls) {
    const parameters = new URL(call.path, "https://fixture.example").searchParams
    assert.equal(parameters.get("seasonId"), "s4")
    assert.equal(parameters.get("patchVariantId"), "september")
    assert.equal(call.init?.signal, signal)
  }
})

test("unscoped baselines remain distinct from gameplay changes and inherit only validated baseline context", () => {
  const baseline = item("baseline").revision
  assert.equal(warehouseBaselineMode(baseline), "initial")
  assert.equal(
    warehouseBaselineMode({ ...baseline, cause: "CONTENT_CORRECTION", sourceRevisionId: "published-baseline" }),
    "inherited",
  )
  assert.equal(
    warehouseBaselineMode({ ...baseline, cause: "TRANSLATION_UPDATE", sourceRevisionId: "published-baseline" }, [
      "effectiveFromPatchVariantId",
    ]),
    undefined,
  )
  assert.equal(warehouseBaselineMode({ ...baseline, cause: "GAME_PATCH", sourceRevisionId: "previous" }), undefined)
})

test("clearing a baseline patch is explicit and never changes a derived revision context", async () => {
  const { createWarehouseApi } = await import("../src/features/warehouse/warehouse-api")
  const payloads: Record<string, unknown>[] = []
  const entry = item("sword")
  entry.revision.effectiveFromPatchVariantId = "observed-patch"
  const api = createWarehouseApi(async <T>(_path: string, init?: RequestInit): Promise<T> => {
    payloads.push(JSON.parse(String(init?.body)))
    return entry as T
  })

  await api.save("items", entry, entry.content)
  await api.save("items", entry, entry.content, null)
  await api.save("items", entry, entry.content, "confirmed-patch")
  const derived = { ...entry, revision: { ...entry.revision, sourceRevisionId: "published-source" } }
  await api.save("items", derived, derived.content, null)
  const spell: WarehouseEntry<SpellContent> = {
    ...entry,
    content: {
      iconAssetId: null,
      translations: [{ locale: "vi-VN", name: "Tốc hành" }],
      notes: null,
      cooldownSeconds: 90,
      unlockLevel: 1,
      availability: "AVAILABLE",
      legacy: false,
      displayOrder: 0,
      states: [],
    },
  }
  await api.save("spells", spell, spell.content, null)

  assert.equal(payloads[0].clearPatchContext, undefined)
  assert.equal(payloads[1].clearPatchContext, true)
  assert.equal(payloads[1].effectiveFromPatchVariantId, undefined)
  assert.equal(payloads[2].clearPatchContext, undefined)
  assert.equal(payloads[2].effectiveFromPatchVariantId, "confirmed-patch")
  assert.equal(payloads[3].clearPatchContext, undefined)
  assert.equal(payloads[4].clearPatchContext, true)
})

test("shop positioning preserves legacy columns, physical gaps, variants and other placements", async () => {
  const { shopColumns, shopRowPeers } = await import("../src/features/warehouse/item-shop-position")
  const edited = item("edited")
  edited.content.shopPositions = [
    { categoryCode: "attack", row: 4, column: 1, variant: "support" },
    { categoryCode: "attack", row: 7, column: 1, variant: null },
  ]
  const makePeer = (id: string, row: number, column: number, variant: string | null, categoryCode = "attack") => {
    const peer = item(id)
    peer.content.shopPositions = [{ categoryCode, row, column, variant }]
    return peer
  }
  const peers = [
    makePeer("general", 0, 1, null),
    makePeer("matching", 5, 1, "support"),
    makePeer("other-branch", 1, 1, "jungle"),
    makePeer("other-column", 2, 4, null),
    makePeer("other-category", 3, 1, null, "defense"),
  ]
  const before = structuredClone([edited, ...peers])
  const result = shopRowPeers(peers, edited, 0)
  assert.deepEqual(
    result.map((p) => [p.item.id, p.row]),
    [
      ["general", 0],
      ["matching", 5],
      ["edited", 7],
    ],
  )
  assert.deepEqual(shopColumns(peers, null), [0, 1, 2, 3, 4])
  assert.deepEqual(shopColumns([], 6), [0, 1, 2, 3, 4, 5, 6])
  assert.deepEqual([edited, ...peers], before)
  assert.deepEqual(
    shopRowPeers(
      peers,
      {
        ...edited,
        content: {
          ...edited.content,
          shopPositions: [{ categoryCode: "attack", row: null, column: null, variant: null }],
        },
      },
      0,
    ),
    [],
  )
})
