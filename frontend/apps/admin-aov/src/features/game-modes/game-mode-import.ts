import type { MediaSourceInput } from "@aov/ui/lib/media-credit"
import type { GuideContent, ModeContent, ModeGroup } from "./game-mode-api"

/** Where one imported image comes from, recorded next to the data: what it shows, its file and when it was taken. */
export interface ImageSource {
  label: string
  observedAt?: string | null
  note: string
}

/** One mode of `resources/Lien-Quan-v3/che-do-choi/che-do.json`. */
export interface ModeManifestEntry {
  code: string
  name: string
  group: ModeGroup
  order: number
  summary?: string | null
  playersLabel?: string | null
  duration?: { minMinutes: number; maxMinutes: number } | null
  availability: NonNullable<ModeContent["availability"]>
  art?: string | null
  artNote?: string | null
  artSource?: ImageSource | null
  guideKind: "NONE" | "AUTO_CHESS"
  rules: ModeContent["rules"]
  sources: ModeContent["sources"]
}

/** The transcribed encyclopedia: like the guide content, with resource paths where asset ids will go. */
export interface GuideManifest extends Omit<GuideContent, "traits" | "units" | "items" | "blessings"> {
  traits: (Omit<GuideContent["traits"][number], "iconAssetId"> & { icon?: string | null })[]
  units: (Omit<GuideContent["units"][number], "portraitAssetId" | "skill"> & {
    portrait?: string | null
    skill: (Omit<NonNullable<GuideContent["units"][number]["skill"]>, "iconAssetId"> & { icon?: string | null }) | null
  })[]
  items: (Omit<GuideContent["items"][number], "iconAssetId"> & { icon?: string | null })[]
  blessings: (Omit<GuideContent["blessings"][number], "iconAssetId"> & { icon?: string | null })[]
  /** Source of every icon, keyed by the same path as the icon. */
  imageSources?: Record<string, ImageSource>
}

export const MODES_MANIFEST = "che-do-choi/che-do.json"
export const GUIDE_FOLDER = "che-do-choi/co-lien-quan/"
export const GUIDE_MANIFEST = `${GUIDE_FOLDER}du-lieu/bach-khoa-2026-11-08-1503.json`

export function modeContentFromManifest(entry: ModeManifestEntry, artAssetId: string | null): ModeContent {
  return {
    name: entry.name,
    group: entry.group,
    order: entry.order,
    summary: entry.summary ?? null,
    playersLabel: entry.playersLabel ?? null,
    duration: entry.duration ?? null,
    availability: entry.availability,
    artAssetId,
    guideKind: entry.guideKind,
    rules: entry.rules,
    heroes: [],
    specialItems: [],
    sources: entry.sources,
  }
}

/** Every icon path of the encyclopedia, once, relative to `resources/Lien-Quan-v3/che-do-choi/co-lien-quan/`. */
export function guideIconPaths(manifest: GuideManifest) {
  const paths = new Set<string>()
  const add = (path?: string | null) => path && paths.add(path)
  manifest.traits.forEach((trait) => add(trait.icon))
  manifest.units.forEach((unit) => {
    add(unit.portrait)
    add(unit.skill?.icon)
  })
  manifest.items.forEach((item) => add(item.icon))
  manifest.blessings.forEach((blessing) => add(blessing.icon))
  return [...paths]
}

/**
 * The media source of an imported image, or null when the data does not say where it comes from. Such an image is not
 * uploaded: a vague source would hide that its origin still has to be found.
 */
export function importedImageSource(source: ImageSource | null | undefined): MediaSourceInput | null {
  if (!source?.label?.trim() || !source.note?.trim()) return null
  return { type: "GAME_CLIENT", label: source.label.trim(), observedAt: source.observedAt ?? null, note: source.note }
}

/** Icon paths of the encyclopedia that have no usable source. */
export function iconsWithoutSource(manifest: GuideManifest) {
  return guideIconPaths(manifest).filter((path) => !importedImageSource(manifest.imageSources?.[path]))
}

/** Replaces resource paths with uploaded asset ids; a path without an upload leaves the image empty. */
export function guideContentFromManifest(manifest: GuideManifest, assets: ReadonlyMap<string, string>): GuideContent {
  const asset = (path?: string | null) => (path ? (assets.get(path) ?? null) : null)
  return {
    edition: manifest.edition ?? null,
    observedOn: manifest.observedOn ?? null,
    summary: manifest.summary ?? null,
    rules: manifest.rules,
    traits: manifest.traits.map(({ icon, ...trait }) => ({ ...trait, iconAssetId: asset(icon) })),
    units: manifest.units.map(({ portrait, skill, ...unit }) => ({
      ...unit,
      portraitAssetId: asset(portrait),
      skill: skill ? { ...withoutIcon(skill), iconAssetId: asset(skill.icon) } : null,
    })),
    itemGroups: manifest.itemGroups,
    items: manifest.items.map(({ icon, ...item }) => ({ ...item, iconAssetId: asset(icon) })),
    blessings: manifest.blessings.map(({ icon, ...blessing }) => ({ ...blessing, iconAssetId: asset(icon) })),
    quests: manifest.quests,
    lineups: manifest.lineups,
    sources: manifest.sources,
  }
}

function withoutIcon<T extends { icon?: string | null }>(value: T): Omit<T, "icon"> {
  const { icon: _icon, ...rest } = value
  return rest
}

/** Runs `task` again after a failure, waiting longer each time; the last failure is rethrown. */
export async function retry<T>(task: () => Promise<T>, attempts = 3, delayMs = 1000): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await task()
    } catch (error) {
      if (attempt >= attempts) throw error
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt))
    }
  }
}

/** Runs `task` over `values` with at most `limit` at a time, keeping the input order in the result. */
export async function mapLimit<T, R>(
  values: readonly T[],
  limit: number,
  task: (value: T, index: number) => Promise<R>,
) {
  const results: R[] = new Array(values.length)
  let next = 0
  async function worker() {
    while (next < values.length) {
      const at = next++
      results[at] = await task(values[at]!, at)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker))
  return results
}

/** Labels for the editor. */
export const AVAILABILITY_LABEL = {
  ALWAYS_OPEN: "Thường trực",
  LIMITED: "Mở có thời hạn",
  SPECIAL: "Mở đặc biệt",
  CLOSED: "Tạm đóng",
  LOCKED: "Chưa mở khóa",
  UNKNOWN: "Chưa rõ",
} as const

export const MISSING_LABEL: Record<string, string> = {
  name: "Tên chế độ",
  group: "Nhóm",
  "availability.status": "Tình trạng mở",
  units: "Quân cờ",
  traits: "Phe/Nghề",
}

/** Readable name of a missing field path such as `units[3].stats`. */
export function missingLabel(path: string, content?: GuideContent) {
  if (MISSING_LABEL[path]) return MISSING_LABEL[path]
  const unit = /^units\[(\d+)]\.(.+)$/.exec(path)
  if (unit) {
    const name = content?.units[Number(unit[1])]?.name ?? `Quân cờ ${Number(unit[1]) + 1}`
    const field = { portraitAssetId: "ảnh", "skill.name": "tên chiêu", stats: "chỉ số", traitCodes: "Phe/Nghề" }[
      unit[2]!
    ]
    return `${name}: thiếu ${field ?? unit[2]}`
  }
  const lineup = /^lineups\[(\d+)]\.units$/.exec(path)
  if (lineup) return `${content?.lineups[Number(lineup[1])]?.name ?? "Đội hình"}: chưa có quân cờ`
  return path
}
