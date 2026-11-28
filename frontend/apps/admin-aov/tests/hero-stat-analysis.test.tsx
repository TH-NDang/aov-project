import assert from "node:assert/strict"
import { test } from "node:test"
import { analyzeStat, statDistribution } from "../src/features/publishing/model/assessment/hero-stat-analysis"
import { combatAttributeRows, type StatSample } from "../src/features/publishing/model/assessment/combat-attributes"
import { withView } from "./fixtures/hero-skills-view"

test("relative stat levels count ties, including zero, and need five other heroes", () => {
  assert.equal(statDistribution(200, [200, 200, 200, 200]).label, "Chưa đủ mẫu")
  assert.equal(statDistribution(200, [200, 200, 200, 200, 200]).label, "Đồng mức")
  assert.equal(statDistribution(0, [0, 0, 0, 0, 1, 2]).label, "Phổ biến")
  const peers = [10, 20, 30, 30, 40, 50]
  assert.equal(statDistribution(10, peers).label, "Thấp")
  assert.equal(statDistribution(30, peers).label, "Trung bình")
  assert.equal(statDistribution(50, peers).label, "Cao")
  assert.equal(statDistribution(30, peers).median, 30)
  assert.equal(statDistribution(3, [1, 2, 4, 8]).median, 3)
  assert.equal(statDistribution("Đánh gần", Array(6).fill("Đánh xa")).label, "Chưa gặp trong nhóm")
})

test("stat comparisons keep recorded source, patch, level, resource type and armor components separate", () => {
  const values = {
    physicalDefense: 140,
    physicalDefensePercent: 0,
    maxResource: 460,
    resourceLabel: "Năng lượng tối đa",
  }
  const capture = { patchCode: "s4", level: null, values }
  const rows = combatAttributeRows(null, { ...capture, image: undefined }, [])
  const peer = (id: string, details: StatSample["capture"]): StatSample => ({
    heroId: id,
    draft: true,
    roles: [],
    baseStats: { ARMOR: { value: 999, unit: "POINT" }, MAX_RESOURCE: { value: 460, unit: "POINT" } },
    capture: details,
  })
  const peers = [
    peer("1", capture),
    peer("2", { ...capture, patchCode: "s3" }),
    peer("3", { ...capture, level: 1 }),
    peer("4", { ...capture, values: { physicalDefensePercent: 0, maxResource: 460, resourceLabel: "Nội năng" } }),
    peer("5", null),
  ]
  const armor = analyzeStat(
    rows.find((r) => r.key === "ARMOR")!,
    peers,
    "s4",
    null,
  )
  assert.equal(armor?.primary?.total, 1)
  assert.equal(armor?.primary?.matches, 1)
  assert.equal(armor?.secondary?.total, 2)
  assert.equal(armor?.secondary?.matches, 2)
  assert.equal(
    analyzeStat(
      rows.find((r) => r.key === "MAX_RESOURCE")!,
      peers,
      "s4",
      null,
    )?.primary?.total,
    1,
  )
  const own = combatAttributeRows(
    { values: [{ statKey: "ARMOR", baseValue: 999, unit: "POINT", growthPerLevel: null }], sources: [] },
    undefined,
    [],
  )[0]
  peers[0].baseStats.ARMOR.unit = "PERCENT"
  assert.equal(analyzeStat(own, peers, "s4", null)?.primary?.matches, 4)
  const resourceStats = {
    values: [{ statKey: "MAX_RESOURCE", baseValue: 460, unit: "POINT", growthPerLevel: null }],
    sources: [],
  }
  const resource = combatAttributeRows(resourceStats, { ...capture, image: undefined }, []).find(
    (r) => r.key === "MAX_RESOURCE",
  )!
  assert.equal(analyzeStat(resource, peers, "s4", null)?.primary?.total, 2)
  assert.equal(analyzeStat(combatAttributeRows(resourceStats, undefined, [])[0], peers, "s4", null)?.primary?.total, 0)
  const fallback = combatAttributeRows(null, undefined, [
    {
      statKey: "ARMOR",
      baseValue: 140,
      percentValue: null,
      growthPerLevel: null,
      capValue: null,
      unit: "POINT",
      sourceUrl: "https://example.com/source",
      version: 1,
    },
  ])[0]
  assert.equal(analyzeStat(fallback, peers, "s4", null), undefined)
})

test("hero analysis opens on demand and excludes the selected hero from both role groups", async () => {
  await withView(async ({ document, render, click, client, waitFor }) => {
    const { HeroCombatAttributes } =
      await import("../src/features/publishing/components/assessment/hero-combat-attributes")
    const sample = (heroId: string, roles: string[]): StatSample => ({
      heroId,
      roles,
      draft: true,
      baseStats: { HP: { value: 3500, unit: "HP" } },
      capture: null,
    })
    client.setQueryData(
      ["hero-stat-samples", "s4"],
      [
        sample("view-hero", ["MAGE"]),
        sample("tank", ["TANK"]),
        ...Array.from({ length: 5 }, (_, i) => sample(String(i), ["MAGE", "SUPPORT"])),
      ],
    )
    const stats = { values: [{ statKey: "HP", baseValue: 3500, unit: "POINT", growthPerLevel: null }], sources: [] }
    await render(
      <HeroCombatAttributes
        stats={stats}
        skills={null}
        roles={["MAGE"]}
        heroId="view-hero"
        variantId="s4"
        patchCode="s4"
        rules={[]}
      />,
    )
    assert.doesNotMatch(document.body.textContent!, /Đồng mức/)
    // The comparison opens in the attributes window, on its own tab.
    const trigger = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.trim() === "So sánh")!
    await click(trigger)
    assert.ok(document.querySelector('[role="dialog"]'), "The comparison opens in a window of its own")
    await waitFor(() => document.body.textContent!.includes("Đồng mức · 6 mẫu"))
    await click(Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "Cùng vai trò")!)
    assert.match(document.body.textContent!, /Đồng mức · 5 mẫu/)
    assert.match(document.body.textContent!, /Mỗi tướng một giá trị/)
  })
})
