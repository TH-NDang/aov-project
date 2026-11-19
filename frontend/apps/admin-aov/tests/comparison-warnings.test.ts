import assert from "node:assert/strict"
import { test } from "node:test"
import {
  comparisonWarningText,
  type ComparisonWarning,
} from "../src/features/publishing/model/assessment/comparison-warnings"

test("each snapshot comparison warning code reads as a Vietnamese sentence", () => {
  assert.match(comparisonWarningText({ code: "NO_EARLIER_SNAPSHOT" }), /^Bản đầu tiên ghi lại trạng thái tướng/)
  assert.match(
    comparisonWarningText({ code: "SNAPSHOT_DIFFERENCE_UNPROVEN" }),
    /Kiểm tra nguồn trước khi ghi changelog/,
  )
})

test("a comparison warning code Admin does not know yet shows the code itself", () => {
  const unknown = { code: "NEW_WARNING" } as unknown as ComparisonWarning
  assert.equal(comparisonWarningText(unknown), "NEW_WARNING")
})
