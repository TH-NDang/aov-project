import assert from "node:assert/strict"
import { test } from "node:test"
import { settle, sheetPage } from "./fixtures/sheets.ts"

test("a file without sheets is here at once", async () => {
  const file = sheetPage().file()
  await settle()
  assert.equal(file.state, "HERE")
})

test("a file waits for the sheet it came with", async () => {
  const page = sheetPage()
  const file = page.file("a.css")
  await settle()
  assert.equal(file.state, "WAITING")
  page.sheetComes("a.css")
  await settle()
  assert.equal(file.state, "HERE")
})

test("a file waits for a sheet that another file has asked for", async () => {
  const page = sheetPage()
  page.file("shared.css", "a.css")
  const second = page.file("shared.css", "b.css")
  page.sheetComes("b.css")
  await settle()
  assert.equal(second.state, "WAITING")
  page.sheetComes("shared.css")
  page.sheetComes("a.css")
  await settle()
  assert.equal(second.state, "HERE")
})

test("a file whose sheet does not come is lost", async () => {
  const page = sheetPage()
  const file = page.file("a.css")
  page.sheetFails("a.css")
  await settle()
  assert.equal(file.state, "LOST")
})

test("a sheet that did not come is asked for again with the file", async () => {
  const page = sheetPage()
  page.file("a.css")
  page.sheetFails("a.css")
  await settle()
  const again = page.file("a.css")
  await settle()
  assert.deepEqual(page.asked, ["a.css", "a.css"])
  assert.equal(again.state, "WAITING")
  page.sheetComes("a.css")
  await settle()
  assert.equal(again.state, "HERE")
})

test("a sheet that comes late keeps its place among the others", async () => {
  const page = sheetPage()
  page.file("a.css")
  page.file("b.css")
  page.sheetFails("a.css")
  page.sheetComes("b.css")
  await settle()
  page.file("a.css")
  await settle()
  assert.deepEqual(page.order(), ["a.css", "b.css"])
})

test("two files that need the sheet that did not come ask for it again once", async () => {
  const page = sheetPage()
  page.file("shared.css")
  page.sheetFails("shared.css")
  await settle()
  const files = [page.file("shared.css"), page.file("shared.css")]
  await settle()
  assert.deepEqual(page.asked, ["shared.css", "shared.css"])
  page.sheetComes("shared.css")
  await settle()
  assert.deepEqual(
    files.map(({ state }) => state),
    ["HERE", "HERE"],
  )
})

test("a sheet that does not come the second time either is told of", async () => {
  const page = sheetPage()
  page.file("a.css")
  page.sheetFails("a.css")
  await settle()
  const again = page.file("a.css")
  await settle()
  page.sheetFails("a.css")
  await settle()
  assert.equal(again.state, "LOST")
  assert.equal(page.lost(), 1)
})
