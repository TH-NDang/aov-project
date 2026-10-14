import assert from "node:assert/strict"
import test from "node:test"
import { initialProfileDraft, suggestPreferences } from "../src/features/users/profile-preferences"
import type { UserProfile } from "../src/features/users/user-api"

const profile: UserProfile = {
  id: null,
  displayName: "User",
  biography: "",
  locale: "vi-VN",
  timeZone: "Asia/Ho_Chi_Minh",
  avatarAssetId: null,
  avatarUrl: null,
  version: 0,
  createdAt: null,
  updatedAt: null,
}
const browser = { languages: ["en-us"], timeZone: "Europe/London" }

test("new self profile uses independent browser language and zone without mutating server data", () => {
  const draft = initialProfileDraft(profile, false, browser)
  assert.equal(draft.locale, "en-US")
  assert.equal(draft.timeZone, "Europe/London")
  assert.equal(profile.locale, "vi-VN")
})
test("saved profiles and admin forms preserve saved preferences", () => {
  const saved = { ...profile, id: "existing", version: 1 }
  assert.equal(initialProfileDraft(saved, false, browser), saved)
  assert.equal(initialProfileDraft(profile, true, browser), profile)
})
test("invalid browser preferences fall back independently", () => {
  const draft = suggestPreferences(profile, { languages: ["bad_tag", "fr-FR"], timeZone: "Invalid/Zone" })
  assert.equal(draft.locale, "fr-FR")
  assert.equal(draft.timeZone, profile.timeZone)
  const zoneOnly = suggestPreferences(profile, { languages: [], timeZone: "UTC" })
  assert.equal(zoneOnly.locale, profile.locale)
  assert.equal(zoneOnly.timeZone, "UTC")
})
test("explicit browser action updates preferences but preserves other edited fields", () => {
  const draft = suggestPreferences({ ...profile, biography: "Unsaved draft", version: 3 }, browser)
  assert.equal(draft.biography, "Unsaved draft")
  assert.equal(draft.version, 3)
  assert.equal(draft.locale, "en-US")
})
