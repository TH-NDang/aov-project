/** Joins the values read off the game's shop screenshots to the exact card each one came from. */

export interface ShopHeroRow {
  ten_tuong: string
  hero_code: string
  gia_vang: number | string | null
  gia_quan_huy: number | string | null
  trang_thai_tren_anh: string
  can_xem_lai: string
  ghi_chu: string
  anh_nguon: string
}

export interface ShopSkinRow {
  tuong: string
  hero_code: string
  ten_trang_phuc: string
  ma_trang_phuc: string
  khop_wiki: string
  cach_nhan: string
  nhan_tren_anh: string
  gia_goc_quan_huy: number | string | null
  gia_da_giam: number | string | null
  ten_su_kien: string
  can_xem_lai: string
  ghi_chu: string
  anh_nguon: string
}

/** One card on a screenshot, in the screenshot's own pixels. */
export interface ShopCardBox {
  x: number
  y: number
  width: number
  height: number
  imageWidth: number
  imageHeight: number
}

export interface ShopSource {
  image: string
  card: number
  box: ShopCardBox | null
}

export interface ShopEntry {
  /** The wiki skin this was matched to; absent for a price and for a skin nothing matched. */
  skinKey: string | null
  name: string
  reading: string
  notes: string[]
  sources: ShopSource[]
}

export interface ShopManifest {
  capturedOn: string
  region: string
  images: Record<string, { path: string; fileName: string; width: number; height: number }>
  heroes: Record<string, { price: ShopEntry[]; skins: ShopEntry[] }>
}

/** Where a screenshot's first full card row starts; the left edge barely moves between screenshots. */
export interface ShopRowStart {
  x: number
  y: number
}

/** Measured on the 2400x1080 shop screen. Cards are read left to right; the fifth is the last in a row. */
const CARD_COLUMNS = [
  [0, 279],
  [295, 571],
  [587, 864],
  [880, 1158],
  [1174, 1449],
] as const
const CARD_HEIGHT = 509
const ROW_PITCH = 541
/** The shop's tabs end here, so a card scrolled under them is only visible below this line. */
const CONTENT_TOP = 190

export function cardBox(
  card: number,
  start: ShopRowStart | undefined,
  image: { width: number; height: number },
): ShopCardBox | null {
  if (!start || !Number.isInteger(card) || card < 1) return null
  const [left, right] = CARD_COLUMNS[(card - 1) % CARD_COLUMNS.length]!
  const top = start.y + Math.floor((card - 1) / CARD_COLUMNS.length) * ROW_PITCH
  const y = Math.max(top, CONTENT_TOP)
  const bottom = Math.min(top + CARD_HEIGHT, image.height)
  if (bottom <= y) return null
  return {
    x: start.x + left,
    y,
    width: right - left,
    height: bottom - y,
    imageWidth: image.width,
    imageHeight: image.height,
  }
}

/** `a.jpg#1 ; b.jpg#2`: the same card can appear on more than one screenshot. */
export function parseSources(value: string) {
  return value
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [fileName = "", card = ""] = part.split("#")
      return { fileName, card: Number(card) }
    })
}

const amount = (value: number | string | null | undefined) =>
  value === null || value === undefined || value === "" ? null : Number(value).toLocaleString("vi-VN")

function priceReading(row: ShopHeroRow) {
  const gold = amount(row.gia_vang)
  const voucher = amount(row.gia_quan_huy)
  const prices = [gold && `${gold} vàng`, voucher && `${voucher} quân huy`].filter(Boolean)
  return prices.length ? prices.join(" · ") : row.trang_thai_tren_anh
}

function skinReading(row: ShopSkinRow) {
  const list = amount(row.gia_goc_quan_huy)
  const sale = amount(row.gia_da_giam)
  if (list) return [`${list} quân huy`, sale && `đang giảm còn ${sale}`].filter(Boolean).join(", ")
  return [row.nhan_tren_anh, row.ten_su_kien].filter(Boolean).join(" · ")
}

const reviewNote = (row: { can_xem_lai: string }) =>
  row.can_xem_lai === "co" ? ["Mục này được đánh dấu cần xem lại khi đọc ảnh."] : []

export function buildShopManifest({
  capturedOn,
  region,
  images,
  rowStarts,
  heroes,
  skins,
}: {
  capturedOn: string
  region: string
  /** Keyed by file name, because that is how the results name a screenshot. */
  images: Map<string, { sha256: string; path: string; width: number; height: number }>
  rowStarts: Map<string, ShopRowStart>
  heroes: readonly ShopHeroRow[]
  skins: readonly ShopSkinRow[]
}): ShopManifest {
  const manifest: ShopManifest = { capturedOn, region, images: {}, heroes: {} }
  const hero = (code: string) => (manifest.heroes[code] ??= { price: [], skins: [] })
  const sources = (value: string): ShopSource[] =>
    parseSources(value).map(({ fileName, card }) => {
      const image = images.get(fileName)
      if (!image) throw new Error(`${fileName} is named by the results but was not found.`)
      manifest.images[image.sha256] = { path: image.path, fileName, width: image.width, height: image.height }
      return { image: image.sha256, card, box: cardBox(card, rowStarts.get(fileName), image) }
    })

  for (const row of heroes) {
    const owned = row.trang_thai_tren_anh === "Đã nhận"
    const entry: ShopEntry = {
      skinKey: null,
      name: row.ten_tuong,
      reading: priceReading(row),
      notes: [
        ...(owned ? ["Tài khoản chụp ảnh đã sở hữu tướng này nên cửa hàng không hiện giá."] : []),
        ...reviewNote(row),
        ...(row.ghi_chu ? [row.ghi_chu] : []),
      ],
      sources: sources(row.anh_nguon),
    }
    // Cards with one name can stand for several wiki codes, and the screenshot cannot say which.
    for (const code of row.hero_code.split("|").filter(Boolean)) hero(code).price.push(entry)
  }

  for (const row of skins) {
    if (!row.hero_code) continue
    const matched = row.khop_wiki !== "khong_khop" && !!row.ma_trang_phuc
    hero(row.hero_code).skins.push({
      skinKey: matched ? row.ma_trang_phuc : null,
      name: row.ten_trang_phuc,
      reading: skinReading(row),
      notes: [
        ...(row.khop_wiki === "gan_dung" ? [`Khớp gần đúng theo tên trên ảnh: ${row.ten_trang_phuc}.`] : []),
        ...reviewNote(row),
        ...(row.ghi_chu ? [row.ghi_chu] : []),
      ],
      sources: sources(row.anh_nguon),
    })
  }
  return manifest
}

/** What the panel needs for one card: a capture image, plus what was read from it. */
export interface ShopCaptureImage {
  id: string
  fileName: string
  archive: string
  member: string
  section: "SHOP"
  link: "SHOP" | "UNLINKED"
  skillKey: null
  skillName: null
  notes: string[]
  kind: "price" | "skin"
  skinKey: string | null
  entryName: string
  reading: string
  card: number
  box: ShopCardBox | null
  capturedOn: string
  url: string
}

export const shopImageUrl = (sha256: string) => `/__shop-captures/images/${sha256}.jpg`

export function heroShopImages(manifest: ShopManifest, heroCode: string): ShopCaptureImage[] {
  const hero = manifest.heroes[heroCode]
  if (!hero) return []
  const flatten = (kind: ShopCaptureImage["kind"], entries: ShopEntry[]) =>
    entries.flatMap((entry, index) =>
      entry.sources.map((source): ShopCaptureImage => {
        const image = manifest.images[source.image]!
        return {
          id: `${manifest.capturedOn}:${kind}:${entry.skinKey ?? index}:${source.image.slice(0, 16)}:${source.card}`,
          fileName: image.fileName,
          archive: `raw/shop/${manifest.capturedOn}`,
          member: image.path,
          section: "SHOP",
          // A skin nothing matched is still this hero's, and stays findable without claiming to be a wiki skin.
          link: kind === "skin" && !entry.skinKey ? "UNLINKED" : "SHOP",
          skillKey: null,
          skillName: null,
          notes: entry.notes,
          kind,
          skinKey: entry.skinKey,
          entryName: entry.name,
          reading: entry.reading,
          card: source.card,
          box: source.box,
          capturedOn: manifest.capturedOn,
          url: shopImageUrl(source.image),
        }
      }),
    )
  // Entries that matched a wiki skin come first; the ones that did not are the rare exception.
  const skins = [...hero.skins.filter((entry) => entry.skinKey), ...hero.skins.filter((entry) => !entry.skinKey)]
  return [...flatten("price", hero.price), ...flatten("skin", skins)]
}
