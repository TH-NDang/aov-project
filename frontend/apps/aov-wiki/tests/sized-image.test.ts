import assert from "node:assert/strict"
import { test } from "node:test"
import { resizedImageUrl, sizedImageSources } from "../src/lib/sized-image.ts"

const picture = "https://img.athahub.com/assets/a1/b2.png"

test("a Media picture is asked for through the image service at the next listed width", () => {
  assert.equal(
    resizedImageUrl(picture, 100, true),
    "https://img.athahub.com/cdn-cgi/image/width=128,fit=scale-down,format=auto,quality=82/assets/a1/b2.png",
  )
})

test("a width beyond the list asks for the largest listed width", () => {
  assert.match(resizedImageUrl(picture, 5000, true), /width=2048,/)
})

test("with the service off, or for a picture outside Media, the address stays as it is", () => {
  assert.equal(resizedImageUrl(picture, 100, false), picture)
  assert.equal(resizedImageUrl("/images/mole-logo-v4-160.png", 100, true), "/images/mole-logo-v4-160.png")
  assert.equal(resizedImageUrl("https://img.athahub.com/other/x.png", 100, true), "https://img.athahub.com/other/x.png")
})

test("the sources hold a copy for ordinary screens, one for sharp screens and the full-size picture", () => {
  const sources = sizedImageSources(picture, 90, true)
  assert.match(sources.src, /width=96,/)
  assert.match(sources.srcSet ?? "", /width=96,.* 1x, .*width=192,.* 2x$/)
  assert.equal(sources.original, picture)
})

test("with the service off the sources are the picture alone", () => {
  assert.deepEqual(sizedImageSources(picture, 90, false), { src: picture })
})
