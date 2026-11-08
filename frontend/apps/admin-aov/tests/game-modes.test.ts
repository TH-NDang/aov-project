import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import {
  guideContentFromManifest,
  guideIconPaths,
  mapLimit,
  missingLabel,
  modeContentFromManifest,
  type GuideManifest,
  type ModeManifestEntry,
} from "../src/features/game-modes/game-mode-import"

const resources = new URL("../../../../resources/Lien-Quan-v3/che-do-choi/", import.meta.url)
const modes = JSON.parse(readFileSync(new URL("che-do.json", resources), "utf8")) as { modes: ModeManifestEntry[] }
const guide = JSON.parse(
  readFileSync(new URL("co-lien-quan/du-lieu/bach-khoa-2026-11-08.json", resources), "utf8"),
) as GuideManifest

test("the lobby manifest lists every mode once with the observed labels and no made-up dates", () => {
  const codes = modes.modes.map((mode) => mode.code)
  assert.equal(codes.length, 26)
  assert.equal(new Set(codes).size, 26)
  assert.equal(modes.modes.filter((mode) => mode.group === "PVP").length, 6)
  const auto = modes.modes.find((mode) => mode.code === "co-lien-quan")!
  assert.equal(auto.guideKind, "AUTO_CHESS")
  assert.deepEqual(auto.duration, { minMinutes: 20, maxMinutes: 30 })
  const limited = modes.modes.find((mode) => mode.code === "dau-moc")!
  assert.equal(limited.availability.gameLabel, "Mở hữu hạn 14 giờ")
  assert.equal(limited.availability.startsOn, null)
  assert.equal(modes.modes.find((mode) => mode.code === "dau-truong-ulti")!.art, null)

  const content = modeContentFromManifest(auto, "asset-1")
  assert.equal(content.artAssetId, "asset-1")
  assert.deepEqual(content.heroes, [])
  assert.ok(content.rules.length > 0)
})

test("the encyclopedia references only its own codes and every icon file exists", () => {
  const traits = new Set(guide.traits.map((trait) => trait.code))
  const units = new Set(guide.units.map((unit) => unit.code))
  assert.equal(units.size, guide.units.length)
  for (const unit of guide.units)
    for (const code of unit.traitCodes) assert.ok(traits.has(code), `${unit.code} → ${code}`)
  for (const lineup of guide.lineups) for (const member of lineup.units) assert.ok(units.has(member.unitCode))
  assert.equal(guide.units.filter((unit) => unit.complete).length, 35)
  for (const trait of guide.traits)
    trait.tiers.forEach((tier, at) => at && assert.ok(tier.count > trait.tiers[at - 1]!.count, trait.code))

  const paths = guideIconPaths(guide)
  assert.equal(paths.length, new Set(paths).size)
  for (const path of paths) readFileSync(new URL(`co-lien-quan/${path}`, resources))
})

test("icon paths become asset ids and missing uploads leave the image empty", () => {
  const paths = guideIconPaths(guide)
  const assets = new Map(paths.slice(1).map((path, at) => [path, `asset-${at}`]))
  const content = guideContentFromManifest(guide, assets)
  assert.equal(content.units.length, guide.units.length)
  assert.equal(content.units[0]!.portraitAssetId, assets.get(guide.units[0]!.portrait!) ?? null)
  assert.ok(!("portrait" in content.units[0]!))
  assert.ok(!("icon" in content.traits[0]!))
  assert.equal(content.units.at(-1)!.skill?.name, null, "a unit seen only in the list has no skill yet")
  const withPath = [
    ...guide.traits.map((trait, at) => [trait.icon, content.traits[at]!.iconAssetId] as const),
    ...guide.units.map((unit, at) => [unit.portrait, content.units[at]!.portraitAssetId] as const),
    ...guide.items.map((item, at) => [item.icon, content.items[at]!.iconAssetId] as const),
    ...guide.blessings.map((blessing, at) => [blessing.icon, content.blessings[at]!.iconAssetId] as const),
  ].filter(([path]) => path)
  assert.deepEqual(
    withPath.filter(([, asset]) => asset === null).map(([path]) => path),
    [paths[0]],
    "only the image that was not uploaded stays empty",
  )
})

test("uploads run a few at a time and keep their order", async () => {
  let running = 0
  let peak = 0
  const result = await mapLimit([5, 1, 4, 2, 3], 2, async (value) => {
    running++
    peak = Math.max(peak, running)
    await new Promise((resolve) => setTimeout(resolve, value))
    running--
    return value * 10
  })
  assert.deepEqual(result, [50, 10, 40, 20, 30])
  assert.equal(peak, 2)
})

test("missing fields read as Vietnamese labels", () => {
  assert.equal(missingLabel("availability.status"), "Tình trạng mở")
  assert.equal(missingLabel("units[0].stats", { units: [{ name: "Violet" }] } as never), "Violet: thiếu chỉ số")
})
