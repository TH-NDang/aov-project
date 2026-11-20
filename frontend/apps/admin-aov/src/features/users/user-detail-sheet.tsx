import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CalendarDays, Clock3, Globe2, Pencil, RefreshCw, UserRound } from "lucide-react"
import { useSession } from "@/app/auth/auth-gate"
import { Button } from "@aov/ui/components/button"
import { Avatar, AvatarFallback, AvatarImage } from "@aov/ui/components/avatar"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@aov/ui/components/dialog"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import { getProfile, profileError, userKeys, type UserProfile } from "./user-api"
import { ProfileForm } from "./profile-form"
import { LocalTime } from "@aov/ui/components/local-time"

function displayDate(value: string | null) {
  return <LocalTime value={value} format={{ dateStyle: "medium", timeStyle: "short" }} fallback="Chưa có thông tin" />
}
function languageName(locale: string) {
  try {
    return new Intl.DisplayNames(["vi"], { type: "language" }).of(locale) ?? locale
  } catch {
    return locale
  }
}

/**
 * One user's profile in a drawer at the right of the users list, so the list keeps its search and scroll behind it.
 * The address still names the user (`/users/:userId`), so the drawer can be linked and reopened.
 */
export function UserDetailSheet({ userId, onClose }: { userId: string | undefined; onClose: () => void }) {
  return (
    <Sheet open={!!userId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-md">
        {userId && <UserDetail userId={userId} />}
      </SheetContent>
    </Sheet>
  )
}

function UserDetail({ userId }: { userId: string }) {
  const { actor } = useSession()
  const canRead = actor?.capabilities.includes("user:read") === true
  const canWrite = actor?.capabilities.includes("user:write") === true
  const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
  const [editing, setEditing] = useState<UserProfile | null>(null)
  const [editRevision, setEditRevision] = useState(0)
  const [reloadError, setReloadError] = useState("")
  const [reloading, setReloading] = useState(false)
  const query = useQuery({
    queryKey: userKeys.detail(actor?.issuer, actor?.subject, userId),
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
    <>
      <SheetHeader className="border-b pr-12">
        <SheetTitle>Chi tiết người dùng</SheetTitle>
        <SheetDescription className="sr-only">Hồ sơ của người dùng đang chọn</SheetDescription>
      </SheetHeader>
      <div className="space-y-5 p-4">
        {!canRead ? (
          <p role="alert" className="rounded-xl border p-4 text-sm">
            Bạn chưa có quyền xem hồ sơ người dùng. Cần quyền user:read từ quản trị viên.
          </p>
        ) : !validId ? (
          <p role="alert" className="rounded-xl border p-4 text-sm">
            Đường dẫn người dùng không hợp lệ. Hãy chọn một hồ sơ từ danh sách.
          </p>
        ) : query.isPending ? (
          <p role="status" className="rounded-xl border p-4 text-sm">
            Đang tải hồ sơ người dùng…
          </p>
        ) : query.isError ? (
          <div role="alert" className="space-y-3 rounded-xl border p-4">
            <p className="text-sm">{profileError(query.error)}</p>
            <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
              Thử lại
            </Button>
          </div>
        ) : (
          <>
            <section className="flex items-center gap-4">
              <Avatar className="size-16">
                <AvatarImage
                  key={query.data.avatarUrl}
                  src={query.data.avatarUrl ?? undefined}
                  alt={`Ảnh đại diện của ${query.data.displayName}`}
                  referrerPolicy="no-referrer"
                />
                <AvatarFallback className="text-base">
                  {query.data.displayName.slice(0, 2).toUpperCase() || <UserRound />}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h2 className="type-section-title break-words">{query.data.displayName}</h2>
                <p className="type-meta break-all font-mono select-text">{query.data.id}</p>
              </div>
            </section>
            <div className="flex gap-2">
              {canWrite && (
                <Button
                  className="flex-1"
                  onClick={() => {
                    setReloadError("")
                    setEditing(query.data)
                  }}
                >
                  <Pencil />
                  Chỉnh sửa hồ sơ
                </Button>
              )}
              <Button
                variant="outline"
                disabled={query.isFetching}
                onClick={() => void query.refetch()}
                aria-label="Tải lại hồ sơ"
              >
                <RefreshCw className={query.isFetching ? "animate-spin" : undefined} />
                {!canWrite && "Tải lại"}
              </Button>
            </div>
            <section className="space-y-2 border-t pt-4">
              <h3 className="type-label text-muted-foreground">Giới thiệu</h3>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                {query.data.biography.trim() || "Người dùng chưa thêm giới thiệu."}
              </p>
            </section>
            <section className="space-y-3 border-t pt-4">
              <h3 className="type-label text-muted-foreground">Thông tin hồ sơ</h3>
              <dl className="grid gap-4">
                <div className="space-y-1">
                  <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Globe2 className="size-4" />
                    Ngôn ngữ
                  </dt>
                  <dd className="break-words text-sm font-medium">
                    {languageName(query.data.locale)}{" "}
                    <span className="font-normal text-muted-foreground">({query.data.locale})</span>
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock3 className="size-4" />
                    Múi giờ
                  </dt>
                  <dd className="break-words text-sm font-medium">{query.data.timeZone}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="size-4" />
                    Ngày tạo hồ sơ
                  </dt>
                  <dd className="text-sm font-medium">{displayDate(query.data.createdAt)}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                    <RefreshCw className="size-4" />
                    Cập nhật gần nhất
                  </dt>
                  <dd className="text-sm font-medium">{displayDate(query.data.updatedAt)}</dd>
                </div>
              </dl>
            </section>
          </>
        )}
      </div>
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
    </>
  )
}
