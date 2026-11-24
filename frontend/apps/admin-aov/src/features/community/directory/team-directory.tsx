import { useState } from "react"
import { Link } from "react-router"
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { ArrowDownWideNarrow, MapPin } from "lucide-react"
import type { TeamDirectoryEntry } from "@aov/community-contracts"
import { type Access, tournamentPath } from "@/features/esports/pages/esports-shell"
import { LaneIcon, Monogram } from "@/features/esports/components/primitives"
import { initials } from "@/features/esports/model/game-view"
import { ManagementToolbar } from "@/features/tournaments/components/management-list"
import { FilterSelect } from "@/features/tournaments/components/filter-select"
import { facetOptions } from "@/features/tournaments/model/facet-options"
import { activityLabel } from "@/features/tournaments/model/record-reason"
import { directoryApi, useDebounced, useProfilesOf, winRate, type TeamSort } from "./directory-api"
import { pageKeys } from "../api/page-api"
import {
  CountryLabel,
  DirectoryBody,
  DirectoryFooter,
  DirectoryShell,
  Figure,
  PublishedMark,
  countryName,
  directorySections,
  useDirectoryFilters,
} from "./directory-shell"
import { RecordEditSheet } from "./entry-edit-sheet"
import { EntryAction, EntryPicture } from "./entry-parts"
import { LocalMoney } from "@aov/ui/components/local-money"
import { nextPageOf } from "@aov/ui/lib/page-slice"

const section = directorySections[0]
const SORTS: Record<TeamSort, string> = {
  RECENT: "Thi đấu gần đây",
  TOURNAMENTS: "Nhiều giải nhất",
  TITLES: "Nhiều chức vô địch",
  PRIZE: "Tiền thưởng cao nhất",
  NAME: "Tên A–Z",
}

/** Teams read by their record and who plays for them; a logo alone would say nothing about either. */
export function TeamDirectory({ access }: { access: Access }) {
  const filters = useDirectoryFilters(["q", "country", "sort"] as const)
  const { q, country } = filters.values
  const sort = (filters.values.sort || "RECENT") as TeamSort
  const search = useDebounced(q)
  const [editing, setEditing] = useState<TeamDirectoryEntry | null>(null)
  const teams = useInfiniteQuery({
    queryKey: pageKeys.directory.teams(access.actorKey, search, country, sort),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => directoryApi.teams({ q: search, country, sort, page: pageParam }, signal),
    getNextPageParam: nextPageOf,
  })
  const facets = useQuery({
    queryKey: pageKeys.directory.teamFacets(access.actorKey, search),
    queryFn: ({ signal }) => directoryApi.teamFacets(search, signal),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
  const rows = teams.data?.pages.flatMap((page) => page.items) ?? []
  const profiles = useProfilesOf(
    access.actorKey,
    "TEAM",
    rows.map((team) => team.id),
  )

  return (
    <DirectoryShell section={section} access={access}>
      <DirectoryBody
        query={teams}
        empty={{
          isEmpty: !rows.length,
          title: filters.filtered ? "Không tìm thấy đội tuyển" : "Chưa có đội tuyển",
          description: filters.filtered
            ? "Thử bỏ bớt bộ lọc hoặc tìm theo tên khác."
            : "Tạo đội tuyển đầu tiên, rồi thêm đội hình và thành tích.",
        }}
        toolbar={
          <ManagementToolbar
            search={q}
            onSearchChange={(value) => filters.setFilter("q", value)}
            searchLabel="Tìm đội tuyển"
            placeholder="Tên đội, tên viết tắt hoặc mã…"
            onReset={filters.filtered ? filters.reset : undefined}
          >
            <FilterSelect
              icon={MapPin}
              label="Khu vực đội tuyển"
              every="Mọi khu vực"
              value={country}
              options={facetOptions(facets.data?.countries, country, countryName)}
              onChange={(value) => filters.setFilter("country", value)}
            />
            <FilterSelect
              icon={ArrowDownWideNarrow}
              label="Sắp xếp đội tuyển"
              value={sort}
              options={Object.entries(SORTS)}
              onChange={(value) => filters.setFilter("sort", value)}
            />
          </ManagementToolbar>
        }
      >
        <ul className="grid gap-3 p-3 @3xl:grid-cols-2 @3xl:p-4 @6xl:grid-cols-3">
          {rows.map((team) => {
            const profile = profiles.get(team.id)
            return (
              <TeamCard
                key={team.id}
                team={team}
                pageId={profile?.id}
                published={profile?.published}
                onEdit={access.canWrite ? () => setEditing(team) : undefined}
              />
            )
          })}
        </ul>
        <DirectoryFooter total={teams.data?.pages[0]?.totalElements ?? 0} noun="đội tuyển" query={teams} />
      </DirectoryBody>
      {editing && (
        <RecordEditSheet
          kind="teams"
          id={editing.id}
          name={editing.name}
          pageId={profiles.get(editing.id)?.id}
          actorKey={access.actorKey}
          onClose={() => setEditing(null)}
        />
      )}
    </DirectoryShell>
  )
}

function TeamCard({
  team,
  pageId,
  published,
  onEdit,
}: {
  team: TeamDirectoryEntry
  pageId?: string
  published?: boolean
  onEdit?: () => void
}) {
  const rate = winRate(team.wins, team.losses)
  const starters = team.lineup.filter((member) => member.status !== "SUBSTITUTE").slice(0, 5)
  const bench = team.lineup.length - starters.length
  return (
    <li className="relative flex min-w-0 flex-col gap-3 rounded-lg border bg-background p-4 transition hover:border-primary/50">
      <div className="flex items-start gap-3">
        <EntryPicture missing={!team.logoUrl && !team.logoDarkUrl} label="Thiếu logo">
          <Monogram
            url={team.logoUrl}
            darkUrl={team.logoDarkUrl}
            label={`Logo ${team.name}`}
            text={team.shortName || initials(team.name).slice(0, 3)}
            size={56}
            className="shrink-0 rounded-lg"
          />
        </EntryPicture>
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="type-section-title truncate">
            {pageId ? (
              <Link to={`/pages/${pageId}`} className="after:absolute after:inset-0 after:rounded-lg">
                {team.name}
              </Link>
            ) : (
              team.name
            )}
          </h2>
          <p className="type-meta flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <CountryLabel country={team.country} />
            {team.shortName && <span>{team.shortName}</span>}
          </p>
        </div>
        <PublishedMark published={published} />
        {onEdit && <EntryAction label={`Sửa hồ sơ đội ${team.name}`} onClick={onEdit} />}
      </div>

      <dl className="grid grid-cols-4 gap-2 border-y py-2">
        <Figure value={team.tournaments} label="Giải" />
        <Figure
          value={team.matches ? `${team.wins}-${team.losses}` : "–"}
          label={rate === null ? "Trận" : `Thắng ${rate}%`}
        />
        <Figure value={team.titles} label="Vô địch" />
        <Figure
          value={
            // Lifted above the link that covers the card, so its original amount can be revealed.
            <LocalMoney
              amounts={[{ amount: team.prizeUsd || null, currency: "USD" }]}
              compact
              fallback="–"
              className="relative z-10"
            />
          }
          label="Tiền thưởng"
        />
      </dl>

      {starters.length ? (
        <div className="min-w-0 space-y-1.5">
          <p className="type-meta truncate">
            Đội hình · {team.lineupTournament?.name}
            {bench > 0 && ` · ${bench} dự bị`}
          </p>
          <ul className="grid grid-cols-5 gap-1.5">
            {starters.map((member) => (
              <li
                key={member.playerId}
                className="flex min-w-0 flex-col items-center gap-1 text-center"
                title={member.name}
              >
                <span className="grid size-6 place-items-center rounded-full bg-muted text-muted-foreground">
                  {member.lane ? <LaneIcon lane={member.lane} size={14} /> : <span aria-hidden="true">·</span>}
                </span>
                <span className="type-meta w-full truncate text-foreground">{member.name}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="type-meta">Chưa có đội hình trên hồ sơ.</p>
      )}

      <div className="mt-auto min-w-0 space-y-0.5">
        <p className="type-meta">{activityLabel(team.lastActiveOn)}</p>
        {team.latestTournament && (
          <Link
            to={tournamentPath(team.latestTournament.id)}
            className="type-meta relative z-10 block truncate underline-offset-2 hover:text-foreground hover:underline"
          >
            Gần nhất: {team.latestTournament.name}
          </Link>
        )}
      </div>
    </li>
  )
}
