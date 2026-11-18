import type {
  CaptureImage as PatchImage,
  CaptureLink as PatchLink,
} from "../../../../../server/patch-capture-manifest.ts"
import type { ShopCaptureImage, ShopCardBox } from "../../../../../server/shop-capture-manifest.ts"
import type { HeroContentTab, HeroWorkspaceView } from "../hero-location"
import { selectSkillTranslation, skillLabel, skillSlot } from "../skills/hero-skills"
import type { Section, Skill } from "../../api/types"

/** SHOP: the results name this card as where a price or an acquisition was read, but nobody has confirmed it in game. */
export type CaptureLink = PatchLink | "SHOP"

/** A screenshot from a patch set, or one card of a shop screenshot together with what was read from it. */
export interface CaptureImage extends Omit<PatchImage, "section" | "link"> {
  section: PatchImage["section"] | "SHOP"
  link: CaptureLink
  /** The bytes Admin opens through a presigned link; a patch picture's id is already its SHA-256. */
  sha256?: string
  /** Where the picture sits in its source collection (ADR-030). */
  path?: string
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

/** An image is a source of its own skill and of any other skill the review listed it under. */
const showsSkill = (image: CaptureImage, skillKey: string) =>
  image.skillKey === skillKey || !!image.alsoSkillKeys?.includes(skillKey)

/** The group that matches what the workspace is showing, so the panel can follow the editor. */
export function captureFocus({
  view,
  tab,
  editing,
  section,
  skillKey,
  skills,
  pinned,
}: {
  view: HeroWorkspaceView
  tab: HeroContentTab
  editing: boolean
  section: Section
  skillKey: string
  skills: readonly Skill[]
  /** A group the panel itself led the page to, such as the attributes, which shares its tab with the overview. */
  pinned?: string
}): string {
  // The history view holds the change notes patch by patch, so its pictures are the patch notes.
  if (view === "history") return captureGroupKeys.patchNotes
  if (pinned && view === "overview" && !editing) return pinned
  const tabSections: Record<HeroContentTab, Section> = {
    overview: "PROFILE",
    skills: "SKILLS",
    // Traits are read from the skills, so their pictures are the skills' own.
    evaluation: "SKILLS",
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
      images: reviewed.filter((image) => showsSkill(image, skill.skillKey)),
      empty: hidden
        ? `Có ${hidden} ảnh mang tên kỹ năng này nhưng đã bị loại khi rà soát, nên không nối với kỹ năng. Xem nhóm “Không nhập”.`
        : "Không có ảnh gốc nối với kỹ năng này.",
    }
  })
  const known = new Set(draftSkills.map((skill) => skill.skillKey))
  const extraKeys = [...new Set(reviewed.flatMap((image) => [image.skillKey!, ...(image.alsoSkillKeys ?? [])]))].filter(
    (key) => !known.has(key),
  )
  const extraGroups = extraKeys.map((skillKey): CaptureGroup => {
    const members = reviewed.filter((image) => showsSkill(image, skillKey))
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

/** The SHA-256 a picture is stored under in the private bucket; a shop card names its screenshot's. */
export const captureSha256 = (image: Pick<CaptureImage, "id" | "sha256">) => image.sha256 ?? image.id

/** Where the picture sits among the source files; without a published path, where it was inside its ZIP. */
export const captureSourcePath = (image: Pick<CaptureImage, "archive" | "member" | "path">) =>
  image.path ?? `${image.archive}/${image.member}`

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

/** Where the hero page shows what a capture is the source of, and the panel group that stays on it. */
export interface CaptureTarget {
  tab: HeroContentTab
  /** The part of the tab to bring into view. */
  section?: Section
  skill?: string
  skin?: string
  group: string
}

/** The part of the page a group of captures checks; withheld and unmatched captures have none. */
export function captureGroupTarget(
  group: Pick<CaptureGroup, "key">,
  skills: readonly Skill[],
  image?: CaptureImage,
): CaptureTarget | null {
  const key = group.key
  if (key === captureGroupKeys.overview) return { tab: "overview", section: "PROFILE", group: key }
  if (key === captureGroupKeys.attributes) return { tab: "overview", section: "COMBAT_STATS", group: key }
  if (key === captureGroupKeys.shopPrice) return { tab: "overview", section: "PROFILE", group: key }
  if (key === captureGroupKeys.skins) return { tab: "skins", skin: image?.skinKey ?? undefined, group: key }
  if (key === captureGroupKeys.media) return { tab: "media", group: key }
  const skill = /^skill:(.+)$/.exec(key)?.[1]
  // A capture of a skill the viewed draft does not have has nothing to open.
  return skill && skills.some((item) => item.skillKey === skill) ? { tab: "skills", skill, group: key } : null
}

/** A part of a capture, in fractions of the picture, and the part of the page it is the source of. */
export interface CaptureRegion {
  key: string
  label: string
  box: { x: number; y: number; width: number; height: number }
  target: CaptureTarget
}

type CaptureBox = CaptureRegion["box"]

// The game's hero screen keeps one layout on 20:9 screenshots, measured on the 2400 x 1080 captures of patch
// 2026-10-30: the details column on the left (ratings, then the passive and three skill icons), and on the right the
// name, the attribute sheet or the open skill's text.
const GAME_SCREEN_RATIO = 20 / 9
const DETAILS_COLUMN: CaptureBox = { x: 0.045, y: 0.22, width: 0.225, height: 0.52 }
const RATINGS: CaptureBox = { x: 0.07, y: 0.29, width: 0.18, height: 0.27 }
const SKILL_ICON_CENTERS = [0.0925, 0.1375, 0.1815, 0.226]
const SKILL_ICON = { y: 0.56, width: 0.042, height: 0.094 }
const NAME: CaptureBox = { x: 0.735, y: 0.23, width: 0.18, height: 0.18 }
const SUMMARY: CaptureBox = { x: 0.495, y: 0.12, width: 0.44, height: 0.08 }
const ATTRIBUTE_SHEET: CaptureBox = { x: 0.495, y: 0.26, width: 0.44, height: 0.54 }
const SKILL_TEXT: CaptureBox = { x: 0.445, y: 0.02, width: 0.49, height: 0.6 }

/** Whether a picture has the shape of the game screen the regions were measured on. */
export function isGameScreen(natural: { width: number; height: number } | null | undefined) {
  return !!natural && natural.height > 0 && Math.abs(natural.width / natural.height - GAME_SCREEN_RATIO) < 0.05
}

const gameScreenSections: readonly CaptureImage["section"][] = ["OVERVIEW", "ATTRIBUTES", "SKILL"]

/** The parts of a game screenshot that lead to the page: ratings, skill icons, and what the screen was opened on. */
export function captureRegions(
  image: CaptureImage,
  skills: readonly Skill[],
  locale: string,
  natural: { width: number; height: number } | null | undefined,
): CaptureRegion[] {
  // An in-match shot can have the same 20:9 shape, but none of the hero page layout.
  if (image.box || image.screen === "IN_MATCH" || !isGameScreen(natural) || !gameScreenSections.includes(image.section))
    return []
  const regions: CaptureRegion[] = [
    {
      key: "ratings",
      label: "Đánh giá",
      box: RATINGS,
      target: { tab: "overview", section: "OVERVIEW_RATINGS", group: captureGroupKeys.overview },
    },
  ]
  const draft = ordered(skills)
  SKILL_ICON_CENTERS.forEach((center, slot) => {
    const skill = draft.find((item) => skillSlot(item) === slot)
    if (!skill) return
    const name = selectSkillTranslation(skill, locale)?.name
    regions.push({
      key: `skill-${slot}`,
      label: name ? `${skillLabel(skill)} · ${name}` : skillLabel(skill),
      box: { x: center - SKILL_ICON.width / 2, ...SKILL_ICON },
      target: { tab: "skills", skill: skill.skillKey, group: captureGroupKeys.skill(skill.skillKey) },
    })
  })
  if (image.section === "OVERVIEW")
    regions.push({
      key: "name",
      label: "Thông tin tướng",
      box: NAME,
      target: { tab: "overview", section: "PROFILE", group: captureGroupKeys.overview },
    })
  if (image.section === "ATTRIBUTES")
    regions.push(
      {
        key: "summary",
        label: "Giới thiệu",
        box: SUMMARY,
        target: { tab: "overview", section: "PROFILE", group: captureGroupKeys.overview },
      },
      {
        key: "attributes",
        label: "Thuộc tính chiến đấu",
        box: ATTRIBUTE_SHEET,
        target: { tab: "overview", section: "COMBAT_STATS", group: captureGroupKeys.attributes },
      },
    )
  const shown = image.section === "SKILL" ? draft.find((item) => item.skillKey === image.skillKey) : undefined
  if (shown)
    regions.push({
      key: "skill-text",
      label: `Mô tả ${skillLabel(shown).toLocaleLowerCase("vi")}`,
      box: SKILL_TEXT,
      target: { tab: "skills", skill: shown.skillKey, group: captureGroupKeys.skill(shown.skillKey) },
    })
  return regions
}

/** The part of a game screenshot worth reading first: the details column, the attribute sheet or the skill text. */
export function captureFocusBox(
  image: CaptureImage,
  natural: { width: number; height: number } | null | undefined,
): CaptureBox | null {
  if (image.box || image.screen === "IN_MATCH" || !isGameScreen(natural)) return null
  if (image.section === "OVERVIEW") return DETAILS_COLUMN
  if (image.section === "ATTRIBUTES") return ATTRIBUTE_SHEET
  if (image.section === "SKILL") return SKILL_TEXT
  return null
}

/** Opens a picture on a part of it given in fractions, the way a shop card is opened. */
export function captureBoxZoom(
  box: CaptureBox,
  natural: { width: number; height: number },
  width: number,
  height: number,
): CaptureZoom {
  return captureCardZoom(
    {
      x: box.x * natural.width,
      y: box.y * natural.height,
      width: box.width * natural.width,
      height: box.height * natural.height,
      imageWidth: natural.width,
      imageHeight: natural.height,
    },
    width,
    height,
  )
}

/** Where a part of the picture sits in the frame, after the picture is fitted and zoomed. */
export function captureBoxOnScreen(
  box: CaptureBox,
  natural: { width: number; height: number },
  frame: { width: number; height: number },
  zoom: CaptureZoom,
) {
  const fit = Math.min(frame.width / natural.width, frame.height / natural.height)
  const left = (frame.width - natural.width * fit) / 2
  const top = (frame.height - natural.height * fit) / 2
  return {
    left: zoom.x + (left + box.x * natural.width * fit) * zoom.scale,
    top: zoom.y + (top + box.y * natural.height * fit) * zoom.scale,
    width: box.width * natural.width * fit * zoom.scale,
    height: box.height * natural.height * fit * zoom.scale,
  }
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
