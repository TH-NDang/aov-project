import assert from "node:assert/strict"
import { test } from "node:test"
import { JSDOM } from "jsdom"
import * as React from "react"
import { act } from "react"
import { MemoryRouter } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createHeroFixture, fixtureContent } from "./fixtures/hero-workspace-data"
import "fake-indexeddb/auto"
import { draftRepository } from "../src/app/drafts/draft-store"

test("hero reading, section save/cancel/conflict and translation preserve unrelated data", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/publishing/fixture-hero" })
  const fixture = createHeroFixture()
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  })
  let conflict = false
  const fetcher: typeof fetch = async (input, init) =>
    conflict && init?.method === "PUT"
      ? Response.json({ code: "HERO_REVISION_VERSION_CONFLICT", detail: "Version conflict" }, { status: 409 })
      : fixture.fetcher(input, init)
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    NodeFilter: dom.window.NodeFilter,
    HTMLInputElement: dom.window.HTMLInputElement,
    MutationObserver: dom.window.MutationObserver,
    CustomEvent: dom.window.CustomEvent,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    BroadcastChannel: undefined,
    fetch: fetcher,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { verifySession, logout } = await import("../src/app/auth/session")
  const { PublishingWorkspace } = await import("../src/features/publishing/publishing-page")
  const { updateTranslation } = await import("../src/features/publishing/translation-editor")
  const { createRoot } = await import("react-dom/client")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const document = dom.window.document
  let unsafe = false
  const mount = async (translationMode = false) =>
    act(async () =>
      root.render(
        <MemoryRouter
          key={String(translationMode)}
          initialEntries={[translationMode ? "/hero/fixture-hero/translations?locale=en-US" : "/hero/fixture-hero"]}
        >
          <QueryClientProvider client={cache}>
            <PublishingWorkspace
              heroId="fixture-hero"
              translationMode={translationMode}
              onUnsavedChange={(value) => {
                unsafe = value
              }}
            />
          </QueryClientProvider>
        </MemoryRouter>,
      ),
    )
  const waitFor = async (condition: () => boolean) => {
    for (let i = 0; i < 150 && !condition(); i++)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5))
      })
    assert.ok(condition(), "Expected workspace state was not reached")
  }
  const button = (label: string) =>
    [...document.querySelectorAll<HTMLButtonElement>("button")].find((node) => node.textContent?.includes(label))!
  const input = (label: string) => {
    const field = [...document.querySelectorAll("label")].find((node) => node.textContent?.includes(label))
    assert.ok(field, `Missing field ${label}: ${document.body.textContent?.slice(-4000)}`)
    return field.querySelector<HTMLInputElement>("input")!
  }
  const type = async (node: HTMLInputElement, value: string) =>
    act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(node, value)
      node.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
    })
  const click = async (node: HTMLElement) => act(async () => node.click())
  const select = async (node: HTMLSelectElement | HTMLButtonElement, value: string) => {
    if (node.tagName === "BUTTON") {
      await act(async () =>
        node.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true })),
      )
      await click(document.querySelector<HTMLElement>(`[role="menuitemradio"][data-locale="${value}"]`)!)
      return
    }
    await act(async () => {
      node.value = value
      node.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
    })
  }
  const mainTab = (view: string) => document.querySelector<HTMLButtonElement>(`[aria-controls="workspace-${view}"]`)!
  const readLocale = () => document.querySelector<HTMLButtonElement>('[aria-label="Ngôn ngữ hiển thị nội dung"]')!
  const translationLocale = () => document.querySelector<HTMLButtonElement>('[aria-label="Ngôn ngữ đích"]')!
  try {
    await verifySession()
    await mount()
    await waitFor(() => !!document.querySelector('[aria-label="Nội dung tướng"]'))
    assert.equal(document.querySelector('[aria-label="Chỉnh sửa nội dung"]'), null)
    assert.match(document.body.textContent!, /Ninja rồng/)
    assert.ok(document.querySelector('[role="tab"][aria-controls="workspace-translations"]'))
    assert.ok(document.querySelector('[role="tab"][aria-controls="workspace-history"]'))
    assert.equal(readLocale().value, "vi-VN")
    assert.ok(readLocale().closest("header"), "The language picker belongs to the hero header")
    assert.equal(document.querySelectorAll('[aria-label="Ngôn ngữ hiển thị nội dung"]').length, 1)
    // The overview gathers a short look at the other tabs. Its items are looked at in place; only the details button
    // opens the tab, which is kept once built.
    for (const tab of ["skills", "skins", "media", "videos"])
      assert.ok(document.querySelector(`[data-preview="${tab}"]`), `The overview previews ${tab}`)
    const skillPicks = [...document.querySelectorAll<HTMLButtonElement>('[data-preview="skills"] button[aria-pressed]')]
    await click(skillPicks.at(-1)!)
    assert.equal(skillPicks.at(-1)!.getAttribute("aria-pressed"), "true")
    assert.equal(
      document.querySelector('[aria-controls="hero-content-overview"]')!.getAttribute("aria-selected"),
      "true",
      "Looking at a skill on the overview stays on the overview",
    )
    assert.equal(document.querySelector("#hero-content-skills"), null, "A tab is built when first opened")
    await click(document.querySelector<HTMLButtonElement>('[aria-label="Xem chi tiết kỹ năng"]')!)
    assert.equal(document.querySelector('[aria-controls="hero-content-skills"]')!.getAttribute("aria-selected"), "true")
    assert.equal(document.querySelector<HTMLElement>("#hero-content-overview")!.hidden, true)
    assert.equal(document.querySelector<HTMLElement>("#hero-content-skills")!.hidden, false)
    await click(document.querySelector<HTMLButtonElement>('[aria-controls="hero-content-overview"]')!)
    assert.equal(document.querySelector<HTMLElement>("#hero-content-skills")?.hidden, true)
    await select(readLocale(), "en-US")
    assert.match(readLocale().getAttribute("aria-description")!, /Chưa có bản dịch/)
    assert.equal(
      document.querySelector('[aria-label="Nội dung chưa dịch"]'),
      null,
      "Missing translations stay in a popup, outside the reading layout",
    )
    await click(document.querySelector<HTMLButtonElement>('button[aria-label^="Xem 3 mục chưa dịch"]')!)
    await click(document.querySelector<HTMLButtonElement>('[aria-label="Dịch phần này: Giới thiệu"]')!)
    assert.equal(translationLocale().value, "en-US")
    assert.equal(
      document.activeElement?.closest<HTMLElement>("[data-translation-field]")?.dataset.translationField,
      "summary",
    )
    assert.equal(
      document.activeElement?.closest<HTMLElement>("[data-translation-key]")?.dataset.translationKey,
      "profile",
    )
    assert.equal(fixture.writes.length, 0)
    await click(mainTab("overview"))
    assert.equal(readLocale().value, "en-US")
    await click(document.querySelector<HTMLButtonElement>('button[aria-label="Chỉnh sửa Thông tin"]')!)
    assert.ok(
      document.querySelector('[aria-label="Đối chiếu bản dịch"]'),
      "Editing fallback text must open the target translation, never the source profile",
    )
    await click(mainTab("overview"))
    await click(document.querySelector<HTMLButtonElement>('[aria-controls="hero-content-skills"]')!)
    assert.equal(readLocale().value, "en-US")
    await click(document.querySelector<HTMLButtonElement>('button[aria-label^="Xem 2 mục chưa dịch"]')!)
    await click(document.querySelector<HTMLButtonElement>('[aria-label="Dịch phần này: Mô tả"]')!)
    assert.equal(
      document.activeElement?.closest<HTMLElement>("[data-translation-field]")?.dataset.translationField,
      "description",
    )
    assert.equal(
      document.activeElement?.closest<HTMLElement>("[data-translation-key]")?.dataset.translationKey,
      "passive",
    )
    assert.equal(translationLocale().value, "en-US")
    await click(mainTab("overview"))
    await select(readLocale(), "vi-VN")
    // The content opens on the tab it was left at, the skills; the profile lives on the overview tab.
    assert.equal(document.querySelector('[aria-controls="hero-content-skills"]')?.getAttribute("aria-selected"), "true")
    await click(document.querySelector<HTMLButtonElement>('[aria-controls="hero-content-overview"]')!)
    await click(document.querySelector<HTMLButtonElement>('button[aria-label="Chỉnh sửa Thông tin"]')!)
    assert.doesNotMatch(
      document.querySelector('[aria-label="Chỉnh sửa nội dung"]')!.textContent!,
      /Xem hồ sơ|Chỉnh sửa bản nháp/,
    )
    await click(button("Hủy chỉnh sửa phần này"))
    assert.equal(document.querySelector('[aria-label="Chỉnh sửa nội dung"]'), null)
    assert.equal(fixture.writes.length, 0)
    await click(mainTab("translations"))
    assert.equal(translationLocale().value, "en-US")
    await select(translationLocale(), "th-TH")
    await click(mainTab("overview"))
    assert.equal(readLocale().value, "vi-VN", "Opening translations must not change the reading language")
    await select(readLocale(), "zh-TW")
    await click(mainTab("history"))
    assert.equal(readLocale().value, "zh-TW")
    await click(mainTab("translations"))
    assert.equal(translationLocale().value, "th-TH", "The selected target language must survive tab switching")
    await click(mainTab("overview"))
    assert.equal(readLocale().value, "zh-TW")
    await select(readLocale(), "vi-VN")
    await click(document.querySelector<HTMLButtonElement>('button[aria-label="Chỉnh sửa Thông tin"]')!)
    assert.equal(document.querySelector('[aria-label="Các phần nội dung"]'), null)
    assert.doesNotMatch(
      document.querySelector('[aria-label="Chỉnh sửa nội dung"]')!.textContent!,
      /BCP 47|Thêm bản dịch|Cốt truyện/,
    )
    await type(input("Tên tướng"), "Unsaved hero")
    // Checked at once: an edit counts as at risk only until local storage has it, 500 ms later.
    const unload = new dom.window.Event("beforeunload", { cancelable: true })
    dom.window.dispatchEvent(unload)
    assert.equal(unload.defaultPrevented, true)
    const draftControl = document.querySelector<HTMLButtonElement>('header button[aria-label*="phần chưa lưu"]')!
    assert.ok(draftControl)
    assert.equal(document.querySelector('[aria-label="Trạng thái bản nháp"]'), null)
    await click(draftControl)
    assert.ok(
      document.querySelector('[aria-label="Trạng thái bản nháp"]')?.textContent?.includes("Bỏ thay đổi chưa lưu"),
    )
    await click(button("Xem thay đổi"))
    const review = Array.from(document.querySelectorAll('[role="dialog"]')).find((el) => el.querySelector("dl"))!
    assert.ok(review.textContent!.includes("Bản #"))
    assert.deepEqual(
      Array.from(review.querySelectorAll("dt"), (el) => el.textContent),
      ["Trước", "Sau"],
    )
    assert.deepEqual(
      Array.from(review.querySelectorAll("dd"), (el) => el.textContent),
      [fixtureContent.PROFILE!.translations[0].name, "Unsaved hero"],
    )
    assert.equal(review.querySelector('section[aria-label="Kỹ năng"]'), null)
    assert.equal(fixture.writes.length, 0)
    await click(review.querySelector<HTMLButtonElement>('[data-slot="sheet-close"],button:last-child')!)
    await click(draftControl)
    assert.equal(unsafe, false, "Locally captured edits must not prevent opening another page")
    assert.equal(document.querySelector<HTMLButtonElement>('[aria-controls="workspace-translations"]')!.disabled, false)
    await click(mainTab("translations"))
    await select(translationLocale(), "en-US")
    await type(input("Tên · Tiếng Anh (Mỹ)"), "Unfinished English")
    await select(translationLocale(), "th-TH")
    await type(input("Tên · Tiếng Thái (Thái Lan)"), "Unfinished Thai")
    await select(translationLocale(), "en-US")
    assert.equal(input("Tên · Tiếng Anh (Mỹ)").value, "Unfinished English")
    await click(mainTab("overview"))
    await act(async () => {
      for (const key of Object.keys(draftRepository.store.getState().slots)) await draftRepository.flush(key)
      root.render(null)
    })
    draftRepository.store.setState({ slots: {} })
    cache.clear()
    await mount()
    await waitFor(() => document.body.textContent!.includes("Unsaved hero"))
    await click(document.querySelector<HTMLButtonElement>('button[aria-label="Chỉnh sửa Thông tin"]')!)
    assert.equal(input("Tên tướng").value, "Unsaved hero", "An unmounted page must restore its persisted working copy")
    assert.equal(fixture.writes.length, 0, "Restoring a local draft must not write to the backend")
    await click(button("Hủy chỉnh sửa phần này"))
    assert.equal(unsafe, false)
    assert.equal(fixture.writes.length, 0)
    assert.ok(!document.body.textContent!.includes("Unsaved hero"))

    await click(document.querySelector<HTMLButtonElement>('button[aria-label="Chỉnh sửa Thông tin"]')!)
    await type(input("Tên tướng"), "Saved hero")
    await click(button("Lưu phần này"))
    await waitFor(() => fixture.writes.length === 1 && !document.querySelector('[aria-label="Chỉnh sửa nội dung"]'))
    assert.equal(fixture.writes[0].section, "PROFILE")
    assert.equal(fixture.writes[0].body.expectedDraftVersion, 1)
    assert.deepEqual(fixture.content.SKILLS, fixtureContent.SKILLS)
    assert.equal(fixture.content.PROFILE!.translations[0].name, "Saved hero")

    await click(document.querySelector<HTMLButtonElement>('button[aria-label="Chỉnh sửa Thông tin"]')!)
    await type(input("Tên tướng"), "Conflicting hero")
    conflict = true
    await click(button("Lưu phần này"))
    await waitFor(() => !!document.querySelector('[role="alert"]'))
    assert.equal(input("Tên tướng").value, "Conflicting hero")
    assert.equal(unsafe, false)
    conflict = false
    await click(button("Hủy chỉnh sửa phần này"))

    await mount(true)
    await waitFor(() => !!document.querySelector('[aria-label="Đối chiếu bản dịch"]'))
    assert.equal(
      translationLocale().value,
      "en-US",
      "A direct translation link must keep its requested target language",
    )
    await click(mainTab("overview"))
    assert.equal(readLocale().value, "vi-VN", "The translation URL target must not replace the reading preference")
    await click(mainTab("translations"))
    assert.equal(translationLocale().value, "en-US")
    const original = structuredClone(fixture.content.PROFILE!)
    await type(input("Tên · Tiếng Anh (Mỹ)"), "Airi English")
    await click(button("Lưu phần này"))
    await waitFor(() => fixture.writes.length === 2 && !unsafe)
    assert.deepEqual(fixture.content.PROFILE!.translations[0], original.translations[0])
    assert.equal(fixture.content.PROFILE!.translations.find((text) => text.locale === "en-US")?.name, "Airi English")
    assert.deepEqual(fixture.content.PROFILE!.roles, original.roles)
    await click(mainTab("overview"))
    await click(document.querySelector<HTMLButtonElement>('button[aria-label="Chỉnh sửa Thông tin"]')!)
    await type(input("Tên tướng"), "Pending profile name")
    await type(input("Ghi chú thay đổi"), "Pending information note")
    await click(mainTab("overview"))
    // The lore opens from its icon on the hero card; its editor starts from that window.
    await click(document.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"][aria-label*="ốt truyện"]')!)
    await click(document.querySelector<HTMLButtonElement>('[role="dialog"] button[aria-label="Chỉnh sửa cốt truyện"]')!)
    // A written lore reads as published first; its pencil turns the same box into the editor.
    const openLore = document.querySelector<HTMLButtonElement>(
      '[aria-label="Chỉnh sửa nội dung"] button[aria-label^="Sửa "]',
    )
    if (openLore) await click(openLore)
    const loreEditor = document.querySelector<HTMLElement>('[contenteditable="true"]')!
    assert.ok(loreEditor)
    assert.equal(document.querySelector('[aria-label="Các phần nội dung"]'), null)
    assert.doesNotMatch(
      document.querySelector('[aria-label="Chỉnh sửa nội dung"]')!.textContent!,
      /Tên tướng|Danh hiệu|Vai trò|Thêm bản dịch/,
    )
    assert.equal(input("Ghi chú thay đổi").value, "")
    assert.equal(input("Ghi chú thay đổi").disabled, true)
    assert.ok(input("Ghi chú thay đổi").closest('[aria-label="Lưu thay đổi"]')?.contains(button("Lưu phần này")))
    await act(async () => {
      loreEditor.textContent = "A separately saved story."
      loreEditor.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
    })
    await type(input("Ghi chú thay đổi"), "Story note")
    assert.equal(input("Ghi chú thay đổi").disabled, false)
    await click(button("Lưu phần này"))
    await waitFor(() => fixture.writes.length === 3 && !document.querySelector('[aria-label="Chỉnh sửa nội dung"]'))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5050))
    })
    assert.equal(
      fixture.content.PROFILE!.translations[0].name,
      "Saved hero",
      "Saving lore must not publish pending information edits",
    )
    assert.equal(fixture.content.PROFILE!.translations[0].lore, "A separately saved story.")
    assert.match(document.body.textContent!, /Pending profile name/)
    await click(document.querySelector<HTMLButtonElement>('button[aria-label="Chỉnh sửa Thông tin"]')!)
    assert.equal(input("Ghi chú thay đổi").value, "Pending information note")
    await click(button("Hủy chỉnh sửa phần này"))
    assert.equal(fixture.content.PROFILE!.translations[0].lore, "A separately saved story.")
    assert.doesNotMatch(document.body.textContent!, /Pending profile name/)
    const skills = updateTranslation(
      "SKILLS",
      fixtureContent.SKILLS!,
      "passive",
      "en-US",
      "name",
      "Sharp",
    ) as typeof fixtureContent.SKILLS
    assert.deepEqual(skills!.skills[0].translations[0], fixtureContent.SKILLS!.skills[0].translations[0])
    assert.equal(skills!.skills[0].iconAssetId, fixtureContent.SKILLS!.skills[0].iconAssetId)
    const { HeroCatalog } = await import("../src/features/publishing/hero-catalog")
    await act(async () =>
      root.render(
        <MemoryRouter>
          <QueryClientProvider client={cache}>
            <HeroCatalog ruleset="" locale="th-TH" />
          </QueryClientProvider>
        </MemoryRouter>,
      ),
    )
    await waitFor(() => !!document.querySelector('button[aria-label^="Bản dịch airi:"]'))
    const translations = document.querySelector('button[aria-label^="Bản dịch airi:"]')!
    assert.match(translations.getAttribute("aria-label")!, /3 ngôn ngữ có nội dung/)
    assert.equal(
      fixture.content.PROFILE!.translations.find((text) => text.locale === "th-TH")?.name,
      "Unfinished Thai",
      "Canceling information edits must preserve the previously entered Thai translation",
    )
    assert.ok(document.querySelector('a[aria-label="Thêm bản dịch airi"]'))
  } finally {
    await act(async () => root.unmount())
    for (const key of Object.keys(draftRepository.store.getState().slots)) await draftRepository.remove(key)
    await logout()
    cache.clear()
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})

test("translation progress uses exact locale and source tables preserve conflicting labels", async () => {
  const originalReact = Object.getOwnPropertyDescriptor(globalThis, "React")
  Object.defineProperty(globalThis, "React", { configurable: true, writable: true, value: React })
  try {
    const { translationStatus } = await import("../src/features/publishing/hero-translation-status")
    const { heroReviewNotes, SkillSourceDetails } = await import("../src/features/publishing/hero-source-details")
    const { renderToStaticMarkup } = await import("react-dom/server")
    assert.deepEqual(translationStatus(fixtureContent, "vi-VN"), {
      completed: 3,
      total: 3,
      profile: true,
      skills: 1,
      skins: 1,
      exists: true,
      completedFields: 7,
      totalFields: 7,
      missing: [],
    })
    assert.equal(translationStatus(fixtureContent, "en-US").completed, 0)
    const partial = structuredClone(fixtureContent)
    partial.SKILLS!.skills[0].translations.push({ locale: "en-US", name: "Sharp", description: "" })
    assert.equal(translationStatus(partial, "en-US").completed, 0)
    assert.equal(translationStatus(partial, "en-US").exists, true)
    const skill = structuredClone(fixtureContent.SKILLS!.skills[0])
    const note = "Giữ nguyên nhãn ST gốc; không đổi thành hồi chiêu."
    skill.effects = [
      {
        effectType: "SOURCE_SNAPSHOT",
        metadata: {
          cooldown: { seconds: 8 },
          energyCost: { value: 0 },
          levelTable: {
            column_labels: ["Lv 1", "Lv 2"],
            rows: [{ label: "ST gốc", display_values: ["8", "7.6"], review_required: true }],
          },
          reviewFlags: [{ note }],
          heroReviewFlags: [{ status: "unresolved", note }],
        },
      },
    ]
    const html = renderToStaticMarkup(<SkillSourceDetails skill={skill} />)
    assert.match(html, /ST gốc/)
    assert.match(html, /7\.6/)
    assert.match(html, /Tiêu hao: 0/)
    assert.match(html, /Cần đối chiếu/)
    assert.deepEqual(heroReviewNotes([skill, skill]), [note])
  } finally {
    if (originalReact) Object.defineProperty(globalThis, "React", originalReact)
    else Reflect.deleteProperty(globalThis, "React")
  }
})
