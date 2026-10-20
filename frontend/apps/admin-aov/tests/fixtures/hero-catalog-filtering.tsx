import * as React from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Link, MemoryRouter, Route, Routes } from "react-router"
import "@aov/ui/styles.css"
import { createHeroCatalogFixture } from "./hero-catalog-data"

const fixture = createHeroCatalogFixture()
const fixtureIds = new Map<string, string>()
const originalIds = new Map<string, string>()
const id = (source: string) => {
  let value = fixtureIds.get(source)
  if (!value) {
    value = `00000000-0000-4000-8000-${String(fixtureIds.size + 1).padStart(12, "0")}`
    fixtureIds.set(source, value)
    originalIds.set(value, source)
  }
  return value
}
const responseIds = (value: unknown, key = ""): unknown => {
  if (Array.isArray(value)) return value.map((item) => responseIds(item, key))
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([field, item]) => [field, responseIds(item, field)]))
  return typeof value === "string" && (key === "id" || key.endsWith("Id")) ? id(value) : value
}

// Every request is served from memory; unsupported actions fail without reaching a real API.
window.fetch = async (input, init) => {
  const url = new URL(String(input), location.origin)
  url.pathname = url.pathname
    .split("/")
    .map((segment) => originalIds.get(segment) ?? segment)
    .join("/")
  for (const field of ["seasonId", "patchVariantId", "rulesetId"]) {
    const current = url.searchParams.get(field)
    if (current && originalIds.has(current)) url.searchParams.set(field, originalIds.get(current)!)
  }
  const response = await fixture.fetcher(url.pathname + url.search, init)
  return response.headers.get("content-type")?.includes("application/json")
    ? Response.json(responseIds(await response.json()), { status: response.status })
    : response
}
Object.defineProperty(window, "BroadcastChannel", { configurable: true, value: undefined })
document.documentElement.classList.toggle("dark", new URLSearchParams(location.search).get("theme") === "dark")
const { verifySession } = await import("../../src/app/auth/session")
await verifySession()
const { PublishingPage } = await import("../../src/features/publishing/publishing-page")
const seasonPath = `/hero?season=${id("season-new")}`
const patchPath = `${seasonPath}&patch=${id("patch-current")}`

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[seasonPath]}>
      <main className="min-h-svh bg-background text-foreground">
        <div
          role="note"
          className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs"
        >
          <strong>Dữ liệu kiểm thử · không ghi dữ liệu thật</strong>
          <Link className="underline underline-offset-4" to="/hero">
            Tất cả tướng
          </Link>
          <Link className="underline underline-offset-4" to={seasonPath}>
            Mùa S4 · hai patch
          </Link>
          <Link className="underline underline-offset-4" to={patchPath}>
            Patch hiện tại · tăng & giảm
          </Link>
        </div>
        <div className="mx-auto max-w-7xl">
          <Routes>
            <Route path="/hero" element={<PublishingPage />} />
            <Route path="/hero/:heroId" element={<PublishingPage />} />
            <Route path="/hero/:heroId/translations" element={<PublishingPage translationMode />} />
          </Routes>
        </div>
      </main>
    </MemoryRouter>
  </QueryClientProvider>,
)
