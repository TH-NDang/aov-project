import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import { image, skill, withView } from "./fixtures/hero-skills-view"

test("inventory matches only unambiguous skill identities and explicit version artwork always wins", async () => {
  await withView(async ({ document, client, SkillArtwork, skillImageMatch, render, waitFor }) => {
    const value = skill("skill-2-1")
    const exact = image("exact", { skillKey: value.skillKey, sourceSlot: 9, variantNo: 8 })
    const loose = image("loose")
    assert.equal(skillImageMatch(value, [loose, exact])?.id, exact.id)
    assert.equal(skillImageMatch(value, [exact, image("second-exact", { skillKey: value.skillKey }), loose]), undefined)
    assert.equal(skillImageMatch(value, [loose])?.id, loose.id)
    assert.equal(skillImageMatch(value, [loose, image("second-loose")]), undefined)
    assert.equal(skillImageMatch(value, [image("other-key", { skillKey: "another-skill" })]), undefined)
    assert.equal(skillImageMatch(value, [image("wrong-slot", { sourceSlot: 1 })]), undefined)
    assert.equal(skillImageMatch(value, [image("wrong-variant", { variantNo: 2 })]), undefined)
    const unverified = skill("custom-unidentified")
    unverified.effects = [{ effectType: "SOURCE_SNAPSHOT", metadata: { sourceSlot: 2 } }]
    assert.equal(skillImageMatch(unverified, [loose]), undefined)
    const conflicting = { ...value, effects: [{ effectType: "SOURCE_SNAPSHOT", metadata: { sourceSlot: 3 } }] }
    assert.equal(skillImageMatch(conflicting, [image("conflicting-slot", { sourceSlot: 3 })]), undefined)
    client.setQueryData(["hero-skill-images", "view-hero"], [exact])
    await render(<SkillArtwork skill={{ ...value, iconAssetId: "version-icon" }} heroId="view-hero" preview />)
    await waitFor(() => !!document.querySelector('img[src="/media/version-icon.webp"]'))
    assert.equal(
      document.querySelector('img[alt="Ảnh kỹ năng của phiên bản"]')?.getAttribute("src"),
      "/media/version-icon.webp",
    )
    assert.equal(document.querySelector('img[alt="Ảnh thư viện kỹ năng"]'), null)
    await render(<SkillArtwork skill={value} heroId="view-hero" />)
    await waitFor(() => !!document.querySelector('img[src="/media/asset-exact.webp"]'))
    // No mark on the icon; the picture names its origin and the tooltip explains it.
    assert.ok(document.querySelector('img[alt="Ảnh thư viện kỹ năng"]'))
    assert.ok(document.querySelector('[title*="không phải ảnh xác nhận riêng"]'))
  })
})

test("ambiguous and unbound inventory stays available in a gallery that loads asset metadata only after opening", async () => {
  await withView(async ({ dom, document, client, requests, HeroSkillsView, render, waitFor }) => {
    const value = skill("skill-2-1")
    const images = [
      image("ambiguous-a", { skillKey: value.skillKey }),
      image("ambiguous-b", { skillKey: value.skillKey }),
      image("unknown", { sourceSlot: 4, variantNo: 3 }),
    ]
    client.setQueryData(["hero-skill-images", "view-hero"], images)
    await render(<HeroSkillsView skills={[value]} locale="vi-VN" heroId="view-hero" />)
    const gallery = [...document.querySelectorAll("details")].find((node) =>
      node.querySelector("summary")?.textContent?.includes("Ảnh chưa gắn nội dung"),
    )!
    assert.ok(gallery)
    assert.match(gallery.querySelector("summary")!.textContent!, /3/)
    assert.equal(gallery.open, false)
    assert.equal(gallery.querySelector("img"), null)
    assert.equal(
      requests.some((path) => path.startsWith("/admin/media/assets/asset-")),
      false,
    )
    await act(async () => {
      gallery.open = true
      gallery.dispatchEvent(new dom.window.Event("toggle"))
    })
    await waitFor(() => gallery.querySelectorAll("img").length === 3)
    assert.ok(gallery.querySelector('img[src="/media/asset-unknown.webp"]'))
    await act(async () => {
      gallery.open = false
      gallery.dispatchEvent(new dom.window.Event("toggle"))
    })
    assert.equal(gallery.querySelectorAll("img").length, 0)
  })
})
