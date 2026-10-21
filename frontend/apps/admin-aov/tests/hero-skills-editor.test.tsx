import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { JSDOM } from "jsdom"
import { MemoryRouter } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { Skill, Skills } from "../src/features/publishing/types"
import { createHeroFixture } from "./fixtures/hero-workspace-data"
import { fillReferenceInput, referenceInput } from "./fixtures/reference-input"

test("focused skill editing preserves forms, effects and translations while adding unique skills and selecting media", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/hero/fixture-hero", pretendToBeVisual: true })
  const fixture = createHeroFixture()
  const requests: string[] = []
  let finishUpload: ((response: Response) => void) | undefined
  const uploadStates: boolean[] = []
  const reportBusy = (busy: boolean) => uploadStates.push(busy)
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input)
    requests.push(url)
    if (url.endsWith("/admin/media/assets") && init?.method === "POST") return Response.json({ id: "uploaded-skill" })
    if (url.endsWith("/admin/media/assets/uploaded-skill/version-uploads"))
      return Response.json({
        uploadId: "skill-upload",
        method: "PUT",
        headers: {},
        uploadUrl: "https://storage.test/held-upload",
      })
    if (url === "https://storage.test/held-upload")
      return new Promise<Response>((resolve) => {
        finishUpload = resolve
      })
    if (url.endsWith("/admin/media/uploads/skill-upload/complete"))
      return Response.json({ assetId: "uploaded-skill", current: true })
    if (url.endsWith("/admin/media/assets/uploaded-skill"))
      return Response.json({ id: "uploaded-skill", currentVersionId: "v1", currentUrl: "/uploaded.webp" })
    if (url.includes("/admin/media/assets?"))
      return Response.json({
        items: [{ id: "skill-icon", state: "ACTIVE", currentVersionId: "v1", currentUrl: "/skill.webp" }],
        totalElements: 1,
      })
    if (url.endsWith("/admin/media/assets/skill-icon"))
      return Response.json({ id: "skill-icon", currentVersionId: "v1", currentUrl: "/skill.webp" })
    if (url.endsWith("/admin/me"))
      return Response.json({
        issuer: "fixture",
        subject: "editor",
        type: "HUMAN",
        displayName: "Editor",
        capabilities: ["catalog:read", "hero:write", "media:write"],
      })
    return fixture.fetcher(input, init)
  }
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    NodeFilter: dom.window.NodeFilter,
    MutationObserver: dom.window.MutationObserver,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    CustomEvent: dom.window.CustomEvent,
    BroadcastChannel: undefined,
    fetch: fetcher,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { createRoot } = await import("react-dom/client")
  const { verifySession, logout } = await import("../src/app/auth/session")
  const { SectionEditor } = await import("../src/features/publishing/section-editor")
  const { nextSkillKey } = await import("../src/features/publishing/hero-skills-editor")
  const skill = (skillKey: string, formKey: string | null, displayOrder: number): Skill => ({
    skillKey,
    formKey,
    displayOrder,
    kind: "ACTIVE",
    iconAssetId: null,
    translations: [
      { locale: "vi-VN", name: "Kỹ năng cùng tên", description: `Mô tả ${formKey}` },
      { locale: "en-US", name: `Skill ${formKey}`, description: `Original ${formKey}` },
    ],
    effects: [
      { effectType: "SOURCE_SNAPSHOT", metadata: { cooldown: { seconds: 0 }, reviewFlags: [{ note: "Verify" }] } },
      { effectType: "DAMAGE", metadata: { values: [100, 200], form: formKey } },
    ],
  })
  const original: Skills = {
    skills: [skill("skill-1", null, 0), skill("skill-3", "fox", 1), skill("skill-2", "human", 2)],
    sources: [
      { label: "Nguồn đã có", sourceUrl: null, observedAt: null, verificationState: "UNVERIFIED", note: "Keep" },
    ],
  }
  const snapshot = structuredClone(original)
  let current = original
  let setCurrent: React.Dispatch<React.SetStateAction<Skills>>
  function Harness() {
    const [value, setValue] = React.useState(original)
    current = value
    setCurrent = setValue
    return (
      <SectionEditor
        section="SKILLS"
        value={value}
        locale="vi-VN"
        initialSkillKey="skill-3"
        onBusyChange={reportBusy}
        onChange={(next) => setValue(next as Skills)}
      />
    )
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const root = createRoot(dom.window.document.getElementById("root")!)
  const document = dom.window.document
  const editor = () => document.querySelector<HTMLElement>('[aria-label="Kỹ năng đang chỉnh sửa"]')!
  const nameInput = () =>
    [...editor().querySelectorAll("label")]
      .find((label) => label.textContent === "Tên chiêu")!
      .querySelector<HTMLInputElement>("input")!
  const button = (text: string) =>
    [...document.querySelectorAll<HTMLButtonElement>("button")].find((element) => element.textContent?.trim() === text)!
  const type = async (element: HTMLInputElement, value: string) =>
    act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(element, value)
      element.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
    })
  const waitFor = async (condition: () => boolean) => {
    for (let attempt = 0; attempt < 100 && !condition(); attempt++)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
      })
    assert.ok(condition())
  }
  try {
    assert.equal(nextSkillKey(original.skills), "skill-4")
    assert.equal(nextSkillKey([original.skills[0], original.skills[1]]), "skill-2")
    await verifySession()
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <Harness />
          </MemoryRouter>
        </QueryClientProvider>,
      ),
    )
    assert.equal(editor().querySelectorAll('[data-slot="entity-reference-input"]').length, 1)
    assert.equal(document.querySelectorAll('[aria-label="Chọn kỹ năng để sửa"] [aria-pressed="true"]').length, 1)
    assert.equal(
      document.querySelector('[aria-label="Chọn kỹ năng để sửa"] [aria-pressed="true"]')?.getAttribute("aria-label"),
      "Chọn sửa kỹ năng 2: Kỹ năng cùng tên",
    )
    assert.equal(
      [...editor().querySelectorAll("summary")]
        .find((element) => element.textContent?.trim() === "Thiết lập kỹ năng")!
        .closest("details")!.open,
      false,
      "Identity fields are secondary",
    )
    const rail = document.querySelector<HTMLElement>('[aria-label="Chọn kỹ năng để sửa"]')!
    rail.getBoundingClientRect = () => new dom.window.DOMRect(0, 0, 200, 100)
    const choices = [...rail.querySelectorAll<HTMLButtonElement>("button")]
    choices.forEach((element, position) => {
      element.getBoundingClientRect = () => new dom.window.DOMRect(position * 120 - rail.scrollLeft, 0, 112, 100)
    })
    await act(async () => choices[2].click())
    assert.equal(rail.scrollLeft, 152, "Selecting an offscreen form scrolls only the icon rail")
    assert.equal(editor().querySelector("h3")?.textContent, "Kỹ năng cùng tên")
    await act(async () => choices[1].click())
    assert.equal(rail.scrollLeft, 120)
    await type(nameInput(), "Tên riêng dạng cáo")
    assert.equal(current.skills[1].translations[0].name, "Tên riêng dạng cáo")
    assert.deepEqual(current.skills[0], original.skills[0])
    assert.deepEqual(current.skills[2], original.skills[2])
    const language = document.querySelector<HTMLSelectElement>('[aria-label="Ngôn ngữ chiêu"]')!
    await act(async () => {
      language.value = "en-US"
      language.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
    })
    assert.equal(nameInput().value, "Skill fox")
    await type(nameInput(), "Fox skill")
    assert.equal(current.skills[1].translations[0].name, "Tên riêng dạng cáo")
    assert.equal(current.skills[1].translations[1].name, "Fox skill")
    const description = referenceInput(editor())
    await act(async () => fillReferenceInput(description, "Updated English description"))
    assert.equal(current.skills[1].translations[1].description, "Updated English description")
    await act(async () =>
      [...editor().querySelectorAll("summary")]
        .find((element) => element.textContent?.trim() === "Ảnh kỹ năng")!
        .click(),
    )
    assert.ok(editor().querySelector('input[aria-label="Tải ảnh mới"]'), "Selected skill supports direct upload")
    await act(async () => button("Chọn từ kho ảnh").click())
    await waitFor(() => !!document.querySelector('[aria-label="Chọn ảnh skill-icon"]'))
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Chọn ảnh skill-icon"]')!.click())
    assert.equal(current.skills[1].iconAssetId, "skill-icon")
    const fileInput = editor().querySelector<HTMLInputElement>('input[aria-label="Tải ảnh mới"]')!
    await act(async () => {
      Object.defineProperty(fileInput, "files", {
        configurable: true,
        value: [new dom.window.File(["image"], "skill.png", { type: "image/png" })],
      })
      fileInput.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
    })
    await waitFor(() => !!finishUpload)
    assert.equal(uploadStates.at(-1), true)
    const firstSkill = document.querySelector<HTMLButtonElement>('[aria-label="Chọn kỹ năng để sửa"] button')!
    assert.equal(firstSkill.disabled, true, "Uploads must not attach to another skill after navigation")
    assert.equal(button("Thêm kỹ năng").disabled, true)
    assert.equal(button("Bỏ kỹ năng").disabled, true)
    await act(async () => firstSkill.click())
    assert.equal(nameInput().value, "Fox skill")
    await act(async () => finishUpload!(new Response(null, { status: 200 })))
    await waitFor(() => current.skills[1].iconAssetId === "uploaded-skill")
    assert.equal(uploadStates.at(-1), false)
    assert.equal(firstSkill.disabled, false)
    assert.equal(current.skills[0].iconAssetId, null)
    assert.deepEqual(current.skills[1].effects, original.skills[1].effects)
    assert.deepEqual(current.sources, original.sources)
    const keyInput = [...editor().querySelectorAll("label")]
      .find((label) => label.textContent === "Khóa kỹ năng")!
      .querySelector<HTMLInputElement>("input")!
    await type(keyInput, "renamed-fox")
    assert.equal(nameInput().value, "Fox skill", "Changing the stable key does not switch or remount the edited form")
    assert.equal(current.skills[1].skillKey, "renamed-fox")
    const beforeAdd = structuredClone(current)
    await act(async () => button("Thêm kỹ năng").click())
    assert.equal(current.skills.length, 4)
    assert.equal(new Set(current.skills.map((item) => item.skillKey)).size, 4)
    assert.equal(current.skills[3].skillKey, "skill-3")
    assert.equal(current.skills[3].displayOrder, 3)
    assert.equal(nameInput().value, "")
    assert.deepEqual(current.skills.slice(0, 3), beforeAdd.skills)
    await act(async () => button("Bỏ kỹ năng").click())
    assert.equal(current.skills.length, 3)
    assert.deepEqual(current, beforeAdd)
    await act(async () => setCurrent!({ skills: [], sources: original.sources }))
    assert.match(document.body.textContent!, /Chưa có kỹ năng/)
    await act(async () => button("Thêm kỹ năng").click())
    assert.equal(current.skills[0].skillKey, "skill-1")
    assert.equal(current.skills[0].formKey, null, "No missing form is inferred")
    assert.deepEqual(current.sources, original.sources)
    assert.deepEqual(original, snapshot, "Editing must never mutate the input snapshot")
    assert.equal(
      requests.some((url) => /\/drafts\//.test(url)),
      false,
      "Selection and local typing never save automatically",
    )
  } finally {
    await act(async () => root.unmount())
    client.clear()
    await logout()
    await new Promise((resolve) => setTimeout(resolve, 20))
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
