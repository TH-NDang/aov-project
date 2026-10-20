import assert from "node:assert/strict"
import { test } from "node:test"
import { itemShopLayout, itemShopSections } from "../src/features/warehouse/item-shop-layout"
import type { ItemContent, WarehouseEntry } from "../src/features/warehouse/warehouse-types"

function item(id: string, column: number | null, content: Partial<ItemContent> = {}): WarehouseEntry<ItemContent> {
  return {
    id,
    code: id,
    revision: {
      id: `revision-${id}`,
      ownerId: id,
      code: id,
      rulesetId: "ruleset",
      revisionNo: 1,
      state: "DRAFT",
      version: 1,
      publicationSequence: null,
      publishedAt: null,
      cause: "DATA_BASELINE",
      effectiveFromPatchVariantId: null,
      sourceRevisionId: null,
      createdAt: "",
      updatedAt: "",
    },
    content: {
      tier: column === null ? 3 : column + 1,
      price: 100,
      categoryCode: "attack",
      shopPositions: [{ categoryCode: "attack", column, row: 0, variant: null }],
      recipeStatus: "VERIFIED",
      components: [],
      stats: [],
      iconAssetId: null,
      translations: [{ locale: "vi-VN", name: id }],
      notes: null,
      ...content,
    },
  }
}

function components(...ids: string[]) {
  return ids.map((itemId) => ({ itemId, quantity: 1 }))
}

test("terminal tier three items keep their actual column two placement and source position index", () => {
  const rows = [
    item("ingredient", 1),
    item("final", 1, {
      tier: 3,
      components: components("ingredient"),
      shopPositions: [
        { categoryCode: "magic", column: 2, row: 4, variant: null },
        { categoryCode: "attack", column: 1, row: 7, variant: null },
      ],
    }),
    item("normal", 2),
  ]
  const result = itemShopLayout(rows, "final", "attack")
  assert.deepEqual(
    result.placements.map(({ item, position, index, terminal }) => [
      item.id,
      position.column,
      position.row,
      index,
      terminal,
    ]),
    [
      ["ingredient", 1, 0, 0, false],
      ["final", 1, 7, 1, true],
      ["normal", 2, 0, 0, false],
    ],
  )
  assert.deepEqual(result.external, [])
})

test("tier three ingredients with verified upgrades stay ordinary while unknown recipes add no upgrade", () => {
  const rows = [
    item("ingredient", 1, { tier: 3 }),
    item("final", 2, { components: components("ingredient") }),
    item("terminal", 1, { tier: 3 }),
    item("uncertain", 2, {
      recipeStatus: "UNKNOWN",
      components: components("terminal"),
    }),
  ]
  const result = itemShopLayout(rows, null, "attack")
  assert.equal(result.placements.find(({ item }) => item.id === "ingredient")?.terminal, false)
  assert.equal(result.placements.find(({ item }) => item.id === "terminal")?.terminal, true)
})

test("external recipe relatives use actual source columns, deduplicate diamonds and omit upgrade siblings", () => {
  const sourcePosition = (column: number) => [{ categoryCode: "defense", column, row: 2, variant: null }]
  const rows = [
    item("shared", 0, { categoryCode: "defense", shopPositions: sourcePosition(0) }),
    item("left", 1, { categoryCode: "defense", shopPositions: sourcePosition(1), components: components("shared") }),
    item("right", 1, { components: components("shared") }),
    item("selected", 2, { components: components("left", "right", "missing") }),
    item("sibling", 0, { categoryCode: "defense", shopPositions: sourcePosition(0) }),
    item("upgrade", 1, {
      tier: 3,
      categoryCode: "defense",
      shopPositions: sourcePosition(1),
      components: components("selected", "sibling"),
    }),
  ]
  const result = itemShopLayout(rows, "selected", "attack")
  assert.deepEqual(
    result.external.map(({ item, position, index, categoryCode }) => [item.id, position?.column, index, categoryCode]),
    [
      ["shared", 0, 0, "defense"],
      ["left", 1, 0, "defense"],
      ["upgrade", 1, 0, "defense"],
    ],
  )
  assert.deepEqual(result.missingIds, ["missing"])
})

test("source position selection respects variants, prefers the item's category and never invents a tier column", () => {
  const rows = [
    item("selected", 2, { components: components("external", "native") }),
    item("external", null, {
      categoryCode: "defense",
      tier: 3,
      shopPositions: [
        { categoryCode: "attack", column: 0, row: 0, variant: "ranged" },
        { categoryCode: "magic", column: 0, row: 2, variant: null },
        { categoryCode: "defense", column: 1, row: 4, variant: "melee" },
        { categoryCode: "defense", column: 2, row: 5, variant: null },
      ],
    }),
    item("native", 0, {
      shopPositions: [
        { categoryCode: "defense", column: 1, row: 0, variant: null },
        { categoryCode: "attack", column: 0, row: 1, variant: "melee" },
      ],
    }),
  ]
  const result = itemShopLayout(rows, "selected", "attack", "melee")
  assert.deepEqual(
    result.external.map(({ item, position, index }) => [item.id, position?.column, position?.row, index]),
    [["external", 1, 4, 2]],
  )
  assert.equal(result.placements.find(({ item }) => item.id === "native")?.index, 1)
  assert.equal(itemShopLayout(rows, "selected", "attack", "ranged").external.length, 1)
  assert.equal(itemShopLayout(rows, "selected", "attack").external.length, 0)
})

test("unplaced records and external selections remain available without coordinate inference or mutation", () => {
  const rows = [
    item("native-unplaced", null),
    item("source-unplaced", null, {
      categoryCode: "defense",
      shopPositions: [{ categoryCode: "defense", column: 1, row: null, variant: null }],
      components: components("without-position", "malformed", "native-unplaced"),
    }),
    item("without-position", null, { categoryCode: "magic", shopPositions: [] }),
    item("malformed", null, {
      categoryCode: "defense",
      shopPositions: [
        { categoryCode: "defense", column: -1, row: 0, variant: null },
        { categoryCode: "magic", column: 0, row: 3, variant: null },
      ],
    }),
    item("isolated", null, { categoryCode: "magic", shopPositions: [] }),
  ]
  const snapshot = structuredClone(rows)
  const result = itemShopLayout(rows, "source-unplaced", "attack")
  assert.equal(result.placements[0].position.column, null)
  assert.deepEqual(
    result.external.map(({ item, position, categoryCode, index }) => [
      item.id,
      position?.column ?? null,
      position?.row ?? null,
      categoryCode,
      index,
    ]),
    [
      ["source-unplaced", 1, null, "defense", 0],
      ["without-position", null, null, "magic", -1],
      ["malformed", 0, 3, "magic", 1],
    ],
  )
  assert.deepEqual(
    itemShopLayout(rows, "isolated", "attack").external.map(({ item }) => item.id),
    ["isolated"],
  )
  assert.deepEqual(itemShopLayout(rows, "unknown", "attack").missingIds, ["unknown"])
  assert.deepEqual(rows, snapshot)
})

test("contiguous sections keep Cầu chiêm tinh between the terminal items in canonical shop order", () => {
  const position = (row: number) => [{ categoryCode: "magic", column: 1, row, variant: null }]
  const items = [
    item("xuyen-tam-lenh", 1, { tier: 3, shopPositions: position(9) }),
    item("cau-chiem-tinh", 1, { tier: 2, shopPositions: position(8) }),
    item("day-chuyen-luc-bao", 1, { tier: 3, shopPositions: position(7) }),
    item("truong-bung-no", 2, {
      categoryCode: "magic",
      components: components("cau-chiem-tinh"),
      shopPositions: [{ categoryCode: "magic", column: 2, row: 0, variant: null }],
    }),
  ]
  const placements = itemShopLayout(items, null, "magic").placements
  const snapshot = structuredClone(placements)
  const result = itemShopSections(placements, 1)
  assert.deepEqual(
    result.map(({ terminal, rows }) => [
      terminal,
      rows.map(({ row, placements }) => [row, placements.map(({ item }) => item.id)]),
    ]),
    [
      [false, Array.from({ length: 7 }, (_, row) => [row, []])],
      [true, [[7, ["day-chuyen-luc-bao"]]]],
      [false, [[8, ["cau-chiem-tinh"]]]],
      [true, [[9, ["xuyen-tam-lenh"]]]],
    ],
  )
  assert.equal(result[2].rows[0].placements[0], placements[1])
  assert.equal(result[2].rows[0].placements[0].index, 0)
  assert.deepEqual(placements, snapshot)
})

test("section gaps and mixed rows stay ordinary without changing each card's terminal state", () => {
  const rows = [
    item("last", 1, {
      tier: 3,
      shopPositions: [{ categoryCode: "attack", column: 1, row: 4, variant: null }],
    }),
    item("mixed-terminal", 1, {
      tier: 3,
      shopPositions: [{ categoryCode: "attack", column: 1, row: 2, variant: null }],
    }),
    item("mixed-ordinary", 1, {
      tier: 2,
      shopPositions: [{ categoryCode: "attack", column: 1, row: 2, variant: null }],
    }),
    item("first", 1, { tier: 3 }),
  ]
  const placements = itemShopLayout(rows, null, "attack").placements
  const result = itemShopSections(placements, 1)
  assert.deepEqual(
    result.map(({ terminal, rows }) => [terminal, rows.map(({ row }) => row)]),
    [
      [true, [0]],
      [false, [1, 2, 3]],
      [true, [4]],
    ],
  )
  assert.deepEqual(
    result[1].rows[1].placements.map(({ item, terminal }) => [item.id, terminal]),
    [
      ["mixed-terminal", true],
      ["mixed-ordinary", false],
    ],
  )
  assert.equal(result[1].rows[1].placements[0], placements[1])
  assert.equal(result[1].rows[1].placements[1], placements[2])
})

test("sections ignore invalid coordinates and use three empty slots only for an empty valid column", () => {
  const rows = [
    item("valid", 0),
    item("negative-row", 1, {
      shopPositions: [{ categoryCode: "attack", column: 1, row: -1, variant: null }],
    }),
    item("fractional-row", 1, {
      shopPositions: [{ categoryCode: "attack", column: 1, row: 1.5, variant: null }],
    }),
    item("null-row", 1, {
      shopPositions: [{ categoryCode: "attack", column: 1, row: null, variant: null }],
    }),
    item("fractional-column", 1.5),
    item("null-column", null),
  ]
  const placements = itemShopLayout(rows, null, "attack").placements
  assert.deepEqual(itemShopSections(placements, 1), [
    { terminal: false, rows: [0, 1, 2].map((row) => ({ row, placements: [] })) },
  ])
  assert.equal(itemShopSections(placements, 0)[0].rows.length, 1)
  assert.deepEqual(itemShopSections(placements, -1), [])
  assert.deepEqual(itemShopSections(placements, 1.5), [])
  assert.deepEqual(itemShopSections(placements, Number.NaN), [])
})
