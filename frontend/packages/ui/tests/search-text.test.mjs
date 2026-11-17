import assert from "node:assert/strict"
import test from "node:test"

import { foldSearchText } from "../src/lib/search-text.ts"
import { warehouseText } from "../src/lib/warehouse-content.ts"

test("a search ignores case and tone marks", () => {
  assert.equal(foldSearchText("Đấu Trường Danh Vọng"), "dau truong danh vong")
})

test("a search reads đ as d in both cases", () => {
  assert.equal(foldSearchText("Đường đua"), "duong dua")
})

test("text in decomposed form folds like the precomposed one", () => {
  assert.equal(foldSearchText("Pháp sự"), foldSearchText("Pháp sự"))
})

test("a missing translation falls back to Vietnamese, then to the first one written", () => {
  const translations = [
    { locale: "th-TH", name: "Thai" },
    { locale: "vi-VN", name: "Việt" },
  ]
  assert.equal(warehouseText(translations, "en-US")?.name, "Việt")
  assert.equal(warehouseText([{ locale: "th-TH", name: "Thai" }], "en-US")?.name, "Thai")
})
