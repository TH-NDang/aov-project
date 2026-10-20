import * as React from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, Routes, Route, Link } from "react-router"
import "@aov/ui/styles.css"
import { createHeroFixture } from "./hero-workspace-data"

// All requests are intercepted; this page never reads or writes real account data.
const fixtureOptions = new URLSearchParams(location.search)
const fixture = createHeroFixture(fixtureOptions.has("annotations"), fixtureOptions.has("history"))
window.fetch = fixture.fetcher
const { verifySession } = await import("../../src/app/auth/session")
await verifySession()
const { PublishingPage } = await import("../../src/features/publishing/publishing-page")
const { TerminologyPage } = await import("../../src/features/terminology/terminology-page")
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={["/hero"]}>
      <main className="min-h-svh bg-background text-foreground">
        <div className="border-b bg-muted/40 px-4 py-3 text-xs">
          Kiểm thử UI · dữ liệu giả lập riêng · không ghi dữ liệu thật{" "}
          <Link className="ml-3 underline" to="/hero">
            Danh sách
          </Link>
          <Link className="ml-3 underline" to="/terminology">
            Thuật ngữ
          </Link>
        </div>
        <div className="mx-auto max-w-6xl">
          <Routes>
            <Route path="/terminology" element={<TerminologyPage />} />
            <Route path="/hero" element={<PublishingPage />} />
            <Route path="/hero/:heroId" element={<PublishingPage />} />
            <Route path="/hero/:heroId/translations" element={<PublishingPage translationMode />} />
          </Routes>
        </div>
      </main>
    </MemoryRouter>
  </QueryClientProvider>,
)
