import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import { compareSkillRanks } from "@aov/ui/lib/skill-rank-values"
import type { Skill } from "../src/features/publishing/api/types"
import { createWindow, installWindow } from "./fixtures/dom"

test("skill details show rank columns and comparison toggles retain the changed-cell markers", async () => {
  const dom = createWindow("http://localhost")
  let restoreGlobals = () => {}
  restoreGlobals = installWindow(dom.window)
  const { SkillSourceDetails } = await import("../src/features/publishing/components/import/hero-source-details")
  const { SkillRankComparison } = await import("../src/features/publishing/components/skills/skill-rank-table")
  const { createRoot } = await import("react-dom/client")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const source: Skill = {
    skillKey: "skill-1-1",
    kind: "ACTIVE",
    formKey: null,
    displayOrder: 1,
    iconAssetId: null,
    translations: [],
    effects: [
      {
        effectType: "SOURCE_SNAPSHOT",
        metadata: {
          cooldown: { display: "Hồi chiêu: 8 - 0.3/cấp chiêu" },
          levelTable: {
            column_labels: ["Thông tin công bố"],
            rows: [{ label: "Hồi chiêu (giây)", display_values: ["8 - 0.3/cấp chiêu"] }],
          },
        },
      },
    ],
  }
  try {
    await act(async () => root.render(<SkillSourceDetails skill={source} />))
    const document = dom.window.document
    assert.deepEqual(
      [...document.querySelectorAll("thead th")].map((cell) => cell.textContent),
      ["Thông số", "Cấp 1", "Cấp 2", "Cấp 3", "Cấp 4", "Cấp 5", "Cấp 6", "Tổng quan"],
    )
    assert.equal(document.querySelector("tbody th")?.textContent, "Hồi chiêu (giây)")
    assert.deepEqual(
      [...document.querySelectorAll("tbody td")].map((cell) => cell.textContent),
      ["8", "7.7", "7.4", "7.1", "6.8", "6.5", "8 - 0.3/cấp chiêu"],
    )
    assert.equal(document.querySelectorAll("tbody td:last-child").length, 1)
    assert.doesNotMatch(document.body.textContent!, /\brank\b/)
    const data = compareSkillRanks("8 - 0.5*(rank-1)", "8 - 0.3*(rank-1)", source, source)!
    await act(async () => root.render(<SkillRankComparison data={data} label="Hồi chiêu" />))
    assert.equal(document.querySelectorAll("tbody tr").length, 2)
    assert.equal(document.querySelector("tbody th")?.textContent, "Trước")
    assert.equal(document.querySelector("thead th:last-child")?.textContent, "Tổng quan")
    assert.deepEqual(
      [...document.querySelectorAll("tbody td:last-child")].map((cell) => cell.textContent),
      ["8 − 0.5 × (cấp chiêu − 1)", "8 − 0.3 × (cấp chiêu − 1)"],
    )
    assert.equal(document.querySelectorAll('[data-rank-changed="true"]').length, 10)
    assert.equal(document.querySelector("tbody td")?.hasAttribute("data-rank-changed"), false)
    await act(async () =>
      document.querySelector<HTMLButtonElement>('button[aria-label="Xem tóm tắt Hồi chiêu"]')!.click(),
    )
    assert.equal(document.querySelector("table"), null)
    assert.match(document.body.textContent!, /Trước: 8 − 0\.5 × \(cấp chiêu − 1\)/)
    await act(async () =>
      document.querySelector<HTMLButtonElement>('button[aria-label="Xem bảng chi tiết Hồi chiêu"]')!.click(),
    )
    assert.equal(document.querySelectorAll('[data-rank-changed="true"]').length, 10)
  } finally {
    await act(async () => root.unmount())
    dom.window.close()
    restoreGlobals()
  }
})
