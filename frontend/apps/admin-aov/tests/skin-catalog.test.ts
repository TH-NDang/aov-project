import assert from "node:assert/strict"
import { test } from "node:test"
import { loadSkinPage, selectSkinRevision } from "../src/features/skins/skin-catalog"
import type { HeroRow, Revision, Preview } from "../src/features/publishing/types"

const revision = (id: string, rulesetId: string, revisionNo: number, state: Revision["state"]) =>
  ({ id, rulesetId, revisionNo, state, heroId: "hero" }) as Revision
test("skin catalog selects a revision within the chosen ruleset and never mixes discarded snapshots", async () => {
  const hero: HeroRow = {
    id: "hero",
    code: "airi",
    revisions: [
      revision("old", "vn", 1, "PUBLISHED"),
      revision("draft", "vn", 2, "DRAFT"),
      revision("discarded", "vn", 3, "DISCARDED"),
      revision("foreign", "other", 4, "PUBLISHED"),
    ],
  }
  assert.equal(selectSkinRevision(hero, "vn", "latest")?.id, "draft")
  assert.equal(selectSkinRevision(hero, "vn", "PUBLISHED")?.id, "old")
  assert.equal(selectSkinRevision(hero, "unknown", "latest"), undefined)
  const calls: string[] = []
  const result = await loadSkinPage(
    {
      heroes: async () => ({ items: [hero], page: 0, size: 20, totalElements: 1 }),
      read: async (_, id) => {
        calls.push(id)
        return {
          content: {
            PROFILE: { translations: [{ locale: "vi-VN", name: "Airi" }] },
            SKINS: { skins: [{ skinKey: "airi-skin", translations: [{ locale: "vi-VN", name: "Skin" }] }] },
          },
        } as Preview
      },
    },
    0,
    "vn",
    "latest",
    "vi-VN",
  )
  assert.deepEqual(calls, ["draft"])
  assert.equal(result.items[0].id, "hero/draft/airi-skin")
  assert.equal(result.items[0].heroName, "Airi")
})
