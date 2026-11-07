import * as React from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, Routes, Route, Link } from "react-router"
import "@aov/ui/styles.css"
import { createHeroFixture } from "./hero-workspace-data"

// All requests are intercepted; this page never reads or writes real account data.
const fixtureOptions = new URLSearchParams(location.search)
const fixture = createHeroFixture(fixtureOptions.has("annotations"), fixtureOptions.has("history"))
if (fixtureOptions.has("review")) {
  const flag = {
    field: "hero.skills[0].description",
    note: "Ảnh nguồn thiếu phần cuối mô tả; cần chụp bổ sung trước khi xuất bản.",
    status: "visible_text_preserved",
  }
  fixture.content.SKILLS!.skills[0].effects = [
    {
      effectType: "SOURCE_SNAPSHOT",
      metadata: {
        reviewFlags: [flag],
        heroReviewFlags: [flag],
        levelTable: {
          column_labels: Array.from({ length: 6 }, (_, index) => `Lv ${index + 1}`),
          rows: [
            { label: "ST gốc", display_values: ["315", "355", "395", "435", "475", "515"] },
            { label: "Hồi chiêu (giây)", display_values: ["11", "10.6", "10.2", "9.8", "9.4", "9"] },
          ],
        },
      },
    },
  ]
  if (fixtureOptions.has("navigation")) {
    const passive = fixture.content.SKILLS!.skills[0]
    const active = structuredClone(passive)
    active.skillKey = "skill-1-1"
    active.kind = "ACTIVE"
    active.displayOrder = 1
    active.translations = [
      { locale: "vi-VN", name: "Phi tiêu", description: "Mô tả chiêu dùng riêng để kiểm tra đích cảnh báo." },
    ]
    active.effects[0].metadata.reviewFlags = [{ ...flag, field: "description" }]
    active.effects[0].metadata.heroReviewFlags = []
    passive.effects[0].metadata.reviewFlags = []
    passive.effects[0].metadata.heroReviewFlags = []
    fixture.content.SKILLS!.skills.push(active)
  }
}
window.fetch = fixture.fetcher
const { verifySession } = await import("../../src/app/auth/session")
await verifySession()
const { PublishingPage } = await import("../../src/features/publishing/publishing-page")
const { TerminologyPage } = await import("../../src/features/terminology/terminology-page")
const { ConfirmDialogHost } = await import("../../src/components/confirm-dialog")
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
    <ConfirmDialogHost />
  </QueryClientProvider>,
)
