import assert from "node:assert/strict"
import test from "node:test"

import { documentLocale, isEnglishLocale, localeText, marketName } from "../src/lib/locale-text.ts"

test("an English locale picks the English words", () => {
  assert.equal(localeText("en-US")("Đóng", "Close"), "Close")
  assert.equal(localeText("en")("Đóng", "Close"), "Close")
})

test("every other locale reads Vietnamese, the product's language", () => {
  assert.equal(localeText("vi-VN")("Đóng", "Close"), "Đóng")
  assert.equal(localeText("th-TH")("Đóng", "Close"), "Đóng")
  assert.equal(localeText(undefined)("Đóng", "Close"), "Đóng")
})

test("a locale merely starting with the letters en is not English", () => {
  assert.equal(isEnglishLocale("eng-x"), false)
})

test("without a page the shared components write Vietnamese", () => {
  assert.equal(documentLocale(), "vi-VN")
})

test("a market keeps the Vietnamese name the service sent and gets its English name in English", () => {
  assert.equal(marketName("VN", "vi-VN", "Việt Nam (máy chủ)"), "Việt Nam (máy chủ)")
  assert.equal(marketName("VN", "en-US", "Việt Nam (máy chủ)"), "Vietnam")
  assert.equal(marketName("TH", "vi-VN"), "Thái Lan")
})

test("an unknown market keeps its given name or its code", () => {
  assert.equal(marketName("KR", "en-US", "Hàn Quốc"), "Hàn Quốc")
  assert.equal(marketName("KR", "vi-VN"), "KR")
})
