import assert from "node:assert/strict"
import { before, test } from "node:test"
import { act } from "react"
import type { Content, Revision } from "@/lib/hero-types"
import { answerConfirm, answerMediaQueries, button, choose, click, waitFor, withDom } from "./fixtures/dom"
import { fixtureContent, fixturePreviousRevision, fixtureRevision } from "./fixtures/hero-workspace-data"
import { json } from "./fixtures/network"
import {
  comparisonRequests,
  draftAction,
  heroId,
  keepVersion,
  sentTo,
  showWorkspace,
  startHero,
  versionMenu,
  workspaceBackend,
} from "./fixtures/publishing-workspace"
import { signIn } from "./fixtures/session"

const dom = withDom({ url: `http://localhost/hero/${heroId}`, globals: () => ({ fetch: workspaceBackend.fetch }) })
answerMediaQueries(dom.window, () => true)
before(signIn)

/** A draft with nothing in the way: a correction needs no patch, and the content has every part publishing asks for. */
const readyDraft: Revision = { ...fixtureRevision, cause: "CONTENT_CORRECTION" }
const readyContent = (): Content => ({
  ...structuredClone(fixtureContent),
  MEDIA_BINDINGS: { bindings: { HEAD: "head-asset", PORTRAIT: "portrait-asset", SPLASH: "splash-asset" }, sources: [] },
})
/** The draft of a hero whose earlier version is published, as the history fixture holds it. */
const historyDraft: Revision = { ...fixtureRevision, revisionNo: 2 }

const publishButton = () => [...document.querySelectorAll("button")].find((node) => node.textContent === "Xuất bản")
const publishPanel = () => document.querySelector('[aria-label="Điều kiện xuất bản"]')
const pageText = () => document.body.textContent ?? ""

async function openMenu(trigger: Element | null | undefined, what: string) {
  assert.ok(trigger, `Missing ${what}`)
  await act(async () => {
    trigger.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
  })
}

const baselineContexts = (request: { pathname: string; path: string }) => {
  if (request.pathname === "/admin/seasons") return json([{ id: "season-1" }])
  if (request.path === "/admin/heroes/import/contexts?seasonId=season-1")
    return json(
      [
        ["context-old", "variant-old", "1.0"],
        ["context-new", "variant-new", "1.1"],
      ].map(([contextId, patchVariantId, patchCode]) => ({
        contextId,
        rulesetId: fixtureRevision.rulesetId,
        patchVariantId,
        seasonName: "S1",
        patchCode,
      })),
    )
  return undefined
}

test("publishing a ready draft sends its version and opens the published version", async () => {
  const published: Revision = { ...readyDraft, state: "PUBLISHED", version: 2, publishedAt: "2026-11-19T00:00:00Z" }
  await startHero([readyDraft], {
    content: readyContent(),
    routes: ({ method, pathname }) =>
      method === "POST" && pathname === draftAction(readyDraft.id, "publish")
        ? json(keepVersion(published))
        : undefined,
  })
  await showWorkspace(`/hero/${heroId}?revision=${readyDraft.id}`)

  await click(await waitFor(publishButton, "The ready draft offers publishing"), "publish button")

  await waitFor(() => versionMenu()?.title === "Phiên bản #1 · Đã xuất bản", "The published version opens")
  assert.deepEqual(sentTo(draftAction(readyDraft.id, "publish")), [{ expectedVersion: 1, changeNote: "" }])
  assert.equal(publishButton(), undefined, "A published version offers no publishing")
})

test("a draft with gaps lists them beside the button instead of publishing", async () => {
  await startHero([fixtureRevision])
  await showWorkspace(`/hero/${heroId}?revision=${fixtureRevision.id}`)

  const blocked = await waitFor(() => button("Xuất bản · xem mục còn thiếu"), "The draft with gaps says so")
  await click(blocked, "blocked publish button")

  const panel = await waitFor(publishPanel, "The gaps open beside the button")
  assert.match(panel.textContent!, /Chọn patch áp dụng cho bản nháp trước khi xuất bản tướng/)
  assert.match(panel.textContent!, /Chọn đủ ảnh Head, Portrait và Splash/)
  assert.deepEqual(sentTo(draftAction(fixtureRevision.id, "publish")), [])
})

test("a refused publish keeps the draft open and says why beside the button", async () => {
  await startHero([readyDraft], {
    content: readyContent(),
    routes: ({ method, pathname }) =>
      method === "POST" && pathname === draftAction(readyDraft.id, "publish")
        ? json({ code: "HERO_REVISION_VERSION_CONFLICT", status: 409 }, 409)
        : undefined,
  })
  await showWorkspace(`/hero/${heroId}?revision=${readyDraft.id}`)

  await click(await waitFor(publishButton, "The ready draft offers publishing"), "publish button")

  const refusal = await waitFor(() => publishPanel()?.querySelector('[role="alert"]'), "The refusal opens")
  assert.match(refusal.textContent!, /Bản nháp đã được người khác sửa/)
  assert.equal(versionMenu()?.title, "Phiên bản #1 · Bản nháp", "The draft stays open")
})

test("discarding a draft asks first and opens the discarded version", async () => {
  const discarded: Revision = { ...fixtureRevision, state: "DISCARDED", version: 2 }
  await startHero([fixtureRevision], {
    routes: ({ method, pathname }) =>
      method === "POST" && pathname === draftAction(fixtureRevision.id, "discard")
        ? json(keepVersion(discarded))
        : undefined,
  })
  await showWorkspace(`/hero/${heroId}?revision=${fixtureRevision.id}`)
  await waitFor(() => versionMenu()?.title === "Phiên bản #1 · Bản nháp", "The draft opens")

  await openMenu(button("Thao tác tướng"), "hero actions menu")
  await click(
    [...document.querySelectorAll('[role="menuitem"]')].find((item) => item.textContent === "Hủy bản nháp"),
    "discard item",
  )
  assert.deepEqual(sentTo(draftAction(fixtureRevision.id, "discard")), [], "Nothing is sent while the question is open")
  await answerConfirm("Hủy bản nháp")

  await waitFor(() => versionMenu()?.title === "Phiên bản #1 · Đã hủy", "The discarded version opens")
  assert.deepEqual(sentTo(draftAction(fixtureRevision.id, "discard")), [{ expectedVersion: 1 }])
})

test("a link that asks for a comparison opens it against the chosen version", async () => {
  await startHero([historyDraft, fixturePreviousRevision])
  await showWorkspace(`/hero/${heroId}?revision=${historyDraft.id}&view=history&compare=${fixturePreviousRevision.id}`)

  await waitFor(() => document.querySelectorAll("article").length === 2, "Both changes are compared")
  assert.deepEqual(comparisonRequests(), [`${historyDraft.id}/comparison?fromRevisionId=${fixturePreviousRevision.id}`])
  assert.equal(
    document.querySelector<HTMLSelectElement>('select[aria-label="Bản đối chiếu"]')?.value,
    fixturePreviousRevision.id,
  )
})

test("the comparison stays folded and asks for nothing until it is opened", async () => {
  await startHero([historyDraft, fixturePreviousRevision])
  await showWorkspace(`/hero/${heroId}?revision=${historyDraft.id}&view=history`)
  const fold = await waitFor(
    () => [...document.querySelectorAll("details")].find((node) => node.textContent?.includes("So sánh hai bản")),
    "The history offers a comparison",
  )
  assert.equal(fold.open, false)
  assert.deepEqual(comparisonRequests(), [])

  await act(async () => {
    fold.open = true
  })

  await waitFor(() => pageText().includes("Chưa đủ dữ liệu để xác định phần thay đổi"), "The comparison opens")
  assert.deepEqual(comparisonRequests(), [`${historyDraft.id}/comparison`])
})

test("opening a version from the comparison shows it in the workspace", async () => {
  await startHero([historyDraft, fixturePreviousRevision])
  const page = await showWorkspace(
    `/hero/${heroId}?revision=${historyDraft.id}&view=history&compare=${fixturePreviousRevision.id}`,
  )
  const open = await waitFor(() => button("Mở phiên bản 1"), "The comparison lists the earlier version")

  await click(open, "open earlier version")

  await waitFor(() => versionMenu()?.title === "Phiên bản #1 · Đã xuất bản", "The earlier version opens")
  assert.equal(page.search().get("revision"), fixturePreviousRevision.id)
  assert.equal(page.search().get("compare"), null, "The choice of the old comparison is dropped")
})

test("a fix link for the patch of an imported baseline opens its history on the move form", async () => {
  await startHero([fixtureRevision], { routes: baselineContexts })
  const page = await showWorkspace(`/hero/${heroId}?revision=${fixtureRevision.id}&fix=PATCH`)

  await waitFor(() => pageText().includes("Đổi patch của bản nhập dữ liệu"), "The move form opens")
  assert.equal(page.search().get("view"), "history")
  assert.equal(page.search().get("fix"), null, "The link is followed once")
})

test("moving an imported baseline to another patch asks first and reads the moved version back", async () => {
  const moved: Revision = { ...fixtureRevision, version: 2, effectiveFromPatchVariantId: "variant-new" }
  await startHero([fixtureRevision], {
    routes: (request) =>
      request.method === "POST" && request.pathname === draftAction(fixtureRevision.id, "baseline-context")
        ? json(keepVersion(moved))
        : baselineContexts(request),
  })
  await showWorkspace(`/hero/${heroId}?revision=${fixtureRevision.id}&view=history`)
  const patch = await waitFor(
    () =>
      [...document.querySelectorAll("select")].find((select) => select.querySelector('option[value="context-new"]')),
    "The move form lists the patches of the ruleset",
  )

  await choose(patch, "context-new")
  await click(button("Đổi patch"), "move button")
  assert.deepEqual(sentTo(draftAction(fixtureRevision.id, "baseline-context")), [], "Nothing is sent before the answer")
  await answerConfirm("Đổi patch")

  await waitFor(() => pageText().includes("Đang gắn: S1 / 1.1."), "The moved version is read back")
  assert.deepEqual(sentTo(draftAction(fixtureRevision.id, "baseline-context")), [
    { expectedVersion: 1, contextId: "context-new" },
  ])
})

test("without a hero the page lists heroes and offers creating and importing them", async () => {
  await startHero([fixtureRevision])
  await showWorkspace("/hero", "")

  await waitFor(() => document.querySelector('[aria-label^="Bản dịch airi:"]'), "The catalog lists the hero")
  await openMenu(button("Tạo và nhập tướng"), "create and import menu")
  const links = [...document.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]')].map((link) =>
    link.getAttribute("href"),
  )
  assert.deepEqual(links, ["/hero/new", "/hero/import"])
})
