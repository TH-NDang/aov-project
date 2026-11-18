import assert from "node:assert/strict"
import { test } from "node:test"
import {
  importWarningKey,
  importWarningText,
  type ImportWarning,
} from "../src/features/publishing/model/import/import-warnings"

const warning = (code: string, skillKey: string | null = null, locale: string | null = null) =>
  ({ code, skillKey, locale }) as ImportWarning

test("a skill warning names the skill and the language it is about", () => {
  assert.equal(
    importWarningText(warning("STALE_SKILL_SUMMARY", "skill-1", "vi-VN")),
    "Cần xem lại tóm tắt kỹ năng skill-1 (vi-VN): mô tả đã đổi, tóm tắt cũ được giữ nguyên.",
  )
})

test("a snapshot warning reads without parameters", () => {
  assert.equal(
    importWarningText(warning("NO_EARLIER_SNAPSHOT")),
    "Chưa có mốc trước patch này để so sánh. Hãy nhập dữ liệu ban đầu; không suy ngược từ tương lai.",
  )
})

test("a warning code Admin does not know yet shows the code", () => {
  assert.equal(importWarningText(warning("SKIN_PRICE_UNKNOWN")), "SKIN_PRICE_UNKNOWN")
})

test("the same warning for two languages of one skill keeps two keys", () => {
  assert.notEqual(
    importWarningKey(warning("MISSING_SKILL_DESCRIPTION", "skill-1", "vi-VN")),
    importWarningKey(warning("MISSING_SKILL_DESCRIPTION", "skill-1", "en-US")),
  )
})
