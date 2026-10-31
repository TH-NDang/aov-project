import { useState } from "react"
import { Link, useParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, CalendarDays, Clock3, Globe2, Pencil, RefreshCw, UserRound } from "lucide-react"
import { useSession } from "@/app/auth/auth-gate"
import { Page, PageHeader } from "@/components/page-header"
import { Button } from "@aov/ui/components/button"
import { Avatar, AvatarFallback, AvatarImage } from "@aov/ui/components/avatar"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@aov/ui/components/dialog"
import { getProfile, profileError, userKeys, type UserProfile } from "./user-api"
import { ProfileForm } from "./profile-form"

const dateFormat = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" })
function displayDate(value: string | null) {
  if (!value) return "Chưa có thông tin"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "Chưa có thông tin" : dateFormat.format(date)
}
function languageName(locale: string) {
  try {
    return new Intl.DisplayNames(["vi"], { type: "language" }).of(locale) ?? locale
  } catch {
    return locale
  }
}

export function UserDetailPage() {
  const { userId = "" } = useParams()
  const { actor } = useSession()
  const canRead = actor?.capabilities.includes("user:read") === true
  const canWrite = actor?.capabilities.includes("user:write") === true
  const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
  const [editing, setEditing] = useState<UserProfile | null>(null)
  const [editRevision, setEditRevision] = useState(0)
  const [reloadError, setReloadError] = useState("")
  const [reloading, setReloading] = useState(false)
  const query = useQuery({
    queryKey: [...userKeys.all, "detail", actor?.issuer, actor?.subject, userId],
    queryFn: ({ signal }) => getProfile(userId, signal),
    enabled: canRead && validId,
    retry: false,
    refetchOnMount: "always",
    refetchInterval: 600000,
  })

  async function reloadEditor() {
    setReloadError("")
    setReloading(true)
    const result = await query.refetch()
    setReloading(false)
    if (result.isError) setReloadError(profileError(result.error))
    else if (result.data) {
      setEditing(result.data)
      setEditRevision((value) => value + 1)
    }
  }

  return (
    <Page>
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/users">
            <ArrowLeft />
            Danh sách người dùng
          </Link>
        </Button>
      </div>
      <PageHeader
        title="Chi tiết người dùng"
        actions={
          canRead &&
          validId && (
            <Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>
              <RefreshCw className={query.isFetching ? "animate-spin" : undefined} />
              Tải lại
            </Button>
          )
        }
      />
      {!canRead ? (
        <div role="alert" className="rounded-xl border p-6">
          Bạn chưa có quyền xem hồ sơ người dùng. Cần quyền user:read từ quản trị viên.
        </div>
      ) : !validId ? (
        <div role="alert" className="rounded-xl border p-6">
          Đường dẫn người dùng không hợp lệ. Hãy chọn một hồ sơ từ danh sách.
        </div>
      ) : query.isPending ? (
        <div role="status" className="rounded-xl border p-6">
          Đang tải hồ sơ người dùng…
        </div>
      ) : query.isError ? (
        <div role="alert" className="space-y-3 rounded-xl border p-6">
          <p>{profileError(query.error)}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Thử lại
          </Button>
        </div>
      ) : (
        <div className="grid max-w-6xl items-start gap-6 lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
          <section className="min-w-0 overflow-hidden rounded-2xl border bg-card">
            <div className="h-20 bg-gradient-to-br from-primary/20 via-primary/5 to-muted" />
            <div className="space-y-5 px-6 pb-6">
              <Avatar className="-mt-12 size-24 border-4 border-card">
                <AvatarImage
                  key={query.data.avatarUrl}
                  src={query.data.avatarUrl ?? undefined}
                  alt={`Ảnh đại diện của ${query.data.displayName}`}
                  referrerPolicy="no-referrer"
                />
                <AvatarFallback className="text-2xl">
                  {query.data.displayName.slice(0, 2).toUpperCase() || <UserRound />}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <h2 className="break-words text-xl font-semibold">{query.data.displayName}</h2>
                <p className="text-sm text-muted-foreground">Hồ sơ người dùng</p>
              </div>
              {canWrite && (
                <Button
                  className="w-full"
                  onClick={() => {
                    setReloadError("")
                    setEditing(query.data)
                  }}
                >
                  <Pencil />
                  Chỉnh sửa hồ sơ
                </Button>
              )}
              <div className="space-y-2 border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground">Mã người dùng</p>
                <p className="break-all font-mono text-xs select-text">{query.data.id}</p>
              </div>
            </div>
          </section>
          <div className="min-w-0 space-y-6">
            <section className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6">
              <h2 className="font-semibold">Giới thiệu</h2>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
                {query.data.biography.trim() || "Người dùng chưa thêm giới thiệu."}
              </p>
            </section>
            <section className="space-y-5 rounded-2xl border bg-card p-5 sm:p-6">
              <h2 className="font-semibold">Thông tin hồ sơ</h2>
              <dl className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Globe2 className="size-4" />
                    Ngôn ngữ
                  </dt>
                  <dd className="break-words text-sm font-medium">
                    {languageName(query.data.locale)}{" "}
                    <span className="font-normal text-muted-foreground">({query.data.locale})</span>
                  </dd>
                </div>
                <div className="space-y-2">
                  <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock3 className="size-4" />
                    Múi giờ
                  </dt>
                  <dd className="break-words text-sm font-medium">{query.data.timeZone}</dd>
                </div>
                <div className="space-y-2">
                  <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="size-4" />
                    Ngày tạo hồ sơ
                  </dt>
                  <dd className="text-sm font-medium">{displayDate(query.data.createdAt)}</dd>
                </div>
                <div className="space-y-2">
                  <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                    <RefreshCw className="size-4" />
                    Cập nhật gần nhất
                  </dt>
                  <dd className="text-sm font-medium">{displayDate(query.data.updatedAt)}</dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
      )}
      <Dialog
        open={!!editing && canRead && canWrite}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa hồ sơ</DialogTitle>
            <DialogDescription>Thay đổi thông tin hiển thị và ảnh đại diện của người dùng.</DialogDescription>
          </DialogHeader>
          {reloadError && (
            <p role="alert" className="text-sm text-destructive">
              {reloadError}
            </p>
          )}
          {editing && (
            <ProfileForm
              key={`${editing.id}-${editing.version}-${editRevision}`}
              profile={editing}
              admin
              readOnly={reloading}
              onSaved={() => setEditing(null)}
              onReload={() => void reloadEditor()}
            />
          )}
        </DialogContent>
      </Dialog>
    </Page>
  )
}
