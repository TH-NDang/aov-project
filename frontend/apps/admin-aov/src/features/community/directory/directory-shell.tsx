import { useState, type ComponentProps, type ReactNode } from "react"
import { Link, useNavigate, useSearchParams } from "react-router"
import { useQueries } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import type { PersonRole, PersonnelGroup, ProfileKind } from "@aov/community-contracts"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { PageHeader } from "@/components/page-header"
import { EsportsPage, LoadError, type Access } from "@/features/esports/pages/esports-shell"
import { ManagementEmpty, ManagementLoading, ManagementPanel } from "@/features/tournaments/components/management-list"
import { CreateProfileSheet } from "../components/create-profile-sheet"
import { ProfileCountry } from "../components/profile-country"
import { teamRegionName } from "@/features/tournaments/components/team-region"
import { findProfileCountry } from "../model/profile-country-options"
import { profileKindIcons, profileRoleIcons } from "../components/profile-icons"
import { directoryApi } from "./directory-api"
import { pageKeys } from "../api/page-api"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { formatNumber } from "@/lib/text"

export type { PersonnelGroup }

export const directorySections = [
  { kind: "TEAM", path: "/teams", label: "Đội tuyển", create: "Tạo đội tuyển", group: undefined },
  { kind: "PLAYER", path: "/players", label: "Tuyển thủ", create: "Tạo tuyển thủ", group: undefined },
  { kind: "PERSON", path: "/coaches", label: "Ban huấn luyện", create: "Tạo thành viên", group: "COACHING" },
  { kind: "PERSON", path: "/broadcast", label: "Broadcast", create: "Tạo thành viên", group: "BROADCAST" },
  { kind: "PERSON", path: "/creators", label: "Nhà sáng tạo", create: "Tạo nhà sáng tạo", group: "CREATOR" },
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
      queryKey: pageKeys.directory.count(actorKey, section.kind, section.group),
      staleTime: 60_000,
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        directoryApi.profiles(
          { kind: section.group ? undefined : section.kind, personRole: section.group, size: 1 },
          signal,
        ),
    })),
  })
  return (
    <nav
      aria-label="Loại hồ sơ"
      className="@container/directory-nav flex items-center gap-1 overflow-x-auto border-b pb-2 [scrollbar-width:thin]"
    >
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
              "type-body inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2 whitespace-nowrap transition hover:bg-muted @5xl/directory-nav:gap-2 @5xl/directory-nav:px-3",
              active ? "bg-muted text-foreground" : "text-muted-foreground",
            )}
          >
            <Icon aria-hidden="true" className="hidden size-5 shrink-0 @5xl/directory-nav:block" />
            {section.label}
            {total !== undefined && <span className="type-meta tabular-nums">{formatNumber(total)}</span>}
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
  const setFilter = (name: K, value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value) next.set(name, value)
        else next.delete(name)
        return next
      },
      { replace: true },
    )
  const reset = () => setParams(new URLSearchParams(), { replace: true })
  return { values, setFilter, reset, filtered: names.some((name) => name !== "sort" && !!values[name]) }
}

export function DirectoryFooter({
  total,
  noun,
  query,
}: {
  total: number
  noun: string
  query: ComponentProps<typeof InfiniteScroll>["query"]
}) {
  return (
    <>
      <InfiniteScroll query={query} label={`Đang tải thêm ${noun}`} />
      <p className="type-meta border-t px-3 py-3 tabular-nums @3xl:px-4" role="status">
        {formatNumber(total)} {noun}
      </p>
    </>
  )
}

/** The states every list shares: loading, failure, nothing matching. */
export function DirectoryBody({
  query,
  empty,
  toolbar,
  children,
}: {
  query: { isPending: boolean; isLoadingError: boolean; error: unknown; refetch: () => unknown }
  empty: { title: string; description: string; isEmpty: boolean }
  /** Stays on screen through loading and empty results, so a search can always be changed. */
  toolbar: ReactNode
  children: ReactNode
}) {
  if (query.isLoadingError) return <LoadError error={query.error} onRetry={() => void query.refetch()} />
  return (
    <ManagementPanel>
      {toolbar}
      {query.isPending ? (
        <ManagementLoading />
      ) : empty.isEmpty ? (
        <ManagementEmpty title={empty.title} description={empty.description} />
      ) : (
        children
      )}
    </ManagementPanel>
  )
}

/** The name a country filter calls a code by. */
export const countryName = (code: string) => findProfileCountry(code)?.name ?? teamRegionName(code)

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
  return <span className="type-label rounded-md bg-muted px-2 py-0.5">Đã xuất bản</span>
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
