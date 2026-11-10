/** Joins a capture archive's inventory to the manual review files, keeping how each link is known. */

export type CaptureSection = "OVERVIEW" | "ATTRIBUTES" | "SKILL" | "WITHHELD" | "FORM"
/** REVIEWED: a review file names this image for this item. FILENAME: only the file name says so. */
export type CaptureLink = "REVIEWED" | "FILENAME" | "WITHHELD" | "UNLINKED"

export interface CaptureImage {
  id: string
  fileName: string
  archive: string
  member: string
  section: CaptureSection
  link: CaptureLink
  skillKey: string | null
  skillName: string | null
  notes: string[]
}

export interface HeroCaptures {
  heroCode: string
  sourceFolder: string
  images: CaptureImage[]
}

export interface UnlinkedCapture {
  heroCode: string | null
  fileName: string
  member: string
  reason: string
}

export interface CaptureCoverage {
  totalImages: number
  heroes: number
  linkedToHero: number
  linkedToItem: number
  byLink: Record<CaptureLink, number>
  bySection: Record<CaptureSection, number>
  unlinkedFromHero: UnlinkedCapture[]
  unlinkedFromItem: UnlinkedCapture[]
}

/** What one hero's captures show item by item, so an editor can tell what still has to be captured. */
export interface HeroSourceCoverage {
  heroCode: string
  overview: string[]
  attributes: AttributeSource[]
  skills: SkillSource[]
}

export interface AttributeSource {
  fileName: string
  /** The values read off this image; a field that is null or absent was not visible. Null where the set has no record. */
  values: Record<string, unknown> | null
}

export interface SkillSource {
  skillKey: string
  name: string | null
  /** Reviewed images of this skill. */
  shown: string[]
  /** Images named after this skill that the review rejected because they show something else. */
  withheld: string[]
  /** The description runs on past the last captured page. */
  cut: boolean
  /** Whether a level table appears on any captured page; null where the review did not say. */
  table: boolean | null
  /** What the reviewer asked to be captured again. */
  request: string | null
}

/** An archive in `resources/raw` that holds inner archives of the set. */
export interface SourceArchive {
  archive: string
  sha256: string
}

export interface CaptureManifest {
  patchCode: string
  archive: string
  archiveSha256: string
  /** Inner archives that come from a later capture run rather than the set's own archive, by inner archive name. */
  supplementArchives: Map<string, SourceArchive>
  heroes: Map<string, HeroCaptures>
  images: Map<string, CaptureImage>
  coverage: CaptureCoverage
  sources: HeroSourceCoverage[]
}

interface SourceRef {
  archive: string
  member: string
  sha256: string
  file_name: string
}

/** A later capture run of the same patch, added to the set to fill what the first run missed. */
export interface CaptureSupplement extends SourceArchive {
  innerArchives: string[]
}

export interface CaptureDatasetFiles {
  patchCode: string
  sourceManifest: {
    archive: string
    sha256: string
    identityAliases: Record<string, string>
    supplements?: CaptureSupplement[]
  }
  evidence: { record_id: string; pages: { source: SourceRef }[] }[]
  importRows: {
    code: string
    skills: {
      skillKey: string
      name?: string
      effects?: {
        effectType: string
        metadata?: { sourceImages?: SourceRef[]; completeness?: string; tableObservationStatus?: string }
      }[]
    }[]
  }[]
  attributeSources: { heroCode: string; source: SourceRef; index: number }[]
  attributeReviews: { notes?: Record<string, string> }[]
  sourceGaps: {
    additionalGaps?: { heroCode: string; skillKey?: string; kind: string; sources?: SourceRef[] }[]
    withheldCaptures?: {
      withheld?: { heroCode: string; skillKey?: string; sources?: SourceRef[]; reason?: string }[]
    }
  }
  /** Values read off each attributes image; older sets do not have them. */
  observedAttributes?: { heroCode: string; values?: Record<string, unknown> | null; source?: SourceRef }[]
  recaptureRequests?: { entries?: { heroCode: string; skillKey?: string; request?: string }[] }
}

const SOURCE_FOLDER = /^[^/]+\/([^/]+)\/[^/]+$/
const FORM_IMAGE = /-form-\d+-(icons|unknown)\.png$/
const OVERVIEW_IMAGE = /-overview\.png$/
const NOTE_PARTIAL = "Ảnh chưa đủ toàn văn mô tả; mô tả đã nhập chỉ là phần nhìn thấy."
const NOTE_HERO_CONFLICT = "Thư mục ảnh và hồ sơ trích xuất chỉ tới hai tướng khác nhau."
const NOTE_FORM_ICONS =
  "Ảnh chụp bộ biểu tượng của dạng khác; không có bản rà soát nào gắn ảnh này với một mục đã nhập."
const NOTE_FORM_UNKNOWN = "Tên tệp ghi “unknown”; chưa xác định ảnh này thuộc mục nào."
const NOTE_UNCLASSIFIED = "Tên tệp không thuộc nhóm đã biết và chưa có bản rà soát nào nhắc tới."

/** A review names an image by its place in the archive and its hash; a file with other bytes is another image. */
const keyOf = (source: Pick<SourceRef, "member" | "sha256">) => `${source.member}\u0000${source.sha256}`

type Link = Pick<CaptureImage, "section" | "link" | "skillKey" | "skillName"> & { notes: string[] }

export function buildCaptureManifest(files: CaptureDatasetFiles): CaptureManifest {
  const links = new Map<string, Link>()
  const notesFor = new Map<string, string[]>()
  const addNote = (source: SourceRef, note: string) =>
    notesFor.set(keyOf(source), [...(notesFor.get(keyOf(source)) ?? []), note])

  for (const row of files.importRows)
    for (const skill of row.skills) {
      const snapshot = skill.effects?.find((effect) => effect.effectType === "SOURCE_SNAPSHOT")?.metadata
      for (const source of snapshot?.sourceImages ?? []) {
        links.set(keyOf(source), {
          section: "SKILL",
          link: "REVIEWED",
          skillKey: skill.skillKey,
          skillName: skill.name ?? null,
          notes: [],
        })
        if (snapshot?.completeness === "PARTIAL_SOURCE") addNote(source, NOTE_PARTIAL)
      }
    }
  const attributeNotes = Object.assign({}, ...files.attributeReviews.map((review) => review.notes ?? {})) as Record<
    string,
    string
  >
  for (const { source, index } of files.attributeSources) {
    links.set(keyOf(source), { section: "ATTRIBUTES", link: "REVIEWED", skillKey: null, skillName: null, notes: [] })
    if (attributeNotes[index]) addNote(source, attributeNotes[index])
  }
  for (const capture of files.sourceGaps.withheldCaptures?.withheld ?? [])
    for (const source of capture.sources ?? []) {
      // A file never reviewed as this item keeps its reason visible rather than joining the item it was named after.
      if (!links.has(keyOf(source)))
        links.set(keyOf(source), {
          section: "WITHHELD",
          link: "WITHHELD",
          skillKey: capture.skillKey ?? null,
          skillName: null,
          notes: [],
        })
      if (capture.reason) addNote(source, capture.reason)
    }

  const heroes = new Map<string, HeroCaptures>()
  const images = new Map<string, CaptureImage>()
  const unlinkedFromHero: UnlinkedCapture[] = []
  const unlinkedFromItem: UnlinkedCapture[] = []
  for (const record of files.evidence)
    for (const { source } of record.pages) {
      const folder = SOURCE_FOLDER.exec(source.member)?.[1] ?? ""
      const heroCode = files.sourceManifest.identityAliases[folder] ?? folder
      const reviewed = links.get(keyOf(source))
      const fallback: Link = OVERVIEW_IMAGE.test(source.file_name)
        ? { section: "OVERVIEW", link: "FILENAME", skillKey: null, skillName: null, notes: [] }
        : {
            section: "FORM",
            link: "UNLINKED",
            skillKey: null,
            skillName: null,
            notes: [
              !FORM_IMAGE.test(source.file_name)
                ? NOTE_UNCLASSIFIED
                : source.file_name.endsWith("-unknown.png")
                  ? NOTE_FORM_UNKNOWN
                  : NOTE_FORM_ICONS,
            ],
          }
      const link = reviewed ?? fallback
      const image: CaptureImage = {
        id: source.sha256,
        fileName: source.file_name,
        archive: source.archive,
        member: source.member,
        section: link.section,
        link: link.link,
        skillKey: link.skillKey,
        skillName: link.skillName,
        notes: [...link.notes, ...(notesFor.get(keyOf(source)) ?? [])],
      }
      images.set(image.id, image)
      if (!folder || heroCode !== record.record_id) {
        // The two sources disagree on whose image this is, so it belongs to no hero until someone resolves it.
        unlinkedFromHero.push({
          heroCode: null,
          fileName: image.fileName,
          member: image.member,
          reason: `${NOTE_HERO_CONFLICT} (${folder || "?"} → ${heroCode || "?"}, hồ sơ ${record.record_id})`,
        })
        continue
      }
      const hero = heroes.get(heroCode) ?? { heroCode, sourceFolder: folder, images: [] }
      hero.images.push(image)
      heroes.set(heroCode, hero)
      if (image.link === "WITHHELD" || image.link === "UNLINKED")
        unlinkedFromItem.push({
          heroCode,
          fileName: image.fileName,
          member: image.member,
          reason: image.notes.join(" ") || NOTE_UNCLASSIFIED,
        })
    }

  const count = <T extends string>(keys: readonly T[], read: (image: CaptureImage) => T) =>
    Object.fromEntries(
      keys.map((key) => [key, [...images.values()].filter((image) => read(image) === key).length]),
    ) as Record<T, number>
  const byLink = count(["REVIEWED", "FILENAME", "WITHHELD", "UNLINKED"] as const, (image) => image.link)
  return {
    patchCode: files.patchCode,
    archive: files.sourceManifest.archive,
    archiveSha256: files.sourceManifest.sha256,
    supplementArchives: supplementArchives(files.sourceManifest.supplements ?? []),
    heroes,
    images,
    sources: buildSourceCoverage(files, heroes),
    coverage: {
      totalImages: images.size,
      heroes: heroes.size,
      linkedToHero: images.size - unlinkedFromHero.length,
      linkedToItem: images.size - unlinkedFromHero.length - unlinkedFromItem.length,
      byLink,
      bySection: count(["OVERVIEW", "ATTRIBUTES", "SKILL", "WITHHELD", "FORM"] as const, (image) => image.section),
      unlinkedFromHero,
      unlinkedFromItem,
    },
  }
}

/** Images name only their inner archive, so two runs sharing an inner archive name could serve the wrong bytes. */
function supplementArchives(supplements: readonly CaptureSupplement[]) {
  const archives = new Map<string, SourceArchive>()
  for (const { archive, sha256, innerArchives } of supplements)
    for (const inner of innerArchives) {
      if (archives.has(inner)) throw new Error(`Inner archive ${inner} is listed by two capture runs.`)
      archives.set(inner, { archive, sha256 })
    }
  return archives
}

/** The archive in `resources/raw` that holds an inner archive: a supplement's, else the set's own. */
export function sourceArchiveOf(manifest: CaptureManifest, innerArchive: string): SourceArchive {
  return manifest.supplementArchives.get(innerArchive) ?? { archive: manifest.archive, sha256: manifest.archiveSha256 }
}

const SKILL_KEY = /^skill-(\d+)-(\d+)$/

/** Passive first, then each slot's variants in order; keys the set could not name come last. */
const skillOrder = (a: string, b: string) => {
  const [, slotA = "99", formA = "99"] = SKILL_KEY.exec(a) ?? []
  const [, slotB = "99", formB = "99"] = SKILL_KEY.exec(b) ?? []
  return Number(slotA) - Number(slotB) || Number(formA) - Number(formB) || a.localeCompare(b)
}

/**
 * Item by item, which images show what an editor needs. A skill appears when the review entered it or an image was named
 * after it, so a passive that was withheld still shows up as one that has no usable image.
 */
function buildSourceCoverage(files: CaptureDatasetFiles, heroes: Map<string, HeroCaptures>): HeroSourceCoverage[] {
  const itemKey = (heroCode: string, skillKey: string) => `${heroCode}\u0000${skillKey}`
  const entered = new Map<string, { name: string | null; cut: boolean; table: boolean | null }>()
  for (const row of files.importRows)
    for (const skill of row.skills) {
      const snapshot = skill.effects?.find((effect) => effect.effectType === "SOURCE_SNAPSHOT")?.metadata
      const table = snapshot?.tableObservationStatus
      entered.set(itemKey(row.code, skill.skillKey), {
        name: skill.name ?? null,
        cut: snapshot?.completeness === "PARTIAL_SOURCE",
        table: table === "VISIBLE_TABLE_TRANSCRIBED" ? true : table === "NO_TABLE_VISIBLE_IN_CAPTURE" ? false : null,
      })
    }
  const cut = new Set(
    (files.sourceGaps.additionalGaps ?? [])
      .filter((gap) => gap.kind === "DESCRIPTION_SOURCE_INCOMPLETE" && gap.skillKey)
      .map((gap) => itemKey(gap.heroCode, gap.skillKey!)),
  )
  const requests = new Map(
    (files.recaptureRequests?.entries ?? [])
      .filter((entry) => entry.skillKey && entry.request)
      .map((entry) => [itemKey(entry.heroCode, entry.skillKey!), entry.request!]),
  )
  const readings = new Map(
    (files.observedAttributes ?? [])
      .filter((entry) => entry.source)
      .map((entry) => [keyOf(entry.source!), entry.values ?? {}]),
  )

  return [...heroes.values()].map(({ heroCode, images }) => {
    const of = (section: CaptureSection) => images.filter((image) => image.section === section)
    const keys = new Set([
      ...files.importRows.filter((row) => row.code === heroCode).flatMap((row) => row.skills.map((s) => s.skillKey)),
      ...[...of("SKILL"), ...of("WITHHELD")].flatMap((image) => (image.skillKey ? [image.skillKey] : [])),
    ])
    const skills = [...keys].sort(skillOrder).map((skillKey): SkillSource => {
      const known = entered.get(itemKey(heroCode, skillKey))
      const named = (section: CaptureSection) =>
        of(section)
          .filter((image) => image.skillKey === skillKey)
          .map((image) => image.fileName)
      return {
        skillKey,
        name: known?.name ?? of("SKILL").find((image) => image.skillKey === skillKey)?.skillName ?? null,
        shown: named("SKILL"),
        withheld: named("WITHHELD"),
        cut: !!known?.cut || cut.has(itemKey(heroCode, skillKey)),
        table: known?.table ?? null,
        request: requests.get(itemKey(heroCode, skillKey)) ?? null,
      }
    })
    return {
      heroCode,
      overview: of("OVERVIEW").map((image) => image.fileName),
      attributes: of("ATTRIBUTES").map((image) => ({
        fileName: image.fileName,
        values: files.observedAttributes
          ? (readings.get(keyOf({ member: image.member, sha256: image.id })) ?? null)
          : null,
      })),
      skills,
    }
  })
}
