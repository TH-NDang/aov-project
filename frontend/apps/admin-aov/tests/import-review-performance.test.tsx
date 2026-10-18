import assert from "node:assert/strict"
import { test } from "node:test"
import { JSDOM } from "jsdom"
import * as React from "react"
import { act } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { Request } from "../src/features/publishing/publishing-api"

test("large import plans mount nested diffs and image paths only while their disclosure is open", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/publishing/import" })
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    BroadcastChannel: undefined,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async () => {
      throw new Error("Reviewing plans must not upload or fetch images")
    },
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { HeroImport } = await import("../src/features/publishing/hero-import")
  const { createRoot } = await import("react-dom/client")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const codes = ["airi", "aleister"]
  const rows = codes.map((code) => ({
    code,
    name: code,
    skills: Array.from({ length: 8 }, (_, index) => ({
      skillKey: `skill-${index}`,
      kind: index === 0 ? "PASSIVE" : "ACTIVE",
      name: `Skill ${index}`,
      description: `AFTER-${code}-${index} ` + "A long captured description. ".repeat(80),
      iconAssetId: `https://images.invalid/${code}/skill-${index}.png`,
      effects: [
        {
          effectType: "SOURCE_SNAPSHOT",
          metadata: {
            marker: `METADATA-${code}-${index}`,
            levelTable: {
              column_labels: ["Lv 1", "Lv 2", "Lv 3", "Lv 4", "Lv 5", "Lv 6"],
              rows: Array.from({ length: 16 }, (_, row) => ({
                label: `Literal row ${row}`,
                display_values: ["8", "7.6", "7.2", "6.8", "6.4", "6"],
                review_required: true,
              })),
            },
          },
        },
      ],
    })),
    skins: Array.from({ length: 3 }, (_, index) => ({
      skinKey: `skin-${index}`,
      name: `Skin ${index}`,
      artAssetId: `https://images.invalid/${code}/skin-${index}.png`,
    })),
  }))
  const requests: string[] = []
  const request: Request = async <T,>(path: string, init?: RequestInit) => {
    requests.push(path)
    if (path.endsWith("/relation-fields"))
      return {
        skills: ["skillKey", "kind", "name", "description"]
          .map((key) => ({ key, label: key, type: "text" }))
          .concat([
            { key: "iconAssetId", label: "Skill image", type: "image" },
            { key: "effects", label: "Source snapshot", type: "json" },
          ]),
        skins: [
          { key: "skinKey", label: "Skin code", type: "text" },
          { key: "name", label: "Name", type: "text" },
          { key: "artAssetId", label: "Artwork", type: "image" },
        ],
      } as T
    if (path.endsWith("/fields"))
      return [
        { key: "name", label: "Name", type: "text" },
        { key: "skills", label: "Skills", type: "json" },
        { key: "skins", label: "Skins", type: "json" },
      ] as T
    assert.ok(path.endsWith("/preview"), `Review must not write data: ${path}`)
    const body = JSON.parse(String(init?.body)) as { code: string; values: Record<string, unknown> }
    const before = structuredClone(body.values)
    const skills = before.skills as { translations: { description: string }[] }[] | undefined
    skills?.forEach((skill, index) => {
      skill.translations[0].description = `BEFORE-${body.code}-${index}`
    })
    return {
      code: body.code,
      heroId: body.code,
      revisionId: `${body.code}-draft`,
      version: 3,
      before,
      after: body.values,
      changed: true,
      classification: "CHANGED",
      canApply: true,
      warnings: [],
    } as T
  }
  const document = dom.window.document
  const waitFor = async (condition: () => boolean) => {
    for (let attempt = 0; attempt < 150 && !condition(); attempt++)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5))
      })
    assert.ok(condition(), "Expected import review state was not reached")
  }
  const toggle = async (details: HTMLDetailsElement, open: boolean) =>
    act(async () => {
      details.open = open
      details.dispatchEvent(new dom.window.Event("toggle"))
    })
  const disclosure = (article: Element, text: string) =>
    [...article.querySelectorAll<HTMLDetailsElement>("details")].find((node) =>
      node.querySelector("summary")?.textContent?.includes(text),
    )!
  try {
    await act(async () =>
      root.render(
        <QueryClientProvider client={cache}>
          <HeroImport
            context={{
              contextId: "release",
              regionId: "region",
              regionCode: "VN",
              seasonId: "season",
              seasonName: "S3 2026",
              rulesetId: "rules",
              patchVariantId: "patch",
              patchCode: "before-s4",
              rulesetOrdinal: 3,
              effectiveAt: null,
            }}
            locale="vi-VN"
            request={request}
            onBusyChange={() => {}}
          />
        </QueryClientProvider>,
      ),
    )
    await waitFor(() => requests.some((path) => path.endsWith("/relation-fields")))
    const file = document.querySelector<HTMLInputElement>('input[accept=".json,.csv"]')!
    Object.defineProperty(file, "files", {
      value: [{ name: "large-plans.json", size: JSON.stringify(rows).length, text: async () => JSON.stringify(rows) }],
    })
    await act(async () => file.dispatchEvent(new dom.window.Event("change", { bubbles: true })))
    await waitFor(() =>
      [...document.querySelectorAll("button")].some((button) => button.textContent?.includes("Kiểm tra 2")),
    )
    await act(async () =>
      [...document.querySelectorAll<HTMLButtonElement>("button")]
        .find((button) => button.textContent?.includes("Kiểm tra 2"))!
        .click(),
    )
    await waitFor(() => document.querySelectorAll("article").length === 2)
    assert.equal(requests.filter((path) => path.endsWith("/preview")).length, 4)
    const articles = [...document.querySelectorAll("article")]
    assert.equal(document.querySelectorAll("dl").length, 0)
    assert.ok(!document.body.textContent!.includes("METADATA-airi-0"))
    assert.ok(!document.body.textContent!.includes("AFTER-airi-0"))
    assert.ok(!document.body.textContent!.includes("BEFORE-airi-0"))
    assert.ok(!document.body.textContent!.includes("https://images.invalid/"))
    assert.equal(disclosure(articles[0], "Sẽ upload").querySelector("ul"), null)
    assert.equal(disclosure(articles[1], "Sẽ upload").querySelector("ul"), null)

    const firstDiff = disclosure(articles[0], "trường khác biệt")
    await toggle(firstDiff, true)
    assert.ok(firstDiff.querySelectorAll("dl").length > 50)
    assert.match(firstDiff.textContent!, /METADATA-airi-0/)
    assert.match(firstDiff.textContent!, /AFTER-airi-0/)
    assert.match(firstDiff.textContent!, /BEFORE-airi-0/)
    assert.ok(!articles[1].textContent!.includes("METADATA-aleister-0"))
    assert.equal(disclosure(articles[1], "trường khác biệt").querySelector("dl"), null)
    await toggle(firstDiff, false)
    assert.equal(document.querySelectorAll("dl").length, 0)
    assert.ok(!document.body.textContent!.includes("METADATA-airi-0"))

    const firstImages = disclosure(articles[0], "Sẽ upload")
    await toggle(firstImages, true)
    assert.equal(firstImages.querySelectorAll("li").length, 11)
    assert.match(firstImages.textContent!, /https:\/\/images\.invalid\/airi\/skill-0\.png/)
    assert.match(firstImages.textContent!, /https:\/\/images\.invalid\/airi\/skin-2\.png/)
    assert.equal(disclosure(articles[1], "Sẽ upload").querySelector("ul"), null)
    await toggle(firstImages, false)
    assert.equal(firstImages.querySelector("ul"), null)
    assert.ok(!document.body.textContent!.includes("https://images.invalid/"))
    assert.ok(requests.every((path) => /\/(fields|relation-fields|preview)$/.test(path)))
  } finally {
    await act(async () => root.unmount())
    cache.clear()
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
