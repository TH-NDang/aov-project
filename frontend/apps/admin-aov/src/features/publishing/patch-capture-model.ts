import type { CaptureImage as PatchImage, CaptureLink as PatchLink } from "../../../server/patch-capture-manifest.ts"
import type { ShopCaptureImage, ShopCardBox } from "../../../server/shop-capture-manifest.ts"
import type { HeroContentTab, HeroWorkspaceView } from "./hero-location"
import { selectSkillTranslation, skillLabel, skillSlot } from "./hero-skills"
import type { Section, Skill } from "./types"

/** SHOP: the results name this card as where a price or an acquisition was read, but nobody has confirmed it in game. */
export type CaptureLink = PatchLink | "SHOP"

/** A screenshot from a patch set, or one card of a shop screenshot together with what was read from it. */
export interface CaptureImage extends Omit<PatchImage, "section" | "link"> {
  section: PatchImage["section"] | "SHOP"
  link: CaptureLink
  /** Shop screenshots are not addressed through a patch set. */
  url?: string
  kind?: ShopCaptureImage["kind"]
  skinKey?: string | null
  entryName?: string
  reading?: string
  card?: number
  box?: ShopCardBox | null
  capturedOn?: string
}

export interface CaptureGroup {
  key: string
  /** Short enough for a chip; `title` carries the full name. */
  label: string
  title: string
  images: CaptureImage[]
  /** Why this item has no image, shown instead of a viewer. */
  empty?: string
  /** Comes from a visit to the game's shop, not from the patch set. */
  shop?: boolean
}

export const captureGroupKeys = {
  overview: "overview",
  attributes: "attributes",
  shopPrice: "shop-price",
  skins: "skins",
  media: "media",
  patchNotes: "patch-notes",
  withheld: "withheld",
  form: "form",
  skill: (skillKey: string) => `skill:${skillKey}`,
}

const ordered = (skills: readonly Skill[]) => [...skills].sort((a, b) => a.displayOrder - b.displayOrder)

/** The group that matches what the workspace is showing, so the panel can follow the editor. */
export function captureFocus({
  view,
  tab,
  editing,
  section,
  skillKey,
  skills,
}: {
  view: HeroWorkspaceView
  tab: HeroContentTab
  editing: boolean
  section: Section
  skillKey: string
  skills: readonly Skill[]
}): string {
  if (view === "patch") return captureGroupKeys.patchNotes
  if (view === "history") return captureGroupKeys.overview
  const tabSections: Record<HeroContentTab, Section> = {
    overview: "PROFILE",
    skills: "SKILLS",
    skins: "SKINS",
    media: "MEDIA_BINDINGS",
    videos: "MEDIA_BINDINGS",
  }
  const current = editing || view === "translations" ? section : tabSections[tab]
  if (current === "COMBAT_STATS") return captureGroupKeys.attributes
  if (current === "SKINS") return captureGroupKeys.skins
  if (current === "MEDIA_BINDINGS") return captureGroupKeys.media
  if (current !== "SKILLS") return captureGroupKeys.overview
  const first = ordered(skills)[0]?.skillKey
  const selected = skills.some((skill) => skill.skillKey === skillKey) ? skillKey : first
  return selected ? captureGroupKeys.skill(selected) : captureGroupKeys.overview
}

const manifestSkillLabel = (skillKey: string) => {
  const slot = Number(/^skill-(\d+)-\d+$/.exec(skillKey)?.[1] ?? Number.NaN)
  return Number.isNaN(slot) ? skillKey : slot === 0 ? "Nội tại" : `Chiêu ${slot}`
}

/**
 * Groups keep the editor's order, and every skill in the draft gets one even without images so a missing image reads as
 * "none" rather than as a skill that was overlooked. Withheld captures never join the skill they were named after.
 */
export function buildCaptureGroups({
  images,
  skills,
  locale,
  patchCode,
  focus,
}: {
  images: readonly CaptureImage[]
  skills: readonly Skill[]
  locale: string
  patchCode: string
  focus: string
}): CaptureGroup[] {
  const of = (section: CaptureImage["section"]) => images.filter((image) => image.section === section)
  const withheld = of("WITHHELD")
  const draftSkills = ordered(skills)
  const reviewed = of("SKILL")
  const draftGroups = draftSkills.map((skill): CaptureGroup => {
    const name = selectSkillTranslation(skill, locale)?.name
    const slot = skillSlot(skill)
    const variant = /^skill-\d+-(\d+)$/.exec(skill.skillKey)?.[1]
    const shared = slot !== null && draftSkills.filter((item) => skillSlot(item) === slot).length > 1
    const label = skillLabel(skill) + (shared && variant ? ` · ${variant}` : "")
    const hidden = withheld.filter((image) => image.skillKey === skill.skillKey).length
    return {
      key: captureGroupKeys.skill(skill.skillKey),
      label,
      title: name ? `${label} · ${name}` : label,
      images: reviewed.filter((image) => image.skillKey === skill.skillKey),
      empty: hidden
        ? `Có ${hidden} ảnh mang tên kỹ năng này nhưng đã bị loại khi rà soát, nên không nối với kỹ năng. Xem nhóm “Không nhập”.`
        : "Không có ảnh gốc nối với kỹ năng này.",
    }
  })
  const known = new Set(draftSkills.map((skill) => skill.skillKey))
  const extraKeys = [...new Set(reviewed.map((image) => image.skillKey!))].filter((key) => !known.has(key))
  const extraGroups = extraKeys.map((skillKey): CaptureGroup => {
    const members = reviewed.filter((image) => image.skillKey === skillKey)
    const label = manifestSkillLabel(skillKey)
    const name = members[0]?.skillName
    return {
      key: captureGroupKeys.skill(skillKey),
      label: `${label} (${skillKey})`,
      title: `${name ? `${label} · ${name}` : label} · chưa có trong bản đang xem`,
      images: members,
    }
  })
  const groups: CaptureGroup[] = [
    {
      key: captureGroupKeys.overview,
      label: "Tổng quan",
      title: "Tổng quan",
      images: of("OVERVIEW"),
      empty: "Không có ảnh tổng quan của tướng này.",
    },
    {
      key: captureGroupKeys.attributes,
      label: "Chỉ số",
      title: "Chỉ số",
      images: of("ATTRIBUTES"),
      empty: "Không có ảnh chỉ số của tướng này.",
    },
    ...draftGroups,
    ...extraGroups,
    {
      key: captureGroupKeys.skins,
      label: "Trang phục",
      title: "Trang phục",
      images: [],
      empty: `Bộ ảnh patch ${patchCode} không chụp trang phục, nên không có ảnh gốc để đối chiếu mục này.`,
    },
  ]
  if (focus === captureGroupKeys.media)
    groups.push({
      key: captureGroupKeys.media,
      label: "Ảnh tướng",
      title: "Ảnh tướng",
      images: [],
      empty: `Bộ ảnh patch ${patchCode} là ảnh chụp màn hình trong game, không có ảnh gốc cho mục Ảnh tướng.`,
    })
  if (focus === captureGroupKeys.patchNotes)
    groups.push({
      key: captureGroupKeys.patchNotes,
      label: "Ghi chú patch",
      title: "Ghi chú patch",
      images: [],
      empty: `Bộ ảnh patch ${patchCode} không có ảnh cho ghi chú patch; nội dung này lấy từ bài đăng chính thức.`,
    })
  if (withheld.length)
    groups.push({
      key: captureGroupKeys.withheld,
      label: "Không nhập",
      title: "Ảnh đã loại khi rà soát",
      images: withheld,
    })
  if (of("FORM").length)
    groups.push({
      key: captureGroupKeys.form,
      label: "Chưa nối mục",
      title: "Ảnh chưa nối với mục nào",
      images: of("FORM"),
    })
  return groups
}

/** The shop answers for price and skins whichever patch is open, so these groups do not depend on a patch set. */
export function withShopGroups(groups: CaptureGroup[], images: readonly CaptureImage[]): CaptureGroup[] {
  if (!images.length) return groups
  const price: CaptureGroup = {
    key: captureGroupKeys.shopPrice,
    label: "Giá tướng",
    title: "Giá tướng",
    images: images.filter((image) => image.kind === "price"),
    empty: "Ảnh cửa hàng không có thẻ giá của tướng này.",
    shop: true,
  }
  const skins: CaptureGroup = {
    key: captureGroupKeys.skins,
    label: "Trang phục",
    title: "Trang phục",
    images: images.filter((image) => image.kind === "skin"),
    empty: "Ảnh cửa hàng không có trang phục nào của tướng này.",
    shop: true,
  }
  if (!groups.length) return [price, skins]
  return groups.flatMap((group) => {
    if (group.key === captureGroupKeys.skins) return [skins]
    return group.key === captureGroupKeys.attributes ? [group, price] : [group]
  })
}

/** A rejected image is still findable by the skill its file was named after, without claiming it shows that skill. */
export function captureImageTitle(group: CaptureGroup, image: CaptureImage) {
  if (image.kind === "skin" && image.entryName) return `${group.title} · ${image.entryName}`
  return image.section === "WITHHELD" && image.skillKey
    ? `${group.title} · tệp mang tên ${manifestSkillLabel(image.skillKey)}`
    : group.title
}

export const captureLinkLabels: Record<CaptureLink, string> = {
  REVIEWED: "Đã rà soát",
  FILENAME: "Chỉ theo tên tệp",
  WITHHELD: "Không nhập",
  UNLINKED: "Chưa nối mục",
  SHOP: "Đọc từ ảnh",
}

export const captureLinkHints: Record<CaptureLink, string> = {
  REVIEWED: "Bản rà soát thủ công ghi rõ ảnh này là nguồn của mục đang xem.",
  FILENAME: "Chỉ dựa vào tên tệp, chưa có bản rà soát nào xác nhận riêng ảnh này.",
  WITHHELD: "Bản rà soát đã loại ảnh này khỏi dữ liệu nhập.",
  UNLINKED: "Ảnh thuộc tướng này nhưng chưa nối được với mục đã nhập nào.",
  SHOP: "Giá trị này được đọc từ thẻ đang đánh dấu trên ảnh chụp cửa hàng, chưa ai xác nhận lại trong game.",
}

export const captureImageUrl = (patchCode: string, image: Pick<CaptureImage, "id" | "url">) =>
  image.url ?? `/__patch-captures/${encodeURIComponent(patchCode)}/images/${image.id}.png`

export interface CaptureZoom {
  scale: number
  x: number
  y: number
}

export const captureFit: CaptureZoom = { scale: 1, x: 0, y: 0 }
export const CAPTURE_MAX_SCALE = 8

/** Keeps the scaled image covering the frame, so panning can never reveal empty space or lose the picture. */
export function clampCaptureZoom(zoom: CaptureZoom, width: number, height: number): CaptureZoom {
  const scale = Math.min(CAPTURE_MAX_SCALE, Math.max(1, zoom.scale))
  return {
    scale,
    x: Math.min(0, Math.max(width - width * scale, zoom.x)),
    y: Math.min(0, Math.max(height - height * scale, zoom.y)),
  }
}

/** Opens a shop screenshot on the card in question, since a whole screen of cards is too small to read. */
export function captureCardZoom(box: ShopCardBox, width: number, height: number): CaptureZoom {
  if (!width || !height) return captureFit
  // The picture is fitted inside the frame, keeping its shape and staying centred.
  const fit = Math.min(width / box.imageWidth, height / box.imageHeight)
  const left = (width - box.imageWidth * fit) / 2
  const top = (height - box.imageHeight * fit) / 2
  const scale = 0.92 * Math.min(width / (box.width * fit), height / (box.height * fit))
  const centerX = left + (box.x + box.width / 2) * fit
  const centerY = top + (box.y + box.height / 2) * fit
  return clampCaptureZoom({ scale, x: width / 2 - centerX * scale, y: height / 2 - centerY * scale }, width, height)
}

/** Zooms around a point in the frame; that point stays under the pointer. */
export function zoomCaptureAt(
  zoom: CaptureZoom,
  scale: number,
  point: { x: number; y: number },
  width: number,
  height: number,
): CaptureZoom {
  const next = Math.min(CAPTURE_MAX_SCALE, Math.max(1, scale))
  const ratio = next / zoom.scale
  return clampCaptureZoom(
    { scale: next, x: point.x - (point.x - zoom.x) * ratio, y: point.y - (point.y - zoom.y) * ratio },
    width,
    height,
  )
}
