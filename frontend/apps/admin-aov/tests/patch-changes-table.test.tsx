import { setFetch } from "./fixtures/dispatch-fetch"
import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import { MemoryRouter } from "react-router"
import { createHeroFixture } from "./fixtures/hero-workspace-data"
import {
  answerMediaQueries,
  button,
  click,
  inDom,
  render,
  testQueryClient,
  type,
  waitFor,
  type Dom,
} from "./fixtures/dom"

const overview = {
  asOf: "2026-10-16T00:00:00Z",
  rulesets: [{ id: "rules", code: "Shared gameplay", description: null }],
  assignments: [],
  markets: [],
  seasonSchedules: [],
  seasons: [],
  variants: [
    {
      id: "variant",
      patchId: "patch",
      seasonId: "season",
      patchCode: "patch-october",
      rulesetId: "rules",
      rulesetOrdinal: 1,
      status: "PUBLISHED",
    },
  ],
  releases: [],
}

const change = (id: string, heroId: string, heroCode: string) => ({
  id,
  heroId,
  heroCode,
  sourceKind: "PATCH_NOTES",
  sourceUrl: "https://example.org/notes",
  overallKind: "BUFF",
  assessmentVersion: 1,
  summary: "Tăng máu",
  actualLocale: "vi-VN",
  fromHeroRevisionId: null,
  toHeroRevisionId: null,
  changes: [
    {
      id: `${id}-hp`,
      type: "HERO_STAT_CHANGE",
      changeKind: "BUFF",
      statKey: "HP",
      unitCode: "FLAT",
      oldValue: 3000,
      newValue: 3200,
    },
  ],
})

const hero = (id: string, name: string) => ({
  id,
  kind: "hero",
  translations: [{ locale: "vi-VN", name, aliases: [], description: "" }],
  iconAssetId: null,
})

const page = { url: "http://localhost/game-configuration" }

/** A request the table sends that the test answers itself, with what it sent. */
type Answer = (url: string, init: RequestInit | undefined) => Response | undefined

const balanceRows = [change("change-airi", "airi", "airi"), change("change-violet", "violet", "violet")]

async function openTable(
  dom: Dom,
  answer: Answer,
  capabilities = ["catalog:read", "patch:write"],
  rows: unknown[] = balanceRows,
) {
  const fixture = createHeroFixture()
  const sent: { url: string; method?: string; body: unknown }[] = []
  setFetch(async (input, init) => {
    const url = String(input)
    if (url.endsWith("/admin/me"))
      return Response.json({ issuer: "fixture", subject: "editor", type: "HUMAN", capabilities })
    if (url.endsWith("/admin/patch-variants/variant/hero-changes?locale=vi-VN")) return Response.json(rows)
    if (init?.method === "PUT") {
      sent.push({ url, method: init.method, body: JSON.parse(String(init.body)) })
      const answered = answer(url, init)
      if (answered) return answered
    }
    return fixture.fetcher(input, init)
  })
  answerMediaQueries(dom.window, () => true)
  const { verifySession } = await import("../src/app/auth/session")
  await act(async () => verifySession())
  const { PatchChangesTable } = await import("../src/features/publishing/components/patch-changes/patch-changes-table")
  const client = testQueryClient()
  client.setDefaultOptions({ queries: { retry: false, gcTime: Infinity, staleTime: Infinity } })
  client.setQueryData(["patch-changes", "variant", "vi-VN"], rows)
  client.setQueryData(
    ["reference-catalog", "fixture", "editor", ""],
    [hero("airi", "Airi"), hero("violet", "Violet"), hero("lorion", "Lorion")],
  )
  client.setQueryData(["patch-additional-notes", "variant", "vi-VN"], { body: "", version: 0 })
  for (const kind of ["items", "enchantments", "arcana", "spells"])
    client.setQueryData(["warehouse", "changes", kind, "rules", "vi-VN"], [])
  await render(<PatchChangesTable variantId="variant" overview={overview as never} locale="vi-VN" />, {
    client,
    wrap: (node) => <MemoryRouter>{node}</MemoryRouter>,
  })
  return { client, sent }
}

const noContent = () => new Response(null, { status: 204 })

test("an editor arranges the heroes of a patch and the new order is saved for every change set", async () => {
  await inDom(page, async (dom) => {
    const { client, sent } = await openTable(dom, noContent)
    const invalidated: unknown[] = []
    const invalidate = client.invalidateQueries.bind(client)
    client.invalidateQueries = (filters, options) => {
      invalidated.push(filters?.queryKey)
      return invalidate(filters, options)
    }

    await click(await waitFor(() => button("Sắp xếp tướng")), "order button")
    await click(button("Đưa Airi xuống"), "move down")
    await click(button("Lưu thứ tự"), "save")

    assert.deepEqual(
      sent.map((request) => request.body),
      [{ changeSetIds: ["change-violet", "change-airi"] }],
    )
    assert.deepEqual(invalidated, [["patch-changes"]])
    await waitFor(() => !document.querySelector('[role="dialog"]'), "The dialog closes after saving")
  })
})

test("a patch that changed meanwhile asks the editor to reopen the order from the new list", async () => {
  await inDom(page, async (dom) => {
    const { sent } = await openTable(dom, () =>
      Response.json(
        { type: "about:blank", status: 409, code: "HERO_PATCH_CHANGE_CONFLICT", detail: "Changed." },
        { status: 409, headers: { "content-type": "application/problem+json" } },
      ),
    )

    await click(await waitFor(() => button("Sắp xếp tướng")), "order button")
    await click(button("Đưa Airi xuống"), "move down")
    await click(button("Lưu thứ tự"), "save")

    assert.equal(sent.length, 1)
    const alert = await waitFor(() => document.querySelector('[role="dialog"] [role="alert"]'))
    assert.match(alert.textContent ?? "", /vừa thay đổi/)
  })
})

test("readers without patch:write see the heroes without the order button", async () => {
  await inDom(page, async (dom) => {
    await openTable(dom, noContent, ["catalog:read"])

    await waitFor(() => document.querySelector('button[aria-label="Xem thay đổi Violet"]'))
    assert.equal(button("Sắp xếp tướng"), undefined)
  })
})

test("an editor rewrites a recorded change set from its detail and the same lines are sent back", async () => {
  await inDom(page, async (dom) => {
    const { sent } = await openTable(dom, noContent)

    await click(await waitFor(() => button("Xem thay đổi Airi")), "hero detail")
    await click(await waitFor(() => button("Sửa thay đổi")), "edit button")
    const summary = await waitFor(() =>
      document.querySelector<HTMLTextAreaElement>(
        '[role="dialog"] textarea[placeholder="Tóm tắt thay đổi của tướng…"]',
      ),
    )
    assert.equal(summary.value, "Tăng máu")
    await type(summary, "Tăng máu cơ bản")
    await click(button("Lưu thay đổi"), "save")

    await waitFor(() => sent.length === 1, "The edit is sent")
    assert.equal(sent[0].url, "/api/wiki/v1/admin/hero-changes/change-airi")
    assert.deepEqual(sent[0].body, {
      sourceUrl: "https://example.org/notes",
      summaryTranslations: [{ locale: "vi-VN", summary: "Tăng máu cơ bản" }],
      changes: [{ type: "STAT", changeKind: "BUFF", statKey: "HP", unit: "FLAT", oldValue: 3000, newValue: 3200 }],
    })
    await waitFor(() => button("Sửa thay đổi"), "The detail shows the lines again after saving")
  })
})

test("a change set that is locked keeps the editor open and says why", async () => {
  await inDom(page, async (dom) => {
    await openTable(dom, (url) =>
      url.endsWith("/admin/hero-changes/change-airi")
        ? Response.json(
            { type: "about:blank", status: 409, code: "HERO_PATCH_CHANGE_LOCKED", detail: "Locked." },
            { status: 409, headers: { "content-type": "application/problem+json" } },
          )
        : undefined,
    )

    await click(await waitFor(() => button("Xem thay đổi Airi")), "hero detail")
    await click(await waitFor(() => button("Sửa thay đổi")), "edit button")
    await click(await waitFor(() => button("Lưu thay đổi")), "save")

    await waitFor(() => document.body.textContent?.includes("đang bị khóa"), "The lock is explained")
    assert.ok(button("Lưu thay đổi"), "The editor stays open")
  })
})

test("heroes whose changes only fix bugs are listed apart from the balance changes", async () => {
  await inDom(page, async (dom) => {
    const fix = {
      ...change("change-lorion", "lorion", "lorion"),
      overallKind: "FIX",
      summary: "Sửa lỗi chiêu 1 bị kẹt.",
      changes: [{ id: "stuck", type: "HERO_OTHER_CHANGE", changeKind: "FIX", description: "Chiêu 1 bị kẹt." }],
    }
    await openTable(dom, noContent, ["catalog:read", "patch:write"], [...balanceRows, fix])

    const fixes = await waitFor(() => document.querySelector('section[aria-labelledby="hero-fix-list-title"]'))
    assert.match(fixes.textContent ?? "", /Sửa lỗi và tối ưu/)
    assert.match(fixes.textContent ?? "", /Sửa lỗi chiêu 1 bị kẹt\./)
    assert.equal(document.querySelector('table button[aria-label="Xem thay đổi Lorion"]'), null)
    assert.ok(document.querySelector('table button[aria-label="Xem thay đổi Airi"]'))

    await click(button("Xem sửa lỗi Lorion", fixes), "fix row")
    await waitFor(() => button("Sửa thay đổi"), "The fix opens in the same detail")
  })
})
