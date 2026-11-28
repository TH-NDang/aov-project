import assert from "node:assert/strict"
import { test } from "node:test"
import type { EntityReference } from "@aov/ui/lib/entity-rich-text"
import {
  catalogLanguageCode,
  catalogLanguageGaps,
  catalogLanguageWord,
  catalogLanguages,
  hasCatalogLanguage,
} from "../src/features/terminology/catalog-languages"

const term = (id: string, names: Record<string, string>): EntityReference => ({
  id,
  kind: "term",
  translations: Object.entries(names).map(([locale, name]) => ({ locale, name, aliases: [], description: "" })),
})
const order = ["vi-VN", "en-US", "th-TH", "zh-TW", "id-ID"]

test("a list keeps the languages its entries are named in, plus the one being read", () => {
  const terms = [term("a", { "vi-VN": "Đi rừng", "th-TH": "ป่า" }), term("b", { "en-US": "Jungle", "zz-ZZ": "x" })]
  assert.deepEqual(catalogLanguages(terms, order, "vi-VN"), ["vi-VN", "en-US", "th-TH", "zz-ZZ"])
  assert.deepEqual(catalogLanguages(terms, order, "id-ID"), ["vi-VN", "en-US", "th-TH", "id-ID", "zz-ZZ"])
  assert.deepEqual(catalogLanguages([term("c", { "EN-us": "Jungle" })], order, "en-US"), ["en-US"])
})

test("an empty name is a missing name", () => {
  const blank = term("a", { "vi-VN": "Đi rừng", "en-US": "  " })
  assert.equal(hasCatalogLanguage(blank, "vi-vn"), true)
  assert.equal(hasCatalogLanguage(blank, "en-US"), false)
  assert.deepEqual(catalogLanguageGaps([blank, term("b", { "en-US": "Jungle" })], ["vi-VN", "en-US", "th-TH"]), [
    { code: "vi-VN", count: 1 },
    { code: "en-US", count: 1 },
    { code: "th-TH", count: 2 },
  ])
})

test("languages are marked short and named the way a sentence names them", () => {
  assert.equal(catalogLanguageCode("th-TH"), "TH")
  assert.equal(catalogLanguageWord("th-TH"), "tiếng Thái")
  assert.equal(catalogLanguageWord("en-US"), "tiếng Anh")
})
