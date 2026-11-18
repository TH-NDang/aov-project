import assert from "node:assert/strict"
import test from "node:test"

import { fallbackOrder, pickTranslation } from "../src/lib/translation-fallback.ts"

const texts = (...locales) => locales.map((locale) => ({ locale, name: locale }))

test("the fallback order tries the requested locale, then English, then Vietnamese", () => {
  assert.deepEqual(fallbackOrder("th-TH"), ["th-TH", "en-US", "vi-VN"])
})

test("a requested English or Vietnamese locale is listed once", () => {
  assert.deepEqual(fallbackOrder("en-US"), ["en-US", "vi-VN"])
  assert.deepEqual(fallbackOrder("vi-VN"), ["vi-VN", "en-US"])
})

test("without a requested locale the fallback order starts with English", () => {
  assert.deepEqual(fallbackOrder(undefined), ["en-US", "vi-VN"])
})

test("the requested translation wins when it exists", () => {
  assert.equal(pickTranslation(texts("vi-VN", "en-US", "th-TH"), "th-TH")?.locale, "th-TH")
})

test("a missing translation falls back to English before Vietnamese", () => {
  assert.equal(pickTranslation(texts("vi-VN", "en-US", "th-TH"), "id-ID")?.locale, "en-US")
})

test("a missing translation falls back to Vietnamese when there is no English", () => {
  assert.equal(pickTranslation(texts("th-TH", "vi-VN"), "id-ID")?.locale, "vi-VN")
})

test("without English or Vietnamese the first locale code wins, whatever the written order", () => {
  assert.equal(pickTranslation(texts("zh-TW", "de-DE", "th-TH"), "id-ID")?.locale, "de-DE")
  assert.equal(pickTranslation(texts("th-TH", "zh-TW", "de-DE"), "id-ID")?.locale, "de-DE")
})

test("no translations give nothing", () => {
  assert.equal(pickTranslation([], "vi-VN"), undefined)
  assert.equal(pickTranslation(undefined, "vi-VN"), undefined)
})
