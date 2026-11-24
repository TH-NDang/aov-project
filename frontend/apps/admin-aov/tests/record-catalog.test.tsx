import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import { MemoryRouter } from "react-router"
import type { EntityKind, EntityReference } from "@aov/ui/lib/entity-rich-text"
import { button, click, flush, render, type, waitFor, withDom } from "./fixtures/dom"
import { intersectionHarness } from "./fixtures/intersection-observer"
import { fakeBackend, json, page, type ApiRequest, type Handler } from "./fixtures/network"
import { sessionRoutes, signIn } from "./fixtures/session"

const named = (name: string, id = name.toLowerCase().replaceAll(" ", "-")) => ({ id, code: id, name })
const circuits = [
  { ...named("Đấu Trường Danh Vọng", "aog"), shortName: "AOG", avatarUrl: "https://img.example/aog.png" },
  { ...named("RoV Pro League", "rpl"), shortName: "RPL" },
]
const people = [named("Tony Bình", "tony")]
const tournaments = [named("AOG Mùa Đông 2026", "aog-winter")]
const teams = Array.from({ length: 3 }, (_, index) => named(`Team ${index + 1}`))
let forbidden = new Set<string>()
let failing = false

const matches = (name: string, q: string | null) => !q || name.toLowerCase().includes(q.toLowerCase())
function slice<T extends { name: string }>({ url }: ApiRequest, all: T[], size = 2) {
  const found = all.filter(({ name }) => matches(name, url.searchParams.get("q")))
  const asked = Number(url.searchParams.get("page") ?? 0)
  const items = found.slice(asked * size, (asked + 1) * size)
  return { items, options: { page: asked, size, totalElements: found.length } }
}
const profile = ({ id, code, ...content }: (typeof circuits)[number] | (typeof people)[number]) => ({
  id,
  code,
  content,
})

const records: Handler = (request) => {
  const { service, pathname, url } = request
  const kind = url.searchParams.get("kind")
  if (forbidden.has(pathname)) return json({ code: "FORBIDDEN" }, 403)
  if (failing && service === "community" && pathname !== "/admin/me") return json({ code: "INTERNAL_ERROR" }, 500)
  if (service === "wiki" && pathname === "/admin/game-modes") return json([named("Cờ Liên Quân", "auto-chess")])
  if (service !== "community") return undefined
  if (pathname === "/admin/pages") {
    const { items, options } = slice(request, kind === "CIRCUIT" ? circuits : kind === "PERSON" ? people : [])
    return page(items.map(profile), options)
  }
  if (pathname === "/admin/tournaments") {
    const { items, options } = slice(request, tournaments)
    return page(
      items.map(({ id, ...content }) => ({ id, content })),
      options,
    )
  }
  if (pathname === "/admin/reference-catalog") {
    const { items, options } = slice(request, kind === "TEAM" ? teams : [])
    return page(
      items.map(({ id, name }) => ({
        id,
        kind: "team",
        translations: [{ locale: "vi-VN", name, aliases: [], description: "" }],
        destinations: { admin: `/tournaments?tab=teams&team=${id}` },
      })),
      options,
    )
  }
}
const intersections = intersectionHarness()
const backend = fakeBackend(sessionRoutes({ capabilities: ["hero:write"] }), records)
withDom({
  url: "http://localhost/terminology",
  globals: () => ({ fetch: backend.fetch, IntersectionObserver: intersections.Observer }),
})
afterEach(() => {
  forbidden = new Set()
  failing = false
})

const own = (kind: EntityKind, name: string): EntityReference => ({
  id: name.toLowerCase(),
  kind,
  translations: [{ locale: "vi-VN", name, aliases: [], description: "" }],
})

async function catalog(entities: EntityReference[] = [own("hero", "Airi"), own("team", "Old team")], counted = true) {
  await signIn()
  const { ReferenceCatalogTable } = await import("../src/features/terminology/reference-catalog-table")
  await render(
    <ReferenceCatalogTable
      variant="references"
      entities={entities}
      locale="vi-VN"
      fallbackLocale="vi-VN"
      selected=""
      onSelect={() => {}}
      customKeys={new Set()}
      availableKeys={new Set()}
    />,
    { wrap: (node) => <MemoryRouter>{node}</MemoryRouter> },
  )
  if (counted) await waitFor(() => !chip("Tất cả")?.textContent?.endsWith("Tất cả"))
}
const chip = (label: string) => button(label, document.querySelector('[aria-label="Lọc loại tham chiếu"]')!)
const rows = () =>
  [...document.querySelectorAll("tbody tr")].map((row) => row.querySelector(".font-semibold")?.textContent)
const links = () => [...document.querySelectorAll("tbody a")].map((link) => link.getAttribute("href"))
const choose = async (label: string) => {
  await click(chip(label))
  await waitFor(() => ![...document.querySelectorAll("tbody")].some((body) => body.textContent?.includes("Đang tải")))
}
/** Brings the end of the list into view until it has nothing more to load. */
async function scrollToEnd() {
  for (let round = 0; round < 12; round++) {
    for (const end of document.querySelectorAll('[aria-label="Đang tải thêm danh mục"]')) intersections.intersect(end)
    await flush()
  }
}

test("every kind is counted, the ones other screens keep among them", async () => {
  await catalog()

  assert.equal(chip("Tướng")?.textContent, "Tướng1")
  assert.equal(chip("Hệ thống giải")?.textContent, "Hệ thống giải2")
  assert.equal(chip("Đội tuyển")?.textContent, "Đội tuyển3", "Counted where teams are kept, not in the part in memory")
  assert.equal(chip("Chế độ chơi")?.textContent, "Chế độ chơi1")
  assert.equal(chip("Tất cả")?.textContent, "Tất cả9")
})

test("a kind lists its records with their logo, and each opens the screen that keeps it", async () => {
  await catalog()

  await choose("Hệ thống giải")
  await waitFor(() => rows().length === 2)

  assert.deepEqual(rows(), ["Đấu Trường Danh Vọng", "RoV Pro League"])
  assert.deepEqual(links(), ["/pages/aog", "/pages/rpl"])
  assert.equal(document.querySelector<HTMLImageElement>("tbody img")?.src, "https://img.example/aog.png")
})

test("tournaments, modes and personnel open their own screens", async () => {
  await catalog()
  for (const [label, path] of [
    ["Giải đấu", "/tournaments/aog-winter"],
    ["Chế độ chơi", "/game-modes/auto-chess"],
    ["Nhân sự", "/pages/tony"],
  ] as const) {
    await choose(label)
    await waitFor(() => links()[0] === path)
  }
})

test("the whole catalog goes on with the records of every kind as the reader scrolls", async () => {
  await catalog([own("hero", "Airi")])

  await scrollToEnd()

  assert.deepEqual(rows(), [
    "Airi",
    "Cờ Liên Quân",
    "Đấu Trường Danh Vọng",
    "RoV Pro League",
    "AOG Mùa Đông 2026",
    "Team 1",
    "Team 2",
    "Team 3",
    "Tony Bình",
  ])
})

test("a search asks every kind and counts what each finds", async () => {
  await catalog()

  await type(document.querySelector<HTMLInputElement>('input[type="search"]')!, "AOG")
  await waitFor(() => chip("Tất cả")?.textContent === "Tất cả1")
  await scrollToEnd()

  assert.deepEqual(rows(), ["AOG Mùa Đông 2026"])
})

test("a service that fails is told once and can be asked again", async () => {
  failing = true
  await catalog([own("hero", "Airi")], false)
  await waitFor(() => document.querySelectorAll('tbody [role="alert"]').length === 1)

  failing = false
  await click(button("Thử lại", document.querySelector("tbody")!))
  await scrollToEnd()

  assert.equal(document.querySelector('tbody [role="alert"]'), null)
  assert.equal(rows().length, 9)
})

test("an editor who may not read a kind finds none of it and keeps the rest", async () => {
  forbidden = new Set(["/admin/tournaments"])
  await catalog()

  assert.equal(chip("Giải đấu")?.textContent, "Giải đấu0")
  await choose("Hệ thống giải")
  await waitFor(() => rows().length === 2)
})
