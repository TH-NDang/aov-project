import type { Build, BuildHero, CaptureDetail, ReviewBuild } from "./builds-api"

/** The part of the "Chuan bi" screenshot that shows the build (items, enchantments, arcana, spell), in image pixels. */
export const PANEL = { x: 1410, y: 170, width: 855, height: 760, imageWidth: 2400, imageHeight: 1080 }

/** CSS that shows only {@link PANEL} of a full screenshot inside a box with the panel's aspect ratio. */
export function panelImageStyle() {
  return {
    width: `${(PANEL.imageWidth / PANEL.width) * 100}%`,
    left: `${(-PANEL.x / PANEL.width) * 100}%`,
    top: `${(-PANEL.y / PANEL.height) * 100}%`,
  }
}

export const RESULT_LABELS: Record<BuildHero["result"], string> = {
  COLLECTED: "Đã chụp",
  NO_BUILDS: "Game không có bộ đề cử",
  FAILED: "Chụp lỗi",
}

export interface HeroView {
  query: string
  reviewOnly: boolean
}

const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLocaleLowerCase()

export const openBuilds = (hero: BuildHero) => hero.builds.filter((build) => build.needsReview).length

/** Heroes in the order they were captured, narrowed by name or code and, if asked, to those with builds in review. */
export function heroRows(detail: CaptureDetail, view: HeroView): BuildHero[] {
  const query = fold(view.query.trim())
  return detail.heroes.filter(
    (hero) =>
      (!view.reviewOnly || openBuilds(hero) > 0) &&
      (!query || fold(`${hero.nameOnScreen} ${hero.heroCode ?? ""}`).includes(query)),
  )
}

/** For each build, the earlier positions of the same hero holding exactly the same content. */
export function sameAs(builds: Build[]): Map<string, number> {
  const first = new Map<string, number>()
  const result = new Map<string, number>()
  for (const build of [...builds].sort((a, b) => a.position - b.position)) {
    if (!build.contentKey) continue
    const earlier = first.get(build.contentKey)
    if (earlier === undefined) first.set(build.contentKey, build.position)
    else result.set(build.id, earlier)
  }
  return result
}

/** The next hero (after the given one, wrapping around) that still has a build waiting for review. */
export function nextHeroToReview(detail: CaptureDetail, heroId: string | null): BuildHero | null {
  const heroes = detail.heroes
  const start = heroes.findIndex((hero) => hero.heroId === heroId)
  for (let step = 1; step <= heroes.length; step++) {
    const hero = heroes[(start + step + heroes.length) % heroes.length]!
    if (openBuilds(hero) > 0 && hero.heroId !== heroId) return hero
  }
  return null
}

/** A draft of the build's content an editor changes before saving; slots are 1-based. */
export interface BuildDraft {
  items: (string | null)[]
  enchantments: (string | null)[]
  arcana: { arcanaId: string | null; quantity: number }[]
  spellId: string | null
  note: string
  needsReview: boolean
}

export function draftOf(build: Build): BuildDraft {
  const items = Array.from(
    { length: 6 },
    (_, index) => build.items.find((item) => item.slot === index + 1)?.itemId ?? null,
  )
  const enchantments = Array.from(
    { length: 5 },
    (_, index) => build.enchantments.find((entry) => entry.slot === index + 1)?.enchantmentId ?? null,
  )
  return {
    items,
    enchantments,
    arcana: build.arcana.map((entry) => ({ arcanaId: entry.arcanaId, quantity: entry.quantity })),
    spellId: build.spellId,
    note: build.note ?? "",
    needsReview: build.needsReview,
  }
}

/** Missing parts that keep a build from leaving review; the arcana page is optional. */
export function missingParts(draft: BuildDraft): string[] {
  const missing: string[] = []
  const items = draft.items.filter(Boolean).length
  const enchantments = draft.enchantments.filter(Boolean).length
  if (items < 6) missing.push(`${6 - items} ô trang bị`)
  if (enchantments < 5) missing.push(`${5 - enchantments} ô phù hiệu`)
  if (!draft.spellId) missing.push("phụ trợ")
  return missing
}

export function reviewBodyOf(build: Build, draft: BuildDraft): ReviewBuild {
  const note = draft.note.trim()
  return {
    expectedVersion: build.version,
    items: draft.items.flatMap((itemId, index) => (itemId ? [{ slot: index + 1, itemId }] : [])),
    enchantments: draft.enchantments.flatMap((enchantmentId, index) =>
      enchantmentId ? [{ slot: index + 1, enchantmentId }] : [],
    ),
    arcana: draft.arcana.flatMap((entry) =>
      entry.arcanaId ? [{ arcanaId: entry.arcanaId, quantity: entry.quantity }] : [],
    ),
    spellId: draft.spellId,
    playerName: build.playerName,
    playerPower: build.playerPower,
    playerWinRate: build.playerWinRate,
    needsReview: draft.needsReview,
    note: note || null,
  }
}

/** Confirming a build as it is keeps its content and only clears the review flag. */
export function confirmBodyOf(build: Build): ReviewBuild {
  return reviewBodyOf(build, { ...draftOf(build), needsReview: false })
}
