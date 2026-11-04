import { useState } from "react"
import { Link, useNavigate } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight, Building2, CheckCircle2, FileText, Plus, Search, ShieldCheck, Users } from "lucide-react"
import { profileKindLabels, type ProfileKind } from "@aov/community-contracts"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { Page, PageHeader } from "@/components/page-header"
import { AccessGate, type Access } from "@/features/esports/pages/esports-shell"
import { pageApi, pageError, pageKeys } from "./page-api"
import { CreateProfileSheet } from "./create-profile-sheet"

const paths: Partial<Record<ProfileKind, string>> = {
  ORGANIZATION: "/organizations",
  TEAM: "/teams",
  PLAYER: "/players",
}
export const profileDirectoryPath = (kind: ProfileKind) => paths[kind] ?? "/tournaments"
export function PageDirectory({ kind }: { kind: ProfileKind }) {
  return <AccessGate>{(access) => <Directory key={kind} kind={kind} access={access} />}</AccessGate>
}
function Directory({ kind, access }: { kind: ProfileKind; access: Access }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const [creating, setCreating] = useState(false)
  const query = useQuery({
    queryKey: [...pageKeys, access.actorKey, kind, search, page],
    queryFn: () => pageApi.list(kind, search, page),
  })
  const label = profileKindLabels[kind]
  return (
    <Page className="mx-auto w-full max-w-[1400px] gap-6">
      <PageHeader
        title={label}
        description="Hồ sơ thi đấu, thông tin công khai và quyền đại diện."
        actions={
          access.canWrite && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              Tạo hồ sơ
            </Button>
          )
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <span className="type-label mr-2 text-muted-foreground">DANH BẠ THI ĐẤU</span>
        {(Object.keys(paths) as ProfileKind[]).map((type) => (
          <Button key={type} variant={kind === type ? "secondary" : "ghost"} asChild>
            <Link to={profileDirectoryPath(type)}>{profileKindLabels[type]}</Link>
          </Button>
        ))}
      </div>
      <div className="rounded-xl border bg-card">
        <div className="flex items-center gap-3 border-b p-4">
          <Search className="size-4 text-muted-foreground" />
          <Input
            aria-label={`Tìm ${label.toLowerCase()}`}
            placeholder="Tìm theo tên hoặc mã hồ sơ…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
            className="max-w-md"
          />
          <span className="type-meta ml-auto">{query.data?.totalElements ?? 0} hồ sơ</span>
        </div>
        {query.isPending ? (
          <p className="type-body p-8">Đang tải hồ sơ…</p>
        ) : query.isError ? (
          <div role="alert" className="space-y-3 p-8">
            <p className="type-body">{pageError(query.error)}</p>
            <Button variant="outline" onClick={() => void query.refetch()}>
              Thử lại
            </Button>
          </div>
        ) : !query.data.items.length ? (
          <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-14 text-center">
            <div className="rounded-2xl border bg-muted p-4">
              <Building2 className="size-8 text-muted-foreground" />
            </div>
            <h2 className="type-section-title">
              {search ? "Không tìm thấy hồ sơ" : `Bắt đầu với ${label.toLowerCase()} đầu tiên`}
            </h2>
            <p className="type-body text-muted-foreground">
              Tạo thông tin có nguồn, công bố trang và để người đại diện nhận quyền quản lý khi họ tham gia.
            </p>
            {!search && access.canWrite && (
              <Button onClick={() => setCreating(true)}>
                <Plus className="size-4" />
                Tạo hồ sơ đầu tiên
              </Button>
            )}
            <div className="mt-5 grid w-full gap-3 sm:grid-cols-3">
              {[
                [FileText, "1. Tạo hồ sơ"],
                [CheckCircle2, "2. Công bố"],
                [ShieldCheck, "3. Nhận đại diện"],
              ].map(([Icon, text]) => {
                const Component = Icon as typeof FileText
                return (
                  <div
                    key={String(text)}
                    className="type-meta flex items-center justify-center gap-2 rounded-lg bg-muted px-3 py-3"
                  >
                    <Component className="size-4" />
                    {String(text)}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="divide-y">
            {query.data.items.map((item) => (
              <Link
                key={item.id}
                to={`/pages/${item.id}`}
                className="flex items-center gap-4 px-5 py-4 transition hover:bg-muted/50"
              >
                {item.content?.avatarUrl ? (
                  <img src={item.content.avatarUrl} alt="" className="size-12 rounded-lg border object-contain" />
                ) : (
                  <div className="flex size-12 items-center justify-center rounded-lg border bg-muted">
                    <Users className="size-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="type-section-title truncate">{item.content?.name || item.code}</p>
                  <p className="type-meta mt-1">
                    {item.content?.country || "Chưa có khu vực"} · /{item.code}
                  </p>
                </div>
                <span className="type-label rounded-md bg-muted px-2.5 py-1.5">
                  {item.published ? "Đã công bố" : "Bản nháp"}
                </span>
                <span className="type-meta hidden sm:block">
                  {item.represented ? "Đại diện đã xác minh" : "AthaHub tổng hợp"}
                </span>
                <ArrowRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
        {query.data && query.data.totalElements > 24 && (
          <div className="flex items-center justify-end gap-3 border-t p-4">
            <Button variant="outline" disabled={!page} onClick={() => setPage(page - 1)}>
              Trước
            </Button>
            <span className="type-meta">Trang {page + 1}</span>
            <Button
              variant="outline"
              disabled={(page + 1) * 24 >= query.data.totalElements}
              onClick={() => setPage(page + 1)}
            >
              Tiếp
            </Button>
          </div>
        )}
      </div>
      {creating && (
        <CreateProfileSheet
          kind={kind}
          onClose={() => setCreating(false)}
          onCreated={(entry) => navigate(`/pages/${entry.id}`)}
        />
      )}
    </Page>
  )
}
