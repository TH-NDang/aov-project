import { useEffect, useRef } from "react"
import { Link, useSearchParams } from "react-router"
import { useInfiniteQuery } from "@tanstack/react-query"
import {
  isCommunityProfile,
  isIndividualProfile,
  personRoleLabels,
  profileKindLabels,
  type CommunityProfile,
  type ProfileKind,
  type PageSlice,
} from "@aov/community-contracts"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { navArtIcons } from "@aov/ui/components/nav-art-icons"
import { OfficialBadge } from "@aov/ui/components/official-badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@aov/ui/components/public-overlay"
import { useRevealedRows } from "@aov/ui/hooks/use-revealed-rows"
import { nextPageOf } from "@aov/ui/lib/page-slice"
import { StreamIcon } from "../../components/stream-icon"
import { communityApi } from "./community-api"
import { useFollowedIds, useFollowPage } from "./community-queries"
import { Avatar, followersLabel, regionKey, regionName } from "./community-ui"
import "./community.css"
import "./community-directory.css"

export const profileKinds = Object.keys(profileKindLabels) as ProfileKind[]

const kindArt = {
  CIRCUIT: navArtIcons.circuits,
  ORGANIZATION: navArtIcons.organizations,
  TEAM: navArtIcons.teams,
  PLAYER: navArtIcons.players,
  PERSON: navArtIcons.coaches,
}

function KindArt({ kind }: { kind: keyof typeof kindArt }) {
  const Art = kindArt[kind]
  return <Art size={20} />
}

/** Cards revealed at a time: whole rows at every column count the grid takes (one to four). */
const STEP = 24
/** Regions offered as chips, and how many pages a region needs to be one; the rest open from the last chip. */
const TOP_REGIONS = 6
const CHIP_PAGES = 5
/**
 * The service cannot filter or count pages by country, so the regions are counted here from the whole directory.
 * Past this many pages that stops being reasonable: the directory then only loads as the reader scrolls and offers
 * no regions.
 */
const SCAN_LIMIT = 3000
const UNRECORDED = "none"

type Region = { key: string; name: string; count: number }

const regionOf = (profile: CommunityProfile) => regionKey(profile.content?.country) || UNRECORDED

/** The regions of a list of pages, largest first; pages without a country close the list. */
function regionFacet(profiles: CommunityProfile[]): Region[] {
  const counts = new Map<string, number>()
  for (const profile of profiles) counts.set(regionOf(profile), (counts.get(regionOf(profile)) || 0) + 1)
  return [...counts]
    .map(([key, count]) => ({ key, count, name: key === UNRECORDED ? "Chưa ghi khu vực" : regionName(key)! }))
    .sort(
      (a, b) =>
        Number(a.key === UNRECORDED) - Number(b.key === UNRECORDED) ||
        b.count - a.count ||
        a.name.localeCompare(b.name, "vi"),
    )
}

/**
 * Brings the chosen chip of a row that scrolls sideways into view when the choice changes, as it does when a link
 * opens the directory already filtered. Only the row moves; the page stays where it is.
 */
function useChosenChipInView(choice: string) {
  const row = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const box = row.current
    const chosen = box?.querySelector<HTMLElement>('[aria-pressed="true"], [aria-current]')
    if (!box || !chosen) return
    const offset = chosen.getBoundingClientRect().left - box.getBoundingClientRect().left + box.scrollLeft
    box.scrollLeft = offset - (box.clientWidth - chosen.offsetWidth) / 2
  }, [choice])
  return row
}

/**
 * Every published page, narrowed by kind and by region. Both filters live in the URL. The kind is asked of the
 * service; the region is applied here, to pages that keep loading in the background until the list is whole.
 */
export function PageDirectory() {
  const [params, setParams] = useSearchParams()
  const requested = params.get("kind") as ProfileKind | null
  const kind = requested && profileKinds.includes(requested) ? requested : null
  const region = params.get("region") || ""
  const following = useFollowedIds()
  const query = useInfiniteQuery({
    queryKey: ["public-pages", kind],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      communityApi<PageSlice<CommunityProfile>>(
        `/pages?${new URLSearchParams({ ...(kind ? { kind } : {}), page: String(pageParam), size: "100" })}`,
      ),
    getNextPageParam: nextPageOf,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
  const { hasNextPage, isFetching, isFetchNextPageError, fetchNextPage } = query
  const total = query.data?.pages[0]?.totalElements ?? 0
  const scanned = total <= SCAN_LIMIT
  useEffect(() => {
    if (scanned && hasNextPage && !isFetching && !isFetchNextPageError) void fetchNextPage({ cancelRefetch: false })
  }, [scanned, hasNextPage, isFetching, isFetchNextPageError, fetchNextPage])

  const profiles = query.data?.pages.flatMap((page) => page.items) ?? []
  const complete = !!query.data && !hasNextPage
  const regions = complete ? regionFacet(profiles) : null
  const narrowed = scanned && !!region
  const rows = narrowed ? profiles.filter((profile) => regionOf(profile) === region) : profiles
  const revealed = useRevealedRows(rows, `${kind}|${narrowed ? region : ""}`, STEP)
  // The loaded pages are revealed first; after that the list waits for the service.
  const more = {
    hasNextPage: revealed.loader.hasNextPage || hasNextPage,
    isFetching: !revealed.loader.hasNextPage && isFetching,
    isError: !revealed.loader.hasNextPage && isFetchNextPageError,
    fetchNextPage: revealed.loader.hasNextPage ? revealed.loader.fetchNextPage : fetchNextPage,
  }
  const count = narrowed ? (complete ? rows.length : null) : query.data ? total : null
  const kindRow = useChosenChipInView(kind ?? "")

  function update(next: { kind?: string; region?: string }) {
    setParams((current) => {
      const updated = new URLSearchParams(current)
      for (const [key, value] of Object.entries(next)) {
        if (value) updated.set(key, value)
        else updated.delete(key)
      }
      return updated
    })
  }

  return (
    <section aria-labelledby="page-directory">
      <div className="tn-heading">
        <h2 id="page-directory">
          Danh bạ trang {count != null && <small>{count.toLocaleString("vi-VN")} trang</small>}
        </h2>
      </div>
      <div className="pg-filters">
        <div ref={kindRow} className="hub-pills" role="group" aria-label="Loại trang">
          <button type="button" aria-pressed={!kind} onClick={() => update({ kind: "" })}>
            <StreamIcon name="grid" size={16} />
            Tất cả
          </button>
          {profileKinds.map((type) => (
            <button key={type} type="button" aria-pressed={kind === type} onClick={() => update({ kind: type })}>
              <KindArt kind={type} />
              {profileKindLabels[type]}
            </button>
          ))}
        </div>
        {scanned &&
          !query.isError &&
          (regions ? (
            <RegionChips regions={regions} value={region} onChange={(value) => update({ region: value })} />
          ) : (
            <div className="hub-pills" role="status" aria-label="Đang đếm trang theo khu vực">
              {Array.from({ length: 5 }, (_, index) => (
                <span key={index} className="hub-skeleton" />
              ))}
            </div>
          ))}
      </div>
      {query.isPending || (!rows.length && !complete && !query.isError) ? (
        <div className="cp-grid" role="status" aria-label="Đang tải danh bạ">
          {Array.from({ length: 12 }, (_, index) => (
            <div className="hub-skeleton cp-card-skeleton" key={index} />
          ))}
        </div>
      ) : query.isLoadingError ? (
        <div className="hub-state" role="alert">
          <h3>Chưa tải được danh bạ</h3>
          <p>{query.error.message}</p>
          <button type="button" className="cp-button" onClick={() => void query.refetch()}>
            Thử lại
          </button>
        </div>
      ) : !rows.length && complete ? (
        <div className="hub-state">
          <h3>{kind || narrowed ? "Không có trang nào khớp bộ lọc" : "Danh bạ đang được xây dựng"}</h3>
          <p>
            {kind || narrowed
              ? "Thử một loại trang hoặc một khu vực khác."
              : "Trang đã đối chiếu và công bố sẽ xuất hiện tại đây."}
          </p>
          {(kind || narrowed) && (
            <button type="button" className="cp-button" onClick={() => update({ kind: "", region: "" })}>
              Xóa bộ lọc
            </button>
          )}
        </div>
      ) : (
        <div className="cp-grid">
          {revealed.rows.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              following={following}
              hideKind={!!kind}
              hideRegion={narrowed && region !== UNRECORDED}
            />
          ))}
        </div>
      )}
      <InfiniteScroll query={more} label="Đang tải thêm trang" />
    </section>
  )
}

/**
 * The largest regions as chips with their page counts; the smaller ones, and the pages without a country, open from
 * the last chip. A chosen region that is not among the chips takes that chip's place.
 */
function RegionChips({
  regions,
  value,
  onChange,
}: {
  regions: Region[]
  value: string
  onChange: (value: string) => void
}) {
  const row = useChosenChipInView(value)
  const recorded = regions.filter((entry) => entry.key !== UNRECORDED)
  // One region, or none, leaves nothing to choose between.
  if (recorded.length < 2) return null
  // A region with a handful of pages is not worth a chip of its own, unless that would leave too few chips.
  const large = recorded.filter((entry) => entry.count >= CHIP_PAGES)
  const top = (large.length >= 2 ? large : recorded).slice(0, TOP_REGIONS)
  const rest = regions.filter((entry) => !top.includes(entry))
  const other = rest.find((entry) => entry.key === value)
  return (
    <div ref={row} className="hub-pills" role="group" aria-label="Khu vực">
      <button type="button" aria-pressed={!value} onClick={() => onChange("")}>
        Mọi khu vực
      </button>
      {top.map((entry) => (
        <button key={entry.key} type="button" aria-pressed={value === entry.key} onClick={() => onChange(entry.key)}>
          {entry.name} <small>{entry.count.toLocaleString("vi-VN")}</small>
        </button>
      ))}
      {rest.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="pg-region-more" aria-current={other ? "true" : undefined}>
              {other ? (
                <>
                  {other.name} <small>{other.count.toLocaleString("vi-VN")}</small>
                </>
              ) : (
                "Khu vực khác"
              )}
              <StreamIcon name="chevronRight" size={12} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={6}
            collisionPadding={12}
            className="hub-popover pg-region-menu"
            drawerTitle="Khu vực khác"
          >
            {rest.map((entry) => (
              <DropdownMenuItem
                key={entry.key}
                className={entry.key === value ? "hub-menu-item pg-region-current" : "hub-menu-item"}
                onSelect={() => onChange(entry.key)}
              >
                {entry.name}
                <small>{entry.count.toLocaleString("vi-VN")}</small>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

/**
 * One page in a list: picture, name, what it is and where, and how many follow it. `hideKind` and `hideRegion` leave
 * out what the list around the card already says. `following` is null for signed-out viewers, who see no follow
 * button.
 */
export function ProfileCard({
  profile,
  following,
  hideKind = false,
  hideRegion = false,
}: {
  profile: CommunityProfile
  following: Set<string> | null
  hideKind?: boolean
  hideRegion?: boolean
}) {
  const follow = useFollowPage()
  const name = profile.content?.name || profile.code
  const followed = following?.has(profile.id) ?? false
  const community = isCommunityProfile(profile.kind)
  // A person's own role says more than the generic staff label, also in a list of people.
  const roles = (profile.kind === "PERSON" && profile.content?.personRoles) || []
  const what = roles.length
    ? roles.map((role) => personRoleLabels[role]).join(", ")
    : hideKind
      ? null
      : profileKindLabels[profile.kind]
  const where = hideRegion ? null : regionName(profile.content?.country)
  return (
    <article className="pg-card" data-person={isIndividualProfile(profile.kind) || undefined}>
      <Link className="pg-card-link" to={`/pages/${profile.code}`} aria-label={name} />
      <Avatar profile={profile} />
      <div className="pg-card-body">
        <strong className="pg-card-name" title={name}>
          {name}
          {community && profile.represented && <OfficialBadge label="Đại diện đã xác minh" />}
        </strong>
        {(what || where) && <span className="pg-card-meta">{[what, where].filter(Boolean).join(" · ")}</span>}
        {community && profile.followers > 0 && (
          <span className="pg-card-meta">{followersLabel(profile.followers)}</span>
        )}
      </div>
      {community && following && (
        <button
          type="button"
          className={followed ? "cp-follow-chip" : "cp-follow-chip cp-follow-primary"}
          aria-pressed={followed}
          aria-label={`Theo dõi ${name}`}
          title={followed ? "Đang theo dõi" : "Theo dõi"}
          disabled={follow.isPending}
          onClick={() => follow.mutate({ pageId: profile.id, following: !followed })}
        >
          <StreamIcon name={followed ? "check" : "plus"} size={14} />
          <span className="cp-follow-label">{followed ? "Đang theo dõi" : "Theo dõi"}</span>
        </button>
      )}
    </article>
  )
}
