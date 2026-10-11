import test from "node:test"
import assert from "node:assert/strict"
import { constructTable, tableFeatures } from "@tanstack/react-table"
import { storeReactivityBindings } from "@tanstack/table-core/store-reactivity-bindings"
import { dataTableFeatures, facetFilterFn } from "../src/components/data-table/table-features.ts"

const features = tableFeatures({ ...dataTableFeatures, coreReactivityFeature: storeReactivityBindings() })
const data = [
  { id: "001", name: "Airi", kind: "normal", count: 17 },
  { id: "002", name: "Aleister", kind: "variant", count: 12 },
  { id: "003", name: "Alice", kind: "normal", count: 14 },
]
const columns = [{ accessorKey: "name" }, { accessorKey: "kind", filterFn: facetFilterFn }, { accessorKey: "count" }]
const setup = () =>
  constructTable({
    features,
    data,
    columns,
    getRowId: (row) => row.id,
    globalFilterFn: (row, _id, value) => row.original.name.toLowerCase().includes(String(value).toLowerCase()),
    initialState: { pagination: { pageIndex: 0, pageSize: 2 } },
  })

test("v9 client sorting and pagination use the same registered feature pipeline", () => {
  const table = setup()
  assert.deepEqual(
    table.getRowModel().rows.map((row) => row.id),
    ["001", "002"],
  )
  table.setSorting([{ id: "count", desc: true }])
  assert.deepEqual(
    table.getRowModel().rows.map((row) => row.id),
    ["001", "003"],
  )
  table.nextPage()
  assert.deepEqual(
    table.getRowModel().rows.map((row) => row.id),
    ["002"],
  )
  assert.equal(table.getPageCount(), 2)
})

test("search, facet filters and facet counts preserve stable row IDs", () => {
  const table = setup()
  table.setGlobalFilter("AIR")
  assert.deepEqual(
    table.getFilteredRowModel().rows.map((row) => row.id),
    ["001"],
  )
  table.setGlobalFilter("")
  table.setColumnFilters([{ id: "kind", value: ["variant"] }])
  assert.deepEqual(
    table.getFilteredRowModel().rows.map((row) => row.id),
    ["002"],
  )
  assert.equal(table.getColumn("kind")!.getFacetedUniqueValues().get("normal"), 2)
  table.setColumnFilters([])
  assert.equal(table.getFilteredRowModel().rows.length, 3)
})

test("column visibility and dynamic JSON accessors do not change stored data", () => {
  const table = setup()
  table.getColumn("name")!.toggleVisibility(false)
  assert.deepEqual(
    table.getVisibleLeafColumns().map((column) => column.id),
    ["kind", "count"],
  )
  table.getColumn("name")!.toggleVisibility(true)
  assert.equal(table.getVisibleLeafColumns().length, 3)
  const dynamic = constructTable({
    features,
    data: [{ code: "001", "hero.name": "Airi" }],
    columns: [{ id: "field:hero.name", accessorFn: (row) => row["hero.name"] }],
    getRowId: (row) => row.code,
  })
  assert.equal(dynamic.getRowModel().rows[0].getValue("field:hero.name"), "Airi")
  assert.equal(data[0].id, "001")
})
