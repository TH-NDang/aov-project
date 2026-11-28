import { setFetch } from "./fixtures/dispatch-fetch"
import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import { button, choose, click, inDom, render, testQueryClient, type, waitFor } from "./fixtures/dom"

const page = { url: "http://localhost/game-configuration" }

const thaiPost = {
  id: "post-th",
  source: "ROV_TH",
  region: "TH",
  channel: "OFFICIAL",
  url: "https://rov.in.th/news/patch",
  title: "Thai patch notes",
  publishedAt: null,
  firstSeenAt: "2026-11-20T00:00:00Z",
  state: "NEW",
  stateChangedAt: null,
  version: 0,
}

async function openStrip(saved: unknown[] = []) {
  const sent: unknown[] = []
  setFetch(async (input, init) => {
    const url = String(input)
    if (url.endsWith("/auth/refresh")) return Response.json({ accessToken: "fixture-only", expiresIn: 3600 })
    if (url.endsWith("/admin/me"))
      return Response.json({ issuer: "fixture", subject: "editor", type: "HUMAN", capabilities: ["patch:write"] })
    if (url.endsWith("/admin/patch-variants/variant/sources") && init?.method === "PUT") {
      const body = JSON.parse(String(init.body)) as { sources: unknown[] }
      sent.push(body)
      return Response.json(body.sources)
    }
    return new Response(null, { status: 404 })
  })
  const { verifySession } = await import("../src/app/auth/session")
  await act(async () => verifySession())
  const { PatchSourceStrip } = await import("../src/features/publishing/components/patch-changes/patch-sources")
  const client = testQueryClient()
  client.setDefaultOptions({ queries: { retry: false, gcTime: Infinity, staleTime: Infinity } })
  client.setQueryData(["patch-sources", "variant"], saved)
  client.setQueryData(["patch-watch", "posts", "ALL"], {
    pages: [{ items: [thaiPost], page: 0, size: 20, totalElements: 1 }],
    pageParams: [0],
  })
  await render(<PatchSourceStrip variantId="variant" canEdit />, { client })
  return { sent }
}

const field = (label: string) => document.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!

test("an editor gives a patch two labelled links and they are kept in the order chosen", async () => {
  await inDom(page, async () => {
    const { sent } = await openStrip()

    await click(await waitFor(() => button("Thêm link nguồn")), "add sources")
    await type(await waitFor(() => field("Link 1: nhãn")), "Tiếng Việt")
    await choose(document.querySelector<HTMLSelectElement>('[aria-label="Link 1: ngôn ngữ"]')!, "vi-VN")
    await type(field("Link 1: địa chỉ"), " https://lienquan.garena.vn/patch ")
    await click(button("Thêm nguồn Thai patch notes"), "suggested post")
    assert.equal(field("Link 2: nhãn").value, "Thái Lan")
    await click(button("Đưa link 2 lên"), "move up")
    await click(button("Lưu nguồn"), "save")

    await waitFor(() => sent.length === 1, "The links are sent")
    assert.deepEqual(sent[0], {
      sources: [
        { url: "https://rov.in.th/news/patch", label: "Thái Lan", locale: "th-TH" },
        { url: "https://lienquan.garena.vn/patch", label: "Tiếng Việt", locale: "vi-VN" },
      ],
    })
    await waitFor(() => !document.querySelector('[role="dialog"]'), "The dialog closes after saving")
    const links = [...document.querySelectorAll<HTMLAnchorElement>('[aria-label="Nguồn ghi chú cập nhật"] a')]
    assert.deepEqual(
      links.map((link) => [link.textContent, link.href]),
      [
        ["Thái Lan· ภาษาไทย", "https://rov.in.th/news/patch"],
        ["Tiếng Việt", "https://lienquan.garena.vn/patch"],
      ],
    )
  })
})

test("a link without a label or a web address says what is missing and nothing is sent", async () => {
  await inDom(page, async () => {
    const { sent } = await openStrip([{ url: "https://lienquan.garena.vn/patch", label: "Tiếng Việt", locale: null }])

    await click(await waitFor(() => button("Sửa nguồn")), "edit sources")
    await click(await waitFor(() => button("Thêm link")), "add row")
    await type(field("Link 2: địa chỉ"), "lienquan.garena.vn/other")
    await click(button("Lưu nguồn"), "save")

    const alert = await waitFor(() => document.querySelector('[aria-label="Link 2"] [role="alert"]'))
    assert.match(alert.textContent ?? "", /Ghi nhãn/)
    await type(field("Link 2: nhãn"), "English")
    await waitFor(() =>
      /http\(s\)/.test(document.querySelector('[aria-label="Link 2"] [role="alert"]')?.textContent ?? ""),
    )
    assert.equal(sent.length, 0)
  })
})
