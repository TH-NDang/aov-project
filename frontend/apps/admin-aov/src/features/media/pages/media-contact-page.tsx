import { LocalTime } from "@aov/ui/components/local-time"
import { useState } from "react"
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router"
import { Button } from "@aov/ui/components/button"
import { Page, PageHeader } from "@/components/page-header"
import { backendRequest, getSession } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { ContactImage } from "../components/contact-image"
import type { PageSlice } from "../../publishing/api/types"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { nextPageOf } from "@aov/ui/lib/page-slice"

interface Contact {
  id: string
  assetId: string | null
  versionId: string | null
  name: string
  email: string
  topic: string
  message: string
  status: string
  createdAt: string
}
export function MediaContactPage() {
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const client = useQueryClient()
  const allowed = getSession().actor?.capabilities.includes("media:write")
  const requests = useInfiniteQuery({
    queryKey: ["media-contact-requests"],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      backendRequest<PageSlice<Contact>>(`/admin/media/contact-requests?page=${pageParam}&size=20`),
    getNextPageParam: nextPageOf,
    enabled: !!allowed,
  })
  const contacts = requests.data?.pages.flatMap((page) => page.items) ?? []
  async function resolve(id: string) {
    setBusy(id)
    setError("")
    try {
      await backendRequest(`/admin/media/contact-requests/${id}/resolve`, { method: "POST" })
      await client.invalidateQueries({ queryKey: ["media-contact-requests"] })
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy("")
    }
  }
  return (
    <Page>
      <PageHeader
        title="Góp ý Wiki & liên hệ về ảnh"
        actions={
          <Button variant="outline" asChild>
            <Link to="/files">Kho ảnh</Link>
          </Button>
        }
      />
      {!allowed ? (
        <p>Bạn cần quyền quản lý ảnh để xem thông tin liên hệ.</p>
      ) : (
        <>
          {requests.isPending && <p role="status">Đang tải yêu cầu…</p>}
          {(requests.error || error) && <p role="alert">{error || errorMessage(requests.error)}</p>}
          {requests.data && !contacts.length && <p>Chưa có yêu cầu liên hệ.</p>}
          <div className="grid gap-4">
            {contacts.map((entry) => (
              <article key={entry.id} className="space-y-3 rounded-xl border p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <h2 className="type-section-title">
                    {entry.name} ·{" "}
                    {entry.topic === "SOURCE"
                      ? "Nguồn / ghi công"
                      : entry.topic === "RIGHTS"
                        ? "Quyền sử dụng"
                        : "Liên hệ"}
                  </h2>
                  <span className="text-sm">{entry.status === "OPEN" ? "Chờ xử lý" : "Đã xử lý"}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {entry.email} · <LocalTime value={entry.createdAt} />
                </p>
                <p className="whitespace-pre-wrap break-words text-sm">{entry.message}</p>
                {entry.assetId && entry.versionId && (
                  <ContactImage assetId={entry.assetId} versionId={entry.versionId} />
                )}
                {entry.status === "OPEN" && (
                  <Button size="sm" disabled={!!busy} onClick={() => void resolve(entry.id)}>
                    Đánh dấu đã xử lý
                  </Button>
                )}
              </article>
            ))}
          </div>
          <InfiniteScroll query={requests} label="Đang tải thêm yêu cầu" />
        </>
      )}
    </Page>
  )
}
