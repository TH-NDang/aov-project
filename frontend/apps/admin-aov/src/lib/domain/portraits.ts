import type { Hero, PortraitOwner, PortraitRole, PortraitSource, Skin } from "@/lib/api/types"

export type PortraitTarget = { kind: "hero" } | { kind: "skin"; skinId: string } | { kind: "new-skin" }

export interface PortraitMoveRequest {
  file: string
  heroId: string
  target: PortraitTarget
  /** Skin display name (ignored for hero targets). */
  name: string
  /** Desired file name; recorded as metadata until the media API can rename objects. */
  fileName: string
  badgeId: string | null
  role: PortraitRole
}

export interface PortraitMoveResult {
  heroes: Hero[]
  /** Hero ids whose data changed. */
  changedHeroIds: string[]
  steps: string[]
  createdSkinId: string | null
}

export type PortraitFilter = "all" | "unmatched" | "heroes" | "skins" | "alternates" | "portraitOnly"

export const PORTRAIT_FILTER_LABEL: Record<PortraitFilter, string> = {
  all: "Tất cả ảnh",
  unmatched: "Chưa khớp",
  heroes: "Ảnh tướng",
  skins: "Ảnh trang phục",
  alternates: "Bản khác",
  portraitOnly: "Chỉ có portrait",
}

/** Maps each portrait file to the hero/skin that currently references it. */
export function buildOwnerIndex(heroes: Hero[]): Map<string, PortraitOwner> {
  const owners = new Map<string, PortraitOwner>()
  for (const hero of heroes) {
    if (hero.portrait) owners.set(hero.portrait, { heroId: hero.id, skinId: null, role: "primary" })
    for (const file of hero.portraitAlternates) owners.set(file, { heroId: hero.id, skinId: null, role: "alternate" })
    for (const skin of hero.skins) {
      if (skin.isDefault) continue
      if (skin.portrait) owners.set(skin.portrait, { heroId: hero.id, skinId: skin.id, role: "primary" })
      for (const file of skin.portraitAlternates)
        owners.set(file, { heroId: hero.id, skinId: skin.id, role: "alternate" })
    }
  }
  return owners
}

export function isPortraitOnly(skin: Skin): boolean {
  return !skin.isDefault && !skin.head && !skin.cover
}

export function matchesPortraitFilter(
  filter: PortraitFilter,
  owner: PortraitOwner | undefined,
  skin: Skin | undefined,
): boolean {
  switch (filter) {
    case "all":
      return true
    case "unmatched":
      return !owner
    case "heroes":
      return !!owner && owner.skinId === null
    case "skins":
      return !!owner && owner.skinId !== null
    case "alternates":
      return owner?.role === "alternate"
    case "portraitOnly":
      return !!skin && isPortraitOnly(skin)
  }
}

export function ownerLabel(heroes: Hero[], owner: PortraitOwner | undefined): string {
  if (!owner) return "Chưa ghép"
  const hero = heroes.find((candidate) => candidate.id === owner.heroId)
  if (!hero) return "Chưa ghép"
  if (!owner.skinId) return hero.name
  const skin = hero.skins.find((candidate) => candidate.id === owner.skinId)
  return `${hero.name} / ${skin?.name || "Chưa có tên"}`
}

/** Entry that owns portrait fields: the hero itself or one of its non-default skins. */
type Entry = Pick<Hero, "portrait" | "portraitAlternates">

function removeFile(entry: Entry, file: string): string | null {
  if (entry.portrait === file) {
    const promoted = entry.portraitAlternates.pop() ?? null
    entry.portrait = promoted
    return promoted
  }
  entry.portraitAlternates = entry.portraitAlternates.filter((candidate) => candidate !== file)
  return null
}

/** Keeps the default skin in sync with hero-level portrait fields. */
function syncDefaultSkin(hero: Hero) {
  const skin = hero.skins.find((candidate) => candidate.isDefault)
  if (!skin) return
  skin.portrait = hero.portrait
  skin.portraitAlternates = [...hero.portraitAlternates]
}

function nextLocalSkinId(): string {
  const random = Math.random().toString(16).slice(2, 14).padEnd(12, "0")
  return `local-${random}`
}

/**
 * Applies a portrait move to a copy of `heroes`, following the rules of the original
 * portrait manager: a removed primary is replaced by its last alternate, and a new primary pushes
 * the previous one into the alternates.
 */
export function planPortraitMove(heroes: Hero[], request: PortraitMoveRequest): PortraitMoveResult {
  const next = structuredClone(heroes)
  const steps: string[] = []
  const changed = new Set<string>()
  const owners = buildOwnerIndex(heroes)
  const current = owners.get(request.file)

  const target = next.find((hero) => hero.id === request.heroId)
  if (!target) throw new Error("Chưa chọn tướng nhận ảnh.")
  if (
    request.target.kind === "skin" &&
    !target.skins.some((skin) => skin.id === (request.target as { skinId: string }).skinId)
  ) {
    throw new Error("Trang phục nhận ảnh không thuộc tướng đã chọn.")
  }
  if (request.target.kind !== "hero" && !request.name.trim()) throw new Error("Tên trang phục không được để trống.")

  if (current) {
    const hero = next.find((candidate) => candidate.id === current.heroId)!
    const entry: Entry = current.skinId ? hero.skins.find((skin) => skin.id === current.skinId)! : hero
    const promoted = removeFile(entry, request.file)
    if (!current.skinId) syncDefaultSkin(hero)
    changed.add(hero.id)
    steps.push(`Gỡ ảnh khỏi ${ownerLabel(heroes, current)}${current.role === "alternate" ? " (bản khác)" : ""}.`)
    if (current.role === "primary") {
      steps.push(
        promoted ? "Bản khác gần nhất của mục cũ được đưa lên làm ảnh chính." : "Mục cũ sẽ không còn portrait.",
      )
    }
  } else {
    steps.push("Ghép ảnh đang chưa khớp.")
  }

  let entry: Entry
  let label: string
  let createdSkinId: string | null = null
  if (request.target.kind === "hero") {
    entry = target
    label = target.name
  } else if (request.target.kind === "skin") {
    const skinId = request.target.skinId
    const skin = target.skins.find((candidate) => candidate.id === skinId)!
    if (skin.name !== request.name.trim())
      steps.push(`Đổi tên trang phục “${skin.name || "Chưa có tên"}” thành “${request.name.trim()}”.`)
    skin.name = request.name.trim()
    skin.fullName = `${target.name} ${skin.name}`
    skin.badgeId = request.badgeId
    skin.portraitFileName = request.fileName
    entry = skin
    label = `${target.name} / ${skin.name}`
  } else {
    const sourceSkinId = nextLocalSkinId()
    const skin: Skin = {
      id: `${target.id}-${sourceSkinId}`,
      sourceSkinId,
      name: request.name.trim(),
      fullName: `${target.name} ${request.name.trim()}`,
      isDefault: false,
      badgeId: request.badgeId,
      head: null,
      cover: null,
      portrait: null,
      portraitAlternates: [],
      portraitFileName: request.fileName,
      createdAt: new Date().toISOString(),
    }
    target.skins.push(skin)
    createdSkinId = skin.id
    entry = skin
    label = `${target.name} / ${skin.name}`
    steps.push(`Tạo trang phục mới “${skin.name}” chỉ có portrait.`)
  }

  if (request.role === "primary" || !entry.portrait || entry.portrait === request.file) {
    if (entry.portrait && entry.portrait !== request.file) {
      entry.portraitAlternates = [...entry.portraitAlternates.filter((file) => file !== entry.portrait), entry.portrait]
      steps.push("Ảnh chính hiện tại của nơi nhận chuyển thành bản khác.")
    }
    entry.portraitAlternates = entry.portraitAlternates.filter((file) => file !== request.file)
    entry.portrait = request.file
    steps.push(`Đặt làm ảnh chính của ${label}.`)
  } else {
    if (!entry.portraitAlternates.includes(request.file)) entry.portraitAlternates.push(request.file)
    steps.push(`Thêm làm bản khác của ${label}.`)
  }
  if (request.target.kind === "hero") syncDefaultSkin(target)
  changed.add(target.id)
  steps.push(`Tên file đích: ${request.fileName}`)

  return {
    heroes: next,
    changedHeroIds: [...changed],
    steps,
    createdSkinId,
  }
}

/** Default target suggestion for an image, using the matcher's best guess when unmatched. */
export function suggestedTarget(source: PortraitSource, heroes: Hero[]) {
  const hero = heroes.find((candidate) => candidate.name === source.hero)
  if (!hero) return null
  const best = source.suggestions[0]
  const skin = best ? hero.skins.find((candidate) => candidate.sourceSkinId === best[1]) : undefined
  return { hero, skin }
}

/** Display name proposed from the Figma frame name: "<Hero> - <Skin>" becomes "<Skin>". */
export function nameFromFigma(figmaName: string): string {
  const index = figmaName.indexOf(" - ")
  return index >= 0 ? figmaName.slice(index + 3).trim() : figmaName.trim()
}
