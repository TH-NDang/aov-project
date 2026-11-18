import { useMemo } from "react"
import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { ExternalLink } from "lucide-react"
import type { CommunityProfile, CompetitionPageEntry } from "@aov/community-contracts"
import { tournamentPath, type Access } from "@/features/esports/pages/esports-shell"
import { Monogram, TierBadge } from "@/features/esports/components/primitives"
import { initials } from "@/features/esports/model/game-view"
import { ManagementToolbar, managementSelectClassName } from "@/features/tournaments/components/management-list"
import { activityLabel } from "@/features/tournaments/model/record-reason"
import { directoryApi, useDebounced, yearRange } from "./directory-api"
import { pageKeys } from "../api/page-api"
import {
  CountryLabel,
  DirectoryBody,
  DirectoryShell,
  PublishedMark,
  directorySections,
  useDirectoryFilters,
} from "./directory-shell"

const COMPETITION_PAGE_SORTS = { ACTIVE: "Gần đây trước", TOURNAMENTS: "Nhiều giải nhất", NAME: "Tên A–Z" }
type CompetitionPageSort = keyof typeof COMPETITION_PAGE_SORTS

/**
 * Organizers and circuits run from the one with the most recent tournament. They are few enough that asking for most
 * tournaments is answered here, from the counts already on screen.
 */
function useCompetitionPages(kind: "ORGANIZATION" | "CIRCUIT", access: Access) {
  const filters = useDirectoryFilters(["q", "sort"] as const)
  const sort = (filters.values.sort || "ACTIVE") as CompetitionPageSort
  const search = useDebounced(filters.values.q)
  const pages = useQuery({
    queryKey: pageKeys.directory.competitionPages(access.actorKey, kind, search, sort === "NAME" ? "NAME" : "ACTIVE"),
    queryFn: ({ signal }) =>
      directoryApi.profiles({ kind, q: search, sort: sort === "NAME" ? "NAME" : "ACTIVE", size: 100 }, signal),
  })
  const stats = useQuery({
    queryKey: pageKeys.directory.competitionPageStats(access.actorKey),
    queryFn: ({ signal }) => directoryApi.competitionPages(signal),
    staleTime: 60_000,
  })
  const rows = useMemo(() => {
    const byPage = new Map((stats.data ?? []).map((entry) => [entry.pageId, entry]))
    const entries = (pages.data?.items ?? []).map((page) => ({ page, stats: byPage.get(page.id) }))
    return sort === "TOURNAMENTS"
      ? entries.sort((a, b) => (b.stats?.tournaments ?? 0) - (a.stats?.tournaments ?? 0))
      : entries
  }, [pages.data, stats.data, sort])
  return {
    filters,
    sort,
    pages,
    rows,
    totalTournaments: rows.reduce((sum, row) => sum + (row.stats?.tournaments ?? 0), 0),
  }
}

const ActiveOn = ({ page }: { page: CommunityProfile }) =>
  page.lastActiveOn ? <span className="type-meta block truncate">{activityLabel(page.lastActiveOn)}</span> : null

const LatestTournament = ({ stats }: { stats?: CompetitionPageEntry }) =>
  stats?.latestTournament ? (
    <Link
      to={tournamentPath(stats.latestTournament.id)}
      className="relative z-10 flex min-w-0 items-center gap-2 rounded-md underline-offset-2 hover:underline"
    >
      <Monogram
        url={stats.latestTournament.logoUrl}
        label={`Logo ${stats.latestTournament.name}`}
        text={initials(stats.latestTournament.name).slice(0, 3)}
        size={28}
        className="shrink-0 rounded"
      />
      <span className="type-body truncate">{stats.latestTournament.name}</span>
    </Link>
  ) : (
    <span className="type-meta">Chưa gắn giải nào.</span>
  )

const Tiers = ({ stats }: { stats?: CompetitionPageEntry }) => (
  <span className="flex flex-wrap items-center gap-1">
    {stats?.tiers.map((tier) => (
      <TierBadge key={tier} tier={tier} compact />
    ))}
  </span>
)

const websiteOf = (page: CommunityProfile) => page.content?.links[0]

function CompetitionPageSortSelect({
  label,
  sort,
  onChange,
}: {
  label: string
  sort: CompetitionPageSort
  onChange: (value: string) => void
}) {
  return (
    <select
      aria-label={label}
      value={sort}
      onChange={(event) => onChange(event.target.value)}
      className={managementSelectClassName}
    >
      {Object.entries(COMPETITION_PAGE_SORTS).map(([value, name]) => (
        <option key={value} value={value}>
          {name}
        </option>
      ))}
    </select>
  )
}

/** Organizers: who runs what, and how to reach them. */
export function OrganizationDirectory({ access }: { access: Access }) {
  const { filters, sort, pages, rows, totalTournaments } = useCompetitionPages("ORGANIZATION", access)
  return (
    <DirectoryShell
      section={directorySections[4]}
      access={access}
      summary={rows.length ? `${rows.length} tổ chức · ${totalTournaments} giải đã gắn đơn vị tổ chức` : undefined}
    >
      <DirectoryBody
        query={pages}
        empty={{
          isEmpty: !rows.length,
          title: filters.filtered ? "Không tìm thấy tổ chức" : "Chưa có tổ chức",
          description: "Tổ chức là đơn vị đứng ra tổ chức các giải đấu.",
        }}
        toolbar={
          <ManagementToolbar
            search={filters.values.q}
            onSearchChange={(value) => filters.setFilter("q", value)}
            searchLabel="Tìm tổ chức"
            placeholder="Tên hoặc mã hồ sơ…"
            onReset={filters.filtered ? filters.reset : undefined}
          >
            <CompetitionPageSortSelect
              label="Sắp xếp tổ chức"
              sort={sort}
              onChange={(value) => filters.setFilter("sort", value)}
            />
          </ManagementToolbar>
        }
      >
        <ul className="divide-y">
          {rows.map(({ page, stats }) => {
            const name = page.content?.name ?? page.code
            const website = websiteOf(page)
            return (
              <li
                key={page.id}
                className="relative grid items-center gap-x-4 gap-y-2 px-4 py-3 transition hover:bg-muted/50 @3xl:grid-cols-[minmax(0,1.2fr)_auto_minmax(0,1.3fr)]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Monogram
                    url={page.content?.avatarUrl}
                    label={`Logo ${name}`}
                    text={initials(name).slice(0, 3)}
                    size={44}
                    className="shrink-0 rounded-lg"
                  />
                  <div className="min-w-0">
                    <h2 className="type-section-title truncate">
                      <Link to={`/pages/${page.id}`} className="after:absolute after:inset-0">
                        {name}
                      </Link>
                    </h2>
                    <p className="type-meta flex flex-wrap items-center gap-x-2">
                      <CountryLabel country={page.content?.country} />
                      {website && (
                        <a
                          href={website.url}
                          target="_blank"
                          rel="noreferrer"
                          className="relative z-10 inline-flex items-center gap-1 underline-offset-2 hover:text-foreground hover:underline"
                        >
                          <ExternalLink size={12} aria-hidden="true" />
                          {website.label || "Website"}
                        </a>
                      )}
                      <PublishedMark published={page.published} />
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 @3xl:w-44 @3xl:flex-col @3xl:items-start @3xl:gap-1">
                  <span className="type-body tabular-nums whitespace-nowrap">
                    {stats?.tournaments ?? 0} giải
                    {stats?.firstYear ? ` · ${yearRange(stats.firstYear, stats.lastYear)}` : ""}
                  </span>
                  <Tiers stats={stats} />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <LatestTournament stats={stats} />
                  <ActiveOn page={page} />
                </div>
              </li>
            )
          })}
        </ul>
      </DirectoryBody>
    </DirectoryShell>
  )
}

/** Circuits: a brand that returns season after season, so the seasons and the latest one lead. */
export function CircuitDirectory({ access }: { access: Access }) {
  const { filters, sort, pages, rows, totalTournaments } = useCompetitionPages("CIRCUIT", access)
  return (
    <DirectoryShell
      section={directorySections[5]}
      access={access}
      summary={rows.length ? `${rows.length} hệ thống giải · ${totalTournaments} mùa giải` : undefined}
    >
      <DirectoryBody
        query={pages}
        empty={{
          isEmpty: !rows.length,
          title: filters.filtered ? "Không tìm thấy hệ thống giải" : "Chưa có hệ thống giải",
          description: "Hệ thống giải gom các mùa của cùng một thương hiệu, như Đấu Trường Danh Vọng.",
        }}
        toolbar={
          <ManagementToolbar
            search={filters.values.q}
            onSearchChange={(value) => filters.setFilter("q", value)}
            searchLabel="Tìm hệ thống giải"
            placeholder="Tên hoặc mã hồ sơ…"
            onReset={filters.filtered ? filters.reset : undefined}
          >
            <CompetitionPageSortSelect
              label="Sắp xếp hệ thống giải"
              sort={sort}
              onChange={(value) => filters.setFilter("sort", value)}
            />
          </ManagementToolbar>
        }
      >
        <ul className="grid gap-3 p-3 @3xl:grid-cols-2 @3xl:p-4 @6xl:grid-cols-3">
          {rows.map(({ page, stats }) => {
            const name = page.content?.name ?? page.code
            return (
              <li
                key={page.id}
                className="relative flex min-w-0 flex-col gap-3 rounded-lg border bg-background p-4 transition hover:border-primary/50"
              >
                <div className="flex items-start gap-3">
                  <Monogram
                    url={page.content?.avatarUrl}
                    label={`Logo ${name}`}
                    text={initials(name).slice(0, 3)}
                    size={64}
                    className="shrink-0 rounded-lg"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <h2 className="type-section-title line-clamp-2">
                      <Link to={`/pages/${page.id}`} className="after:absolute after:inset-0 after:rounded-lg">
                        {name}
                      </Link>
                    </h2>
                    <p className="type-body tabular-nums">
                      {stats?.tournaments ?? 0} mùa giải
                      {stats?.firstYear ? ` · ${yearRange(stats.firstYear, stats.lastYear)}` : ""}
                    </p>
                    <Tiers stats={stats} />
                  </div>
                  <PublishedMark published={page.published} />
                </div>
                <div className="mt-auto min-w-0 space-y-1 border-t pt-2">
                  <p className="type-meta">Mùa gần nhất</p>
                  <LatestTournament stats={stats} />
                  <ActiveOn page={page} />
                </div>
              </li>
            )
          })}
        </ul>
      </DirectoryBody>
    </DirectoryShell>
  )
}
