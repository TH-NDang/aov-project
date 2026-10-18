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
          initialEntries={[
            translationMode ? "/publishing/fixture-hero/translations?locale=en-US" : "/publishing/fixture-hero",
          ]}
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
  const select = async (node: HTMLSelectElement, value: string) =>
    act(async () => {
      node.value = value
      node.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
    })
  const mainTab = (view: string) => document.querySelector<HTMLButtonElement>(`[aria-controls="workspace-${view}"]`)!
  const readLocale = () => document.querySelector<HTMLSelectElement>('[aria-label="Ngôn ngữ hiển thị nội dung"]')!
  const translationLocale = () =>
    [...document.querySelectorAll("label")]
      .find((label) => label.textContent?.includes("Ngôn ngữ dữ liệu"))!
      .querySelector<HTMLSelectElement>("select")!
  try {
    await verifySession()
    await mount()
    await waitFor(() => !!document.querySelector('[aria-label="Nội dung tướng"]'))
    assert.equal(document.querySelector('[aria-label="Chỉnh sửa nội dung"]'), null)
    assert.match(document.body.textContent!, /Ninja rồng/)
    assert.ok(document.querySelector('[role="tab"][aria-controls="workspace-translations"]'))
    assert.ok(document.querySelector('[role="tab"][aria-controls="workspace-history"]'))
    assert.equal(readLocale().value, "vi-VN")
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
    await type(input("Tên tướng"), "Unsaved hero")
    assert.equal(unsafe, false, "Locally captured edits must not prevent opening another page")
    assert.equal(document.querySelector<HTMLButtonElement>('[aria-controls="workspace-translations"]')!.disabled, false)
    const unload = new dom.window.Event("beforeunload", { cancelable: true })
    dom.window.dispatchEvent(unload)
    assert.equal(unload.defaultPrevented, true)
    await click(mainTab("translations"))
    await select(translationLocale(), "en-US")
    await type(input("Tên · en-US"), "Unfinished English")
    await select(translationLocale(), "th-TH")
    await type(input("Tên · th-TH"), "Unfinished Thai")
    await select(translationLocale(), "en-US")
    assert.equal(input("Tên · en-US").value, "Unfinished English")
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
    await click(button("Hủy chỉnh sửa nhóm này"))
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

    await click(document.querySelector<HTMLButtonElement>('button[aria-label="Chỉnh sửa Thông tin"]')!)
    await type(input("Tên tướng"), "Conflicting hero")
    conflict = true
    await click(button("Lưu phần này"))
    await waitFor(() => !!document.querySelector('[role="alert"]'))
    assert.equal(input("Tên tướng").value, "Conflicting hero")
    assert.equal(unsafe, false)
    conflict = false
    await click(button("Hủy chỉnh sửa nhóm này"))

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
    await type(input("Tên · en-US"), "Airi English")
    await click(button("Lưu phần này"))
    await waitFor(() => fixture.writes.length === 2 && !unsafe)
    assert.deepEqual(fixture.content.PROFILE!.translations[0], original.translations[0])
    assert.equal(fixture.content.PROFILE!.translations.find((text) => text.locale === "en-US")?.name, "Airi English")
    assert.deepEqual(fixture.content.PROFILE!.roles, original.roles)
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
    assert.match(translations.getAttribute("aria-label")!, /2 ngôn ngữ có nội dung/)
    assert.ok(
      !translations.getAttribute("aria-label")!.includes("3 ngôn ngữ"),
      "The Thai display fallback must not count as a translation",
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
