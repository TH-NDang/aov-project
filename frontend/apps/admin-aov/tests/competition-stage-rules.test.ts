import assert from "node:assert/strict"
import { test } from "node:test"
import type { StagePatch } from "@aov/community-contracts"
import type { WikiPatch } from "../src/features/competition/wiki-patch-api"
import {
  linkWikiPatch,
  patchLineIsEmpty,
  patchLineTitle,
  sameDayWikiPatch,
} from "../src/features/competition/workspace/stage-rules"

const riftPatch: WikiPatch = { id: "p-0929", code: "2026-09-29", title: "Cập nhật Vết Nứt Thời Không" }

test("a patch line that names no Wiki patch, release day or source is empty", () => {
  assert.equal(patchLineIsEmpty({ label: "Tuần 1", name: "Bản 13/8", sourceUrl: " " }), true)
  assert.equal(patchLineIsEmpty({ releasedOn: "2026-08-13" }), false)
  assert.equal(patchLineIsEmpty({ sourceUrl: "https://example.com/patch-notes" }), false)
})

test("a line not linked yet is offered the Wiki patch released the same day", () => {
  const line: StagePatch = { label: "Tuần 5–7", releasedOn: "2026-09-29" }

  assert.equal(sameDayWikiPatch(line, [riftPatch])?.id, "p-0929")
  assert.equal(sameDayWikiPatch({ ...line, patchId: "p-0929" }, [riftPatch]), undefined)
  assert.equal(sameDayWikiPatch({ ...line, releasedOn: "2026-08-27" }, [riftPatch]), undefined)
})

test("linking a Wiki patch fills the day and name but keeps what the editor wrote", () => {
  assert.deepEqual(linkWikiPatch({ label: "Tuần 5–7" }, riftPatch), {
    label: "Tuần 5–7",
    patchId: "p-0929",
    releasedOn: "2026-09-29",
    name: "Cập nhật Vết Nứt Thời Không",
  })
  assert.equal(linkWikiPatch({ name: "S4 2026", releasedOn: "2026-09-30" }, riftPatch).name, "S4 2026")
  assert.equal(linkWikiPatch({ name: "S4 2026", releasedOn: "2026-09-30" }, riftPatch).releasedOn, "2026-09-30")
})

test("a line reads by its name, then its release day", () => {
  assert.equal(patchLineTitle({ name: "Bản 27/8", releasedOn: "2026-08-27" }), "Bản 27/8")
  assert.equal(patchLineTitle({ releasedOn: "2026-08-13" }), "Bản cập nhật 13/08/2026")
})
