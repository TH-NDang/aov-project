import { Link } from "react-router"
import { useInfiniteQuery } from "@tanstack/react-query"
import {
  isCoachingRole,
  personRoleLabels,
  type CommunityProfile,
  type PersonRole,
  type PersonRoleFilter,
} from "@aov/community-contracts"
import { FilterTab, FilterTabs } from "@aov/ui/components/filter-tabs"
import type { Access } from "@/features/esports/pages/esports-shell"
import { PlayerPhoto } from "@/features/esports/components/primitives"
import { ManagementToolbar, managementSelectClassName } from "@/features/tournaments/management-list"
import { activityLabel } from "@/features/tournaments/record-reason"
import { PlatformIcon, platformOf } from "../platform-icon"
import { ProfileRoleIcon } from "../profile-icons"
import { directoryApi, directoryKeys, useDebounced } from "./directory-api"
import {
  CountryLabel,
  DirectoryBody,
  DirectoryFooter,
  DirectoryShell,
  PublishedMark,
  directorySections,
  useDirectoryFilters,
  type PersonnelGroup,
} from "./directory-shell"
import { nextPageOf } from "@aov/ui/lib/page-slice"

const ROLES = Object.keys(personRoleLabels) as PersonRole[]
const rolesOf = (group: PersonnelGroup) => ROLES.filter((role) => isCoachingRole(role) === (group === "COACHING"))

/** Newest stint first; entries without a date keep the order they were written in. */
const latestStint = (entry: CommunityProfile) =>
  [...(entry.content?.history ?? [])].sort((a, b) => (b.startsOn ?? "").localeCompare(a.startsOn ?? ""))[0]

const SORTS = { ACTIVE: "Hoạt động gần đây", ACTIVITY: "Nhiều giải nhất", NAME: "Tên A–Z" }
type PersonnelSort = keyof typeof SORTS

function SortSelect({ sort, onChange }: { sort: PersonnelSort; onChange: (value: string) => void }) {
  return (
    <select
      aria-label="Sắp xếp thành viên"
      value={sort}
      onChange={(event) => onChange(event.target.value)}
      className={managementSelectClassName}
    >
      {Object.entries(SORTS).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  )
}

function usePersonnel(group: PersonnelGroup, access: Access) {
  const filters = useDirectoryFilters(["q", "role", "sort"] as const)
  const role = (filters.values.role || group) as PersonRoleFilter
  const sort = (filters.values.sort || "ACTIVE") as PersonnelSort
  const search = useDebounced(filters.values.q)
  const people = useInfiniteQuery({
    queryKey: [...directoryKeys, access.actorKey, "people", group, role, search, sort],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      directoryApi.profiles({ personRole: role, q: search, sort, page: pageParam }, signal),
    getNextPageParam: nextPageOf,
  })
  const rows = people.data?.pages.flatMap((page) => page.items) ?? []
  return { filters, role, sort, people, rows }
}

function RoleTabs({
  group,
  role,
  onChange,
}: {
  group: PersonnelGroup
  role: PersonRoleFilter
  onChange: (role: string) => void
}) {
  return (
    <FilterTabs label="Lọc theo vai trò">
      <FilterTab active={role === group} onClick={() => onChange("")}>
        <ProfileRoleIcon role={group} className="size-4 shrink-0" />
        Tất cả
      </FilterTab>
      {rolesOf(group).map((value) => (
        <FilterTab key={value} active={role === value} onClick={() => onChange(value)}>
          <ProfileRoleIcon role={value} className="size-4 shrink-0" />
          {personRoleLabels[value]}
        </FilterTab>
      ))}
    </FilterTabs>
  )
}

const RoleLabels = ({ roles }: { roles?: PersonRole[] }) => (
  <span className="flex flex-wrap gap-1">
    {(roles ?? []).map((role) => (
      <span key={role} className="type-meta inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5">
        <ProfileRoleIcon role={role} className="size-3.5 shrink-0" />
        {personRoleLabels[role]}
      </span>
    ))}
  </span>
)

/** Coaches are looked up by where they work, so their latest team and how long they have been at it come first. */
export function CoachDirectory({ access }: { access: Access }) {
  const { filters, role, sort, people, rows } = usePersonnel("COACHING", access)
  return (
    <DirectoryShell
      section={directorySections[2]}
      access={access}
      initialRoles={[role === "COACHING" ? "COACH" : (role as PersonRole)]}
    >
      <RoleTabs group="COACHING" role={role} onChange={(value) => filters.setFilter("role", value)} />
      <DirectoryBody
        query={people}
        empty={{
          isEmpty: !rows.length,
          title: filters.filtered ? "Không tìm thấy thành viên" : "Chưa có ban huấn luyện",
          description: "Thêm huấn luyện viên và chuyên viên phân tích đi cùng các đội.",
        }}
        toolbar={
          <ManagementToolbar
            search={filters.values.q}
            onSearchChange={(value) => filters.setFilter("q", value)}
            searchLabel="Tìm thành viên ban huấn luyện"
            placeholder="Tên hoặc mã hồ sơ…"
            onReset={filters.filtered ? filters.reset : undefined}
          >
            <SortSelect sort={sort} onChange={(value) => filters.setFilter("sort", value)} />
          </ManagementToolbar>
        }
      >
        <ul className="divide-y">
          {rows.map((person) => {
            const stint = latestStint(person)
            return (
              <li key={person.id}>
                <Link
                  to={`/pages/${person.id}`}
                  className="grid items-center gap-x-4 gap-y-1 px-4 py-3 transition hover:bg-muted/50 @3xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.6fr)_auto]"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <PlayerPhoto
                      name={person.content?.name ?? person.code}
                      url={person.content?.avatarUrl ?? undefined}
                      size={44}
                    />
                    <span className="min-w-0">
                      <span className="type-section-title block truncate">{person.content?.name ?? person.code}</span>
                      <span className="type-meta block">
                        <CountryLabel country={person.content?.country} />
                      </span>
                    </span>
                  </span>
                  <RoleLabels roles={person.content?.personRoles} />
                  <span className="min-w-0">
                    {stint ? (
                      <>
                        <span className="type-body block truncate">{stint.title}</span>
                        <span className="type-meta block truncate">{stint.role}</span>
                        {person.lastActiveOn && (
                          <span className="type-meta block truncate">{activityLabel(person.lastActiveOn)}</span>
                        )}
                      </>
                    ) : (
                      <span className="type-meta">Chưa có quá trình làm việc.</span>
                    )}
                  </span>
                  <span className="flex items-center gap-2 @3xl:flex-col @3xl:items-end @3xl:gap-1">
                    <span className="type-meta tabular-nums whitespace-nowrap">
                      {person.content?.history.length ?? 0} giải
                    </span>
                    <PublishedMark published={person.published} />
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
        <DirectoryFooter total={people.data?.pages[0]?.totalElements ?? 0} noun="thành viên" query={people} />
      </DirectoryBody>
    </DirectoryShell>
  )
}

/** Broadcast talent is booked by face and channel, so the photo and social links lead. */
export function BroadcastDirectory({ access }: { access: Access }) {
  const { filters, role, sort, people, rows } = usePersonnel("BROADCAST", access)
  return (
    <DirectoryShell
      section={directorySections[3]}
      access={access}
      initialRoles={[role === "BROADCAST" ? "CASTER" : (role as PersonRole)]}
    >
      <RoleTabs group="BROADCAST" role={role} onChange={(value) => filters.setFilter("role", value)} />
      <DirectoryBody
        query={people}
        empty={{
          isEmpty: !rows.length,
          title: filters.filtered ? "Không tìm thấy thành viên" : "Chưa có ê-kíp broadcast",
          description: "Thêm bình luận viên, MC và khách mời phân tích của các giải.",
        }}
        toolbar={
          <ManagementToolbar
            search={filters.values.q}
            onSearchChange={(value) => filters.setFilter("q", value)}
            searchLabel="Tìm thành viên broadcast"
            placeholder="Tên hoặc mã hồ sơ…"
            onReset={filters.filtered ? filters.reset : undefined}
          >
            <SortSelect sort={sort} onChange={(value) => filters.setFilter("sort", value)} />
          </ManagementToolbar>
        }
      >
        <ul className="grid gap-3 p-3 @2xl:grid-cols-2 @3xl:p-4 @5xl:grid-cols-3 @7xl:grid-cols-4">
          {rows.map((person) => {
            const name = person.content?.name ?? person.code
            const stint = latestStint(person)
            return (
              <li
                key={person.id}
                className="relative flex min-w-0 flex-col items-center gap-2 rounded-lg border bg-background p-4 text-center transition hover:border-primary/50"
              >
                <PlayerPhoto name={name} url={person.content?.avatarUrl ?? undefined} size={80} />
                <h2 className="type-section-title max-w-full truncate">
                  <Link to={`/pages/${person.id}`} className="after:absolute after:inset-0 after:rounded-lg">
                    {name}
                  </Link>
                </h2>
                <RoleLabels roles={person.content?.personRoles} />
                <p className="type-meta">
                  <CountryLabel country={person.content?.country} />
                </p>
                <p className="type-meta w-full truncate">{stint ? stint.title : "Chưa có giải đã tham gia."}</p>
                {!!person.content?.links.length && (
                  <div className="relative z-10 mt-auto flex flex-wrap justify-center gap-1">
                    {person.content.links.map((link) => (
                      <a
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`${link.label || platformOf(link.url).name} của ${name}`}
                        className="grid size-8 place-items-center rounded-md border transition hover:bg-muted"
                      >
                        <PlatformIcon url={link.url} className="size-4" />
                      </a>
                    ))}
                  </div>
                )}
                <PublishedMark published={person.published} />
              </li>
            )
          })}
        </ul>
        <DirectoryFooter total={people.data?.pages[0]?.totalElements ?? 0} noun="thành viên" query={people} />
      </DirectoryBody>
    </DirectoryShell>
  )
}
