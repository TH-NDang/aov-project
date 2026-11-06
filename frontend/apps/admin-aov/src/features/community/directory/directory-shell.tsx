import { useState, type ReactNode } from "react"
import { Link, useNavigate, useSearchParams } from "react-router"
import { useQueries } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import type { PersonRole, ProfileKind } from "@aov/community-contracts"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { PageHeader } from "@/components/page-header"
import { EsportsPage, LoadError, type Access } from "@/features/esports/pages/esports-shell"
import { ManagementEmpty, ManagementLoading, ManagementPanel } from "@/features/tournaments/management-list"
import { CreateProfileSheet } from "../create-profile-sheet"
import { ProfileCountry } from "../profile-country"
import { findProfileCountry } from "../profile-country-options"
import { profileKindIcons, profileRoleIcons } from "../profile-icons"
import { DIRECTORY_PAGE_SIZE, directoryApi, directoryKeys } from "./directory-api"

export type PersonnelGroup = "COACHING" | "BROADCAST"

export const directorySections = [
  { kind: "TEAM", path: "/teams", label: "Đội tuyển", create: "Tạo đội tuyển", group: undefined },
  { kind: "PLAYER", path: "/players", label: "Tuyển thủ", create: "Tạo tuyển thủ", group: undefined },
  { kind: "PERSON", path: "/coaches", label: "Ban huấn luyện", create: "Tạo thành viên", group: "COACHING" },
  { kind: "PERSON", path: "/broadcast", label: "Broadcast", create: "Tạo thành viên", group: "BROADCAST" },
  { kind: "ORGANIZATION", path: "/organizations", label: "Tổ chức", create: "Tạo tổ chức", group: undefined },
  { kind: "CIRCUIT", path: "/circuits", label: "Hệ thống giải", create: "Tạo hệ thống giải", group: undefined },
] as const satisfies readonly {
  kind: ProfileKind
  path: string
  label: string
  create: string
  group?: PersonnelGroup
}[]
export type DirectorySection = (typeof directorySections)[number]

const sectionIcon = (section: DirectorySection) =>
  section.group ? profileRoleIcons[section.group] : profileKindIcons[section.kind]

/** Navigation between the competition directories, each with how many records it holds. */
function DirectoryNav({ current, actorKey }: { current: DirectorySection; actorKey: string }) {
  const counts = useQueries({
    queries: directorySections.map((section) => ({
      queryKey: [...directoryKeys, actorKey, "count", section.kind, section.group],
      staleTime: 60_000,
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        directoryApi.profiles(
          { kind: section.group ? undefined : section.kind, personRole: section.group, size: 1 },
          signal,
        ),
    })),
  })
  return (
    <nav aria-label="Loại hồ sơ" className="flex flex-wrap items-center gap-1 border-b pb-2">
      {directorySections.map((section, index) => {
        const Icon = sectionIcon(section)
        const active = section.path === current.path
        const total = counts[index]?.data?.totalElements
        return (
          <Link
            key={section.path}
            to={section.path}
            aria-current={active ? "page" : undefined}
            className={cn(
              "type-body inline-flex h-9 items-center gap-2 rounded-md px-3 transition hover:bg-muted",
              active ? "bg-muted text-foreground" : "text-muted-foreground",
            )}
          >
            <Icon aria-hidden="true" className="size-5 shrink-0" />
            {section.label}
            {total !== undefined && <span className="type-meta tabular-nums">{total.toLocaleString("vi-VN")}</span>}
          </Link>
        )
      })}
    </nav>
  )
}

export function DirectoryShell({
  section,
  access,
  summary,
  initialRoles = [],
  children,
}: {
  section: DirectorySection
  access: Access
  summary?: ReactNode
  initialRoles?: PersonRole[]
  children: ReactNode
}) {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  return (
    <EsportsPage>
      <PageHeader
        title={section.label}
        description={summary}
        actions={
          access.canWrite && (
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" />
              {section.create}
            </Button>
          )
        }
      />
      <DirectoryNav current={section} actorKey={access.actorKey} />
      {children}
      {creating && (
        <CreateProfileSheet
          kind={section.kind}
          initialRoles={initialRoles}
          onClose={() => setCreating(false)}
          onCreated={(entry) => navigate(`/pages/${entry.id}`)}
        />
      )}
    </EsportsPage>
  )
}

/** Filters live in the address, so going back from a profile returns to the same list. */
export function useDirectoryFilters<K extends string>(names: readonly K[]) {
  const [params, setParams] = useSearchParams()
  const values = Object.fromEntries(names.map((name) => [name, params.get(name) ?? ""])) as Record<K, string>
  const page = Math.max(0, Number(params.get("page") ?? 0) || 0)
  const setFilter = (name: K, value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value) next.set(name, value)
        else next.delete(name)
        next.delete("page")
        return next
      },
      { replace: true },
    )
  const setPage = (value: number) =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (value) next.set("page", String(value))
      else next.delete("page")
      return next
    })
  const reset = () => setParams(new URLSearchParams(), { replace: true })
  return { values, page, setFilter, setPage, reset, filtered: names.some((name) => name !== "sort" && !!values[name]) }
}

export function DirectoryFooter({
  total,
  page,
  noun,
  onPage,
}: {
  total: number
  page: number
  noun: string
  onPage: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / DIRECTORY_PAGE_SIZE))
  const change = (next: number) => {
    onPage(next)
    window.scrollTo?.({ top: 0 })
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-3 py-3 @3xl:px-4">
      <p className="type-meta tabular-nums" role="status">
        {total.toLocaleString("vi-VN")} {noun}
      </p>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Trang trước"
            disabled={!page}
            onClick={() => change(page - 1)}
          >
            <ChevronLeft />
          </Button>
          <span className="type-meta tabular-nums">
            Trang {page + 1}/{pages}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Trang sau"
            disabled={page + 1 >= pages}
            onClick={() => change(page + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  )
}

/** The states every list shares: loading, failure, nothing matching. */
export function DirectoryBody({
  query,
  empty,
  children,
}: {
  query: { isPending: boolean; error: unknown; refetch: () => unknown; data?: unknown }
  empty: { title: string; description: string; isEmpty: boolean }
  children: ReactNode
}) {
  if (query.error) return <LoadError error={query.error} onRetry={() => void query.refetch()} />
  if (query.isPending) return <ManagementLoading />
  return (
    <ManagementPanel>
      {empty.isEmpty ? <ManagementEmpty title={empty.title} description={empty.description} /> : children}
    </ManagementPanel>
  )
}

/** Flag and name; profile pages may hold a code or a written name, and a value may list several places. */
export function CountryLabel({ country }: { country?: string | null }) {
  const whole = findProfileCountry(country)
  const parts = (country || "")
    .split(/[/,;]+/)
    .map((part) => part.trim())
    .filter(Boolean)
  const label =
    whole?.name ?? (parts.map((part) => findProfileCountry(part)?.name ?? part).join(" / ") || "Chưa rõ khu vực")
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <ProfileCountry country={country} />
      <span className="truncate">{label}</span>
    </span>
  )
}

/** A compact published mark: almost every record is a draft, so only the exception is worth the space. */
export function PublishedMark({ published }: { published?: boolean }) {
  if (!published) return null
  return <span className="type-label rounded-md bg-muted px-2 py-0.5">Đã công bố</span>
}

/** One figure of a directory entry, labelled below it. */
export function Figure({ value, label, strong }: { value: ReactNode; label: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dd className={cn("type-section-title esp-num truncate tabular-nums", !strong && "text-foreground")}>{value}</dd>
      <dt className="type-meta truncate">{label}</dt>
    </div>
  )
}
