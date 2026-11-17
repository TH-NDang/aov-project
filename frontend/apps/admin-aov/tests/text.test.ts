import assert from "node:assert/strict"
import { test } from "node:test"
import { formatNumber, matchesQuery, normalize, slugify } from "../src/lib/text"

test("a search folds accents, case and the crossed d the same way everywhere", () => {
  assert.equal(normalize("  Điêu Thuyền "), "dieu thuyen")
  assert.equal(normalize("ĐẤU SĨ"), "dau si")
  assert.equal(matchesQuery("dau si", "Đấu sĩ"), true)
  assert.equal(matchesQuery("thuyen dieu", "Điêu Thuyền"), true, "Every word may come in any order")
  assert.equal(matchesQuery("lauriel", "Điêu Thuyền"), false)
})

test("a code from a name keeps letters and digits joined by dashes", () => {
  assert.equal(slugify("Tân Thủy Thủ"), "tan-thuy-thu")
  assert.equal(slugify(" Đường Caesar! "), "duong-caesar")
})

test("an interface number follows the reader's locale", () => {
  assert.equal(formatNumber(1234.5, {}, "vi-VN"), "1.234,5")
  assert.equal(formatNumber(1234.5, {}, "en-US"), "1,234.5")
})
