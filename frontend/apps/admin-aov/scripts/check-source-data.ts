/**
 * Checks the importers against the full source data sets, which live in the private bucket (ADR-030) and are not in
 * CI. The tests run the same readers on the small samples in tests/fixtures; run this after pulling the data, from
 * frontend/apps/admin-aov:
 *
 *   pnpm sources:sync pull --collection sanh-che-do --to ../../../resources/Lien-Quan-v3/che-do-choi --apply
 *   pnpm sources:sync pull --collection co-lien-quan-2026-11-08-1503 --to ../../../resources/Lien-Quan-v3/che-do-choi --apply
 *   pnpm sources:sync pull --collection esports-2026-post-apl --to ../../../resources/esports/2026-post-apl --apply
 *   pnpm check:source-data
 *
 * A data set that is not pulled is reported and left out; a failed check stops with its assertion.
 */
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import {
  guideContentFromManifest,
  guideIconPaths,
  iconsWithoutSource,
  importedImageSource,
  modeContentFromManifest,
  type GuideManifest,
  type ModeManifestEntry,
} from "../src/features/game-modes/game-mode-import"
import { importCounts, parseRegistryImport } from "../src/features/tournaments/registry-import-model"

const resources = new URL("../../../../resources/", import.meta.url)
const checks: { name: string; files: URL[]; run: (read: (file: URL) => string) => void }[] = []

const modesFolder = new URL("Lien-Quan-v3/che-do-choi/", resources)
const modesFile = new URL("che-do.json", modesFolder)
const guideFile = new URL("co-lien-quan/du-lieu/bach-khoa-2026-11-08-1503.json", modesFolder)
const aog = new URL("esports/2026-post-apl/aog-sample/", resources)

checks.push({
  name: "the lobby manifest lists every mode once with the observed labels and no made-up dates",
  files: [modesFile],
  run(read) {
    const modes = JSON.parse(read(modesFile)) as { modes: ModeManifestEntry[] }
    const codes = modes.modes.map((mode) => mode.code)
    assert.equal(codes.length, 26)
    assert.equal(new Set(codes).size, 26)
    assert.equal(modes.modes.filter((mode) => mode.group === "PVP").length, 6)
    const auto = modes.modes.find((mode) => mode.code === "co-lien-quan")!
    assert.equal(auto.guideKind, "AUTO_CHESS")
    assert.deepEqual(auto.duration, { minMinutes: 20, maxMinutes: 30 })
    assert.equal(modes.modes.find((mode) => mode.code === "dau-moc")!.availability.gameLabel, "Mở hữu hạn 14 giờ")
    assert.equal(modes.modes.find((mode) => mode.code === "dau-truong-ulti")!.art, null)
    assert.ok(modeContentFromManifest(auto, "asset-1").rules.length > 0)
  },
})

checks.push({
  name: "the encyclopedia references only its own codes, every icon file exists and every image has its source",
  files: [modesFile, guideFile],
  run(read) {
    const guide = JSON.parse(read(guideFile)) as GuideManifest
    const modes = JSON.parse(read(modesFile)) as { modes: ModeManifestEntry[] }
    const traits = new Set(guide.traits.map((trait) => trait.code))
    const units = new Set(guide.units.map((unit) => unit.code))
    assert.equal(units.size, guide.units.length)
    for (const unit of guide.units)
      for (const code of unit.traitCodes) assert.ok(traits.has(code), `${unit.code} → ${code}`)
    for (const lineup of guide.lineups) for (const member of lineup.units) assert.ok(units.has(member.unitCode))
    assert.equal(guide.units.filter((unit) => unit.complete).length, 58)
    assert.ok(guide.units.every((unit) => unit.cost >= 1 && unit.cost <= 6))

    const paths = guideIconPaths(guide)
    assert.equal(paths.length, new Set(paths).size)
    for (const path of paths) readFileSync(new URL(`co-lien-quan/${path}`, modesFolder))
    assert.deepEqual(iconsWithoutSource(guide), [])
    for (const mode of modes.modes.filter((entry) => entry.art))
      assert.ok(importedImageSource(mode.artSource), mode.code)

    const content = guideContentFromManifest(guide, new Map(paths.map((path, at) => [path, `asset-${at}`])))
    assert.equal(content.units.length, guide.units.length)
  },
})

checks.push({
  name: "the frozen AOG registry package imports 147 records",
  files: [new URL("registries-and-rosters.json", aog)],
  run(read) {
    const parsed = parseRegistryImport(read(new URL("registries-and-rosters.json", aog)))
    assert.equal(parsed.asOf, "2026-10-27")
    assert.equal(parsed.rows.length, 147)
    assert.equal(parsed.skipped, 0)
    assert.deepEqual(
      importCounts(parsed.rows).map(({ kind, count }) => ({ kind, count })),
      [
        { kind: "teams", count: 9 },
        { kind: "players", count: 68 },
        { kind: "tournaments", count: 1 },
        { kind: "roster-memberships", count: 69 },
      ],
    )
  },
})

checks.push({
  name: "the frozen series package keeps all 79 timestamps and 78 sourced results without the TBD final",
  files: [new URL("series-import.json", aog)],
  run(read) {
    const parsed = parseRegistryImport(read(new URL("series-import.json", aog)))
    assert.equal(parsed.rows.length, 79)
    assert.equal(parsed.rows.filter((row) => row.content.result !== null).length, 78)
    assert.ok(parsed.rows.every((row) => row.content.scheduledAt))
  },
})

let checked = 0
for (const check of checks) {
  if (!check.files.every((file) => existsSync(file))) {
    console.log(`- skipped, data not pulled: ${check.name}`)
    continue
  }
  check.run((file) => readFileSync(file, "utf8"))
  checked++
  console.log(`✓ ${check.name}`)
}
console.log(`${checked} of ${checks.length} source data checks ran`)
