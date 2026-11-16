import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { JSDOM } from "jsdom"
import { MemoryRouter } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { Skill, Skills } from "../src/features/publishing/types"
import { createHeroFixture } from "./fixtures/hero-workspace-data"
import { fillReferenceInput, referenceInput, referenceInputValue } from "./fixtures/reference-input"

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
      {
        effectType: "SOURCE_SNAPSHOT",
        metadata: {
          cooldown: { seconds: 0 },
          reviewFlags: [{ note: "Verify" }],
          tags: ["<color=#A94C5D>Vật lý</color>"],
          levelTable: {
            level_axis: "skill_level",
            column_labels: ["Lv1", "Lv2"],
            rows: [{ label: "ST gốc", display_values: ["100", "200"], review_required: true }],
          },
        },
      },
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
  let saved: Skills | undefined
  // The submit handler assigns it, so an assertion on it must not narrow later reads.
  const submitted = () => saved
  let setCurrent: React.Dispatch<React.SetStateAction<Skills>>
  let changeLanguage: React.Dispatch<React.SetStateAction<string>>
  function Harness() {
    const [value, setValue] = React.useState(original)
    const [locale, setLocale] = React.useState("vi-VN")
    changeLanguage = setLocale
    current = value
    setCurrent = setValue
    return (
      <SectionEditor
        section="SKILLS"
        value={value}
        locale={locale}
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
  const settings = () => editor().querySelector<HTMLButtonElement>('[aria-label="Thiết lập kỹ năng"]')!
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
  const openMenu = (trigger: HTMLElement) =>
    act(async () => {
      trigger.dispatchEvent(new dom.window.MouseEvent("pointerdown", { bubbles: true, button: 0 }))
    })
  const menuItem = (text: string) =>
    [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((item) => item.textContent?.startsWith(text))!
  const addSkillIn = async (slot: string) => {
    await openMenu(button("Thêm kỹ năng"))
    await act(async () => menuItem(slot).click())
  }
  const openDescription = async () => {
    const edit = editor().querySelector<HTMLButtonElement>('[aria-label="Sửa Mô tả"]')
    if (edit) await act(async () => edit.click())
  }
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
            <form
              onSubmit={(event) => {
                event.preventDefault()
                saved = current
              }}
            >
              <Harness />
              <button type="submit">Lưu phần này</button>
            </form>
          </MemoryRouter>
        </QueryClientProvider>,
      ),
    )
    assert.equal(
      editor().querySelectorAll('[data-slot="entity-reference-input"]').length,
      1,
      "The description is typed into where it reads",
    )
    assert.equal(editor().querySelector('[aria-label="Kết quả hiển thị · Mô tả"]'), null, "One box: no second preview")
    assert.equal(document.querySelectorAll('[aria-label="Chọn kỹ năng"] [aria-pressed="true"]').length, 1)
    assert.equal(
      document.querySelector('[aria-label="Chọn kỹ năng"] [aria-pressed="true"]')?.getAttribute("aria-label"),
      "Chủ động · Kỹ năng cùng tên · fox",
    )
    assert.equal(settings().getAttribute("aria-expanded"), "false")
    const sources = document.querySelector<HTMLButtonElement>('[aria-label="Nguồn tham khảo (1)"]')!
    await act(async () => sources.click())
    const sourceLabel = () =>
      [...document.querySelectorAll('[role="dialog"] label')]
        .find((label) => label.textContent === "Nhãn nguồn")!
        .querySelector("input")!
    await type(sourceLabel(), "Temporary source")
    await act(async () => button("Hủy").click())
    assert.deepEqual(current.sources, original.sources)
    await act(async () => sources.click())
    assert.equal(sourceLabel().value, original.sources[0].label)
    await type(sourceLabel(), "Updated source")
    await act(async () => button("Áp dụng").click())
    assert.equal(current.sources[0].label, "Updated source")
    assert.equal(submitted(), undefined, "Applying a sheet does not submit the surrounding section form")
    const rail = document.querySelector<HTMLElement>('[aria-label="Chọn kỹ năng"]')!
    Object.defineProperties(rail, { clientWidth: { value: 200 }, scrollWidth: { value: 360 } })
    rail.getBoundingClientRect = () => new dom.window.DOMRect(0, 0, 200, 100)
    const choices = [...rail.querySelectorAll<HTMLButtonElement>("button")]
    choices.forEach((element, position) => {
      element.getBoundingClientRect = () => new dom.window.DOMRect(position * 120 - rail.scrollLeft, 0, 112, 100)
    })
    await act(async () => choices[2].click())
    assert.equal(rail.scrollLeft, 152, "Selecting an offscreen form scrolls only the icon rail")
    assert.equal(nameInput().value, "Kỹ năng cùng tên")
    await act(async () => choices[1].click())
    assert.equal(rail.scrollLeft, 120)
    await type(nameInput(), "Tên riêng dạng cáo")
    assert.equal(current.skills[1].translations[0].name, "Tên riêng dạng cáo")
    assert.deepEqual(current.skills[0], original.skills[0])
    assert.deepEqual(current.skills[2], original.skills[2])
    assert.equal(document.querySelector('[aria-label="Ngôn ngữ chiêu"]'), null)
    await act(async () => changeLanguage("en-US"))
    assert.equal(nameInput().value, "Skill fox")
    await type(nameInput(), "Fox skill")
    assert.equal(current.skills[1].translations[0].name, "Tên riêng dạng cáo")
    assert.equal(current.skills[1].translations[1].name, "Fox skill")
    await openDescription()
    assert.equal(editor().querySelector('[aria-label="Kết quả hiển thị · Mô tả"]'), null, "One box: no second preview")
    const description = referenceInput(editor())
    await act(async () => fillReferenceInput(description, "Updated English description"))
    assert.equal(current.skills[1].translations[1].description, "Updated English description")
    assert.match(description.textContent!, /Updated English description/)
    assert.ok(
      ![...editor().querySelectorAll("summary")].some((summary) => summary.textContent?.includes("Xem trước nội dung")),
    )
    await act(async () => button("Dạng phẳng").click())
    assert.equal(document.querySelectorAll('[aria-label="Kỹ năng đang chỉnh sửa"]').length, 1)
    assert.equal(nameInput().value, "Fox skill")
    await act(async () => button("Tập trung").click())
    await act(async () => button("Sửa bảng").click())
    await type(editor().querySelector<HTMLInputElement>('[aria-label="ST gốc · Cấp 2"]')!, "250")
    const summaryInput = () => editor().querySelector<HTMLInputElement>('[aria-label="ST gốc · Tổng quan"]')!
    assert.equal(summaryInput().value, "100 (+150/cấp chiêu)")
    const beforeFormula = structuredClone(current)
    await type(summaryInput(), "120 +")
    assert.equal(button("Điền các cấp").disabled, true)
    assert.deepEqual(current, beforeFormula, "An incomplete formula must not replace recorded cells")
    await type(summaryInput(), "120 (+40/cấp chiêu)")
    assert.match(document.querySelector('[aria-label="Điền nhanh ST gốc"]')!.textContent!, /120 \/ 160/)
    assert.deepEqual(current, beforeFormula, "Preview remains local until explicitly applied")
    await act(async () => button("Điền các cấp").click())
    assert.equal(editor().querySelector<HTMLInputElement>('[aria-label="ST gốc · Cấp 2"]')!.value, "160")
    await type(summaryInput(), "100 (+150/cấp chiêu)")
    await act(async () => button("Điền các cấp").click())
    await act(async () => button("Xem bảng").click())
    assert.ok(editor().querySelector("table")!.textContent!.includes("100 (+150/cấp chiêu)"))
    await act(async () => button("Thêm nhãn").click())
    const tagInput = [...editor().querySelectorAll<HTMLDivElement>('[data-slot="entity-reference-input"]')].at(-1)!
    await act(async () => fillReferenceInput(tagInput, "Đẩy lùi"))
    assert.equal(
      editor().querySelector('[aria-label="Kết quả hiển thị · Nội dung nhãn"]'),
      null,
      "One box: no second preview",
    )
    assert.equal(referenceInputValue(tagInput), "Đẩy lùi")
    await act(async () => button("Xong").click())
    assert.equal(document.querySelector('input[aria-label="Tải ảnh mới"]'), null, "The image picker opens on demand")
    await act(async () => button("Lưu phần này").click())
    assert.equal(saved?.skills[1].translations[1].description, "Updated English description")
    const expectedEffects = structuredClone(original.skills[1].effects)
    expectedEffects[0].metadata.tags = ["<color=#A94C5D>Vật lý</color>", "Đẩy lùi"]
    expectedEffects[0].metadata.levelTable = {
      level_axis: "skill_level",
      column_labels: ["Lv1", "Lv2"],
      rows: [{ label: "ST gốc", display_values: ["100", "250"], review_required: true }],
    }
    assert.deepEqual(saved?.skills[1].effects, expectedEffects)
    const imageTrigger = editor().querySelector<HTMLButtonElement>('[aria-label="Chỉnh sửa ảnh kỹ năng"]')!
    await act(async () => imageTrigger.click())
    const imageSheet = document.querySelector<HTMLElement>('[role="dialog"]')!
    assert.match(imageSheet.textContent!, /Fox skill/)
    assert.equal(button("Tải ảnh mới").disabled, true, "Uploading still requires image credit")
    assert.ok(imageSheet.querySelector('input[aria-label="Tải ảnh mới"]'), "Selected skill supports direct upload")
    await act(async () => button("Chọn từ kho ảnh").click())
    await waitFor(() => !!document.querySelector('[aria-label="Chọn ảnh skill-icon"]'))
    const downloadUrl = [...imageSheet.querySelectorAll("label")]
      .find((label) => label.textContent?.trim() === "Link file ảnh để tải")!
      .querySelector("input")!
    await type(downloadUrl, "unfinished-url")
    assert.equal(downloadUrl.validity.typeMismatch, true)
    assert.equal(button("Lưu phần này").form!.checkValidity(), true)
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Chọn ảnh skill-icon"]')!.click())
    assert.equal(current.skills[1].iconAssetId, "skill-icon")
    // New uploads must name their owner first.
    const ownerField = [...imageSheet.querySelectorAll("label")]
      .find((label) => label.textContent?.trim() === "Chủ sở hữu / tên cần credit")!
      .querySelector("input")!
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(
        ownerField,
        "Garena / Liên Quân Mobile",
      )
      ownerField.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
    })
    const fileInput = imageSheet.querySelector<HTMLInputElement>('input[aria-label="Tải ảnh mới"]')!
    await act(async () => {
      Object.defineProperty(fileInput, "files", {
        configurable: true,
        value: [new dom.window.File(["image"], "skill.png", { type: "image/png" })],
      })
      fileInput.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
    })
    await waitFor(() => !!finishUpload)
    assert.equal(uploadStates.at(-1), true)
    const closeImage = imageSheet.querySelector<HTMLButtonElement>('[aria-label="Đóng chỉnh sửa ảnh"]')!
    assert.equal(closeImage.disabled, true)
    const firstSkill = document.querySelector<HTMLButtonElement>('[aria-label="Chọn kỹ năng"] button')!
    assert.equal(firstSkill.disabled, true, "Uploads must not attach to another skill after navigation")
    assert.equal(button("Thêm kỹ năng").disabled, true)
    assert.equal(settings().disabled, true)
    await act(async () => firstSkill.click())
    assert.equal(nameInput().value, "Fox skill")
    await act(async () => finishUpload!(new Response(null, { status: 200 })))
    await waitFor(() => current.skills[1].iconAssetId === "uploaded-skill")
    assert.equal(uploadStates.at(-1), false)
    await act(async () => closeImage.click())
    assert.equal(imageTrigger.getAttribute("aria-expanded"), "false")
    assert.equal(firstSkill.disabled, false)
    assert.equal(current.skills[0].iconAssetId, null)
    assert.deepEqual(current.skills[1].effects, expectedEffects)
    assert.deepEqual(current.sources, [{ ...original.sources[0], label: "Updated source" }])
    await act(async () => settings().click())
    // The key is never typed: it follows the slot and the variant chosen.
    const slotSelect = [...document.querySelectorAll('[role="dialog"] label')]
      .find((label) => label.textContent?.startsWith("Ô chiêu"))!
      .querySelector<HTMLSelectElement>("select")!
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, "value")!.set!.call(slotSelect, "2")
      slotSelect.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
    })
    assert.match(document.querySelector('[role="dialog"]')!.textContent!, /skill-2-1/)
    assert.equal(current.skills[1].skillKey, "skill-3")
    await act(async () => button("Áp dụng").click())
    assert.equal(nameInput().value, "Fox skill", "Changing the stable key does not switch or remount the edited form")
    assert.equal(current.skills[1].skillKey, "skill-2-1")
    const beforeAdd = structuredClone(current)
    await addSkillIn("Chiêu 4")
    assert.equal(current.skills.length, 4)
    assert.equal(new Set(current.skills.map((item) => item.skillKey)).size, 4)
    assert.equal(current.skills.at(-1)!.skillKey, "skill-4-1", "A new skill takes its slot's key")
    assert.equal(current.skills[3].displayOrder, 3)
    assert.equal(nameInput().value, "")
    assert.deepEqual(current.skills.slice(0, 3), beforeAdd.skills)
    await act(async () => settings().click())
    await act(async () => button("Bỏ kỹ năng").click())
    assert.equal(current.skills.length, 3)
    assert.deepEqual(current, beforeAdd)
    const formulaSkill = skill("skill-3-1", null, 0)
    formulaSkill.effects[0].metadata.levelTable = {
      column_labels: ["Thông tin công bố"],
      rows: [{ label: "Hồi chiêu", display_values: ["8 - 0.3/cấp chiêu"] }],
    }
    await act(async () => {
      setCurrent!({ skills: [formulaSkill], sources: original.sources })
      changeLanguage("th-TH")
    })
    assert.equal(nameInput().value, "", "A missing translation must not be prefilled with fallback text")
    await act(async () => button("Sửa bảng").click())
    const formula = editor().querySelector<HTMLInputElement>('[aria-label="Hồi chiêu · Tổng quan"]')!
    await type(formula, "7")
    await type(formula, "7 - 0.5/cấp chiêu")
    assert.match(editor().querySelector("tbody")!.textContent!, /6,5/)
    await act(async () => button("Lưu phần này").click())
    assert.deepEqual(saved?.skills[0].translations, formulaSkill.translations)
    assert.deepEqual(saved?.skills[0].effects[0].metadata.levelTable, {
      column_labels: ["Thông tin công bố"],
      rows: [{ label: "Hồi chiêu", display_values: ["7 - 0.5/cấp chiêu"] }],
    })
    const beforeReview = structuredClone(current)
    await act(async () => button("Đối chiếu cảnh báo").click())
    await act(async () => button("Đánh dấu đã đối chiếu").click())
    assert.equal(
      (current.skills[0].effects[0].metadata.reviewFlags as Record<string, unknown>[])[0].reviewResolution,
      "RESOLVED",
    )
    assert.deepEqual(current.skills[0].translations, beforeReview.skills[0].translations)
    await act(async () => button("Mở lại cảnh báo").click())
    assert.deepEqual(current, beforeReview)
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Đóng đối chiếu cảnh báo"]')!.click())
    await act(async () => setCurrent!({ skills: [], sources: original.sources }))
    assert.match(document.body.textContent!, /Chưa có nội dung kỹ năng/)
    await addSkillIn("Chiêu 1")
    assert.equal(current.skills[0].skillKey, "skill-1-1")
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
