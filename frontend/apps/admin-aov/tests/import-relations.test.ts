import assert from "node:assert/strict"
import { test } from "node:test"
import { zipSync, strToU8 } from "fflate"
import { readImportZip, importDataDirectory } from "../src/features/publishing/import-archive"
import { readImportDrop } from "../src/features/publishing/import-drop"

test("folder drops read every directory batch and preserve relative paths", async () => {
  const entry = (name: string) => ({
    name,
    isFile: true,
    isDirectory: false,
    file: (done: (file: File) => void) => done(new File([name], name)),
  })
  const batches = [[entry("heroes.json")], [entry("portrait.png")], []]
  const directory = {
    name: "bundle",
    isFile: false,
    isDirectory: true,
    createReader: () => ({ readEntries: (done: (entries: unknown[]) => void) => done(batches.shift()!) }),
  }
  const result = await readImportDrop({
    items: [{ kind: "file", webkitGetAsEntry: () => directory }],
    files: [],
  } as unknown as DataTransfer)
  assert.deepEqual([...result.keys()], ["bundle/heroes.json", "bundle/portrait.png"])
  const file = new File(["[]"], "heroes.json")
  const fallback = await readImportDrop({ items: [], files: [file] } as unknown as DataTransfer)
  assert.equal(fallback.get("heroes.json"), file)
})
import {
  defaultRelationMapping,
  mapRelation,
  sourcePaths,
  type RelationField,
} from "../src/features/publishing/import-relations"
import {
  indexImportFiles,
  resolveImportImage,
  normalizeImportPath,
  importImageFile,
  detectImportImageBase,
} from "../src/features/publishing/import-files"

test("image roots follow actual package paths and survive JSON reselection", () => {
  const image = new File(["image"], "airi.jpg")
  const files = new Map([
    ["bundle/assets/airi.jpg", image],
    ["bundle/assets/skill.jpg", image],
    ["bundle/assets/skin.jpg", image],
  ])
  const data = [
    { head: "assets/airi.jpg", skills: [{ icon: "assets/skill.jpg" }], skins: [{ cover: "assets/skin.jpg" }] },
  ]
  assert.equal(detectImportImageBase(data, files, "bundle/data/heroes.json", ""), "bundle")
  assert.equal(detectImportImageBase(data, files, "bundle/data/other.json", "bundle"), "bundle")
  assert.equal(
    detectImportImageBase([{ icon: "../assets/skill.jpg" }], files, "bundle/data/heroes.json", ""),
    "bundle/data",
  )
  assert.equal(detectImportImageBase(data, new Map([["assets/airi.jpg", image]]), "data/heroes.json", "data"), "")
  assert.equal(detectImportImageBase([{ head: "missing.jpg" }], files, "bundle/data/heroes.json", "bundle"), "bundle")
  assert.equal(
    detectImportImageBase([{ head: "https://example.com/airi.jpg" }], files, "bundle/data/heroes.json", "bundle"),
    "bundle",
  )
  const duplicates = new Map([...files, ["other/assets/airi.jpg", image] as const])
  assert.equal(
    detectImportImageBase([{ head: "assets/airi.jpg" }], duplicates, "bundle/data/heroes.json", "other"),
    "other",
  )
})

const fields: RelationField[] = ["skinKey", "name", "description", "rarityCode"].map((key) => ({
  key,
  label: key,
  type: "text",
}))
fields.push({ key: "artAssetId", label: "Art", type: "image" })
test("only explicitly mapped image columns produce upload targets and unmapped fields survive", () => {
  const source = [{ id: "airi-skin", name: "New name", cover: "assets/new.jpg", portrait: "assets/unused.png" }]
  const previous = [
    {
      skinKey: "airi-skin",
      displayOrder: 7,
      artAssetId: "old",
      rarityCode: "S",
      translations: [
        { locale: "vi-VN", name: "Old", description: "Keep" },
        { locale: "en-US", name: "English" },
      ],
    },
  ]
  const mapping = defaultRelationMapping(source, "skins")
  const result = mapRelation("skins", source, mapping, previous, "vi-VN", fields)
  assert.equal(result.images.length, 0)
  assert.equal(result.rows[0].artAssetId, "old")
  assert.equal(result.rows[0].displayOrder, 7)
  assert.equal(result.rows[0].rarityCode, "S")
  assert.deepEqual(result.rows[0].translations, [
    { locale: "en-US", name: "English" },
    { locale: "vi-VN", name: "New name", description: "Keep" },
  ])
  mapping.fields.artAssetId = "cover"
  const mapped = mapRelation("skins", source, mapping, previous, "vi-VN", fields)
  assert.deepEqual(
    mapped.images.map((image) => image.source),
    ["assets/new.jpg"],
  )
  assert.equal(mapped.images[0].semanticType, "HERO_SKIN_ART")
})
test("skill variants get stable keys and explicit icons, missing descriptions remain empty in drafts", () => {
  const source = [
    {
      slot: 1,
      name: "Skill",
      description: "Description",
      variants: [
        { index: 1, icon: "a.png" },
        { index: 2, icon: "b.png" },
      ],
    },
  ]
  const mapping = defaultRelationMapping(source, "skills")
  mapping.fields.iconAssetId = "variant.icon"
  const fields = ["skillKey", "kind", "name", "description"].map((key) => ({ key, label: key, type: "text" }))
  fields.push({ key: "iconAssetId", label: "Icon", type: "image" })
  fields.push({ key: "displayOrder", label: "Order", type: "number" })
  const result = mapRelation("skills", source, mapping, [], "vi-VN", fields)
  assert.deepEqual(
    result.rows.map((row) => row.skillKey),
    ["skill-1-1", "skill-1-2"],
  )
  assert.deepEqual(
    result.images.map((image) => image.source),
    ["a.png", "b.png"],
  )
  assert.deepEqual(
    result.rows.map((row) => row.displayOrder),
    [0, 1],
  )
  const incomplete = mapRelation("skills", [{ ...source[0], description: null }], mapping, [], "vi-VN", fields)
  assert.equal((incomplete.rows[0].translations as { description: string }[])[0].description, "")
})

const skillFields: RelationField[] = [
  ...["skillKey", "kind", "formKey", "name", "description"].map((key) => ({ key, label: key, type: "text" })),
  { key: "displayOrder", label: "Order", type: "number" },
  { key: "effects", label: "Effects", type: "json" },
  { key: "iconAssetId", label: "Icon", type: "image" },
]

test("capture mapping keeps source snapshots whole while generic nested JSON paths remain selectable", () => {
  const capture = [
    {
      skillKey: "skill-1-1",
      kind: "ACTIVE",
      name: "Captured skill",
      description: "Captured description",
      iconAssetId: "assets/captured.png",
      effects: [
        {
          effectType: "SOURCE_SNAPSHOT",
          metadata: {
            rawAttributes: Object.fromEntries(
              Array.from({ length: 1500 }, (_, index) => [`attribute-${index}`, { value: index }]),
            ),
            levelTable: { rows: [{ label: "ST gốc", display_values: ["8", "7.6"] }] },
          },
        },
      ],
    },
  ]
  assert.deepEqual(sourcePaths(capture), ["skillKey", "kind", "name", "description", "iconAssetId", "effects"])
  const mapping = defaultRelationMapping(capture, "skills")
  assert.equal(mapping.fields.effects, "effects")
  assert.equal(mapping.fields.iconAssetId, "iconAssetId")
  const result = mapRelation("skills", capture, mapping, [], "vi-VN", skillFields)
  assert.deepEqual(result.rows[0].effects, capture[0].effects, "Narrowing choices must not discard captured metadata")
  assert.equal(result.images[0].source, "assets/captured.png")
  const generic = [
    {
      skillKey: "custom",
      details: { translations: [{ locale: "vi-VN", name: "Nested name" }], artwork: { icon: "assets/custom.png" } },
      effects: [{ effectType: "DAMAGE", metadata: { damage: { base: 320 }, coefficients: [1, 2] } }],
      variants: [{ index: 1, icon: "assets/variant.png" }],
    },
  ]
  const genericPaths = sourcePaths(generic)
  assert.ok(genericPaths.includes("details.translations.0.name"))
  assert.ok(genericPaths.includes("details.artwork.icon"))
  assert.ok(genericPaths.includes("effects.0.metadata.damage.base"))
  assert.ok(genericPaths.includes("variants.0.icon"))
})

test("partial captures retain unmatched skill variants and their authored data without shifting image targets", () => {
  const primaryAsset = "11111111-1111-4111-8111-111111111111"
  const variantAsset = "22222222-2222-4222-8222-222222222222"
  const passiveAsset = "33333333-3333-4333-8333-333333333333"
  const previous = [
    {
      skillKey: "skill-1-1",
      kind: "ACTIVE",
      formKey: "human",
      displayOrder: 0,
      iconAssetId: primaryAsset,
      translations: [
        { locale: "vi-VN", name: "Tên trước", description: "Mô tả trước" },
        { locale: "en-US", name: "Human ability", description: "Reviewed English translation" },
      ],
      effects: [{ effectType: "DAMAGE", metadata: { value: 100 } }],
    },
    {
      skillKey: "skill-1-2",
      kind: "ACTIVE",
      formKey: "fox",
      displayOrder: 1,
      iconAssetId: variantAsset,
      translations: [
        { locale: "vi-VN", name: "Dạng hồ ly", description: "Nội dung chưa có trong ảnh chụp" },
        { locale: "en-US", name: "Fox ability", description: "Keep this translation" },
      ],
      effects: [{ effectType: "DAMAGE", metadata: { values: [100, 200], reviewed: true } }],
    },
    {
      skillKey: "skill-0-1",
      kind: "PASSIVE",
      formKey: null,
      displayOrder: 2,
      iconAssetId: passiveAsset,
      translations: [{ locale: "vi-VN", name: "Nội tại", description: "Nội dung được giữ nguyên" }],
      effects: [{ effectType: "BUFF", metadata: { stacks: 3 } }],
    },
  ]
  const snapshot = structuredClone(previous)
  const source = [
    {
      skillKey: "skill-1-1",
      kind: "ACTIVE",
      displayOrder: 0,
      name: "Tên từ ảnh chụp",
      description: "Mô tả được thu thập",
      iconAssetId: "assets/primary.png",
      effects: [{ effectType: "SOURCE_SNAPSHOT", metadata: { sourceImage: "primary-capture.png" } }],
    },
    {
      skillKey: "skill-4-1",
      kind: "ACTIVE",
      displayOrder: 1,
      name: "Chiêu mới",
      description: "Dữ liệu bổ sung",
      iconAssetId: "assets/new-skill.png",
      effects: [{ effectType: "SOURCE_SNAPSHOT", metadata: { sourceImage: "new-capture.png" } }],
    },
  ]
  const result = mapRelation("skills", source, defaultRelationMapping(source, "skills"), previous, "vi-VN", skillFields)
  assert.deepEqual(
    result.rows.map((row) => row.skillKey),
    ["skill-1-1", "skill-4-1", "skill-1-2", "skill-0-1"],
  )
  assert.deepEqual(
    result.rows.map((row) => row.displayOrder),
    [0, 1, 2, 3],
  )
  assert.equal(new Set(result.rows.map((row) => row.displayOrder)).size, result.rows.length)
  assert.deepEqual(result.rows[2], { ...previous[1], displayOrder: 2 })
  assert.deepEqual(result.rows[3], { ...previous[2], displayOrder: 3 })
  assert.equal(result.rows[0].iconAssetId, primaryAsset, "Current icon remains until the replacement upload completes")
  assert.equal(result.rows[0].formKey, "human")
  assert.deepEqual(result.rows[0].translations, [
    previous[0].translations[1],
    { locale: "vi-VN", name: "Tên từ ảnh chụp", description: "Mô tả được thu thập" },
  ])
  assert.deepEqual(
    result.images.map((image) => ({
      index: image.index,
      key: result.rows[image.index].skillKey,
      source: image.source,
      semanticType: image.semanticType,
    })),
    [
      { index: 0, key: "skill-1-1", source: "assets/primary.png", semanticType: "HERO_SKILL_ICON" },
      { index: 1, key: "skill-4-1", source: "assets/new-skill.png", semanticType: "HERO_SKILL_ICON" },
    ],
  )
  assert.deepEqual(previous, snapshot, "Planning a partial import must not mutate existing skill data")
})

test("generic full-array imports replace unmatched skills even when previous metadata came from a capture", () => {
  const previous = [
    {
      skillKey: "skill-1-1",
      kind: "ACTIVE",
      formKey: null,
      displayOrder: 0,
      iconAssetId: "11111111-1111-4111-8111-111111111111",
      translations: [{ locale: "vi-VN", name: "Tên trước", description: "Mô tả trước" }],
      effects: [{ effectType: "SOURCE_SNAPSHOT", metadata: { sourceImage: "old.png" } }],
    },
    {
      skillKey: "skill-1-2",
      kind: "ACTIVE",
      formKey: "fox",
      displayOrder: 1,
      iconAssetId: "22222222-2222-4222-8222-222222222222",
      translations: [{ locale: "vi-VN", name: "Dạng cũ", description: "Bị loại khỏi mảng đầy đủ" }],
      effects: [],
    },
  ]
  const source = [{ skillKey: "skill-1-1", kind: "ACTIVE", name: "Tên mới", description: "Mảng thay thế đầy đủ" }]
  const result = mapRelation("skills", source, defaultRelationMapping(source, "skills"), previous, "vi-VN", skillFields)
  assert.deepEqual(
    result.rows.map((row) => row.skillKey),
    ["skill-1-1"],
  )
  assert.equal(result.rows[0].iconAssetId, previous[0].iconAssetId)
  assert.deepEqual(
    result.rows[0].effects,
    previous[0].effects,
    "Unmapped metadata on matched rows is retained without changing array semantics",
  )
  assert.deepEqual(result.images, [])
  for (const effects of ["", "   "]) {
    const emptyEffects = [{ ...source[0], effects }]
    const mapped = mapRelation(
      "skills",
      emptyEffects,
      defaultRelationMapping(emptyEffects, "skills"),
      previous,
      "vi-VN",
      skillFields,
    )
    assert.deepEqual(
      mapped.rows.map((row) => row.skillKey),
      ["skill-1-1"],
      "Blank CSV effects keep full-array replacement semantics",
    )
    assert.deepEqual(mapped.rows[0].effects, previous[0].effects)
  }
  assert.deepEqual(
    mapRelation("skills", [], defaultRelationMapping([], "skills"), previous, "vi-VN", skillFields).rows,
    [],
  )
})
test("folder resolution uses an explicit base, rejects escapes and does not fall back to matching basenames", async () => {
  const file = new File(["bytes"], "portrait.png", { type: "image/png" })
  Object.defineProperty(file, "webkitRelativePath", { value: "Lien-Quan-v3/assets/portrait.png" })
  const files = indexImportFiles([file])
  assert.equal(resolveImportImage("assets/portrait.png", files, ""), file)
  assert.equal(resolveImportImage("../assets/portrait.png", files, "data"), file)
  assert.throws(() => resolveImportImage("portrait.png", files, ""), /Không tìm thấy/)
  assert.throws(() => normalizeImportPath("../../secret.png"), /ngoài thư mục/)
  assert.throws(() => normalizeImportPath("C:\\private\\a.png"), /tương đối/)
  assert.throws(() => normalizeImportPath("\\\\server\\a.png"), /tương đối/)
  assert.throws(() => resolveImportImage("https://user:password@example.com/a.png", files, ""), /tài khoản/)
  const pointer = new File(["version https://git-lfs.github.com/spec/v1\n"], "pointer.jpg", { type: "image/jpeg" })
  await assert.rejects(importImageFile("pointer.jpg", new Map([["pointer.jpg", pointer]]), ""), /Git LFS pointer/)
})

test("ZIP preserves nested paths and resolves only mapped skill and skin images relative to the data file", async () => {
  const bytes = zipSync({
    "bundle/data/heroes.json": strToU8("[]"),
    "bundle/assets/skill.png": strToU8("skill"),
    "bundle/assets/skin.jpg": strToU8("skin"),
    "bundle/assets/unused.png": strToU8("unused"),
    "bundle/readme.txt": strToU8("ignored"),
  })
  const files = await readImportZip(new File([bytes], "bundle.zip"))
  const base = importDataDirectory("bundle/data/heroes.json")
  assert.equal(base, "bundle/data")
  assert.equal(files.has("bundle/readme.txt"), false)
  const image = await importImageFile("../assets/skill.png", files, base)
  assert.equal(await image.text(), "skill")
  assert.equal(image.type, "image/png")
  assert.equal(await (await importImageFile("../assets/skin.jpg", files, base)).text(), "skin")
  assert.throws(() => resolveImportImage("missing.png", files, base), /Không tìm thấy/)
  assert.throws(() => resolveImportImage("\\\\server\\a.png", files, base), /tương đối/)
})

test("ZIP rejects traversal, duplicate normalized paths, corrupt archives and files exceeding extraction limits", async () => {
  const archive = (entries: Record<string, Uint8Array>) => new File([zipSync(entries)], "test.zip")
  await assert.rejects(readImportZip(archive({ "../heroes.json": strToU8("[]") })), /ngoài thư mục/)
  await assert.rejects(readImportZip(archive({ "a.json": strToU8("[]"), "x/../a.json": strToU8("[]") })), /Trùng/)
  await assert.rejects(readImportZip(archive({ "heroes.json": new Uint8Array(5 * 1024 * 1024 + 1) })), /giới hạn/)
  await assert.rejects(readImportZip(new File(["bad zip"], "bad.zip")))
  await assert.rejects(readImportZip(archive({ "image.png": strToU8("image") })), /không có file/)
})
