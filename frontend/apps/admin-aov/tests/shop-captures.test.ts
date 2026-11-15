import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { importShopCaptures, jpegSize, parseRowStarts } from "../server/shop-capture-import"
import {
  buildShopManifest,
  cardBox,
  heroShopImages,
  parseSources,
  type ShopHeroRow,
  type ShopSkinRow,
} from "../server/shop-capture-manifest"
import { missingPictures } from "../server/capture-sets"
import { captureSetFromFolder, collectFolder } from "../server/source-sync"

const screen = { width: 2400, height: 1080 }

/** The smallest bytes jpegSize can read: start of image, then a frame header. */
const jpeg = (label: string, width = 2400, height = 1080) => {
  const text = new TextEncoder().encode(label)
  const head = [0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255]
  return Uint8Array.from([...head, ...new Array(9).fill(0), ...text])
}
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")

const heroRow = (values: Partial<ShopHeroRow>): ShopHeroRow => ({
  ten_tuong: "Tamyn",
  hero_code: "tamyn",
  gia_vang: 28888,
  gia_quan_huy: 599,
  trang_thai_tren_anh: "co_gia",
  can_xem_lai: "khong",
  ghi_chu: "",
  anh_nguon: "a.jpg#1",
  ...values,
})
const skinRow = (values: Partial<ShopSkinRow>): ShopSkinRow => ({
  tuong: "Tamyn",
  hero_code: "tamyn",
  ten_trang_phuc: "Nữ thuyền trưởng",
  ma_trang_phuc: "tamyn-nu-thuyen-truong-1",
  khop_wiki: "chinh_xac",
  cach_nhan: "su_kien",
  nhan_tren_anh: "Nhận từ sự kiện",
  gia_goc_quan_huy: "",
  gia_da_giam: "",
  ten_su_kien: "",
  can_xem_lai: "khong",
  ghi_chu: "",
  anh_nguon: "b.jpg#2",
  ...values,
})
const images = new Map([
  ["a.jpg", { sha256: "a".repeat(64), path: "tuong/a.jpg", ...screen }],
  ["b.jpg", { sha256: "b".repeat(64), path: "trang-phuc/b.jpg", ...screen }],
])
const build = (heroes: ShopHeroRow[], skins: ShopSkinRow[], rows = new Map([["a.jpg", { x: 615, y: 217 }]])) =>
  buildShopManifest({ capturedOn: "2026-09-16", region: "VN", images, rowStarts: rows, heroes, skins })

test("a card number finds its column and row on the screenshot", () => {
  const start = { x: 615, y: 217 }
  assert.deepEqual(cardBox(1, start, screen), {
    x: 615,
    y: 217,
    width: 279,
    height: 509,
    imageWidth: 2400,
    imageHeight: 1080,
  })
  assert.equal(cardBox(3, start, screen)?.x, 615 + 587)
  const below = cardBox(6, start, screen)
  assert.equal(below?.x, 615, "the sixth card starts the row below")
  assert.equal(below?.y, 217 + 541)
  assert.equal(below?.height, 1080 - (217 + 541), "a card running off the screen stops at its edge")
})

test("a card scrolled under the tabs is marked only where it can be seen, and an unknown row marks nothing", () => {
  const box = cardBox(1, { x: 615, y: 33 }, screen)
  assert.equal(box?.y, 190)
  assert.equal(box?.height, 33 + 509 - 190)
  assert.equal(cardBox(1, undefined, screen), null)
  assert.equal(cardBox(0, { x: 615, y: 217 }, screen), null)
})

test("one card can come from several screenshots", () => {
  assert.deepEqual(parseSources("a.jpg#1 ; b.jpg#2"), [
    { fileName: "a.jpg", card: 1 },
    { fileName: "b.jpg", card: 2 },
  ])
})

test("each hero keeps its own price and skins, with what was read and from which card", () => {
  const manifest = build(
    [heroRow({})],
    [
      skinRow({}),
      skinRow({ ma_trang_phuc: "tamyn-b-1", ten_trang_phuc: "B", gia_goc_quan_huy: 1099, gia_da_giam: 899 }),
    ],
  )
  const shown = heroShopImages(manifest, "tamyn")
  const price = shown.filter((image) => image.kind === "price")
  const skins = shown.filter((image) => image.kind === "skin")
  assert.equal(price.length, 1)
  assert.equal(price[0]?.reading, "28.888 vàng · 599 quân huy")
  assert.equal(price[0]?.card, 1)
  assert.equal(price[0]?.box?.x, 615)
  assert.deepEqual([price[0]?.sha256, price[0]?.path], ["a".repeat(64), "raw/shop/2026-09-16/tuong/a.jpg"])
  assert.equal(skins[0]?.skinKey, "tamyn-nu-thuyen-truong-1")
  assert.equal(skins[0]?.reading, "Nhận từ sự kiện")
  assert.equal(skins[0]?.box, null, "no row start was given for this screenshot")
  assert.equal(skins[1]?.reading, "1.099 quân huy, đang giảm còn 899")
  assert.equal(
    new Set(shown.map((image) => image.id)).size,
    shown.length,
    "a screenshot shared by cards keeps ids apart",
  )
  assert.deepEqual(heroShopImages(manifest, "nobody"), [])
})

test("a card standing for two wiki heroes reaches both, and an owned hero says why it has no price", () => {
  const manifest = build(
    [
      heroRow({
        hero_code: "flowborn-ad|flowborn-mid",
        gia_vang: "",
        gia_quan_huy: "",
        trang_thai_tren_anh: "Đã nhận",
      }),
    ],
    [],
  )
  for (const code of ["flowborn-ad", "flowborn-mid"]) {
    const [price] = heroShopImages(manifest, code)
    assert.equal(price?.reading, "Đã nhận")
    assert.match(price?.notes[0] ?? "", /đã sở hữu/)
  }
})

test("a skin nothing matched stays findable without claiming to be a wiki skin", () => {
  const manifest = build(
    [],
    [
      skinRow({ khop_wiki: "khong_khop", ma_trang_phuc: "", ten_trang_phuc: "Bá tước" }),
      skinRow({ khop_wiki: "gan_dung", ten_trang_phuc: "Tên gần đúng", can_xem_lai: "co", ghi_chu: "Mờ" }),
    ],
  )
  const [close, unmatched] = heroShopImages(manifest, "tamyn")
  assert.equal(close?.link, "SHOP")
  assert.equal(close?.notes.length, 3)
  assert.equal(unmatched?.link, "UNLINKED")
  assert.equal(unmatched?.skinKey, null)
  assert.equal(unmatched?.entryName, "Bá tước")
})

test("a result naming a screenshot that does not exist is refused", () => {
  assert.throws(() => build([heroRow({ anh_nguon: "missing.jpg#1" })], []), /missing\.jpg/)
})

test("row files and JPEG sizes are read without any image library", () => {
  const rows = parseRowStarts('﻿"File","X","Y","Width"\r\n"a.jpg","615","217","1449"\r\n')
  assert.deepEqual(rows.get("a.jpg"), { x: 615, y: 217 })
  assert.throws(() => parseRowStarts('"File","Width"\n"a.jpg","1"\n'), /columns/)
  assert.deepEqual(jpegSize(jpeg("x", 1200, 540)), { width: 1200, height: 540 })
})

async function withSource(run: (paths: { source: string; resources: string; heroImage: Uint8Array }) => Promise<void>) {
  const folder = await mkdtemp(join(tmpdir(), "aov-shop-"))
  const source = join(folder, "source")
  const resources = join(folder, "resources")
  const heroImage = jpeg("hero")
  try {
    await mkdir(join(source, "ket-qua"), { recursive: true })
    await mkdir(join(source, "tuong"), { recursive: true })
    await mkdir(join(source, "trang-phuc"), { recursive: true })
    await mkdir(join(resources, "raw"), { recursive: true })
    await writeFile(join(source, "ket-qua", "tuong-gia-vang.json"), JSON.stringify([heroRow({})]))
    await writeFile(join(source, "ket-qua", "trang-phuc-cach-nhan.json"), JSON.stringify([skinRow({})]))
    await writeFile(join(source, "ket-qua", "can-xem-lai.md"), "# notes")
    await writeFile(join(source, "tuong", "a.jpg"), heroImage)
    await writeFile(join(source, "tuong", "not-read.jpg"), jpeg("unused"))
    await writeFile(join(source, "trang-phuc", "b.jpg"), jpeg("skin"))
    await writeFile(join(source, "rows.csv"), '"File","X","Y"\n"a.jpg","615","217"\n')
    await run({ source, resources, heroImage })
  } finally {
    await rm(folder, { recursive: true, force: true })
  }
}

const options = (source: string, resources: string) => ({
  source,
  resources,
  capturedOn: "2026-09-16",
  rowFiles: [join(source, "rows.csv")],
})

test("importing copies only the screenshots something was read from, and can safely run again", async () => {
  await withSource(async ({ source, resources }) => {
    const first = await importShopCaptures(options(source, resources))
    assert.equal(first.copied, 2)
    assert.equal(Object.keys(first.manifest.images).length, 2)
    const raw = join(resources, "raw", "shop", "2026-09-16")
    await readFile(join(raw, "tuong", "a.jpg"))
    await assert.rejects(readFile(join(raw, "tuong", "not-read.jpg")), "an image nothing was read from stays out")
    await readFile(join(resources, "extracted", "shop", "2026-09-16", "can-xem-lai.md"))

    const again = await importShopCaptures(options(source, resources))
    assert.deepEqual([again.copied, again.kept], [0, 2])

    await writeFile(join(raw, "tuong", "a.jpg"), "changed")
    await assert.rejects(importShopCaptures(options(source, resources)), /different content/)
  })
})

test("the published set lists each hero's cards, and every screenshot is where push stores it", async () => {
  await withSource(async ({ source, resources, heroImage }) => {
    await importShopCaptures(options(source, resources))
    const extracted = join(resources, "extracted", "shop", "2026-09-16")
    const { set, pictures } = await captureSetFromFolder("SHOP_CAPTURE", extracted)
    assert.equal(set.kind, "SHOP_CAPTURE")
    if (set.kind !== "SHOP_CAPTURE") return
    assert.deepEqual(
      set.heroes.tamyn!.map((image) => image.kind),
      ["price", "skin"],
    )
    assert.equal(set.heroes.nobody, undefined)
    const price = set.heroes.tamyn![0]!
    assert.deepEqual([price.sha256, price.path], [sha(heroImage), "raw/shop/2026-09-16/tuong/a.jpg"])

    const raw = join(resources, "raw", "shop", "2026-09-16")
    const pushed = async () => (await collectFolder(raw, "raw/shop/2026-09-16")).items
    assert.deepEqual(missingPictures(pictures, await pushed()), [])

    await writeFile(join(raw, "tuong", "a.jpg"), "changed")
    assert.deepEqual(
      missingPictures(pictures, await pushed()).map((picture) => picture.path),
      ["raw/shop/2026-09-16/tuong/a.jpg"],
      "a changed file is never published as the original",
    )
  })
})
