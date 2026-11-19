import assert from "node:assert/strict"
import { test } from "node:test"
import { importImageFile, resolveImportImage } from "../src/features/publishing/model/import/import-files"

const limit = 25 * 1024 * 1024
const empty = new Map<string, File>()
const pointer = "version https://git-lfs.github.com/spec/v1\noid sha256:fixture\nsize 1000\n"

test("images come from the selected folder or an HTTPS link; server paths, other schemes and escapes are refused", () => {
  for (const source of [
    // The dev server's resources folder left the app with ADR-030; a saved import that still names it must not resolve.
    "/__resources/assets/hero/head/airi.jpg",
    "/api/wiki/v1/admin/media/assets/test",
    "http://localhost:9000/assets/airi.jpg",
    "c:/airi.jpg",
    "\\\\server\\airi.jpg",
    "../airi.jpg",
    "assets/../../airi.jpg",
  ])
    assert.throws(() => resolveImportImage(source, empty, ""), Error, source)
  assert.equal(resolveImportImage("https://cdn.example/airi.jpg", empty, ""), "https://cdn.example/airi.jpg")
  assert.throws(() => resolveImportImage("https://user:secret@cdn.example/airi.jpg", empty, ""), /mật khẩu/)
  assert.throws(() => resolveImportImage("assets/hero/head/airi.jpg", empty, ""), /Không tìm thấy ảnh/)
})

test("selected files share MIME inference, size and empty-file validation, under the chosen base folder", () => {
  const inferred = new File(["image"], "airi.jpg")
  const result = resolveImportImage("assets/hero/head/airi.jpg", new Map([["assets/hero/head/airi.jpg", inferred]]), "")
  assert.ok(result instanceof File)
  assert.equal(result.type, "image/jpeg")
  assert.equal(result.name, "airi.jpg")
  for (const file of [
    new File([], "airi.jpg", { type: "image/jpeg" }),
    new File(["not an image"], "airi.jpg", { type: "text/html" }),
    new File([new Uint8Array(limit + 1)], "airi.jpg", { type: "image/jpeg" }),
  ])
    assert.throws(
      () => resolveImportImage("assets/hero/head/airi.jpg", new Map([["assets/hero/head/airi.jpg", file]]), ""),
      /25 MB/,
    )
  const selected = new File(["head"], "ảnh nền.jpg", { type: "image/jpeg" })
  assert.equal(
    resolveImportImage("assets/skin/ảnh nền.jpg", new Map([["pack/assets/skin/ảnh nền.jpg", selected]]), "pack"),
    selected,
  )
})

test("a selected Git LFS pointer is refused instead of uploaded as an image", async () => {
  await assert.rejects(
    importImageFile(
      "assets/hero/head/airi.jpg",
      new Map([["assets/hero/head/airi.jpg", new File([pointer], "airi.jpg", { type: "image/jpeg" })]]),
      "",
    ),
    /Git LFS pointer/,
  )
  const real = new File([new Uint8Array([1, 2, 3])], "airi.jpg", { type: "image/jpeg" })
  assert.equal(
    await importImageFile("assets/hero/head/airi.jpg", new Map([["assets/hero/head/airi.jpg", real]]), ""),
    real,
  )
})
