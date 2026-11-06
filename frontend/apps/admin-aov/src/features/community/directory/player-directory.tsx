import { Link, useNavigate } from "react-router"
import { useInfiniteQuery } from "@tanstack/react-query"
import { Trophy } from "lucide-react"
import type { CareerStatus, Lane, PlayerDirectoryEntry } from "@aov/community-contracts"
import { FilterTab, FilterTabs } from "@/components/filter-tabs"
import { tournamentPath, type Access } from "@/features/esports/pages/esports-shell"
import { HeroIcon, LaneIcon, Monogram, PlayerPhoto } from "@/features/esports/components/primitives"
import { LANE_LABELS, LANE_ORDER } from "@/features/esports/model/labels"
import { initials } from "@/features/esports/model/game-view"
import { ManagementToolbar, managementSelectClassName } from "@/features/tournaments/management-list"
import { CAREER_STATUSES } from "@/features/tournaments/tournament-metadata"
import { TEAM_REGIONS } from "@/features/tournaments/team-region"
import { ProfileCountry } from "../profile-country"
import {
  directoryApi,
  directoryKeys,
  useDebounced,
  useHeroPortraits,
  useProfilesOf,
  yearRange,
  type PlayerSort,
} from "./directory-api"
import {
  DirectoryBody,
  DirectoryFooter,
  DirectoryShell,
  PublishedMark,
  directorySections,
  useDirectoryFilters,
} from "./directory-shell"
import { nextPageOf } from "@aov/ui/lib/page-slice"

const section = directorySections[1]
const SORTS: Record<PlayerSort, string> = {
  RECENT: "Thi đấu gần đây",
  TOURNAMENTS: "Nhiều giải nhất",
  TITLES: "Nhiều chức vô địch",
  NAME: "Tên A–Z",
}
const age = (birthDate?: string | null) => {
  const year = Number(birthDate?.slice(0, 4))
  return year ? new Date().getFullYear() - year : null
}

/** Players compared side by side: position, team and record line up in columns, which cards would break apart. */
export function PlayerDirectory({ access }: { access: Access }) {
  const navigate = useNavigate()
  const filters = useDirectoryFilters(["q", "country", "lane", "status", "sort"] as const)
  const { q, country } = filters.values
  const lane = filters.values.lane as Lane | ""
  const status = filters.values.status as CareerStatus | ""
  const sort = (filters.values.sort || "RECENT") as PlayerSort
  const search = useDebounced(q)
  const players = useInfiniteQuery({
    queryKey: [...directoryKeys, access.actorKey, "players", search, country, lane, status, sort],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      directoryApi.players({ q: search, country, lane, status, sort, page: pageParam }, signal),
    getNextPageParam: nextPageOf,
  })
  const rows = players.data?.pages.flatMap((page) => page.items) ?? []
  const profiles = useProfilesOf(
    access.actorKey,
    "PLAYER",
    rows.map((player) => player.id),
  )
  const portrait = useHeroPortraits(rows.some((player) => player.signatureHeroes.length > 0))

  return (
    <DirectoryShell section={section} access={access}>
      <FilterTabs label="Vị trí thi đấu">
        <FilterTab active={!lane} onClick={() => filters.setFilter("lane", "")}>
          Mọi vị trí
        </FilterTab>
        {LANE_ORDER.map((value) => (
          <FilterTab key={value} active={lane === value} onClick={() => filters.setFilter("lane", value)}>
            <LaneIcon lane={value} size={14} />
            {LANE_LABELS[value].short}
          </FilterTab>
        ))}
      </FilterTabs>
      <DirectoryBody
        query={players}
        empty={{
          isEmpty: !rows.length,
          title: filters.filtered ? "Không tìm thấy tuyển thủ" : "Chưa có tuyển thủ",
          description: filters.filtered
            ? "Thử bỏ bớt bộ lọc hoặc tìm theo tên khác."
            : "Tạo tuyển thủ đầu tiên hoặc thêm từ đội hình của một giải.",
        }}
        toolbar={
          <ManagementToolbar
            search={q}
            onSearchChange={(value) => filters.setFilter("q", value)}
            searchLabel="Tìm tuyển thủ"
            placeholder="Tên thi đấu, tên thật hoặc mã…"
            onReset={filters.filtered ? filters.reset : undefined}
          >
            <select
              aria-label="Quốc gia tuyển thủ"
              value={country}
              onChange={(event) => filters.setFilter("country", event.target.value)}
              className={managementSelectClassName}
            >
              <option value="">Mọi quốc gia</option>
              {TEAM_REGIONS.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Trạng thái thi đấu"
              value={status}
              onChange={(event) => filters.setFilter("status", event.target.value)}
              className={managementSelectClassName}
            >
              <option value="">Mọi trạng thái</option>
              {Object.entries(CAREER_STATUSES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              aria-label="Sắp xếp tuyển thủ"
              value={sort}
              onChange={(event) => filters.setFilter("sort", event.target.value)}
              className={managementSelectClassName}
            >
              {Object.entries(SORTS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </ManagementToolbar>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="type-label border-b whitespace-nowrap text-muted-foreground">
                <th className="px-4 py-2 font-[inherit]">Tuyển thủ</th>
                <th className="px-3 py-2 font-[inherit]">Vị trí</th>
                <th className="hidden px-3 py-2 font-[inherit] @2xl:table-cell">Đội gần nhất</th>
                <th className="hidden px-3 py-2 font-[inherit] @5xl:table-cell">Tướng tủ</th>
                <th className="hidden px-3 py-2 text-right font-[inherit] @2xl:table-cell">Giải</th>
                <th className="hidden px-3 py-2 text-right font-[inherit] @2xl:table-cell">Vô địch</th>
                <th className="hidden px-3 py-2 font-[inherit] @4xl:table-cell">Giải gần nhất</th>
                <th className="hidden px-4 py-2 font-[inherit] @4xl:table-cell">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((player) => {
                const profile = profiles.get(player.id)
                return (
                  <PlayerRow
                    key={player.id}
                    player={player}
                    pageId={profile?.id}
                    published={profile?.published}
                    portrait={portrait}
                    onOpen={profile ? () => navigate(`/pages/${profile.id}`) : undefined}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
        <DirectoryFooter total={players.data?.pages[0]?.totalElements ?? 0} noun="tuyển thủ" query={players} />
      </DirectoryBody>
    </DirectoryShell>
  )
}

function PlayerRow({
  player,
  pageId,
  published,
  portrait,
  onOpen,
}: {
  player: PlayerDirectoryEntry
  pageId?: string
  published?: boolean
  portrait: (name: string) => string | undefined
  onOpen?: () => void
}) {
  const years = age(player.birthDate)
  const latest = player.latestTournament
  return (
    <tr
      className="border-b align-middle transition last:border-b-0 hover:bg-muted/50 data-[open]:cursor-pointer"
      data-open={onOpen ? true : undefined}
      onClick={onOpen}
    >
      <td className="px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <PlayerPhoto name={player.nickname} url={player.photoUrl ?? undefined} size={40} />
          <div className="min-w-0">
            <p className="type-section-title flex items-center gap-2">
              {pageId ? (
                <Link to={`/pages/${pageId}`} className="truncate" onClick={(event) => event.stopPropagation()}>
                  {player.nickname}
                </Link>
              ) : (
                <span className="truncate">{player.nickname}</span>
              )}
              <PublishedMark published={published} />
            </p>
            <p className="type-meta flex items-center gap-1.5">
              <ProfileCountry country={player.country} />
              <span className="max-w-48 truncate">{player.fullName || "Chưa có tên thật"}</span>
              {years !== null && <span className="shrink-0">· {years} tuổi</span>}
            </p>
            {player.latestTeam && <p className="type-meta truncate @2xl:hidden">{player.latestTeam.name}</p>}
          </div>
        </div>
      </td>
      <td className="type-body px-3 py-2.5 whitespace-nowrap">
        {player.lane ? (
          <span className="inline-flex items-center gap-1.5">
            <LaneIcon lane={player.lane} size={16} className="text-muted-foreground" />
            {LANE_LABELS[player.lane].short}
          </span>
        ) : (
          <span className="text-muted-foreground">–</span>
        )}
      </td>
      <td className="type-body hidden px-3 py-2.5 @2xl:table-cell">
        {player.latestTeam ? (
          <span className="flex min-w-0 items-center gap-2">
            <Monogram
              url={player.latestTeam.logoUrl}
              label={`Logo ${player.latestTeam.name}`}
              text={player.latestTeam.shortName || initials(player.latestTeam.name).slice(0, 3)}
              size={24}
              className="shrink-0 rounded"
            />
            <span className="max-w-40 truncate">{player.latestTeam.name}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">–</span>
        )}
      </td>
      <td className="hidden px-3 py-2.5 @5xl:table-cell">
        <span className="flex max-w-52 flex-wrap items-center gap-1">
          {player.signatureHeroes.slice(0, 3).map((hero) => {
            const iconUrl = portrait(hero)
            // Only published heroes have a portrait; two letters would say less than the name.
            return iconUrl ? (
              <HeroIcon key={hero} hero={{ name: hero, iconUrl }} size={28} />
            ) : (
              <span key={hero} className="type-meta rounded bg-muted px-1.5 py-0.5 capitalize">
                {hero}
              </span>
            )
          })}
        </span>
      </td>
      <td className="type-body esp-num hidden px-3 py-2.5 text-right tabular-nums @2xl:table-cell">
        {player.tournaments}
      </td>
      <td className="type-body esp-num hidden px-3 py-2.5 text-right tabular-nums @2xl:table-cell">
        {player.titles ? (
          <span className="inline-flex items-center gap-1">
            <Trophy size={14} className="text-[var(--esp-gold-text)]" aria-hidden="true" />
            {player.titles}
          </span>
        ) : (
          <span className="text-muted-foreground">0</span>
        )}
      </td>
      <td className="type-meta hidden max-w-56 px-3 py-2.5 @4xl:table-cell">
        {latest && (
          <Link
            to={tournamentPath(latest.id)}
            className="block truncate underline-offset-2 hover:text-foreground hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {latest.name}
            {!/\b20\d\d\b/.test(latest.name) && latest.year ? ` · ${yearRange(latest.year, latest.year)}` : ""}
          </Link>
        )}
      </td>
      <td className="type-meta hidden px-4 py-2.5 whitespace-nowrap @4xl:table-cell">
        {player.careerStatus === "UNKNOWN" ? "–" : CAREER_STATUSES[player.careerStatus]}
      </td>
    </tr>
  )
}
