import assert from "node:assert/strict"
import { test } from "node:test"
import { profileSlug } from "../src/features/community/profile-slug"

test("Vietnamese and Latin names become readable page codes", () => {
  assert.equal(profileSlug("Garena Liên Quân Mobile"), "garena-lien-quan-mobile")
  assert.equal(profileSlug("Liên Quân Mobile eSports-Garena"), "lien-quan-mobile-esports-garena")
  assert.equal(profileSlug("Đội tuyển Sài Gòn Phantom"), "doi-tuyen-sai-gon-phantom")
  assert.equal(profileSlug("  Garena RoV Thailand!  "), "garena-rov-thailand")
})

test("names in other scripts ask for a typed code instead of a truncated one", () => {
  assert.equal(profileSlug("Garena 傳說對決"), null)
  assert.equal(profileSlug("การีน่า RoV"), null)
  assert.equal(profileSlug(""), "")
})
