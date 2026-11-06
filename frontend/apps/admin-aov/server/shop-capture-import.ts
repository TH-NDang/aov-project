/**
 * Copies the shop screenshots that values were actually read from into `resources/`, and records which card each value
 * came from. Run it again after a new shop visit; files already there are checked against the source, never replaced.
 *
 *   node --experimental-strip-types server/shop-capture-import.ts <folder> --date 2026-09-16 [--rows crop-results.csv]...
 *
 * `<folder>` holds `ket-qua/` with the results, and `tuong/` and `trang-phuc/` with the screenshots. A `--rows` file lists
 * where the first card row starts on a screenshot (columns File, X, Y); a later file overrides an earlier one. A screenshot
 * without a row start is still copied, only without the mark on its card.
 */
import { createHash } from "node:crypto"
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises"
import { basename, join } from "node:path"
import { pathToFileURL } from "node:url"
import { findResourcesRoot } from "./patch-captures.ts"
import {
  buildShopManifest,
  parseSources,
  type ShopHeroRow,
  type ShopManifest,
  type ShopRowStart,
  type ShopSkinRow,
} from "./shop-capture-manifest.ts"
import { SHOP_EXTRACTED_FOLDER, SHOP_MANIFEST, SHOP_RAW_FOLDER } from "./shop-captures.ts"

const RESULT_FILES = [
  "tuong-gia-vang.json",
  "tuong-gia-vang.csv",
  "trang-phuc-cach-nhan.json",
  "trang-phuc-cach-nhan.csv",
  "can-xem-lai.md",
]

/** Reads a JPEG's size from its frame header, so no image library is needed for this. */
export function jpegSize(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  for (let at = 2; at + 9 < bytes.length; at += 2 + view.getUint16(at + 2)) {
    if (bytes[at] !== 0xff) throw new Error("Not a readable JPEG.")
    const marker = bytes[at + 1]!
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (isFrame) return { height: view.getUint16(at + 5), width: view.getUint16(at + 7) }
  }
  throw new Error("No frame header in JPEG.")
}

/** Understands the plain quoted CSV the crop scripts write. */
export function parseRowStarts(text: string): Map<string, ShopRowStart> {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter(Boolean)
  const cells = (line: string) => line.split(",").map((cell) => cell.replace(/^"|"$/g, ""))
  const header = cells(lines[0] ?? "")
  const [file, x, y] = ["File", "X", "Y"].map((name) => header.indexOf(name))
  if (file! < 0 || x! < 0 || y! < 0) throw new Error("A rows file needs the columns File, X and Y.")
  return new Map(
    lines.slice(1).map((line) => {
      const row = cells(line)
      return [row[file!]!, { x: Number(row[x!]), y: Number(row[y!]) }]
    }),
  )
}

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")

export async function importShopCaptures({
  source,
  resources,
  capturedOn,
  rowFiles = [],
  region = "VN",
}: {
  source: string
  resources: string
  capturedOn: string
  rowFiles?: string[]
  region?: string
}): Promise<{ manifest: ShopManifest; copied: number; kept: number }> {
  const results = join(source, "ket-qua")
  const heroes = JSON.parse(await readFile(join(results, "tuong-gia-vang.json"), "utf8")) as ShopHeroRow[]
  const skins = JSON.parse(await readFile(join(results, "trang-phuc-cach-nhan.json"), "utf8")) as ShopSkinRow[]
  const rowStarts = new Map<string, ShopRowStart>()
  for (const file of rowFiles)
    for (const [name, start] of parseRowStarts(await readFile(file, "utf8"))) rowStarts.set(name, start)

  const rawFolder = join(resources, ...SHOP_RAW_FOLDER, capturedOn)
  const images = new Map<string, { sha256: string; path: string; width: number; height: number }>()
  let copied = 0
  let kept = 0
  const copyFrom = async (folder: string, rows: readonly { anh_nguon: string }[]) => {
    const names = new Set(rows.flatMap((row) => parseSources(row.anh_nguon).map((entry) => entry.fileName)))
    await mkdir(join(rawFolder, folder), { recursive: true })
    for (const name of names) {
      const from = join(source, folder, name)
      const to = join(rawFolder, folder, name)
      const bytes = await readFile(from)
      const hash = sha256(bytes)
      if (await stat(to).catch(() => null)) {
        if (sha256(await readFile(to)) !== hash) throw new Error(`${to} already exists with different content.`)
        kept++
      } else {
        await copyFile(from, to)
        copied++
      }
      images.set(name, { sha256: hash, path: `${folder}/${name}`, ...jpegSize(bytes) })
    }
  }
  await copyFrom("tuong", heroes)
  await copyFrom("trang-phuc", skins)

  const manifest = buildShopManifest({ capturedOn, region, images, rowStarts, heroes, skins })
  const extracted = join(resources, ...SHOP_EXTRACTED_FOLDER, capturedOn)
  await mkdir(extracted, { recursive: true })
  await writeFile(join(extracted, SHOP_MANIFEST), JSON.stringify(manifest, null, 2) + "\n")
  // The results stay beside the images they were read from.
  for (const name of RESULT_FILES) {
    const from = join(results, name)
    if (await stat(from).catch(() => null)) await copyFile(from, join(extracted, basename(name)))
  }
  return { manifest, copied, kept }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2)
  const source = args[0]
  const value = (name: string) =>
    args.flatMap((arg, index) => (arg === name && args[index + 1] ? [args[index + 1]!] : []))
  const capturedOn = value("--date")[0]
  const resources = findResourcesRoot(process.cwd())
  if (!source || !capturedOn || !/^\d{4}-\d{2}-\d{2}$/.test(capturedOn))
    throw new Error("Usage: shop-capture-import.ts <folder> --date yyyy-mm-dd [--rows file]...")
  if (!resources) throw new Error("No resources/raw folder was found above this directory.")
  const { manifest, copied, kept } = await importShopCaptures({
    source,
    resources,
    capturedOn,
    rowFiles: value("--rows"),
  })
  console.log(
    JSON.stringify({
      resources,
      copied,
      kept,
      images: Object.keys(manifest.images).length,
      heroes: Object.keys(manifest.heroes).length,
    }),
  )
}
