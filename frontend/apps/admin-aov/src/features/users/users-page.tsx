import { useEffect, useMemo, useState } from "react"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { RefreshCw, SearchX, ShieldAlert, UsersRound } from "lucide-react"
import { useSession } from "@/app/auth/auth-gate"
import { Page, PageHeader } from "@/components/page-header"
import { SearchField } from "@/components/search-field"
import { InfiniteScroll } from "@/components/infinite-scroll"
import { Button } from "@aov/ui/components/button"
import { ProfileForm } from "./profile-form"
import { UsersList, UsersListSkeleton } from "./users-list"
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
    <Page className="gap-0 p-0 md:p-0">
      {query.isPending ? (
        <p role="status" className="p-6">
          Đang tải hồ sơ…
        </p>
      ) : query.isError ? (
        <div role="alert" className="p-6">
          <p>{profileError(query.error)}</p>
          <Button onClick={() => void query.refetch()}>Thử lại</Button>
        </div>
      ) : (
        <ProfileForm
          fullWidth
          key={`${actor?.subject}-${revision}`}
          profile={query.data}
          onReload={() => {
            void query.refetch().then(() => setRevision((value) => value + 1))
          }}
        />
      )}
    </Page>
  )
}

export function UsersPage() {
  const { actor } = useSession()
  const canRead = actor?.capabilities.includes("user:read") === true
  const [search, setSearch] = useState("")
  const [term, setTerm] = useState("")
  // Searches by server query once typing pauses.
  useEffect(() => {
    const next = search.trim()
    if (next === term) return
    const timer = window.setTimeout(() => {
      setTerm(next)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [search, term])
  const query = useInfiniteQuery({
    queryKey: [...userKeys.all, "infinite-list", actor?.issuer, actor?.subject, term],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => listProfiles(term, pageParam, signal),
    getNextPageParam: (last) =>
      last.items.length > 0 && last.size > 0 && (last.page + 1) * last.size < last.totalElements
        ? last.page + 1
        : undefined,
    enabled: canRead,
  })
  const profiles = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data])
  const total = query.data?.pages[0]?.totalElements ?? 0
  return (
    <Page>
      <PageHeader
        title="Người dùng"
        description="Tra cứu hồ sơ và thông tin hiển thị của người dùng."
        search={
          canRead ? (
            <SearchField
              placement="header"
              label="Tìm người dùng theo tên"
              placeholder="Tìm theo tên hiển thị…"
              shortcut
              maxLength={80}
              value={search}
              onChange={setSearch}
            />
          ) : undefined
        }
      />
      {!canRead ? (
        <div role="alert" className="flex items-center gap-3 rounded-xl border bg-card p-5 text-sm">
          <ShieldAlert aria-hidden className="size-5 shrink-0 text-muted-foreground" />
          Bạn chưa có quyền xem danh sách người dùng.
        </div>
      ) : (
        <section aria-label="Danh sách người dùng" className="overflow-hidden rounded-xl border bg-card">
          <div className="flex min-h-16 items-center justify-between gap-3 border-b px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                <UsersRound aria-hidden className="size-4 text-muted-foreground" />
              </span>
              <h2 className="truncate text-sm font-semibold">{term ? "Kết quả tìm kiếm" : "Danh sách hồ sơ"}</h2>
              {query.data && (
                <span role="status" className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums">
                  {total.toLocaleString("vi-VN")}
                  <span className="sr-only"> hồ sơ</span>
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Làm mới danh sách người dùng"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              <RefreshCw aria-hidden className={query.isFetching ? "motion-safe:animate-spin" : undefined} />
              <span className="hidden sm:inline">Làm mới</span>
            </Button>
          </div>
          {query.isPending ? (
            <UsersListSkeleton />
          ) : query.isError && !query.data ? (
            <div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <p className="text-sm text-muted-foreground">{profileError(query.error)}</p>
              <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
                <RefreshCw aria-hidden />
                Thử lại
              </Button>
            </div>
          ) : (
            <>
              {profiles.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-12 text-center">
                  <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
                    {term ? (
                      <SearchX aria-hidden className="size-5 text-muted-foreground" />
                    ) : (
                      <UsersRound aria-hidden className="size-5 text-muted-foreground" />
                    )}
                  </span>
                  <h3 className="text-sm font-semibold">
                    {term ? "Không tìm thấy người dùng" : "Chưa có hồ sơ người dùng"}
                  </h3>
                  <p className="mt-1.5 max-w-sm break-words text-sm text-muted-foreground">
                    {term
                      ? `Không có tên hiển thị phù hợp với “${term}”. Hãy thử một tên khác.`
                      : "Người dùng xuất hiện ở đây sau lần lưu hồ sơ đầu tiên."}
                  </p>
                  {term && (
                    <Button variant="outline" size="sm" className="mt-4" onClick={() => setSearch("")}>
                      Xóa tìm kiếm
                    </Button>
                  )}
                </div>
              ) : (
                <UsersList profiles={profiles} />
              )}
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                <p className="tabular-nums">
                  Đã hiển thị {profiles.length.toLocaleString("vi-VN")} / {total.toLocaleString("vi-VN")} hồ sơ
                </p>
                {query.isError ? (
                  <div role="alert" className="flex flex-wrap items-center gap-2">
                    <span>{profileError(query.error)}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={query.isFetching}
                      onClick={() => void (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch())}
                    >
                      <RefreshCw aria-hidden />
                      Thử lại
                    </Button>
                  </div>
                ) : query.hasNextPage ? (
                  <InfiniteScroll query={query} enabled={search.trim() === term} label="Đang tải thêm người dùng…" />
                ) : query.isFetching ? (
                  <span role="status">Đang làm mới danh sách…</span>
                ) : profiles.length > 0 ? (
                  <span>Đã tải tất cả {term ? "kết quả" : "hồ sơ"}</span>
                ) : null}
              </div>
            </>
          )}
        </section>
      )}
    </Page>
  )
}
