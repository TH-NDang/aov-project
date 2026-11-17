import assert from "node:assert/strict"
import { test } from "node:test"
import type { GuideContent } from "../src/features/game-modes/game-mode-api"
import { fixedCodes, named } from "../src/features/game-modes/guide-codes"

const guide = (parts: Partial<GuideContent> = {}) =>
  ({
    units: [],
    traits: [],
    itemGroups: [],
    items: [],
    blessings: [],
    quests: [],
    lineups: [],
    ...parts,
  }) as unknown as GuideContent

const unit = (code: string, name: string, traitCodes: string[] = []) =>
  ({ code, name, cost: 1, traitCodes, complete: false }) as GuideContent["units"][number]

const trait = (code: string, name: string) =>
  ({ code, name, kind: "FACTION", tiers: [] }) as unknown as GuideContent["traits"][number]

test("typing the name of a saved unit keeps its code", () => {
  const zata = unit("zata", "Zata")
  const content = guide({ units: [zata] })

  const renamed = named(zata, "Zata Phong Vũ", fixedCodes(content, content))

  assert.equal(renamed.name, "Zata Phong Vũ")
  assert.equal(renamed.code, "zata")
})

test("a new unit's code follows its name while the name is typed", () => {
  const saved = guide()
  let entry = unit("", "")

  for (const name of ["Đ", "Điêu", "Điêu Thuyền"])
    entry = named(entry, name, fixedCodes(saved, guide({ units: [entry] })))

  assert.equal(entry.code, "dieu-thuyen")
})

test("a new trait keeps its code once a unit points at it", () => {
  const fresh = trait("ma-thuat", "Ma thuật")
  const content = guide({ traits: [fresh], units: [unit("lauriel", "Lauriel", ["ma-thuat"])] })

  const renamed = named(fresh, "Ma thuật sư", fixedCodes(guide(), content))

  assert.equal(renamed.code, "ma-thuat")
})
