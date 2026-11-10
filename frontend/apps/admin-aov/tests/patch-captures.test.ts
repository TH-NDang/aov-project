import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { zipSync } from "fflate"
import { buildCaptureManifest, sourceArchiveOf, type CaptureDatasetFiles } from "../server/patch-capture-manifest"
import { createPatchCaptureHandler, findResourcesRoot } from "../server/patch-captures"

const png = (text: string) => new TextEncoder().encode(`\x89PNG fixture ${text}`)
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
const RUN = "all-danh-sach-tuong"
const INNER = "01_airi.zip"
const image = (folder: string, name: string) => {
  const bytes = png(`${folder}/${name}`)
  return { bytes, ref: { archive: INNER, member: `${RUN}/${folder}/${name}`, sha256: sha(bytes), file_name: name } }
}

const airi = {
  overview: image("airi", "0406-hero-022-overview.png"),
  attributes: image("airi", "0412-hero-022-attributes.png"),
  passive: image("airi", "0417-01-hero-022-passive-detail.png"),
  skillOne: image("airi", "0417-02-hero-022-skill-1-detail.png"),
  skillOneMore: image("airi", "0417-03-hero-022-skill-1-detail-2.png"),
  form: image("airi", "0417-04-hero-022-form-2-icons.png"),
}
const darcy = {
  overview: image("darcy", "1508-hero-080-overview.png"),
  attributes: image("darcy", "1514-hero-080-attributes.png"),
  passive: image("darcy", "1519-01-hero-080-passive-detail.png"),
  unknown: image("darcy", "1519-02-hero-080-form-2-unknown.png"),
}

function dataset(overrides: Partial<CaptureDatasetFiles> = {}): CaptureDatasetFiles {
  return {
    patchCode: "2026-10-30",
    sourceManifest: { archive: "outer.zip", sha256: "a".repeat(64), identityAliases: { darcy: "d-arcy" } },
    evidence: [
      { record_id: "airi", pages: Object.values(airi).map(({ ref }) => ({ source: ref })) },
      { record_id: "d-arcy", pages: Object.values(darcy).map(({ ref }) => ({ source: ref })) },
    ],
    importRows: [
      {
        code: "airi",
        skills: [
          {
            skillKey: "skill-0-1",
            name: "Sắc lẻm",
            effects: [
              {
                effectType: "SOURCE_SNAPSHOT",
                metadata: { sourceImages: [airi.passive.ref], completeness: "MANUALLY_REVIEWED_VISIBLE_CONTENT" },
              },
            ],
          },
          {
            skillKey: "skill-1-1",
            name: "Lôi đình",
            effects: [
              {
                effectType: "SOURCE_SNAPSHOT",
                metadata: { sourceImages: [airi.skillOne.ref, airi.skillOneMore.ref], completeness: "PARTIAL_SOURCE" },
              },
            ],
          },
        ],
      },
    ],
    attributeSources: [
      { heroCode: "airi", source: airi.attributes.ref, index: 1 },
      { heroCode: "d-arcy", source: darcy.attributes.ref, index: 2 },
    ],
    attributeReviews: [{ notes: { "2": "The attributes-named source is an overview." } }],
    sourceGaps: {
      withheldCaptures: {
        withheld: [
          {
            heroCode: "d-arcy",
            skillKey: "skill-0-1",
            sources: [darcy.passive.ref],
            reason: "The file labeled passive-detail shows the hero overview.",
          },
        ],
      },
    },
    ...overrides,
  }
}

test("each image keeps how its hero and item link is known, and nothing is guessed", () => {
  const manifest = buildCaptureManifest(dataset())
  const find = (hero: string, fileName: string) =>
    manifest.heroes.get(hero)!.images.find((item) => item.fileName === fileName)!

  assert.deepEqual([...manifest.heroes.keys()], ["airi", "d-arcy"])
  assert.equal(manifest.heroes.get("d-arcy")!.sourceFolder, "darcy")

  const passive = find("airi", airi.passive.ref.file_name)
  assert.deepEqual(
    [passive.section, passive.link, passive.skillKey, passive.skillName],
    ["SKILL", "REVIEWED", "skill-0-1", "Sắc lẻm"],
  )
  assert.equal(find("airi", airi.overview.ref.file_name).link, "FILENAME")
  assert.equal(find("airi", airi.attributes.ref.file_name).link, "REVIEWED")
  assert.match(find("airi", airi.skillOne.ref.file_name).notes[0]!, /chưa đủ toàn văn/)

  // The name says passive, but the review rejected it: it must not reach the passive skill.
  const rejected = find("d-arcy", darcy.passive.ref.file_name)
  assert.deepEqual([rejected.section, rejected.link], ["WITHHELD", "WITHHELD"])
  assert.match(rejected.notes[0]!, /shows the hero overview/)
  assert.deepEqual(find("d-arcy", darcy.attributes.ref.file_name).notes, [
    "The attributes-named source is an overview.",
  ])

  assert.equal(find("airi", airi.form.ref.file_name).link, "UNLINKED")
  assert.match(find("d-arcy", darcy.unknown.ref.file_name).notes[0]!, /unknown/)

  assert.deepEqual(
    {
      total: manifest.coverage.totalImages,
      hero: manifest.coverage.linkedToHero,
      item: manifest.coverage.linkedToItem,
      byLink: manifest.coverage.byLink,
    },
    { total: 10, hero: 10, item: 7, byLink: { REVIEWED: 5, FILENAME: 2, WITHHELD: 1, UNLINKED: 2 } },
  )
  assert.deepEqual(manifest.coverage.unlinkedFromItem.map((item) => item.fileName).sort(), [
    airi.form.ref.file_name,
    darcy.passive.ref.file_name,
    darcy.unknown.ref.file_name,
  ])
})

test("each hero's coverage says which items have a usable image and what the review asked for", () => {
  const manifest = buildCaptureManifest(
    dataset({
      observedAttributes: [
        { heroCode: "airi", values: { health: 3543, physicalAttack: 170 }, source: airi.attributes.ref },
        { heroCode: "d-arcy", values: { health: null }, source: darcy.attributes.ref },
      ],
      recaptureRequests: {
        entries: [{ heroCode: "d-arcy", skillKey: "skill-0-1", request: "Mở nội tại, chọn Chi tiết." }],
      },
    }),
  )
  const [first, second] = manifest.sources
  assert.deepEqual(first!.overview, [airi.overview.ref.file_name])
  assert.deepEqual(first!.attributes, [
    { fileName: airi.attributes.ref.file_name, values: { health: 3543, physicalAttack: 170 } },
  ])
  assert.deepEqual(
    first!.skills.map((skill) => [skill.skillKey, skill.shown.length, skill.withheld.length, skill.cut]),
    [
      ["skill-0-1", 1, 0, false],
      ["skill-1-1", 2, 0, true],
    ],
    "a description the review marked partial is cut, whatever the number of pages",
  )
  // The passive was never entered; its only image was withheld, so it reads as a skill with no usable image.
  assert.deepEqual(second!.skills, [
    {
      skillKey: "skill-0-1",
      name: null,
      shown: [],
      withheld: [darcy.passive.ref.file_name],
      cut: false,
      table: null,
      request: "Mở nội tại, chọn Chi tiết.",
    },
  ])
  assert.deepEqual(second!.attributes[0]!.values, { health: null })
  assert.equal(buildCaptureManifest(dataset()).sources[0]!.attributes[0]!.values, null, "an older set says nothing")
})

test("a folder and record that disagree stay unlinked instead of picking a hero", () => {
  const stray = image("zuka", "9999-hero-999-overview.png")
  const manifest = buildCaptureManifest(
    dataset({
      evidence: [{ record_id: "airi", pages: [{ source: stray.ref }] }],
      importRows: [],
      attributeSources: [],
    }),
  )
  assert.equal(manifest.heroes.size, 0)
  assert.equal(manifest.coverage.linkedToHero, 0)
  assert.equal(manifest.coverage.unlinkedFromHero[0]!.fileName, stray.ref.file_name)
})

test("a review reference with another hash does not vouch for the image", () => {
  const stale = { ...airi.passive.ref, sha256: "b".repeat(64) }
  const rows = [
    {
      code: "airi",
      skills: [
        {
          skillKey: "skill-0-1",
          effects: [{ effectType: "SOURCE_SNAPSHOT", metadata: { sourceImages: [stale] } }],
        },
      ],
    },
  ]
  const manifest = buildCaptureManifest(dataset({ importRows: rows }))
  const passive = manifest.heroes.get("airi")!.images.find((item) => item.fileName === airi.passive.ref.file_name)!
  assert.equal(passive.link, "UNLINKED")
})

async function fixtureRepository() {
  const root = await mkdtemp(join(tmpdir(), "patch-captures-test-"))
  const resources = join(root, "resources")
  const directory = join(resources, "extracted", "2026-s4", "2026-10-30")
  await mkdir(join(directory, "evidence"), { recursive: true })
  await mkdir(join(directory, "manual"), { recursive: true })
  await mkdir(join(resources, "raw"), { recursive: true })
  const files = dataset()
  const write = (path: string, value: unknown) => writeFile(join(directory, path), JSON.stringify(value))
  await write("source-manifest.json", files.sourceManifest)
  await write("evidence/airi.json", files.evidence[0])
  await write("evidence/d-arcy.json", files.evidence[1])
  await write("manual/import-rows.json", files.importRows)
  await write("manual-attribute-sources.json", files.attributeSources)
  await write("manual-attributes-01.review.json", files.attributeReviews[0])
  await write("manual/source-gaps.json", files.sourceGaps)
  const members = Object.fromEntries(
    [...Object.values(airi), ...Object.values(darcy)].map(({ ref, bytes }) => [ref.member, bytes]),
  )
  const inner = zipSync(members, { level: 6 })
  await writeFile(join(resources, "raw", "outer.zip"), zipSync({ [INNER]: inner }, { level: 1 }))
  return {
    root,
    directory,
    cache: join(root, "cache"),
    worktree: join(root, ".claude", "worktrees", "feature", "apps", "admin"),
  }
}

async function request(
  handler: ReturnType<typeof createPatchCaptureHandler>,
  url: string,
  method = "GET",
): Promise<{ status: number; headers: Record<string, unknown>; body: Buffer; next: boolean }> {
  return new Promise((resolve, reject) => {
    let status = 0
    let headers: Record<string, unknown> = {}
    const res = {
      writeHead(code: number, values: Record<string, unknown>) {
        status = code
        headers = values
      },
      end(body?: string | Buffer) {
        resolve({ status, headers, body: Buffer.from(body ?? ""), next: false })
      },
    }
    handler({ url, method } as never, res as never, () =>
      resolve({ status: 0, headers: {}, body: Buffer.alloc(0), next: true }),
    ).catch(reject)
  })
}

test("the dev endpoint serves verified originals from the nested archive and refuses anything else", async () => {
  const { root, cache, worktree } = await fixtureRepository()
  try {
    assert.equal(findResourcesRoot(worktree, ""), join(root, "resources"))
    const handler = createPatchCaptureHandler({ start: worktree, cacheRoot: cache })

    const hero = await request(handler, "/2026-10-30/heroes/d-arcy.json")
    assert.equal(hero.status, 200)
    const body = JSON.parse(hero.body.toString()) as { heroCode: string; sourceFolder: string; images: unknown[] }
    assert.deepEqual([body.heroCode, body.sourceFolder, body.images.length], ["d-arcy", "darcy", 4])

    const picture = await request(handler, `/2026-10-30/images/${airi.skillOne.ref.sha256}.png`)
    assert.equal(picture.status, 200)
    assert.equal(picture.headers["Content-Type"], "image/png")
    assert.match(String(picture.headers["Cache-Control"]), /immutable/)
    assert.deepEqual(new Uint8Array(picture.body), airi.skillOne.bytes)
    // A hit must not unpack again: the inner archive stays in the cache, outside the read-only resources folder.
    const cached = join(cache, "a".repeat(16), INNER)
    const before = (await stat(cached)).mtimeMs
    await request(handler, `/2026-10-30/images/${airi.passive.ref.sha256}.png`)
    assert.equal((await stat(cached)).mtimeMs, before)

    const head = await request(handler, `/2026-10-30/images/${airi.skillOne.ref.sha256}.png`, "HEAD")
    assert.deepEqual([head.status, head.body.length], [200, 0])

    const code = async (url: string, method?: string) => {
      const response = await request(handler, url, method)
      return [response.status, (JSON.parse(response.body.toString()) as { code: string }).code]
    }
    assert.deepEqual(await code("/2026-01-01/heroes/airi.json"), [404, "PATCH_NOT_FOUND"])
    assert.deepEqual(await code("/2026-10-30/heroes/zuka.json"), [404, "HERO_NOT_FOUND"])
    assert.deepEqual(await code(`/2026-10-30/images/${"f".repeat(64)}.png`), [404, "IMAGE_NOT_FOUND"])
    assert.deepEqual(await code("/2026-10-30/images/not-a-hash.png"), [400, "INVALID_REQUEST"])
    assert.deepEqual(await code("/..%2f..%2fsecrets/heroes/airi.json"), [400, "INVALID_REQUEST"])
    assert.deepEqual(await code("/2026-10-30/heroes/airi.json", "POST"), [405, "METHOD_NOT_ALLOWED"])
    assert.equal((await request(handler, "/2026-10-30/raw/outer.zip")).next, true)

    const sets = await request(handler, "/sets.json")
    assert.deepEqual(JSON.parse(sets.body.toString()), { patches: ["2026-10-30"] })

    const coverage = await request(handler, "/2026-10-30/coverage.json")
    const summary = JSON.parse(coverage.body.toString()) as { totalImages: number; linkedToItem: number }
    assert.deepEqual([summary.totalImages, summary.linkedToItem], [10, 7])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("every hero's coverage is served and read again once a reviewer adds to the set", async () => {
  const { root, directory, cache, worktree } = await fixtureRepository()
  try {
    const handler = createPatchCaptureHandler({ start: worktree, cacheRoot: cache, signatureTtlMs: 0 })
    type Body = { patchCode: string; heroes: { heroCode: string; attributes: { values: unknown }[] }[] }
    const read = async () => JSON.parse((await request(handler, "/2026-10-30/heroes.json")).body.toString()) as Body
    const before = await read()
    assert.equal(before.patchCode, "2026-10-30")
    assert.deepEqual(
      before.heroes.map((hero) => hero.heroCode),
      ["airi", "d-arcy"],
    )
    assert.equal(before.heroes[1]!.attributes[0]!.values, null)

    await writeFile(
      join(directory, "manual", "observed-attributes.json"),
      JSON.stringify([{ heroCode: "d-arcy", values: { health: 3400 }, source: darcy.attributes.ref }]),
    )
    const after = await read()
    assert.deepEqual(after.heroes[1]!.attributes[0]!.values, { health: 3400 }, "no restart needed")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("a later capture run lists its own inner archives, and two runs may not share one", () => {
  const later = { archive: "later.zip", sha256: "c".repeat(64), innerArchives: ["01_later.zip"] }
  const manifest = buildCaptureManifest(
    dataset({ sourceManifest: { ...dataset().sourceManifest, supplements: [later] } }),
  )
  assert.deepEqual(sourceArchiveOf(manifest, "01_later.zip"), { archive: "later.zip", sha256: "c".repeat(64) })
  assert.deepEqual(sourceArchiveOf(manifest, INNER), { archive: "outer.zip", sha256: "a".repeat(64) })

  const twice = { ...later, archive: "again.zip", sha256: "d".repeat(64) }
  assert.throws(
    () =>
      buildCaptureManifest(dataset({ sourceManifest: { ...dataset().sourceManifest, supplements: [later, twice] } })),
    /01_later\.zip is listed by two capture runs/,
  )
})

test("an image from a later capture run is served from that run's archive", async () => {
  const { root, directory, cache, worktree } = await fixtureRepository()
  try {
    const bytes = png("airi/later attributes")
    const member = "pick-airi/airi/0450-hero-024-attributes.png"
    const ref = { archive: "01_later.zip", member, sha256: sha(bytes), file_name: "0450-hero-024-attributes.png" }
    const inner = zipSync({ [member]: bytes }, { level: 6 })
    await writeFile(join(root, "resources", "raw", "later.zip"), zipSync({ "01_later.zip": inner }, { level: 1 }))
    const files = dataset()
    const supplements = [{ archive: "later.zip", sha256: "c".repeat(64), innerArchives: ["01_later.zip"] }]
    await writeFile(join(directory, "source-manifest.json"), JSON.stringify({ ...files.sourceManifest, supplements }))
    const airiRecord = files.evidence[0]!
    await writeFile(
      join(directory, "evidence", "airi.json"),
      JSON.stringify({ ...airiRecord, pages: [...airiRecord.pages, { source: ref }] }),
    )
    await writeFile(
      join(directory, "manual-attribute-sources.json"),
      JSON.stringify([...files.attributeSources, { heroCode: "airi", source: ref, index: 3 }]),
    )

    const handler = createPatchCaptureHandler({ start: worktree, cacheRoot: cache })
    const picture = await request(handler, `/2026-10-30/images/${ref.sha256}.png`)
    assert.equal(picture.status, 200)
    assert.deepEqual(new Uint8Array(picture.body), bytes)
    await stat(join(cache, "c".repeat(16), "01_later.zip"))

    const earlier = await request(handler, `/2026-10-30/images/${airi.skillOne.ref.sha256}.png`)
    assert.deepEqual(new Uint8Array(earlier.body), airi.skillOne.bytes, "the set's own archive still serves its images")

    const hero = JSON.parse((await request(handler, "/2026-10-30/heroes/airi.json")).body.toString()) as {
      images: { fileName: string; section: string; link: string }[]
    }
    const later = hero.images.find((item) => item.fileName === ref.file_name)!
    assert.deepEqual([later.section, later.link], ["ATTRIBUTES", "REVIEWED"])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("a damaged cached archive is reported, never shown as the original", async () => {
  const { root, cache, worktree } = await fixtureRepository()
  try {
    const target = join(cache, "a".repeat(16), INNER)
    await mkdir(join(cache, "a".repeat(16)), { recursive: true })
    const swapped = zipSync({ [airi.skillOne.ref.member]: png("something else") })
    await writeFile(target, swapped)
    const handler = createPatchCaptureHandler({ start: worktree, cacheRoot: cache })
    const response = await request(handler, `/2026-10-30/images/${airi.skillOne.ref.sha256}.png`)
    assert.equal(response.status, 502)
    assert.equal((JSON.parse(response.body.toString()) as { code: string }).code, "IMAGE_HASH_MISMATCH")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
