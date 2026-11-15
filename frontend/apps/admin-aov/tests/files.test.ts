import test from "node:test"
import assert from "node:assert/strict"
import { readFileTab } from "../src/features/files/file-tabs.tsx"
import { fileKind, formatMonth, formatShare, formatStorage, groupLabel } from "../src/features/files/files-format.ts"
import { joinPath, safeFileName, sha256Hex, sourceContentType } from "../src/features/files/source-upload.ts"

test("storage figures use the decimal gigabyte R2 bills in, with a Vietnamese decimal comma", () => {
  assert.equal(formatStorage(4_250_000_000), "4,25 GB")
  assert.equal(formatStorage(10_000_000_000), "10 GB")
  assert.equal(formatStorage(261_100_000), "261,1 MB")
  assert.equal(formatStorage(127_003), "127 KB")
  assert.equal(formatStorage(0), "0 B")
  assert.equal(formatShare(0.4253), "43%")
  assert.equal(formatShare(0.00885), "0,9%")
  assert.equal(formatMonth("2026-11"), "Tháng 11/2026")
})

test("groups read as kinds of pictures for media and as functions for source files", () => {
  assert.equal(groupLabel("MEDIA_ASSETS", "HERO_SKIN_ART"), "Ảnh trang phục")
  assert.equal(groupLabel("SOURCES", "SHOP_CAPTURE"), "Ảnh cửa hàng")
  assert.equal(groupLabel("MEDIA_ASSETS", "SOMETHING_NEW"), "SOMETHING_NEW")
  assert.equal(fileKind("image/png"), "Ảnh PNG")
  assert.equal(fileKind("application/json"), "JSON")
})

test("only the types the private bucket accepts are uploaded, scripts as plain text", () => {
  assert.equal(sourceContentType("page-1.PNG"), "image/png")
  assert.equal(sourceContentType("shop-manifest.json"), "application/json")
  assert.equal(sourceContentType("build_dataset.py"), "text/plain")
  assert.equal(sourceContentType("tuong-v4.zip"), "application/zip")
  assert.equal(sourceContentType("page.html"), null)
  assert.equal(sourceContentType("icon.svg"), null)
  assert.equal(sourceContentType("README"), null)
})

test("picked names and folders become paths the backend accepts", () => {
  assert.equal(safeFileName("Hấu: Nghệ?.png"), "Hấu- Nghệ-.png")
  assert.equal(safeFileName("note. "), "note")
  assert.equal(joinPath("raw//shop/./2026-09-16/../", "a.jpg"), "raw/shop/2026-09-16/a.jpg")
  assert.equal(joinPath("  ", "a.jpg"), "a.jpg")
})

test("hashes are lower-case hex SHA-256 of the bytes", async () => {
  const hash = await sha256Hex(new Blob(["hello source files"]))
  assert.match(hash, /^[0-9a-f]{64}$/)
  assert.equal(hash, await sha256Hex(new Blob([new TextEncoder().encode("hello source files")])))
})

test("the file management tab comes from the address, public images by default", () => {
  assert.equal(readFileTab(new URLSearchParams("tab=storage")), "storage")
  assert.equal(readFileTab(new URLSearchParams("tab=sources&collection=x")), "sources")
  assert.equal(readFileTab(new URLSearchParams("asset=123")), "images")
  assert.equal(readFileTab(new URLSearchParams("tab=unknown")), "images")
})
