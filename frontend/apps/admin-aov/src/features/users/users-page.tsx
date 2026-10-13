import { useState } from "react"
import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { useSession } from "@/app/auth/auth-gate"
import { Page, PageHeader } from "@/components/page-header"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { ProfileForm } from "./profile-form"
import { listProfiles, profileError, selfProfile, userKeys } from "./user-api"

export function ProfilePage() {
  const { actor } = useSession()
  const [revision, setRevision] = useState(0)
  const query = useQuery({
    queryKey: [...userKeys.self, actor?.issuer, actor?.subject],
    queryFn: ({ signal }) => selfProfile(signal),
    refetchInterval: 600000,
  })
  return (
    <Page>
      <PageHeader
        title="Hồ sơ của tôi"
        description="Thông tin hiển thị dùng chung cho Wiki, Stream và các phần khác."
      />
      {query.isPending ? (
        <p role="status">Đang tải hồ sơ…</p>
      ) : query.isError ? (
        <div role="alert">
          <p>{profileError(query.error)}</p>
          <Button onClick={() => void query.refetch()}>Thử lại</Button>
        </div>
      ) : (
        <div className="w-full max-w-2xl rounded-xl border bg-card p-4 sm:p-6">
          <ProfileForm
            key={`${actor?.subject}-${revision}`}
            profile={query.data}
            onReload={() => {
              void query.refetch().then(() => setRevision((value) => value + 1))
            }}
          />
        </div>
      )}
    </Page>
  )
}

export function UsersPage() {
  const { actor } = useSession()
  const canRead = actor?.capabilities.includes("user:read") === true
  const [search, setSearch] = useState("")
  const [term, setTerm] = useState("")
  const [page, setPage] = useState(0)
  const query = useQuery({
    queryKey: [...userKeys.all, "list", actor?.issuer, actor?.subject, term, page],
    queryFn: ({ signal }) => listProfiles(term, page, signal),
    enabled: canRead,
  })
  return (
    <Page>
      <PageHeader title="Người dùng" description="Quản lý hồ sơ đã được người dùng tạo trong hệ thống." />
      {!canRead ? (
        <p role="alert">Bạn chưa có quyền xem danh sách người dùng.</p>
      ) : (
        <>
          <form
            className="flex max-w-lg gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              setTerm(search.trim())
              setPage(0)
            }}
          >
            <Input
              aria-label="Tìm người dùng theo tên"
              placeholder="Tìm theo tên hiển thị…"
              maxLength={80}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Button>Tìm kiếm</Button>
          </form>
          {query.isPending ? (
            <p role="status">Đang tải danh sách…</p>
          ) : query.isError ? (
            <div role="alert">
              <p>{profileError(query.error)}</p>
              <Button onClick={() => void query.refetch()}>Thử lại</Button>
            </div>
          ) : (
            <>
              {query.data.items.length === 0 ? (
                <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
                  Chưa có hồ sơ phù hợp. Người dùng xuất hiện ở đây sau lần lưu hồ sơ đầu tiên.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {query.data.items.map((profile) => (
                    <Link
                      key={profile.id}
                      to={`/users/${profile.id}`}
                      className="flex min-w-0 items-center gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <div className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-medium">
                        {profile.displayName.slice(0, 2).toUpperCase()}
                        {profile.avatarUrl && (
                          <img
                            src={profile.avatarUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="absolute inset-0 size-full object-cover"
                            onError={(event) => {
                              event.currentTarget.hidden = true
                            }}
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{profile.displayName}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {profile.locale} · {profile.timeZone}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">Xem hồ sơ</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <p>
                  {query.data.totalElements} hồ sơ · Trang {page + 1}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>
                    Trước
                  </Button>
                  <Button
                    variant="outline"
                    disabled={(page + 1) * 20 >= query.data.totalElements}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Sau
                  </Button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </Page>
  )
}
