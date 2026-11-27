import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import { MemoryRouter } from "react-router"
import { createHeroFixture } from "./fixtures/hero-workspace-data"
import { answerMediaQueries, button, click, inDom, render, testQueryClient, waitFor, type Dom } from "./fixtures/dom"

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
  summary: "",
  actualLocale: "vi-VN",
  changes: [],
})

const hero = (id: string, name: string) => ({
  id,
  kind: "hero",
  translations: [{ locale: "vi-VN", name, aliases: [], description: "" }],
  iconAssetId: null,
})

// The API client keeps the fetch it found when first imported, so every test answers through this one function.
let answerRequest: typeof fetch = async () => new Response(null, { status: 404 })
const dispatch: typeof fetch = (input, init) => answerRequest(input, init)
const page = { url: "http://localhost/game-configuration", globals: () => ({ fetch: dispatch }) }

async function openTable(
  dom: Dom,
  answer: (body: unknown) => Response,
  capabilities = ["catalog:read", "patch:write"],
) {
  const fixture = createHeroFixture()
  const sent: unknown[] = []
  const rows = [change("change-airi", "airi", "airi"), change("change-violet", "violet", "violet")]
  answerRequest = async (input, init) => {
    const url = String(input)
    if (url.endsWith("/admin/me"))
      return Response.json({ issuer: "fixture", subject: "editor", type: "HUMAN", capabilities })
    if (url.endsWith("/admin/patch-variants/variant/hero-changes?locale=vi-VN")) return Response.json(rows)
    if (url.endsWith("/admin/patch-variants/variant/hero-changes/order") && init?.method === "PUT") {
      const body: unknown = JSON.parse(String(init.body))
      sent.push(body)
      return answer(body)
    }
    return fixture.fetcher(input, init)
  }
  answerMediaQueries(dom.window, () => true)
  const { verifySession } = await import("../src/app/auth/session")
  await act(async () => verifySession())
  const { PatchChangesTable } = await import("../src/features/publishing/components/patch-changes/patch-changes-table")
  const client = testQueryClient()
  client.setDefaultOptions({ queries: { retry: false, gcTime: Infinity, staleTime: Infinity } })
  client.setQueryData(["patch-changes", "variant", "vi-VN"], rows)
  client.setQueryData(["reference-catalog", "fixture", "editor", ""], [hero("airi", "Airi"), hero("violet", "Violet")])
  client.setQueryData(["patch-additional-notes", "variant", "vi-VN"], { body: "", version: 0 })
  for (const kind of ["items", "enchantments", "arcana", "spells"])
    client.setQueryData(["warehouse", "changes", kind, "rules", "vi-VN"], [])
  await render(<PatchChangesTable variantId="variant" overview={overview as never} locale="vi-VN" />, {
    client,
    wrap: (node) => <MemoryRouter>{node}</MemoryRouter>,
  })
  return { client, sent }
}

test("an editor arranges the heroes of a patch and the new order is saved for every change set", async () => {
  await inDom(page, async (dom) => {
    const { client, sent } = await openTable(dom, () => new Response(null, { status: 204 }))
    const invalidated: unknown[] = []
    const invalidate = client.invalidateQueries.bind(client)
    client.invalidateQueries = (filters, options) => {
      invalidated.push(filters?.queryKey)
      return invalidate(filters, options)
    }

    await click(await waitFor(() => button("Sắp xếp tướng")), "order button")
    await click(button("Đưa Airi xuống"), "move down")
    await click(button("Lưu thứ tự"), "save")

    assert.deepEqual(sent, [{ changeSetIds: ["change-violet", "change-airi"] }])
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
    await openTable(dom, () => new Response(null, { status: 204 }), ["catalog:read"])

    await waitFor(() => document.querySelector('button[aria-label="Xem thay đổi Violet"]'))
    assert.equal(button("Sắp xếp tướng"), undefined)
  })
})
