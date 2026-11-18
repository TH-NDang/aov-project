import { setFetch } from "./fixtures/dispatch-fetch"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { JSDOM } from "jsdom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { TooltipProvider } from "@aov/ui/components/tooltip"
import {
  buildCaptureGroups,
  captureBoxOnScreen,
  captureBoxZoom,
  captureCardZoom,
  captureFit,
  captureFocus,
  captureFocusBox,
  captureGroupKeys,
  captureGroupTarget,
  captureRegions,
  type CaptureTarget,
  type CaptureImage,
  captureImageTitle,
  captureSha256,
  clampCaptureZoom,
  withShopGroups,
  zoomCaptureAt,
} from "../src/features/publishing/model/captures/patch-capture-model"
import type { Skill } from "../src/features/publishing/api/types"
import {
  fetchCaptureSets,
  fetchHeroCaptures,
  fetchShopCaptures,
  findHeroCode,
} from "../src/features/publishing/api/use-patch-captures"
import { installWindow, waitFor } from "./fixtures/dom"
import { fixtureHeroRow } from "./fixtures/hero-workspace-data"

/** A patch picture's id is the SHA-256 of its bytes, which is also what its presigned link is asked by. */
const capture = (id: string, section: CaptureImage["section"], extra: Partial<CaptureImage> = {}): CaptureImage => ({
  id: createHash("sha256").update(id).digest("hex"),
  fileName: `${id}.png`,
  archive: "01.zip",
  member: `run/airi/${id}.png`,
  section,
  link: section === "SKILL" || section === "ATTRIBUTES" ? "REVIEWED" : section === "OVERVIEW" ? "FILENAME" : "UNLINKED",
  skillKey: null,
  skillName: null,
  notes: [],
  ...extra,
})

const skill = (skillKey: string, kind: Skill["kind"], displayOrder: number, name: string): Skill => ({
  skillKey,
  kind,
  formKey: null,
  displayOrder,
  iconAssetId: null,
  translations: [{ locale: "vi-VN", name, description: "" }],
  effects: [],
})

const skills = [
  skill("skill-0-1", "PASSIVE", 0, "Sắc lẻm"),
  skill("skill-1-1", "ACTIVE", 1, "Lôi đình"),
  skill("skill-2-1", "ACTIVE", 2, "Phong thần"),
]

const images = [
  capture("overview", "OVERVIEW"),
  capture("attributes", "ATTRIBUTES", { notes: ["Ảnh chỉ chụp tổng quan."] }),
  capture("passive", "SKILL", { skillKey: "skill-0-1", skillName: "Sắc lẻm" }),
  capture("one-a", "SKILL", { skillKey: "skill-1-1", skillName: "Lôi đình" }),
  capture("one-b", "SKILL", { skillKey: "skill-1-1", skillName: "Lôi đình" }),
  capture("wrong", "WITHHELD", {
    link: "WITHHELD",
    skillKey: "skill-2-1",
    notes: ["Ảnh mang tên chiêu 2 nhưng là tổng quan."],
  }),
  capture("icons", "FORM"),
]

const groupsFor = (focus: string, list = images, heroSkills = skills) =>
  buildCaptureGroups({ images: list, skills: heroSkills, locale: "vi-VN", patchCode: "2026-10-30", focus })

test("the panel follows the section being viewed or edited", () => {
  const focus = (patch: Partial<Parameters<typeof captureFocus>[0]>) =>
    captureFocus({
      view: "overview",
      tab: "overview",
      editing: false,
      section: "PROFILE",
      skillKey: "",
      skills,
      ...patch,
    })
  assert.equal(focus({}), "overview")
  assert.equal(focus({ tab: "skills" }), "skill:skill-0-1")
  assert.equal(focus({ tab: "skills", skillKey: "skill-2-1" }), "skill:skill-2-1")
  assert.equal(focus({ tab: "skills", skillKey: "gone" }), "skill:skill-0-1")
  assert.equal(focus({ tab: "skins" }), "skins")
  assert.equal(focus({ tab: "media" }), "media")
  assert.equal(focus({ editing: true, section: "COMBAT_STATS" }), "attributes")
  assert.equal(focus({ editing: true, section: "OVERVIEW_RATINGS" }), "overview")
  assert.equal(focus({ editing: true, section: "SKILLS", skillKey: "skill-1-1" }), "skill:skill-1-1")
  assert.equal(focus({ view: "translations", section: "COMBAT_STATS" }), "attributes")
  assert.equal(focus({ view: "history", tab: "skills" }), "patch-notes")
  assert.equal(focus({ tab: "skills", skills: [] }), "overview")
  // The panel can lead the page to a part that shares the overview tab; an editor or another view still decides.
  assert.equal(focus({ pinned: "attributes" }), "attributes")
  assert.equal(
    focus({ pinned: "attributes", editing: true, section: "SKILLS", skillKey: "skill-1-1" }),
    "skill:skill-1-1",
  )
  assert.equal(focus({ pinned: "attributes", view: "history" }), "patch-notes")
})

test("a game screen opens on the part worth reading, and its ratings, skill icons and text lead to the page", () => {
  const screen = { width: 2400, height: 1080 }
  const overview = captureRegions(capture("overview", "OVERVIEW"), skills, "vi-VN", screen)
  assert.deepEqual(
    overview.map((region) => region.key),
    ["ratings", "skill-0", "skill-1", "skill-2", "name"],
    "Only the slots the draft has get an icon",
  )
  const one = overview.find((region) => region.key === "skill-1")!
  assert.equal(one.label, "Chiêu 1 · Lôi đình")
  assert.deepEqual(one.target, { tab: "skills", skill: "skill-1-1", group: "skill:skill-1-1" })
  assert.deepEqual(overview[0]!.target, { tab: "overview", section: "OVERVIEW_RATINGS", group: "overview" })
  const sheet = captureRegions(capture("attributes", "ATTRIBUTES"), skills, "vi-VN", screen)
  assert.deepEqual(sheet.find((region) => region.key === "attributes")!.target, {
    tab: "overview",
    section: "COMBAT_STATS",
    group: "attributes",
  })
  const passive = captureRegions(capture("passive", "SKILL", { skillKey: "skill-0-1" }), skills, "vi-VN", screen)
  assert.deepEqual(passive.at(-1)!.target, { tab: "skills", skill: "skill-0-1", group: "skill:skill-0-1" })
  // Nothing is guessed on a picture of another shape, on unmatched captures or on shop cards.
  assert.deepEqual(captureRegions(capture("overview", "OVERVIEW"), skills, "vi-VN", { width: 1080, height: 2400 }), [])
  assert.deepEqual(captureRegions(capture("icons", "FORM"), skills, "vi-VN", screen), [])
  assert.deepEqual(captureRegions(capture("overview", "OVERVIEW"), skills, "vi-VN", null), [])

  const focus = captureFocusBox(capture("passive", "SKILL", { skillKey: "skill-0-1" }), screen)!
  assert.ok(focus.x > 0.4, "a skill screen opens on its text, on the right")
  assert.equal(captureFocusBox(capture("overview", "OVERVIEW"), { width: 1000, height: 1000 }), null)
  const zoom = captureBoxZoom(focus, screen, 560, 252)
  assert.ok(zoom.scale > 1.4, `scale ${zoom.scale}`)
  const place = captureBoxOnScreen(focus, screen, { width: 560, height: 252 }, zoom)
  assert.ok(place.left >= 0 && place.left + place.width <= 560, `${place.left} + ${place.width}`)
  assert.ok(place.top >= 0 && place.top + place.height <= 252, `${place.top} + ${place.height}`)
})

test("an in-match shot shows whole, and a picture of several skills joins each skill's group", () => {
  // Resized in-match shots keep the 20:9 shape, so only the mark keeps the hero page layout off them.
  const screen = { width: 2000, height: 900 }
  const panel = capture("panel", "SKILL", { skillKey: "skill-1-1", alsoSkillKeys: ["skill-2-1"], screen: "IN_MATCH" })
  assert.deepEqual(captureRegions(panel, skills, "vi-VN", screen), [])
  assert.equal(captureFocusBox(panel, screen), null)
  assert.notEqual(captureFocusBox({ ...panel, screen: undefined }, screen), null)

  const groups = groupsFor("skill:skill-2-1", [...images, panel])
  for (const key of ["skill:skill-1-1", "skill:skill-2-1"])
    assert.ok(groups.find((group) => group.key === key)!.images.includes(panel), key)
  const extra = groupsFor("overview", [capture("x", "SKILL", { skillKey: "skill-1-1", alsoSkillKeys: ["skill-9-1"] })])
  assert.ok(
    extra.some((group) => group.key === "skill:skill-9-1"),
    "a skill the draft lacks still gets its images",
  )
})

test("each group knows the part of the page it checks, and leaves the rest alone", () => {
  assert.deepEqual(captureGroupTarget({ key: "overview" }, skills), {
    tab: "overview",
    section: "PROFILE",
    group: "overview",
  })
  assert.deepEqual(captureGroupTarget({ key: "attributes" }, skills)?.section, "COMBAT_STATS")
  assert.deepEqual(captureGroupTarget({ key: "skill:skill-2-1" }, skills), {
    tab: "skills",
    skill: "skill-2-1",
    group: "skill:skill-2-1",
  })
  assert.equal(captureGroupTarget({ key: "skill:skill-9-1" }, skills), null, "a skill the draft lacks has no page")
  assert.equal(captureGroupTarget({ key: "withheld" }, skills), null)
  assert.equal(captureGroupTarget({ key: "form" }, skills), null)
  assert.deepEqual(captureGroupTarget({ key: "skins" }, skills, capture("card", "SKILL", { skinKey: "skin-b" })), {
    tab: "skins",
    skin: "skin-b",
    group: "skins",
  })
})

test("every draft skill gets a group, and a rejected image never joins the skill it was named after", () => {
  const groups = groupsFor("overview")
  assert.deepEqual(
    groups.map((group) => [group.label, group.images.length]),
    [
      ["Tổng quan", 1],
      ["Chỉ số", 1],
      ["Nội tại", 1],
      ["Chiêu 1", 2],
      ["Chiêu 2", 0],
      ["Trang phục", 0],
      ["Không nhập", 1],
      ["Chưa nối mục", 1],
    ],
  )
  const second = groups.find((group) => group.key === captureGroupKeys.skill("skill-2-1"))!
  assert.equal(second.title, "Chiêu 2 · Phong thần")
  assert.match(second.empty!, /bị loại khi rà soát/)
  assert.match(groups.find((group) => group.key === "skins")!.empty!, /không chụp trang phục/)
})

test("sections without captures say so, and images for a skill the draft lacks stay visible", () => {
  assert.match(groupsFor("media").find((group) => group.key === "media")!.empty!, /Ảnh tướng/)
  assert.match(groupsFor("patch-notes").find((group) => group.key === "patch-notes")!.empty!, /ghi chú patch/)
  assert.equal(
    groupsFor("overview").some((group) => group.key === "media"),
    false,
  )

  const extra = groupsFor(
    "overview",
    [capture("variant", "SKILL", { skillKey: "skill-3-2", skillName: "Tên ảnh" })],
    skills,
  )
  const group = extra.find((item) => item.key === captureGroupKeys.skill("skill-3-2"))!
  assert.equal(group.images.length, 1)
  assert.match(group.title, /Chiêu 3 · Tên ảnh · chưa có trong bản đang xem/)

  const none = groupsFor("overview", [], skills)
  assert.deepEqual(
    none.filter((item) => item.images.length).map((item) => item.key),
    [],
  )
  assert.match(none[0]!.empty!, /Không có ảnh tổng quan/)
})

test("variants of one slot are told apart in the chip label", () => {
  const forms = [skill("skill-1-1", "ACTIVE", 0, "Dạng một"), skill("skill-1-2", "ACTIVE", 1, "Dạng hai")]
  assert.deepEqual(
    groupsFor("overview", [], forms)
      .filter((group) => group.key.startsWith("skill:"))
      .map((group) => group.label),
    ["Chiêu 1 · 1", "Chiêu 1 · 2"],
  )
})

const shopBox = { x: 615, y: 217, width: 279, height: 509, imageWidth: 2400, imageHeight: 1080 }
/** Every card of these fixtures sits on one screenshot. */
const SHOP_SCREENSHOT = "5".repeat(64)
/** What the fake backend answers for a picture's presigned link. */
const link = (sha256: string) => `https://r2.test/sources/${sha256}?X-Amz-Signature=fixture`
const shopImage = (
  kind: "price" | "skin",
  skinKey: string | null,
  link: "SHOP" | "UNLINKED" = "SHOP",
): CaptureImage => ({
  id: `shop:${kind}:${skinKey}`,
  fileName: "Screenshot.jpg",
  archive: "raw/shop/2026-09-16",
  member: "tuong/Screenshot.jpg",
  section: "SHOP",
  link,
  skillKey: null,
  skillName: null,
  notes: [],
  kind,
  skinKey,
  entryName: skinKey ?? "Giá",
  reading: "28.888 vàng · 599 quân huy",
  card: 1,
  box: shopBox,
  capturedOn: "2026-09-16",
  sha256: SHOP_SCREENSHOT,
  path: "raw/shop/2026-09-16/tuong/Screenshot.jpg",
})

test("shop images take the skins group's place and sit beside the stats, even without a patch set", () => {
  const base = buildCaptureGroups({
    images: [],
    skills: [],
    locale: "vi-VN",
    patchCode: "2026-10-30",
    focus: "overview",
  })
  assert.equal(withShopGroups(base, []), base, "nothing changes when the shop has no card for this hero")

  const shop = [shopImage("price", null), shopImage("skin", "a"), shopImage("skin", null, "UNLINKED")]
  const merged = withShopGroups(base, shop)
  assert.deepEqual(
    merged.map((group) => group.key),
    ["overview", "attributes", "shop-price", "skins"],
  )
  const skins = merged.find((group) => group.key === captureGroupKeys.skins)!
  assert.equal(skins.images.length, 2)
  assert.equal(skins.shop, true)
  assert.equal(captureImageTitle(skins, skins.images[0]!), "Trang phục · a")
  assert.deepEqual(
    withShopGroups([], shop).map((group) => group.key),
    ["shop-price", "skins"],
  )
  assert.equal(captureSha256(shop[0]!), SHOP_SCREENSHOT, "a card opens its screenshot's bytes")
  assert.equal(captureSha256(images[0]!), images[0]!.id, "a patch picture is named by its bytes")
})

test("a shop image opens on its own card, whole inside the frame", () => {
  const width = 560
  const height = 252
  const zoom = captureCardZoom(shopBox, width, height)
  assert.ok(zoom.scale > 1.5, `scale ${zoom.scale}`)
  const fit = Math.min(width / shopBox.imageWidth, height / shopBox.imageHeight)
  const left = (shopBox.x * fit + (width - shopBox.imageWidth * fit) / 2) * zoom.scale + zoom.x
  const right = left + shopBox.width * fit * zoom.scale
  const top = shopBox.y * fit * zoom.scale + zoom.y
  const bottom = top + shopBox.height * fit * zoom.scale
  assert.ok(left >= 0 && right <= width, `${left}..${right}`)
  assert.ok(top >= 0 && bottom <= height, `${top}..${bottom}`)
  assert.deepEqual(captureCardZoom(shopBox, 0, 0), captureFit, "a frame not laid out yet shows the whole picture")
})

test("zooming keeps the pointed spot in place and panning can never leave the picture", () => {
  const zoomed = zoomCaptureAt(captureFit, 2, { x: 100, y: 50 }, 400, 200)
  assert.deepEqual(zoomed, { scale: 2, x: -100, y: -50 })
  assert.deepEqual(zoomCaptureAt(zoomed, 1, { x: 300, y: 150 }, 400, 200), captureFit)
  assert.equal(zoomCaptureAt(captureFit, 100, { x: 0, y: 0 }, 400, 200).scale, 8)
  assert.equal(zoomCaptureAt(captureFit, 0.1, { x: 0, y: 0 }, 400, 200).scale, 1)
  assert.deepEqual(clampCaptureZoom({ scale: 2, x: 50, y: 50 }, 400, 200), { scale: 2, x: 0, y: 0 })
  assert.deepEqual(clampCaptureZoom({ scale: 2, x: -900, y: -900 }, 400, 200), { scale: 2, x: -400, y: -200 })
})

test("the hero code comes from the id, trying the name first and walking the catalog only if needed", async () => {
  const row = (id: string, code: string) => fixtureHeroRow({ id, code, revisions: [] })
  const calls: string[] = []
  const pages = [[row("a", "airi"), row("b", "butterfly")], [row("c", "capheny")]]
  const list = async (page: number, query: { q?: string }) => {
    calls.push(`${page}:${query.q ?? ""}`)
    return {
      items: query.q ? (query.q === "Capheny" ? [row("c", "capheny")] : []) : (pages[page] ?? []),
      page,
      size: 2,
      totalElements: 3,
    }
  }
  assert.equal(await findHeroCode("c", "Capheny", list), "capheny")
  assert.deepEqual(calls, ["0:Capheny"])
  calls.length = 0
  assert.equal(await findHeroCode("c", "Tên đang sửa", list), "capheny")
  assert.deepEqual(calls, ["0:Tên đang sửa", "0:", "1:"])
  assert.equal(await findHeroCode("missing", "", list), null)
})

/**
 * The Admin API and the private bucket as the readers of published sets see them (ADR-030): each file is a collection
 * of its kind whose capture-manifest.json is that file. `failure` answers every Admin API call instead.
 */
function publishedSets(files: Record<string, unknown>[], failure?: { status: number; body: unknown }): typeof fetch {
  return async (input, init) => {
    const url = new URL(String(input), "http://localhost")
    const path = url.pathname.replace("/api/wiki/v1", "")
    if (path === "/auth/refresh") return Response.json({ accessToken: "panel-fixture", expiresIn: 3600 })
    if (failure && path.startsWith("/admin/")) return Response.json(failure.body, { status: failure.status })
    if (path === "/admin/source-collections") {
      const items = files
        .map((file, index) => ({ id: `set-${index}`, code: `set-${index}`, category: file.kind, label: `Bộ ${index}` }))
        .filter((item) => item.category === url.searchParams.get("category"))
      return Response.json({ items, page: 0, size: 100, totalElements: items.length })
    }
    const links = /^\/admin\/source-collections\/set-(\d+)\/links$/.exec(path)
    if (links && init?.method === "POST") {
      const sha256 = createHash("sha256")
        .update(JSON.stringify(files[Number(links[1])]))
        .digest("hex")
      const item = { path: "capture-manifest.json", sha256, url: `https://r2.test/manifest/${links[1]}` }
      return Response.json({ items: [item], missing: [] })
    }
    const manifest = /^\/manifest\/(\d+)$/.exec(path)
    if (manifest && url.host === "r2.test") return Response.json(files[Number(manifest[1])])
    return Response.json({ code: "NOT_FOUND" }, { status: 404 })
  }
}

const patchSet = (patchCode: string) => ({
  kind: "HERO_CAPTURE",
  patchCode,
  archive: "outer.zip",
  coverage: {},
  sources: [],
  heroes: { airi: { heroCode: "airi", sourceFolder: "airi", images: [images[0]] } },
})

test("published sets separate a missing patch, a missing hero and an account without access", async () => {
  const restore = setFetch(publishedSets([patchSet("2026-10-30")]))
  try {
    const ready = await fetchHeroCaptures("2026-10-30", "airi")
    assert.deepEqual(ready, { status: "ready", heroCode: "airi", sourceFolder: "airi", images: [images[0]] })
    assert.deepEqual(await fetchHeroCaptures("2025-01-01", "airi"), { status: "no-patch" })
    assert.deepEqual(await fetchHeroCaptures("2026-10-30", "x"), { status: "no-hero", heroCode: "x" })
    setFetch(publishedSets([], { status: 403, body: { code: "FORBIDDEN" } }))
    assert.deepEqual(await fetchHeroCaptures("2026-10-30", "airi"), { status: "unavailable" })
    setFetch(publishedSets([], { status: 500, body: { code: "INTERNAL_ERROR" } }))
    assert.equal((await fetchHeroCaptures("2026-10-30", "airi")).status, "error")
  } finally {
    restore()
  }
})

async function withPanel(run: (ui: Awaited<ReturnType<typeof mount>>) => Promise<void>) {
  const ui = await mount()
  try {
    await run(ui)
  } finally {
    await ui.close()
  }
}

async function mount() {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://localhost/hero/a" })
  let restoreGlobals = () => {}
  // The panel asks the backend for presigned links; this one signs every picture it is asked about.
  const restoreFetch = setFetch(async (input, init) => {
    const path = String(input).replace("/api/wiki/v1", "")
    if (path === "/auth/refresh") return Response.json({ accessToken: "panel-fixture", expiresIn: 3600 })
    if (path === "/admin/source-files/links" && init?.method === "POST") {
      const { sha256 } = JSON.parse(String(init.body)) as { sha256: string[] }
      const items = sha256.map((value) => ({ sha256: value, url: link(value), expiresAt: "2099-01-01T00:00:00Z" }))
      return Response.json({ items, missing: [] })
    }
    return Response.json({ code: "NOT_FOUND" }, { status: 404 })
  })
  const client = new QueryClient()
  restoreGlobals = installWindow(dom.window)
  const { createRoot } = await import("react-dom/client")
  const { PatchCapturePanel, PatchCaptureLink, PatchCaptureToggle } =
    await import("../src/features/publishing/components/captures/patch-capture-panel")
  const { PatchCaptureProvider } = await import("../src/features/publishing/api/use-patch-captures")
  const { useState } = React
  const navigations: CaptureTarget[] = []
  const select = (selected: string, patch: Partial<{ key: string; imageId: string | null }> = {}) => ({
    ...patch,
    key: selected,
  })

  function Harness({
    state,
    initial = "overview",
    viewedPatch,
    otherPatches = [],
    onChoosePatch = () => {},
    shop = [],
  }: {
    state: never
    initial?: string
    viewedPatch?: string
    otherPatches?: string[]
    onChoosePatch?: (patch: string) => void
    shop?: CaptureImage[]
  }) {
    const [open, setOpen] = useState(true)
    const [active, setActive] = useState(select(initial))
    const list = (state as { status: string; images?: CaptureImage[] }).images ?? []
    const groups = withShopGroups(
      (state as { status: string }).status === "ready" ? groupsFor(initial, list) : [],
      shop,
    )
    const captures = {
      state,
      patchCode: "2026-10-30",
      viewedPatchCode: viewedPatch ?? "2026-10-30",
      otherPatches,
      choosePatch: onChoosePatch,
      open,
      groups,
      activeKey: active.key,
      imageId: active.imageId ?? null,
      focusRequest: 1,
      toggle: () => setOpen(!open),
      close: () => setOpen(false),
      reveal: (key: string, imageId?: string) => {
        setActive(select(key, { imageId: imageId ?? null }))
        setOpen(true)
      },
      select: (key: string, imageId?: string) => setActive(select(key, { imageId: imageId ?? null })),
      skills,
      locale: "vi-VN",
      go: (target: CaptureTarget, imageId?: string) => {
        navigations.push(target)
        setActive(select(target.group, { imageId: imageId ?? null }))
      },
    }
    return (
      <QueryClientProvider client={client}>
        <TooltipProvider>
          <PatchCaptureProvider value={captures as never}>
            <PatchCaptureToggle />
            <PatchCaptureLink groupKey="skill:skill-1-1" name="Lôi đình" />
            <PatchCaptureLink groupKey="skill:skill-2-1" name="Phong thần" />
            <PatchCaptureLink groupKey={captureGroupKeys.shopPrice} name="giá tướng" />
            <PatchCaptureLink groupKey={captureGroupKeys.skins} skinKey="skin-b" name="Trang phục B" />
            <PatchCaptureLink groupKey={captureGroupKeys.skins} skinKey="skin-none" name="Trang phục C" />
            {open && <PatchCapturePanel captures={captures as never} />}
          </PatchCaptureProvider>
        </TooltipProvider>
      </QueryClientProvider>
    )
  }

  const document = dom.window.document
  const root = createRoot(document.getElementById("root")!)
  return {
    document,
    dom,
    navigations,
    render: (
      state: unknown,
      initial?: string,
      options: {
        viewedPatch?: string
        otherPatches?: string[]
        onChoosePatch?: (patch: string) => void
        shop?: CaptureImage[]
      } = {},
    ) => act(async () => root.render(<Harness state={state as never} initial={initial} {...options} />)),
    click: (element: Element | null | undefined) =>
      act(async () => {
        assert.ok(element, "element to click")
        element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
      }),
    press: (key: string) =>
      act(async () => {
        document.querySelector("aside")!.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key, bubbles: true }))
      }),
    picture: () => document.querySelector<HTMLImageElement>("[data-testid=capture-frame] img"),
    /** Waits until the open picture shows these bytes; its presigned link arrives a moment after the panel. */
    showing: async (sha256: string) => {
      await waitFor(
        () => document.querySelector("[data-testid=capture-frame] img")?.getAttribute("src") === link(sha256),
        `The panel never showed ${link(sha256)}.`,
      )
    },
    byLabel: (label: string) => document.querySelector(`[aria-label="${label}"]`),
    chip: (label: string) =>
      [...document.querySelectorAll('[aria-label="Chọn mục cần xem ảnh"] button')].find((button) =>
        button.textContent?.startsWith(label),
      ),
    close: async () => {
      await act(async () => root.unmount())
      client.clear()
      restoreFetch()
      restoreGlobals()
      dom.window.close()
    },
  }
}

const ready = { status: "ready", heroCode: "airi", sourceFolder: "airi", images }

test("opening a hero shows the original next to the page, with zoom and quick switching", async () => {
  await withPanel(async (ui) => {
    await ui.render(ready)
    assert.equal(ui.document.querySelector("aside")?.getAttribute("aria-label"), "Ảnh gốc của tướng")
    await ui.showing(images[0]!.id)
    assert.match(ui.document.querySelector("aside")!.textContent!, /1\/7 ảnh của tướng/)
    assert.match(ui.document.querySelector("aside")!.textContent!, /Chỉ theo tên tệp/)

    // Arrow keys walk the whole hero, crossing from one item to the next, and the page follows each new item.
    await ui.press("ArrowRight")
    assert.equal(ui.chip("Chỉ số")?.getAttribute("aria-pressed"), "true")
    assert.deepEqual(ui.navigations.at(-1), { tab: "overview", section: "COMBAT_STATS", group: "attributes" })
    assert.match(ui.document.querySelector("[aria-label='Ghi chú rà soát']")!.textContent!, /chỉ chụp tổng quan/)
    await ui.press("ArrowRight")
    await ui.press("ArrowRight")
    assert.equal(ui.chip("Chiêu 1")?.getAttribute("aria-pressed"), "true")
    await ui.showing(images[3]!.id)
    assert.deepEqual(ui.navigations.at(-1), { tab: "skills", skill: "skill-1-1", group: "skill:skill-1-1" })
    const led = ui.navigations.length
    await ui.click(ui.byLabel(`Ảnh 2: one-b.png`))
    assert.equal(ui.navigations.length, led, "Another picture of the same skill leaves the page where it is")
    // The group's links were asked together, so the second picture opens at once.
    assert.equal(ui.picture()?.getAttribute("src"), link(images[4]!.id))
    assert.equal(ui.byLabel(`Ảnh 2: one-b.png`)?.getAttribute("aria-current"), "true")
    await ui.press("ArrowLeft")
    assert.equal(ui.picture()?.getAttribute("src"), link(images[3]!.id))

    // jsdom has no layout, so zoom buttons are checked through the scale they report.
    assert.equal(ui.byLabel("Thu nhỏ ảnh")?.hasAttribute("disabled"), true)
    await ui.click(ui.byLabel("Phóng to ảnh"))
    assert.match(ui.picture()!.style.transform, /scale\(1\.25\)/)
    await ui.press("0")
    assert.match(ui.picture()!.style.transform, /scale\(1\)/)
  })
})

test("an item without images says so plainly instead of showing another picture", async () => {
  await withPanel(async (ui) => {
    await ui.render(ready, "skins")
    assert.equal(ui.picture(), null)
    assert.match(ui.document.querySelector("aside [role=status]")!.textContent!, /không chụp trang phục/)
    await ui.click(ui.chip("Chiêu 2"))
    assert.equal(ui.picture(), null)
    assert.match(ui.document.querySelector("aside [role=status]")!.textContent!, /bị loại khi rà soát/)
    await ui.click(ui.chip("Không nhập"))
    assert.match(ui.document.querySelector("[aria-label='Ghi chú rà soát']")!.textContent!, /là tổng quan/)
    assert.match(ui.document.querySelector("aside")!.textContent!, /đã loại ảnh này khỏi dữ liệu nhập/)
  })
})

test("an item button reveals that item's own images and admits when it has none", async () => {
  await withPanel(async (ui) => {
    await ui.render(ready)
    assert.equal(ui.byLabel("Phong thần không có ảnh gốc")?.textContent, "Không có ảnh")
    await ui.click(ui.byLabel("Xem 2 ảnh gốc của Lôi đình"))
    assert.equal(ui.chip("Chiêu 1")?.getAttribute("aria-pressed"), "true")
    await ui.showing(images[3]!.id)
  })
})

test("other states explain themselves, and the toggle disappears for an account without source files", async () => {
  await withPanel(async (ui) => {
    await ui.render({ status: "no-patch" })
    assert.match(ui.document.querySelector("aside [role=status]")!.textContent!, /Patch 2026-10-30 chưa có bộ ảnh gốc/)
    await ui.render({ status: "no-hero", heroCode: "evita" })
    assert.match(ui.document.querySelector("aside [role=status]")!.textContent!, /không có tướng “evita”/)
    await ui.render({ status: "error", message: "Không đọc được" })
    assert.equal(ui.document.querySelector("aside [role=alert]")?.textContent, "Không đọc được")
    assert.ok(ui.byLabel("Đóng khung ảnh gốc"))
    await ui.render({ status: "unavailable" })
    assert.equal(ui.document.querySelector("[aria-pressed][aria-label*='ảnh gốc']"), null)
  })
})

test("a revision from a patch without captures can open the set that exists, and is told it is another patch", async () => {
  await withPanel(async (ui) => {
    const chosen: string[] = []
    await ui.render({ status: "no-patch" }, undefined, {
      viewedPatch: "s3-2026-observed",
      otherPatches: ["2026-10-30"],
      onChoosePatch: (patch) => chosen.push(patch),
    })
    const offer = [...ui.document.querySelectorAll("aside button")].find((button) =>
      button.textContent?.includes("Xem bộ ảnh patch 2026-10-30"),
    )
    await ui.click(offer)
    assert.deepEqual(chosen, ["2026-10-30"])

    await ui.render(ready, undefined, { viewedPatch: "s3-2026-observed" })
    assert.match(
      ui.document.querySelector("aside [role=note]")!.textContent!,
      /Bản đang xem thuộc patch s3-2026-observed; các ảnh này của patch 2026-10-30/,
    )
  })
})

test("a shop card opens from its own button, marked on the screenshot, with what was read from it", async () => {
  await withPanel(async (ui) => {
    await ui.render(ready, "overview", {
      shop: [shopImage("price", null), shopImage("skin", "skin-a"), shopImage("skin", "skin-b")],
    })
    assert.equal(ui.byLabel("Trang phục C không có ảnh gốc")?.textContent, "Không có ảnh")
    await ui.click(ui.byLabel("Xem 1 ảnh gốc của Trang phục B"))
    const aside = ui.document.querySelector("aside")!
    assert.match(aside.querySelector("h2")!.textContent!, /cửa hàng 16\/09\/2026/)
    assert.equal(aside.querySelector("h3")!.textContent, "Trang phục · skin-b")
    assert.match(aside.textContent!, /Đọc từ thẻ số 1: 28\.888 vàng/)
    assert.match(aside.textContent!, /chưa ai xác nhận lại trong game/)
    await ui.showing(SHOP_SCREENSHOT)

    assert.equal(ui.document.querySelector("[data-testid=capture-card-mark]"), null, "no mark before the picture loads")
    await act(async () => {
      ui.picture()!.dispatchEvent(new ui.dom.window.Event("load"))
    })
    assert.ok(ui.document.querySelector("[data-testid=capture-card-mark]"))
    assert.equal(ui.chip("Trang phục")?.textContent, "Trang phục2", "the chip counts this hero's shop cards")

    await ui.click(ui.byLabel("Xem 1 ảnh gốc của giá tướng"))
    assert.equal(aside.querySelector("h3")!.textContent, "Giá tướng")
  })
})

test("shop cards still open when the patch being viewed has no capture set", async () => {
  await withPanel(async (ui) => {
    await ui.render({ status: "no-patch" }, "overview", {
      otherPatches: ["2026-10-30"],
      shop: [shopImage("price", null), shopImage("skin", "skin-a")],
    })
    const aside = ui.document.querySelector("aside")!
    assert.ok(ui.chip("Giá tướng"))
    assert.ok(ui.chip("Trang phục"))
    assert.equal(ui.chip("Tổng quan"), undefined)
    assert.match(aside.querySelector("h2")!.textContent!, /cửa hàng/)
    assert.doesNotMatch(aside.textContent!, /chưa có bộ ảnh gốc/)
    assert.match(aside.textContent!, /Xem bộ ảnh patch 2026-10-30/, "the set that exists can still be opened")
    await ui.showing(SHOP_SCREENSHOT)
  })
})

test("a rejected image names the file's claimed skill without saying it shows that skill", async () => {
  await withPanel(async (ui) => {
    await ui.render(ready)
    await ui.click(ui.chip("Không nhập"))
    assert.equal(ui.document.querySelector("aside h3")?.textContent, "Ảnh đã loại khi rà soát · tệp mang tên Chiêu 2")
  })
})

test("capture sets list the published patches, shop visits read newest first, and no access shows none", async () => {
  const shopVisit = (capturedOn: string, image: CaptureImage) => ({
    kind: "SHOP_CAPTURE",
    capturedOn,
    region: "VN",
    heroes: { airi: [{ ...image, capturedOn }] },
  })
  const restore = setFetch(
    publishedSets([
      patchSet("2026-10-30"),
      shopVisit("2026-09-16", shopImage("price", null)),
      shopVisit("2026-11-01", shopImage("skin", "a")),
    ]),
  )
  try {
    assert.deepEqual(await fetchCaptureSets(), ["2026-10-30"])
    assert.deepEqual(
      (await fetchShopCaptures("airi")).map((image) => [image.capturedOn, image.kind]),
      [
        ["2026-11-01", "skin"],
        ["2026-09-16", "price"],
      ],
    )
    assert.deepEqual(await fetchShopCaptures("nobody"), [])
    setFetch(publishedSets([], { status: 403, body: { code: "FORBIDDEN" } }))
    assert.deepEqual(await fetchCaptureSets(), [])
    assert.deepEqual(await fetchShopCaptures("airi"), [])
  } finally {
    restore()
  }
})
