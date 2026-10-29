import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router"
import { Button } from "@aov/ui/components/button"
import { Page, PageHeader } from "@/components/page-header"
import { backendRequest, getSession } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { ContactImage } from "./contact-image"
import type { PageSlice } from "../publishing/types"

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
  const [page, setPage] = useState(0)
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const client = useQueryClient()
  const allowed = getSession().actor?.capabilities.includes("media:write")
  const requests = useQuery({
    queryKey: ["media-contact-requests", page],
    queryFn: () => backendRequest<PageSlice<Contact>>(`/admin/media/contact-requests?page=${page}&size=20`),
    enabled: !!allowed,
  })
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
        title="Liên hệ về nguồn & hình ảnh"
        actions={
          <Button variant="outline" asChild>
            <Link to="/image-management">Kho ảnh</Link>
          </Button>
        }
      />
      {!allowed ? (
        <p>Bạn cần quyền quản lý ảnh để xem thông tin liên hệ.</p>
      ) : (
        <>
          {requests.isPending && <p role="status">Đang tải yêu cầu…</p>}
          {(requests.error || error) && <p role="alert">{error || errorMessage(requests.error)}</p>}
          {requests.data?.items.length === 0 && <p>Chưa có yêu cầu liên hệ.</p>}
          <div className="grid gap-4">
            {requests.data?.items.map((entry) => (
              <article key={entry.id} className="space-y-3 rounded-xl border p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <h2 className="font-semibold">
                    {entry.name} ·{" "}
                    {entry.topic === "SOURCE"
                      ? "Nguồn / credit"
                      : entry.topic === "RIGHTS"
                        ? "Quyền sử dụng"
                        : "Liên hệ"}
                  </h2>
                  <span className="text-sm">{entry.status === "OPEN" ? "Chờ xử lý" : "Đã xử lý"}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {entry.email} · {new Date(entry.createdAt).toLocaleString("vi-VN")}
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
          <div className="mt-4 flex items-center gap-3">
            <Button variant="outline" disabled={!page} onClick={() => setPage(page - 1)}>
              Trước
            </Button>
            <span>Trang {page + 1}</span>
            <Button
              variant="outline"
              disabled={!requests.data || (page + 1) * 20 >= requests.data.totalElements}
              onClick={() => setPage(page + 1)}
            >
              Sau
            </Button>
          </div>
        </>
      )}
    </Page>
  )
}
