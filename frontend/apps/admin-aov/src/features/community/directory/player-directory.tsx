import { useState } from "react"
import { useNavigate } from "react-router"
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { Activity, ArrowDownWideNarrow, MapPin } from "lucide-react"
import type { CareerStatus, Lane, PlayerDirectoryEntry } from "@aov/community-contracts"
import { FilterTab, FilterTabs } from "@aov/ui/components/filter-tabs"
import type { Access } from "@/features/esports/pages/esports-shell"
import { LaneIcon } from "@/features/esports/components/primitives"
import { ManagementToolbar } from "@/features/tournaments/components/management-list"
import { CAREER_STATUSES } from "@/features/tournaments/components/tournament-metadata"
import { FilterSelect } from "@/features/tournaments/components/filter-select"
import { facetOptions } from "@/features/tournaments/model/facet-options"
import { pageKeys } from "../api/page-api"
import { MergePlayerSheet } from "../components/merge-player-sheet"
import { directoryApi, useDebounced, useHeroPortraits, useProfilesOf, type PlayerSort } from "./directory-api"
import {
  DirectoryBody,
  DirectoryFooter,
  DirectoryShell,
  countryName,
  directorySections,
  useDirectoryFilters,
} from "./directory-shell"
import { RecordEditSheet } from "./entry-edit-sheet"
import { PlayerRow } from "./player-row"
import { nextPageOf } from "@aov/ui/lib/page-slice"
import { LANE_LABELS, LANE_ORDER } from "@/lib/lanes"

const section = directorySections[1]
const SORTS: Record<PlayerSort, string> = {
  RECENT: "Thi đấu gần đây",
  TOURNAMENTS: "Nhiều giải nhất",
  TITLES: "Nhiều chức vô địch",
  NAME: "Tên A–Z",
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
  const [open, setOpen] = useState<{ sheet: "edit" | "merge"; player: PlayerDirectoryEntry } | null>(null)
  const players = useInfiniteQuery({
    queryKey: pageKeys.directory.players(access.actorKey, search, { country, lane, status }, sort),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      directoryApi.players({ q: search, country, lane, status, sort, page: pageParam }, signal),
    getNextPageParam: nextPageOf,
  })
  const facets = useQuery({
    queryKey: pageKeys.directory.playerFacets(access.actorKey, search, { country, lane, status }),
    queryFn: ({ signal }) => directoryApi.playerFacets({ q: search, country, lane, status }, signal),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
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
        {LANE_ORDER.filter((value) => lane === value || !facets.data || facets.data.lanes[value]).map((value) => (
          <FilterTab
            key={value}
            active={lane === value}
            count={facets.data?.lanes[value]}
            onClick={() => filters.setFilter("lane", value)}
          >
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
            <FilterSelect
              icon={MapPin}
              label="Quốc gia tuyển thủ"
              every="Mọi quốc gia"
              value={country}
              options={facetOptions(facets.data?.countries, country, countryName)}
              onChange={(value) => filters.setFilter("country", value)}
            />
            <FilterSelect
              icon={Activity}
              label="Trạng thái thi đấu"
              every="Mọi trạng thái"
              value={status}
              options={facetOptions(
                facets.data?.statuses,
                status,
                (value) => CAREER_STATUSES[value as CareerStatus] ?? value,
                { order: Object.keys(CAREER_STATUSES) },
              )}
              onChange={(value) => filters.setFilter("status", value)}
            />
            <FilterSelect
              icon={ArrowDownWideNarrow}
              label="Sắp xếp tuyển thủ"
              value={sort}
              options={Object.entries(SORTS)}
              onChange={(value) => filters.setFilter("sort", value)}
            />
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
                <th className="hidden px-3 py-2 font-[inherit] @6xl:table-cell">Tướng tủ</th>
                <th className="hidden px-3 py-2 text-right font-[inherit] @2xl:table-cell">Giải</th>
                <th className="hidden px-3 py-2 text-right font-[inherit] @2xl:table-cell">Vô địch</th>
                <th className="hidden px-3 py-2 font-[inherit] @4xl:table-cell">Giải gần nhất</th>
                <th className="hidden px-3 py-2 font-[inherit] @4xl:table-cell">Trạng thái</th>
                {access.canWrite && (
                  <th className="sticky right-0 w-20 bg-card py-2 font-[inherit]">
                    <span className="sr-only">Thao tác</span>
                  </th>
                )}
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
                    onSheet={access.canWrite ? (sheet) => setOpen({ sheet, player }) : undefined}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
        <DirectoryFooter total={players.data?.pages[0]?.totalElements ?? 0} noun="tuyển thủ" query={players} />
      </DirectoryBody>
      {open?.sheet === "edit" && (
        <RecordEditSheet
          kind="players"
          id={open.player.id}
          name={open.player.nickname}
          pageId={profiles.get(open.player.id)?.id}
          actorKey={access.actorKey}
          onClose={() => setOpen(null)}
        />
      )}
      {open?.sheet === "merge" && (
        <MergePlayerSheet playerId={open.player.id} name={open.player.nickname} onClose={() => setOpen(null)} />
      )}
    </DirectoryShell>
  )
}
