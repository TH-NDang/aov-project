import { useState } from "react"
import { Link, useNavigate } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight, CheckCircle2, FileText, Plus, Search, ShieldCheck } from "lucide-react"
import {
  isCoachingRole,
  personRoleLabels,
  profileKindLabels,
  type ProfileKind,
  type PersonRole,
  type PersonRoleFilter,
} from "@aov/community-contracts"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { Page, PageHeader } from "@/components/page-header"
import { AccessGate, type Access } from "@/features/esports/pages/esports-shell"
import { pageApi, pageError, pageKeys } from "./page-api"
import { CreateProfileSheet } from "./create-profile-sheet"
import { ProfileCountry } from "./profile-country"
import { profileKindIcons, profileRoleIcons, ProfileRoleIcon, ProfileTypeIcon } from "./profile-icons"

const directories = [
  { kind: "CIRCUIT", path: "/circuits", label: "Hệ thống giải", group: undefined, icon: profileKindIcons.CIRCUIT },
  {
    kind: "ORGANIZATION",
    path: "/organizations",
    label: "Tổ chức",
    group: undefined,
    icon: profileKindIcons.ORGANIZATION,
  },
  { kind: "TEAM", path: "/teams", label: "Đội tuyển", group: undefined, icon: profileKindIcons.TEAM },
  { kind: "PLAYER", path: "/players", label: "Tuyển thủ", group: undefined, icon: profileKindIcons.PLAYER },
  { kind: "PERSON", path: "/coaches", label: "Ban huấn luyện", group: "COACHING", icon: profileRoleIcons.COACHING },
  { kind: "PERSON", path: "/broadcast", label: "Broadcast", group: "BROADCAST", icon: profileRoleIcons.BROADCAST },
] as const
type PersonnelGroup = "COACHING" | "BROADCAST"
export const profileDirectoryPath = (kind: ProfileKind, roles: PersonRole[] = []) =>
  kind === "PERSON"
    ? roles.some(isCoachingRole)
      ? "/coaches"
      : "/broadcast"
    : directories.find((item) => item.kind === kind)!.path
export function PageDirectory({ kind, group }: { kind: ProfileKind; group?: PersonnelGroup }) {
  return (
    <AccessGate>
      {(access) => <Directory key={`${kind}:${group}`} kind={kind} group={group} access={access} />}
    </AccessGate>
  )
}
function Directory({ kind, group, access }: { kind: ProfileKind; group?: PersonnelGroup; access: Access }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const [creating, setCreating] = useState(false)
  const [roleFilter, setRoleFilter] = useState<PersonRoleFilter | undefined>(group)
  const query = useQuery({
    queryKey: [...pageKeys, access.actorKey, kind, roleFilter, search, page],
    queryFn: () => pageApi.list(group ? "" : kind, search, page, roleFilter),
  })
  const label = directories.find((item) => item.kind === kind && item.group === group)?.label || profileKindLabels[kind]
  const roles = (Object.keys(personRoleLabels) as PersonRole[]).filter((role) =>
    group === "COACHING" ? isCoachingRole(role) : !isCoachingRole(role),
  )
  return (
    <Page className="mx-auto w-full max-w-[1400px] gap-6">
      <PageHeader
        title="Hồ sơ thi đấu"
        actions={
          access.canWrite && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              Tạo hồ sơ
            </Button>
          )
        }
      />
      <nav aria-label="Loại hồ sơ" className="flex flex-wrap items-center gap-2">
        {directories.map((item) => (
          <Button key={item.path} variant={kind === item.kind && group === item.group ? "secondary" : "ghost"} asChild>
            <Link to={item.path} aria-current={kind === item.kind && group === item.group ? "page" : undefined}>
              <item.icon aria-hidden="true" className="size-5 shrink-0" />
              {item.label}
            </Link>
          </Button>
        ))}
      </nav>
      {group && (
        <div aria-label="Lọc theo vai trò" className="flex flex-wrap gap-2">
          {[group, ...roles].map((role) => (
            <Button
              key={role}
              size="sm"
              variant={roleFilter === role ? "secondary" : "outline"}
              aria-pressed={roleFilter === role}
              onClick={() => {
                setRoleFilter(role)
                setPage(0)
              }}
            >
              <ProfileRoleIcon role={role} className="size-4 shrink-0" />
              {role === group ? "Tất cả" : personRoleLabels[role as PersonRole]}
            </Button>
          ))}
        </div>
      )}
      <div className="admin-panel">
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
              {group ? (
                <ProfileRoleIcon role={roleFilter || group} className="size-8 text-muted-foreground" />
              ) : (
                <ProfileTypeIcon kind={kind} className="size-8 text-muted-foreground" />
              )}
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
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-lg border bg-muted">
                    <ProfileTypeIcon
                      kind={item.kind}
                      roles={item.content?.personRoles}
                      filter={roleFilter}
                      className="size-5 text-muted-foreground"
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="type-section-title truncate">{item.content?.name || item.code}</p>
                  {!!item.content?.personRoles?.length && (
                    <p className="type-meta mt-1">
                      {item.content.personRoles.map((role) => personRoleLabels[role]).join(" · ")}
                    </p>
                  )}
                  <p className="type-meta mt-1 flex items-center gap-2">
                    <ProfileCountry country={item.content?.country} />
                    <span className="truncate">/{item.code}</span>
                  </p>
                </div>
                <span className="type-label rounded-md bg-muted px-2.5 py-1.5">
                  {item.published ? "Đã công bố" : "Bản nháp"}
                </span>
                <span className="type-meta hidden sm:block">
                  {item.kind === "CIRCUIT"
                    ? "Trang thông tin"
                    : item.represented
                      ? "Đại diện đã xác minh"
                      : "AthaHub tổng hợp"}
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
          initialRoles={
            group
              ? [
                  roleFilter && roleFilter !== "COACHING" && roleFilter !== "BROADCAST"
                    ? roleFilter
                    : group === "COACHING"
                      ? "COACH"
                      : "CASTER",
                ]
              : []
          }
          onClose={() => setCreating(false)}
          onCreated={(entry) => navigate(`/pages/${entry.id}`)}
        />
      )}
    </Page>
  )
}
