import assert from "node:assert/strict"
import { test } from "node:test"
import { localeText } from "@aov/ui/lib/locale-text"
import { modesLead } from "../src/features/modes/mode-lead.ts"

test("the modes lead is one sentence in the reader's language when no mode is listed", () => {
  assert.equal(modesLead(localeText("en-US"), ""), "Schedules are as the mode lobby showed them and may have changed.")
  assert.equal(modesLead(localeText("vi-VN"), ""), "Lịch mở ghi theo sảnh chọn chế độ, có thể đã đổi.")
})

test("the modes lead puts the counts before the schedule note", () => {
  assert.equal(
    modesLead(localeText("en-US"), "3 modes, 1 open"),
    "3 modes, 1 open. Schedules are as the mode lobby showed them and may have changed.",
  )
})
