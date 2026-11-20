import assert from "node:assert/strict"
import { test } from "node:test"
import { routeItemWire, selectedItemEdges, itemEdges, type CardRect, type Point } from "@aov/ui/lib/item-graph"
import { itemShopSections, itemShopLayout, itemShopRowTracks } from "@aov/ui/lib/item-shop-layout"
import type { ItemContent, WarehouseEntry } from "@aov/ui/lib/warehouse-content"

function item(code: string, content: Partial<ItemContent> = {}): WarehouseEntry<ItemContent> {
  return {
    id: code,
    code,
    revision: {
      state: "PUBLISHED",

      effectiveFromPatchVariantId: null,
    },
    content: {
      categoryCode: "phep",
      tier: 1,
      price: null,
      stats: [],
      notes: null,
      iconAssetId: null,
      translations: [{ locale: "vi-VN", name: code }],
      shopPositions: [],
      recipeStatus: "NONE",
      components: [],
      ...content,
    },
  }
}

function position(column: number | null, row: number | null, categoryCode = "phep", variant: string | null = null) {
  return { column, row, categoryCode, variant }
}

test("shop coordinates remain zero-based and independent from item tiers without mutating source entries", () => {
  const entries = [
    item("xuyen-tam-lenh", { tier: 3, shopPositions: [position(1, 3)] }),
    item("cau-chiem-tinh", { tier: 3, shopPositions: [position(1, 2)] }),
    item("day-chuyen-luc-bao", { tier: 2, shopPositions: [position(1, 1)] }),
    item("sach-phep", { tier: 1, shopPositions: [position(0, 0)] }),
  ]
  const before = structuredClone(entries)
  const { placements } = itemShopLayout(entries, null, "phep")

  assert.deepEqual(
    placements
      .map(({ item, position }) => [item.code, position.column, position.row])
      .sort((a, b) => Number(a[1]) - Number(b[1]) || Number(a[2]) - Number(b[2])),
    [
      ["sach-phep", 0, 0],
      ["day-chuyen-luc-bao", 1, 1],
      ["cau-chiem-tinh", 1, 2],
      ["xuyen-tam-lenh", 1, 3],
    ],
  )
  assert.equal(placements.find(({ item }) => item.id === "cau-chiem-tinh")?.item.content.tier, 3)
  assert.deepEqual(entries, before)
})

test("the shop preserves both variant and default placements within their own category", () => {
  const hybrid = item("hybrid", {
    tier: 3,
    shopPositions: [position(2, 0, "phep", "support"), position(1, 4), position(0, 2, "thu")],
  })

  const magic = itemShopLayout([hybrid], null, "phep")
  assert.equal(magic.placements.length, 2)
  assert.deepEqual([magic.placements[1].position.column, magic.placements[1].position.row], [1, 4])

  const defense = itemShopLayout([hybrid], null, "thu")
  assert.deepEqual([defense.placements[0].position.column, defense.placements[0].position.row], [0, 2])
  assert.equal(itemShopLayout([hybrid], null, "cong").placements.length, 0)
})

test("missing and invalid placements stay unplaced instead of borrowing tier as the column", () => {
  const entries = [
    item("unassigned", { tier: 3 }),
    item("missing-row", { shopPositions: [position(1, null)] }),
    item("negative-column", { shopPositions: [position(-1, 0)] }),
    item("fractional-row", { shopPositions: [position(1, 0.5)] }),
    item("other-category", { categoryCode: "thu" }),
  ]
  const layout = itemShopLayout(entries, null, "phep")

  assert.ok(
    itemShopSections(layout.placements, 0).every((section) => section.rows.every((row) => row.placements.length === 0)),
  )
  assert.deepEqual(
    layout.unplaced.map((entry) => entry.id),
    ["unassigned", "missing-row", "negative-column", "fractional-row"],
  )
  assert.equal(layout.external.length, 0)
})

test("complete items in column two form only contiguous regions and retain isolated middle positions", () => {
  const entries = [
    item("day-chuyen-luc-bao", { tier: 2, shopPositions: [position(1, 0)] }),
    item("cau-chiem-tinh", { tier: 3, shopPositions: [position(1, 1)] }),
    item("complete-neighbor", { tier: 3, shopPositions: [position(1, 2)] }),
    item("xuyen-tam-lenh", { tier: 2, shopPositions: [position(1, 3)] }),
    item("separate-complete", { tier: 3, shopPositions: [position(1, 5)] }),
  ]
  const layout = itemShopLayout(entries, null, "phep")
  const sections = itemShopSections(layout.placements, 1)

  assert.deepEqual(
    sections.map((section) => [section.terminal, section.rows.map(({ row }) => row)]),
    [
      [false, [0]],
      [true, [1, 2]],
      [false, [3, 4]],
      [true, [5]],
    ],
  )
  assert.equal(sections[1].rows[0].placements[0].item.code, "cau-chiem-tinh")
  assert.equal(sections[2].rows[1].placements.length, 0)
  const columns = [0, 1, 2].map((column) => itemShopSections(layout.placements, column))
  assert.deepEqual(itemShopRowTracks(columns, 1), [2, 4, 5, 6, 7, 9, 10])
})

test("a column-two item with a known upgrade remains outside the complete-item region", () => {
  const ingredient = item("ingredient", { tier: 3, shopPositions: [position(1, 0)] })
  const upgrade = item("upgrade", {
    tier: 3,
    shopPositions: [position(2, 0)],
    recipeStatus: "VERIFIED",
    components: [{ itemId: ingredient.id, quantity: 1 }],
  })
  const layout = itemShopLayout([ingredient, upgrade], ingredient.id, "phep")

  assert.equal(layout.placements.find(({ item }) => item.id === ingredient.id)?.terminal, false)
})

test("related items from other categories keep their own physical columns and category labels", () => {
  const attackIngredient = item("attack-ingredient", {
    categoryCode: "cong",
    tier: 3,
    shopPositions: [position(2, 0, "thu"), position(1, 4, "cong"), position(0, 1, "cong", "special")],
  })
  const defenseIngredient = item("defense-ingredient", {
    categoryCode: "thu",
    shopPositions: [position(0, 2, "thu")],
  })
  const selected = item("selected", {
    tier: 3,
    shopPositions: [position(2, 1)],
    recipeStatus: "VERIFIED",
    components: [
      { itemId: attackIngredient.id, quantity: 1 },
      { itemId: defenseIngredient.id, quantity: 2 },
    ],
  })
  const unrelated = item("unrelated", { categoryCode: "cong", shopPositions: [position(0, 0, "cong")] })
  const layout = itemShopLayout([selected, attackIngredient, defenseIngredient, unrelated], selected.id, "phep")

  assert.deepEqual(
    layout.external.map(({ item, position, categoryCode }) => [item.id, position?.column, categoryCode]),
    [
      ["attack-ingredient", 1, "cong"],
      ["defense-ingredient", 0, "thu"],
    ],
  )
  assert.equal(layout.placements.length, 1)
  assert.equal(itemShopLayout([selected, attackIngredient], null, "phep").external.length, 0)
})

test("only verified recipes produce wires, preserve ingredient quantities and report missing references", () => {
  const verified = item("verified", {
    shopPositions: [position(1, 0)],
    recipeStatus: "VERIFIED",
    components: [{ itemId: "missing-ingredient", quantity: 2 }],
  })
  const unknown = item("unknown", {
    recipeStatus: "UNKNOWN",
    components: [{ itemId: "unverified-ingredient", quantity: 1 }],
  })
  const noRecipe = item("none", {
    recipeStatus: "NONE",
    components: [{ itemId: "stale-ingredient", quantity: 1 }],
  })

  assert.deepEqual(itemEdges([verified, unknown, noRecipe]), [
    { from: "missing-ingredient", to: "verified", quantity: 2 },
  ])
  assert.deepEqual(itemShopLayout([verified, unknown, noRecipe], verified.id, "phep").missingIds, [
    "missing-ingredient",
  ])
})

test("selected recipe wires distinguish direct ingredients from ancestors and upgrades without sibling recipes", () => {
  const edges = [
    { from: "basic", to: "middle", quantity: 1 },
    { from: "middle", to: "selected", quantity: 1 },
    { from: "side", to: "selected", quantity: 2 },
    { from: "selected", to: "upgrade", quantity: 1 },
    { from: "upgrade", to: "final", quantity: 1 },
    { from: "basic", to: "sibling", quantity: 1 },
  ]
  const selected = selectedItemEdges(edges, "selected")

  assert.deepEqual(
    selected.map(({ from, to, direct }) => [from, to, direct]).sort(),
    [
      ["basic", "middle", false],
      ["middle", "selected", true],
      ["side", "selected", true],
      ["selected", "upgrade", false],
      ["upgrade", "final", false],
    ].sort(),
  )
  assert.deepEqual(selectedItemEdges(edges, null), [])
})

test("cycle traversal terminates and returns each relationship once", () => {
  const edges = [
    { from: "a", to: "b", quantity: 1 },
    { from: "b", to: "c", quantity: 1 },
    { from: "c", to: "a", quantity: 1 },
  ]
  const selected = selectedItemEdges(edges, "a")

  assert.equal(selected.length, 3)
  assert.deepEqual(
    selected.filter(({ direct }) => direct).map(({ from, to }) => [from, to]),
    [["c", "a"]],
  )
})

function assertClearOrthogonalRoute(route: Point[] | null, source: CardRect, target: CardRect, cards: CardRect[]) {
  assert.ok(route, "A route should exist through the free lanes")
  assert.ok(route.length >= 2)
  assert.deepEqual(route[0], { x: source.right, y: (source.top + source.bottom) / 2 })
  assert.deepEqual(route.at(-1), { x: target.left, y: (target.top + target.bottom) / 2 })

  for (let index = 1; index < route.length; index++) {
    const from = route[index - 1]
    const to = route[index]
    assert.ok(from.x === to.x || from.y === to.y, "Each wire segment should be horizontal or vertical")
    for (const card of cards) {
      const crossesInterior =
        from.x === to.x
          ? from.x > card.left &&
            from.x < card.right &&
            Math.max(from.y, to.y) > card.top &&
            Math.min(from.y, to.y) < card.bottom
          : from.y > card.top &&
            from.y < card.bottom &&
            Math.max(from.x, to.x) > card.left &&
            Math.min(from.x, to.x) < card.right
      assert.equal(crossesInterior, false, "A wire should not pass through an item card")
    }
  }
  assert.ok(route.at(-2)!.x < route.at(-1)!.x, "The final segment should point into the target from the left")
}

test("routing detours around an intervening item card and ends with a right-facing arrow", () => {
  const source = { left: 0, right: 100, top: 0, bottom: 60 }
  const target = { left: 300, right: 400, top: 100, bottom: 160 }
  const obstacle = { left: 150, right: 250, top: 10, bottom: 140 }
  const cards = [source, target, obstacle]

  assertClearOrthogonalRoute(routeItemWire(source, target, cards), source, target, cards)
})

test("routing supports ingredients and complete items in the same physical shop column", () => {
  const source = { left: 0, right: 100, top: 0, bottom: 60 }
  const target = { left: 0, right: 100, top: 200, bottom: 260 }
  const obstacle = { left: 0, right: 100, top: 100, bottom: 160 }
  const cards = [source, target, obstacle]

  assertClearOrthogonalRoute(routeItemWire(source, target, cards, 2), source, target, cards)
})

test("a wire that crosses a column between two rows runs midway through the gap", () => {
  const source = { left: 0, right: 200, top: 100, bottom: 180 }
  const above = { left: 248, right: 448, top: 0, bottom: 80 }
  const below = { left: 248, right: 448, top: 100, bottom: 180 }
  const target = { left: 496, right: 696, top: 0, bottom: 80 }
  const route = routeItemWire(source, target, [source, above, below, target])
  assert.ok(route)
  const crossing = route.findIndex(
    (point, i) => i > 0 && route[i - 1].y === point.y && route[i - 1].x < 248 && point.x > 448,
  )
  assert.ok(crossing > 0)
  assert.equal(route[crossing].y, 90)
})

test("a wire to an item level with its source runs straight across", () => {
  const source = { left: 0, right: 200, top: 0, bottom: 80 }
  const target = { left: 248, right: 448, top: 0, bottom: 80 }
  const route = routeItemWire(source, target, [source, target])
  assert.ok(route)
  assert.equal(route.length, 2)
})
