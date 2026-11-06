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

export interface CaptureManifest {
  patchCode: string
  archive: string
  archiveSha256: string
  heroes: Map<string, HeroCaptures>
  images: Map<string, CaptureImage>
  coverage: CaptureCoverage
}

interface SourceRef {
  archive: string
  member: string
  sha256: string
  file_name: string
}

export interface CaptureDatasetFiles {
  patchCode: string
  sourceManifest: { archive: string; sha256: string; identityAliases: Record<string, string> }
  evidence: { record_id: string; pages: { source: SourceRef }[] }[]
  importRows: {
    code: string
    skills: {
      skillKey: string
      name?: string
      effects?: { effectType: string; metadata?: { sourceImages?: SourceRef[]; completeness?: string } }[]
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

type Link = Pick<CaptureImage, "section" | "link" | "skillKey" | "skillName"> & { notes: string[] }

export function buildCaptureManifest(files: CaptureDatasetFiles): CaptureManifest {
  const links = new Map<string, Link>()
  const notesFor = new Map<string, string[]>()
  const keyOf = (source: SourceRef) => `${source.member}\u0000${source.sha256}`
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
    heroes,
    images,
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
