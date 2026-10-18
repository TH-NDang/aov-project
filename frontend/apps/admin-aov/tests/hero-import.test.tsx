import assert from "node:assert/strict"
import { test } from "node:test"
import { JSDOM } from "jsdom"
import * as React from "react"
import { act } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { Request } from "../src/features/publishing/publishing-api"

test("import wizard carries patch context and never selects rows without a known baseline", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/publishing" })
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    BroadcastChannel: undefined,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { HeroImport } = await import("../src/features/publishing/hero-import")
  const { createRoot } = await import("react-dom/client")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const activity: { status: string; completed: number; total: number }[] = []
  const calls: { path: string; body: Record<string, unknown> }[] = []
  const request: Request = async <T,>(path: string, init?: RequestInit) => {
    if (path.includes("/upload-sessions/")) return { ...JSON.parse(String(init?.body ?? "{}")), version: 0 } as T
    if (path.endsWith("/relation-fields")) return { skills: [], skins: [] } as T
    if (path.endsWith("/fields"))
      return [
        { key: "name", label: "Tên tướng", type: "text" },
        { key: "roles", label: "Vai trò", type: "json" },
      ] as T
    const body = JSON.parse(String(init?.body))
    calls.push({ path, body })
    if (path.endsWith("/jobs")) {
      if (calls.filter((call) => call.path.endsWith("/jobs")).length === 1) throw new Error("Connection lost")
      return { id: body.id } as T
    }
    const known = body.code === "known"
    return {
      code: body.code,
      heroId: known ? "hero" : null,
      revisionId: known ? "revision" : null,
      version: known ? 2 : null,
      before: { name: "Old", roles: [] },
      after: body.values,
      changed: true,
      classification: known ? "CHANGED" : "INSUFFICIENT_DATA",
      canApply: known,
      sourcePatchVariantId: known ? "previous" : null,
      warnings: known ? [] : ["Chưa có mốc trước để so sánh."],
    } as T
  }
  const click = async (text: string) => {
    const button = [...dom.window.document.querySelectorAll("button")].find((b) => b.textContent?.includes(text))
    assert.ok(button, `Missing button: ${text}`)
    await act(async () => {
      button.click()
      await new Promise((r) => setTimeout(r, 20))
    })
  }
  try {
    await act(async () => {
      root.render(
        <QueryClientProvider client={cache}>
          <HeroImport
            context={{
              contextId: "release",
              regionId: "region",
              regionCode: "VN",
              seasonId: "season",
              seasonName: "S1",
              rulesetId: "ruleset",
              patchVariantId: "variant",
              patchCode: "patch-two",
              rulesetOrdinal: 2,
              effectiveAt: "2026-01-02T00:00:00Z",
            }}
            locale="vi-VN"
            onBusyChange={() => {}}
            onActivityChange={(value) => {
              activity.push(value)
            }}
            request={request}
          />
        </QueryClientProvider>,
      )
      await new Promise((r) => setTimeout(r, 30))
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })
    const radio = dom.window.document.querySelector<HTMLInputElement>('input[value="PATCH_UPDATE"]')!
    await act(async () => {
      radio.click()
    })
    const file = dom.window.document.querySelector<HTMLInputElement>('input[accept=".json,.csv"]')!
    Object.defineProperty(file, "files", {
      value: [
        {
          name: "heroes.json",
          size: 200,
          text: async () =>
            JSON.stringify([
              { code: "known", name: "<script>unsafe</script>", roles: ["ASSASSIN"] },
              { code: "unknown", name: "Unknown", roles: ["ASSASSIN"] },
            ]),
        },
      ],
    })
    await act(async () => {
      file.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
      await new Promise((r) => setTimeout(r, 20))
    })
    await click("Kiểm tra 2")
    assert.match(dom.window.document.body.textContent!, /Thiếu mốc so sánh/)
    assert.match(dom.window.document.body.textContent!, /Lưu 1 bản nháp/)
    assert.equal(dom.window.document.querySelector("script"), null)
    assert.ok(calls.every((c) => c.body.contextId === "release" && c.body.mode === "PATCH_UPDATE"))
    await click("Lưu 1 bản nháp")
    assert.match(dom.window.document.body.textContent!, /Connection lost/)
    await click("Gửi lại cùng tác vụ")
    const submissions = calls.filter((call) => call.path.endsWith("/jobs"))
    assert.equal(submissions.length, 2)
    assert.deepEqual(submissions[0].body, submissions[1].body)
    assert.deepEqual(
      (submissions[0].body.rows as { code: string }[]).map((row) => row.code),
      ["known"],
    )
    assert.equal(
      calls.some((call) => call.path.endsWith("/apply")),
      false,
    )
    assert.match(dom.window.document.body.textContent!, /Đã gửi đến máy chủ/)
    assert.equal(activity.at(-1)?.status, "completed")
    assert.equal(activity.at(-1)?.completed, 1)
    assert.equal(activity.at(-1)?.total, 1)
  } finally {
    await act(async () => root.unmount())
    cache.clear()
    dom.window.close()
    for (const [key, value] of originals) {
      if (value) Object.defineProperty(globalThis, key, value)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})

test("folder import uploads only mapped hero, skill and skin images after confirmation", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/publishing" })
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    BroadcastChannel: undefined,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { HeroImport } = await import("../src/features/publishing/hero-import")
  const { createRoot } = await import("react-dom/client")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const activity: { status: string; completed: number; total: number }[] = []
  const calls: { path: string; body: Record<string, unknown> }[] = []
  const uploads: string[] = []
  const oldFetch = globalThis.fetch
  globalThis.fetch = async (_url, init) => {
    uploads.push((init?.body as File).name)
    return new Response("", { status: 200 })
  }
  let asset = 0
  const request: Request = async <T,>(path: string, init?: RequestInit) => {
    if (path.includes("/upload-sessions/")) return { ...JSON.parse(String(init?.body ?? "{}")), version: 0 } as T
    if (path.endsWith("/relation-fields"))
      return {
        skills: ["skillKey", "kind", "name", "description"]
          .map((key) => ({ key, label: key, type: "text" }))
          .concat([{ key: "iconAssetId", label: "iconAssetId", type: "image" }]),
        skins: ["skinKey", "name"]
          .map((key) => ({ key, label: key, type: "text" }))
          .concat([{ key: "artAssetId", label: "artAssetId", type: "image" }]),
      } as T
    if (path.endsWith("/fields"))
      return [
        { key: "name", label: "Name", type: "text" },
        { key: "portrait", label: "Portrait", type: "image" },
        { key: "skills", label: "Skills", type: "json" },
        { key: "skins", label: "Skins", type: "json" },
      ] as T
    const body = JSON.parse(String(init?.body ?? "{}"))
    calls.push({ path, body })
    if (path.endsWith("/admin/media/assets")) return { id: `asset-${++asset}` } as T
    if (path.endsWith("/version-uploads"))
      return { uploadId: `asset-${asset}`, uploadUrl: "https://storage.test/upload", method: "PUT", headers: {} } as T
    if (path.endsWith("/complete")) return { assetId: `asset-${asset}`, current: true } as T
    if (path.endsWith("/jobs")) return { id: body.id } as T
    return {
      code: body.code,
      revisionId: null,
      version: null,
      before: {},
      after: body.values,
      changed: true,
      classification: "NEW",
      canApply: true,
      warnings: [],
    } as T
  }
  const click = async (text: string) => {
    const button = [...dom.window.document.querySelectorAll("button")].find((b) => b.textContent?.includes(text))
    assert.ok(button, `Missing button: ${text}`)
    await act(async () => {
      button.click()
      await new Promise((r) => setTimeout(r, 20))
    })
  }
  try {
    await act(async () => {
      root.render(
        <QueryClientProvider client={cache}>
          <HeroImport
            context={{
              contextId: "release",
              regionId: "region",
              regionCode: "VN",
              seasonId: "season",
              seasonName: "S1",
              rulesetId: "ruleset",
              patchVariantId: "variant",
              patchCode: "patch-two",
              rulesetOrdinal: 2,
              effectiveAt: "2026-01-02T00:00:00Z",
            }}
            locale="vi-VN"
            onBusyChange={() => {}}
            onActivityChange={(value) => {
              activity.push(value)
            }}
            request={request}
          />
        </QueryClientProvider>,
      )
      await new Promise((r) => setTimeout(r, 30))
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })
    const rows = [
      {
        code: "airi",
        name: "Airi",
        portrait: "../assets/hero.png",
        unused: "../assets/missing.png",
        skills: [
          {
            skillKey: "s1",
            kind: "ACTIVE",
            name: "Skill",
            description: "Description",
            icon: "../assets/skill.png",
            unused: "../assets/missing.png",
          },
        ],
        skins: [{ skinKey: "skin1", name: "Skin", cover: "../assets/skin.png", unused: "../assets/missing.png" }],
      },
    ]
    const files = [
      new File([JSON.stringify(rows)], "heroes.json"),
      ...["hero.png", "skill.png", "skin.png", "unused.png"].map(
        (name) => new File(["bytes"], name, { type: "image/png" }),
      ),
    ]
    files.forEach((file, index) =>
      Object.defineProperty(file, "webkitRelativePath", {
        value: `bundle/${index === 0 ? "data" : "assets"}/${file.name}`,
      }),
    )
    const folder = dom.window.document.querySelector<HTMLInputElement>("input[webkitdirectory]")!
    Object.defineProperty(folder, "files", { value: files })
    await act(async () => {
      folder.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
    })
    const data = [...dom.window.document.querySelectorAll("select")].find((select) =>
      [...select.options].some((o) => o.value === "data/heroes.json"),
    )!
    await act(async () => {
      data.value = "data/heroes.json"
      data.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
      await new Promise((r) => setTimeout(r, 30))
    })
    for (const [label, value] of [
      ["skills: iconAssetId", "icon"],
      ["skins: artAssetId", "cover"],
    ]) {
      const select = dom.window.document.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!
      assert.ok(select)
      await act(async () => {
        select.value = value!
        select.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
      })
    }
    await click("Kiểm tra 1")
    assert.deepEqual(uploads, [])
    assert.ok(!calls.some((c) => c.path.includes("/media/")))
    await click("Lưu 1 bản nháp")
    for (let attempt = 0; attempt < 100 && !calls.some((call) => call.path.endsWith("/jobs")); attempt++) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20))
      })
    }
    assert.deepEqual(uploads, ["hero.png", "skill.png", "skin.png"])
    const job = calls.find((c) => c.path.endsWith("/jobs"))!
    const values = (job.body.rows as { values: Record<string, unknown> }[])[0].values
    assert.equal(values.portrait, "asset-1")
    assert.equal((values.skills as Record<string, unknown>[])[0].iconAssetId, "asset-2")
    assert.equal((values.skins as Record<string, unknown>[])[0].artAssetId, "asset-3")
  } finally {
    globalThis.fetch = oldFetch
    await act(async () => root.unmount())
    cache.clear()
    dom.window.close()
    for (const [key, value] of originals) {
      if (value) Object.defineProperty(globalThis, key, value)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
