import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import type { SecondaryContent } from "../src/features/warehouse/components/secondary-editor"
import type { WarehouseEntry, WarehouseRevision } from "../src/features/warehouse/model/warehouse-types"
import type { SpellContent } from "@aov/ui/lib/warehouse-content"
import { withWarehouseUi, fixtureRevision } from "./fixtures/warehouse-ui"

test("creating a spell uploads its icon from the information tab and saves the completed media reference", async () => {
  await withWarehouseUi(async ({ document, requests, render, upload, click }) => {
    const { SecondaryEditor, newSecondaryContent } =
      await import("../src/features/warehouse/components/secondary-editor")
    const content = newSecondaryContent("spells", "vi-VN")
    content.translations[0].name = "Phụ trợ mới"
    let saved: SecondaryContent | undefined
    await render(
      <SecondaryEditor
        kind="spells"
        code="new-spell"
        content={content}
        branches={[]}
        locale="vi-VN"
        isNew
        rulesetId="standard"
        onClose={() => {}}
        onSave={async (_code, value) => {
          saved = value
        }}
      />,
    )
    assert.equal(document.querySelector('[role="tab"][data-state="active"]')?.textContent?.trim(), "Nội dung")
    assert.ok([...document.querySelectorAll("button")].some((button) => button.textContent?.trim() === "Tải ảnh mới"))
    await upload(new File([new Uint8Array([137, 80, 78, 71])], "new-spell.png", { type: "image/png" }))
    assert.ok(
      requests.includes("/admin/media/assets/uploaded-icon/version-uploads"),
      JSON.stringify({ requests, error: document.querySelector('[role="alert"]')?.textContent }),
    )
    assert.ok(requests.includes("/fixture-upload"))
    assert.ok(requests.includes("/admin/media/uploads/fixture-upload/complete"))
    assert.ok(document.body.textContent?.includes("Asset đã chọn: uploaded-icon"))
    await click("Lưu nháp")
    assert.equal(saved?.iconAssetId, "uploaded-icon")
  })
})

test("editing one spell translation preserves other locales, mechanics, states and artwork; published views cannot upload", async () => {
  await withWarehouseUi(async ({ document, render, tab, name, click }) => {
    const window = document.defaultView!
    const { SecondaryEditor } = await import("../src/features/warehouse/components/secondary-editor")
    const content: SecondaryContent = {
      iconAssetId: "spell-icon",
      notes: "Evidence",
      cooldownSeconds: 90,
      unlockType: "ACCOUNT_CREATION",
      unlockLevel: null,
      availability: "AVAILABLE",
      legacy: false,
      displayOrder: 2,
      maxCharges: 2,
      chargeRechargeSeconds: 45,
      defaultStateKey: "empowered",
      referenceImages: [{ assetId: "reference-icon", notes: "Alternate artwork" }],
      translations: [
        { locale: "vi-VN", name: "Tốc hành", summary: "Di chuyển", description: "Tăng tốc chạy" },
        { locale: "en-US", name: "Sprint", summary: "Movement", description: "Increase movement speed" },
      ],
      states: [
        {
          key: "empowered",
          iconAssetId: "state-icon",
          translations: [{ locale: "vi-VN", name: "Cường hóa", description: "Trạng thái nâng cấp" }],
        },
      ],
    }
    const before = structuredClone(content)
    let saved: SecondaryContent | undefined
    let savedPatch: string | null | undefined
    const props = {
      kind: "spells" as const,
      code: "sprint",
      content,
      branches: [],
      locale: "vi-VN",
      isNew: false,
      rulesetId: "standard",
      initialPatchId: "patch-fixture",
      onClose() {},
      onSave: async (_code: string, value: SecondaryContent, patchId: string | null) => {
        saved = value
        savedPatch = patchId
      },
    }
    await render(<SecondaryEditor {...props} />)
    // The language icon at the top sets what the page reads and edits in; its menu tells the progress.
    await act(async () => {
      document
        .querySelector('button[aria-label="Ngôn ngữ: Tiếng Việt (Việt Nam)"]')!
        .dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    })
    // Each language row shows its flag, how far it is translated and its own pencil, as on the hero page.
    const english = [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find((item) =>
      item.textContent?.includes("Tiếng Anh (Mỹ)"),
    )!
    assert.match(english.textContent!, /Đủ nội dung|Thiếu \d+ mục/)
    assert.match(english.textContent!, /\d+\/\d+/)
    assert.ok(document.querySelector('[role="menuitem"][aria-label="Sửa bằng Tiếng Anh (Mỹ)"]'))
    await act(async () => english.click())
    assert.match(document.querySelector("#secondary-section-overview")?.textContent ?? "", /Increase movement speed/)
    await click("Sửa phụ trợ")
    // Writing English shows the same field in another language the spell has, Vietnamese here.
    assert.match(document.querySelector('[aria-label="Nội dung tham khảo"]')?.textContent ?? "", /Tốc hành/)
    await name("Sprint revised")
    await click("Lưu nháp")
    assert.ok(saved)
    assert.equal(saved.translations.find((text) => text.locale === "en-US")?.name, "Sprint revised")
    assert.deepEqual(
      saved.translations.find((text) => text.locale === "vi-VN"),
      before.translations[0],
    )
    assert.deepEqual({ ...saved, translations: before.translations }, before)
    assert.equal(savedPatch, "patch-fixture")
    assert.deepEqual(content, before)
    await render(<SecondaryEditor key="published" {...props} readOnly />)
    await tab("Ảnh")
    assert.equal(document.querySelector('input[type="file"]'), null)
    assert.equal(
      [...document.querySelectorAll("button")].some((button) => button.textContent?.includes("Chọn / tải ảnh")),
      false,
    )
  })
})

test("spell cards expose both state icons, open details and collapse legacy entries without hiding filtered results", async () => {
  await withWarehouseUi(async ({ document, client, render }) => {
    const { SpellCollection } = await import("../src/features/warehouse/components/spell-cards")
    const entry: WarehouseEntry<SpellContent> = {
      id: "punish",
      code: "trung-tri",
      changeKinds: ["INHERITED", "BUFF"],
      revision: {
        id: "revision",
        ownerId: "punish",
        code: "trung-tri",
        rulesetId: "standard",
        revisionNo: 1,
        state: "DRAFT",
        version: 1,
        publicationSequence: null,
        publishedAt: null,
        cause: "DATA_BASELINE",
        effectiveFromPatchVariantId: null,
        sourceRevisionId: null,
        createdAt: "2026-10-18",
        updatedAt: "2026-10-18",
      },
      content: {
        iconAssetId: "normal-icon",
        translations: [{ locale: "vi-VN", name: "Trừng trị" }],
        notes: null,
        cooldownSeconds: 10,
        unlockLevel: 1,
        availability: "AVAILABLE",
        legacy: false,
        displayOrder: 1,
        states: [
          { key: "normal", iconAssetId: "normal-icon", translations: [{ locale: "vi-VN", name: "Trừng trị thường" }] },
          { key: "chill", iconAssetId: "chill-icon", translations: [{ locale: "vi-VN", name: "Trừng trị tê tái" }] },
        ],
      },
    }
    const removed: WarehouseEntry<SpellContent> = {
      ...entry,
      id: "legacy",
      code: "legacy",
      content: {
        ...entry.content,
        translations: [{ locale: "vi-VN", name: "Phụ trợ đã gỡ" }],
        availability: "REMOVED",
        cooldownSeconds: null,
        states: [],
      },
    }
    for (const id of ["normal-icon", "chill-icon"]) {
      client.setQueryData(["media", "asset", id, "content"], { id, currentUrl: `/${id}.webp` })
    }
    let opened: string | undefined
    const props = {
      records: [entry, removed, { ...entry, id: "first", content: { ...entry.content, states: [], displayOrder: 0 } }],
      locale: "vi-VN",
      selectedId: "",
      onOpen: (value: WarehouseEntry<SpellContent>) => {
        opened = value.id
      },
    }
    await render(<SpellCollection {...props} />)
    assert.deepEqual(
      [...document.querySelectorAll("[data-spell-card]")].map((el) => el.getAttribute("data-spell-card")),
      ["first", "punish"],
    )
    const card = document.querySelector<HTMLElement>('[data-spell-card="punish"]')!
    assert.equal(card.querySelector('[data-catalog-change="INHERITED"]'), null)
    assert.ok(card.querySelector('[data-catalog-change="BUFF"]'))
    const openButton = card.querySelector<HTMLButtonElement>('button[aria-label="Xem Trừng trị"]')!
    assert.ok(card)
    // The whole card opens the details; the repeated open hint is gone, the accessible label remains.
    assert.ok(openButton)
    assert.doesNotMatch(card.textContent!, /Xem chi tiết/)
    assert.equal(card.textContent!.match(/Trừng trị/g)?.length, 1)
    assert.equal(card.querySelector('[role="img"][aria-label="Hồi chiêu 10 giây"]')?.textContent, "10 s")
    assert.doesNotMatch(card.textContent!, /Hồi chiêu/)
    assert.doesNotMatch(card.textContent!, /Lv 1|Đang có/)
    assert.deepEqual(
      [...card.querySelectorAll("img")].map((image) => [image.alt, image.getAttribute("src")]).sort(),
      [
        ["Trừng trị thường", "/normal-icon.webp"],
        ["Trừng trị tê tái", "/chill-icon.webp"],
      ].sort(),
    )
    for (const button of card.querySelectorAll("button")) assert.equal(button.querySelector("button"), null)
    const switchButton = card.querySelector<HTMLButtonElement>('button[aria-label="Chuyển sang Trừng trị tê tái"]')!
    assert.ok(switchButton)
    await act(async () => switchButton.click())
    assert.equal(card.querySelector('[aria-live="polite"]')?.textContent, "Trừng trị tê tái")
    assert.equal(card.textContent!.match(/Trừng trị/g)?.length, 1)
    assert.ok(card.querySelector('button[aria-label="Chuyển sang Trừng trị thường"]'))
    assert.equal(opened, undefined)
    assert.equal(entry.content.defaultStateKey, undefined)
    await act(async () => openButton.click())
    assert.equal(opened, "punish")
    const toggle = document.querySelector<HTMLButtonElement>('[data-slot="collapsible-trigger"]')!
    assert.equal(toggle.getAttribute("aria-expanded"), "false")
    assert.equal(document.querySelector('button[aria-label="Xem Phụ trợ đã gỡ"]'), null)
    await act(async () => toggle.click())
    assert.equal(toggle.getAttribute("aria-expanded"), "true")
    assert.ok(document.querySelector('button[aria-label="Xem Phụ trợ đã gỡ"]'))
    assert.equal(document.querySelector('[role="img"][aria-label="Chưa rõ hồi chiêu"]')?.textContent, "—")
    await act(async () => toggle.click())
    assert.equal(toggle.getAttribute("aria-expanded"), "false")
    await render(<SpellCollection {...props} selectedId={removed.id} />)
    assert.equal(toggle.getAttribute("aria-expanded"), "true")
    const published = { ...removed, revision: { ...removed.revision, state: "PUBLISHED" as const } }
    await render(<SpellCollection {...props} records={[entry, published]} />)
    const archivedCard = document.querySelector<HTMLElement>('[data-spell-card="legacy"]')!
    assert.match(archivedCard.textContent!, /Chưa rõ patch/)
    assert.doesNotMatch(archivedCard.textContent!, /Nháp/)
    await render(<SpellCollection key="filtered" {...props} records={[removed]} revealLegacy />)
    assert.equal(document.querySelector('[data-slot="collapsible-trigger"]')?.getAttribute("aria-expanded"), "true")
    assert.ok(document.querySelector('button[aria-label="Xem Phụ trợ đã gỡ"]'))
    const { SecondaryEditor } = await import("../src/features/warehouse/components/secondary-editor")
    await render(
      <SecondaryEditor
        kind="spells"
        code={entry.code}
        content={entry.content}
        branches={[]}
        locale="vi-VN"
        isNew={false}
        rulesetId="standard"
        readOnly
        onClose={() => {}}
        onSave={async () => {}}
      />,
    )
    const detailSwitch = document.querySelector<HTMLButtonElement>('button[aria-label="Chuyển sang Trừng trị tê tái"]')!
    assert.ok(detailSwitch)
    for (const image of document.querySelectorAll('img[alt^="Trừng trị"]')) {
      assert.ok(image.parentElement?.classList.contains("rounded-full"))
    }
    await act(async () => detailSwitch.click())
    assert.equal(document.querySelector('[aria-live="polite"]')?.textContent, "Trừng trị tê tái")
  })
})

test("archived spells stay separate, gameplay revisions require a patch, and later removal history needs a source", async () => {
  await withWarehouseUi(async ({ document, render, click, tab }) => {
    const { SecondaryEditor, newSecondaryContent } =
      await import("../src/features/warehouse/components/secondary-editor")
    const content = newSecondaryContent("spells", "vi-VN")
    content.translations[0] = { locale: "vi-VN", name: "Phụ trợ cũ", description: "Mô tả lịch sử" }
    Object.assign(content, {
      legacy: true,
      availability: "REMOVED",
      cooldownSeconds: 90,
      unlockType: "ACCOUNT_CREATION",
      iconAssetId: "spell-icon",
    })
    let published = 0
    const props = {
      kind: "spells" as const,
      code: "legacy",
      content,
      branches: [],
      locale: "vi-VN",
      isNew: false,
      rulesetId: "standard",
      canPublish: true,
      missingFields: ["effectiveFromPatchVariantId"],
      onClose() {},
      onSave: async () => {},
      onPublish: async () => {
        published++
      },
    }
    await render(<SecondaryEditor {...props} />)
    await tab("Lịch sử")
    assert.match(document.body.textContent ?? "", /Chưa rõ patch · hồ sơ lưu trữ/)
    await click("Xuất bản")
    assert.equal(published, 1)
    await render(
      <SecondaryEditor
        key="active"
        {...props}
        revisionCause="GAME_PATCH"
        content={{ ...content, availability: "AVAILABLE" }}
      />,
    )
    const publishButton = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.trim() === "Xuất bản",
    )!
    assert.equal(publishButton.disabled, true)
    const { SpellRemovalHistory } = await import("../src/features/warehouse/components/spell-removal-history")
    await render(
      <SpellRemovalHistory id="legacy" revisionId="legacy-revision" rulesetId="standard" published canPublish />,
    )
    await click("Thêm mốc loại bỏ")
    const recordButton = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.trim() === "Ghi nhận lịch sử",
    )!
    assert.equal(recordButton.disabled, true)
    await act(async () => {
      const patch = document.querySelector<HTMLSelectElement>('[aria-label="Patch loại bỏ"]')!
      patch.value = "patch-fixture"
      patch.dispatchEvent(new window.Event("change", { bubbles: true }))
      const source = [...document.querySelectorAll("label")]
        .find((label) => label.textContent?.trim() === "Liên kết nguồn xác nhận")!
        .querySelector("input")!
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!.call(
        source,
        "https://example.com/evidence",
      )
      source.dispatchEvent(new window.Event("input", { bubbles: true }))
    })
    assert.equal(recordButton.disabled, false)
    await click("Ghi nhận lịch sử")
    for (let attempt = 0; attempt < 100 && !document.body.textContent?.includes("Đã loại bỏ · 2026-10-15"); attempt++) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
      })
    }
    assert.ok(document.body.textContent?.includes("Đã loại bỏ · 2026-10-15"))
    assert.equal(document.querySelector('a[href="https://example.com/evidence"]')?.getAttribute("rel"), "noreferrer")
  })
})

test("baseline spell publication needs no invented patch and corrections retain their unscoped baseline", async () => {
  await withWarehouseUi(async ({ document, render, click, tab }) => {
    const { SecondaryEditor, newSecondaryContent } =
      await import("../src/features/warehouse/components/secondary-editor")
    const content = newSecondaryContent("spells", "vi-VN")
    content.translations[0] = { locale: "vi-VN", name: "Tốc hành", description: "Tăng tốc chạy" }
    Object.assign(content, {
      availability: "AVAILABLE",
      cooldownSeconds: 90,
      unlockType: "ACCOUNT_CREATION",
      iconAssetId: "spell-icon",
    })
    let published = 0
    const props = {
      kind: "spells" as const,
      code: "sprint",
      content,
      branches: [],
      locale: "vi-VN",
      isNew: false,
      rulesetId: "standard",
      canPublish: true,
      onClose() {},
      onSave: async () => {},
      onPublish: async () => {
        published++
      },
    }
    await render(<SecondaryEditor {...props} missingFields={["effectiveFromPatchVariantId"]} allowPatchChange />)
    await tab("Lịch sử")
    assert.match(document.querySelector('[role="status"]')?.textContent ?? "", /Chưa rõ patch · bản nhập dữ liệu/)
    await click("Sửa phụ trợ")
    assert.match(document.body.textContent ?? "", /không phải xác nhận mục được thêm ở mùa hiện tại/)
    await click("Xuất bản")
    assert.equal(published, 1)

    await render(
      <SecondaryEditor
        key="correction"
        {...props}
        revisionCause="CONTENT_CORRECTION"
        sourceRevisionId="published-baseline"
      />,
    )
    await tab("Lịch sử")
    assert.match(document.querySelector('[role="status"]')?.textContent ?? "", /giữ theo bản nhập dữ liệu trước/)
    await click("Sửa phụ trợ")
    assert.equal(document.querySelector<HTMLSelectElement>('[aria-label="Áp dụng từ patch"]')?.disabled, true)
    await click("Xuất bản")
    assert.equal(published, 2)

    await render(
      <SecondaryEditor
        key="gameplay"
        {...props}
        revisionCause="GAME_PATCH"
        missingFields={["effectiveFromPatchVariantId"]}
      />,
    )
    const publishButton = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.trim() === "Xuất bản",
    )!
    assert.equal(publishButton.disabled, true)
  })
})

test("patch history can compare published unscoped baselines without offering drafts, future or archived spells", async () => {
  await withWarehouseUi(
    async ({ document, client, render }) => {
      const { WarehouseChangeHistory } = await import("../src/features/warehouse/components/warehouse-change-history")
      const baseline = {
        ...fixtureRevision("baseline"),
        id: "baseline",
        ownerId: "spell",
        code: "spell",
        state: "PUBLISHED" as const,
        archived: false,
      }
      const revisions: WarehouseRevision[] = [
        baseline,
        { ...baseline, id: "correction", cause: "CONTENT_CORRECTION", sourceRevisionId: "baseline", revisionNo: 2 },
        { ...baseline, id: "draft", state: "DRAFT" },
        { ...baseline, id: "archived", archived: true },
        { ...baseline, id: "another-ruleset", rulesetId: "regional" },
        { ...baseline, id: "earlier", cause: "GAME_PATCH", effectiveFromPatchVariantId: "earlier-patch" },
        { ...baseline, id: "target", cause: "GAME_PATCH", effectiveFromPatchVariantId: "patch-fixture" },
        { ...baseline, id: "future", cause: "GAME_PATCH", effectiveFromPatchVariantId: "future-patch" },
      ]
      client.setQueryDefaults(["warehouse", "history"], { staleTime: Infinity })
      client.setQueryDefaults(["publication-overview"], { staleTime: Infinity })
      client.setQueryData(["warehouse", "history", "spells", "spell"], revisions)
      client.setQueryData(["warehouse", "changes", "spells", "standard", "vi-VN"], [])
      client.setQueryData(["publication-overview"], {
        seasons: [],
        variants: [
          { id: "earlier-patch", patchCode: "Trước", rulesetId: "standard", rulesetOrdinal: 1, status: "PUBLISHED" },
          { id: "patch-fixture", patchCode: "Hiện tại", rulesetId: "standard", rulesetOrdinal: 2, status: "PUBLISHED" },
          { id: "future-patch", patchCode: "Sau", rulesetId: "standard", rulesetOrdinal: 3, status: "PUBLISHED" },
        ],
      })
      await render(<WarehouseChangeHistory kind="spells" entryId="spell" rulesetId="standard" locale="vi-VN" />)
      // One timeline node per patch, newest first; versions without a patch come last.
      const nodes = [...document.querySelectorAll<HTMLElement>('[aria-label="Dòng thời gian theo patch"] > li')]
      assert.deepEqual(
        nodes.map((node) => node.querySelector("p")?.textContent),
        ["Sau", "Hiện tại", "Trước", "Chưa rõ patch"],
      )
      const current = nodes.find((node) => node.textContent?.includes("Hiện tại"))!
      await act(async () =>
        [...current.querySelectorAll("button")]
          .find((button) => button.textContent?.includes("Ghi nhận thay đổi"))!
          .click(),
      )
      assert.equal(document.querySelector<HTMLSelectElement>('[aria-label="Bản dữ liệu đã xuất bản"]')?.value, "target")
      const choose = async (label: string, value: string) =>
        act(async () => {
          const select = document.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`)!
          select.value = value
          select.dispatchEvent(new window.Event("change", { bubbles: true }))
        })
      await choose("Bản dữ liệu đã xuất bản", "target")
      const options = () => [
        ...document.querySelectorAll<HTMLOptionElement>('[aria-label="Bản trước để đối chiếu"] option'),
      ]
      assert.deepEqual(
        options().map((option) => option.value),
        ["", "baseline", "correction", "earlier"],
      )
      assert.match(
        options().find((option) => option.value === "baseline")?.textContent ?? "",
        /v1 · Nhập dữ liệu, chưa rõ patch/,
      )

      await choose("Bản dữ liệu đã xuất bản", "baseline")
      assert.equal(
        options().some((option) => option.value === "baseline"),
        false,
      )
    },
    ["spell:write", "spell:publish", "patch:write"],
  )
})
