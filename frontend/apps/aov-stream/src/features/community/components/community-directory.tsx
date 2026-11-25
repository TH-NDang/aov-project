import { useEffect, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { useInfiniteQuery } from "@tanstack/react-query"
import {
  isCommunityProfile,
  personRoleLabels,
  profileKindLabels,
  type CommunityProfile,
  type ProfileKind,
} from "@aov/community-contracts"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { gameIcon } from "@aov/ui/components/game-icons"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@aov/ui/components/public-overlay"
import { useRevealedRows } from "@aov/ui/hooks/use-revealed-rows"
import { nextPageOf } from "@aov/ui/lib/page-slice"
import { OfficialName } from "../../../components/official-name"
import { ProfileMark } from "../../../components/page-mark"
import { RegionMark } from "../../../components/region-mark"
import { StreamIcon } from "../../../components/stream-icon"
import { ParticipantList } from "../../../components/participant-list"
import { useStreamLocale } from "../../../components/stream-locale"
import { communityApi } from "../../../lib/community-api"
import { communityKeys } from "../../../lib/community-keys"
import { useFollowedIds, useFollowPage } from "../../../lib/community-queries"
import { isParticipantKind } from "../../../lib/participant-model"
import { DirectoryHub } from "./directory-hub"
import {
  followersLabel,
  personRoleEnglish,
  profileKindEnglish,
  regionKey,
  regionName,
} from "../../../components/community-ui"
import "./community.css"
import "./community-directory.css"

export const profileKinds = Object.keys(profileKindLabels) as ProfileKind[]

/** The same marks as Admin's directory of these pages. */
const kindArt = {
  CIRCUIT: gameIcon("laurels"),
  ORGANIZATION: gameIcon("castle"),
  TEAM: gameIcon("meeple-group"),
  PLAYER: gameIcon("swordman"),
  PERSON: gameIcon("teacher"),
}

function KindArt({ kind }: { kind: keyof typeof kindArt }) {
  const Art = kindArt[kind]
  return <Art size={20} />
}

/** Cards revealed at a time: whole rows at every column count the grid takes (one to four). */
const STEP = 24
/**
 * The service cannot filter or count pages by country, so the regions are counted here from the whole directory, and
 * only once a reader asks for them or opens a link with a region. Past this many pages that stops being reasonable:
 * the directory then only loads as the reader scrolls and offers no regions.
 */
const SCAN_LIMIT = 3000
const UNRECORDED = "none"

type Region = { key: string; name: string; count: number }

const regionOf = (profile: CommunityProfile) => regionKey(profile.content?.country) || UNRECORDED

/** The regions of a list of pages, largest first, named in the reader's language; pages without a country close it. */
function regionFacet(profiles: CommunityProfile[], locale: string): Region[] {
  const counts = new Map<string, number>()
  for (const profile of profiles) counts.set(regionOf(profile), (counts.get(regionOf(profile)) || 0) + 1)
  return [...counts]
    .map(([key, count]) => ({ key, count, name: key === UNRECORDED ? "Chưa ghi khu vực" : regionName(key, locale)! }))
    .sort(
      (a, b) =>
        Number(a.key === UNRECORDED) - Number(b.key === UNRECORDED) ||
        b.count - a.count ||
        a.name.localeCompare(b.name, locale),
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
 * Every published page: a wall of each kind until one is chosen, then the list, narrowed by kind and by region. Both
 * filters live in the URL. The kind is asked of the service; the region is applied here, to pages that keep loading in
 * the background until the list is whole. That download starts only when the regions are asked for, so a visit that
 * does not filter by region stays light.
 */
export function PageDirectory() {
  const { text, languageTag } = useStreamLocale()
  const [params, setParams] = useSearchParams()
  const requested = params.get("kind") as ProfileKind | null
  const kind = requested && profileKinds.includes(requested) ? requested : null
  const region = params.get("region") || ""
  const following = useFollowedIds()
  const [counting, setCounting] = useState(false)
  const query = useInfiniteQuery({
    queryKey: communityKeys.pageDirectory(kind),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => communityApi.pages({ ...(kind ? { kind } : {}), page: String(pageParam), size: "100" }),
    getNextPageParam: nextPageOf,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    // The walls read what they show themselves; the whole directory is read once it is filtered.
    enabled: !!kind || !!region || counting,
  })
  const { hasNextPage, isFetching, isFetchNextPageError, fetchNextPage } = query
  const total = query.data?.pages[0]?.totalElements ?? 0
  const scanned = total <= SCAN_LIMIT
  const scanning = scanned && (counting || !!region)
  useEffect(() => {
    if (scanning && hasNextPage && !isFetching && !isFetchNextPageError) void fetchNextPage({ cancelRefetch: false })
  }, [scanning, hasNextPage, isFetching, isFetchNextPageError, fetchNextPage])

  const profiles = query.data?.pages.flatMap((page) => page.items) ?? []
  const complete = !!query.data && !hasNextPage
  const regions = complete ? regionFacet(profiles, languageTag) : null
  const narrowed = scanned && !!region
  const hub = !kind && !narrowed
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

  function update(next: { kind?: string; region?: string; name?: string }) {
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
      <h2 id="page-directory" className="sr-only">
        {text("Danh bạ trang", "Page directory")}
        {count != null && `: ${count.toLocaleString(languageTag)}`}
      </h2>
      <div className="pg-filters">
        <div ref={kindRow} className="hub-pills" role="group" aria-label={text("Loại trang", "Page type")}>
          <button type="button" aria-pressed={!kind} onClick={() => update({ kind: "", name: "" })}>
            <StreamIcon name="grid" size={16} />
            {text("Tất cả", "All")}
          </button>
          {profileKinds.map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={kind === type}
              onClick={() => update({ kind: type, name: "" })}
            >
              <KindArt kind={type} />
              {text(profileKindLabels[type], profileKindEnglish[type])}
            </button>
          ))}
        </div>
        {scanned && !query.isError && (
          <RegionMenu
            regions={regions}
            value={region}
            onOpen={() => setCounting(true)}
            onChange={(value) => update({ region: value })}
          />
        )}
      </div>
      {isParticipantKind(kind) && !narrowed && <ParticipantList kind={kind} q={params.get("name")?.trim()} />}
      {hub && <DirectoryHub />}
      {hub || (isParticipantKind(kind) && !narrowed && !rows.length) ? null : query.isPending ||
        (!rows.length && !complete && !query.isError) ? (
        <div className="cp-grid" role="status" aria-label={text("Đang tải danh bạ", "Loading the directory")}>
          {Array.from({ length: 12 }, (_, index) => (
            <div className="hub-skeleton cp-card-skeleton" key={index} />
          ))}
        </div>
      ) : query.isLoadingError ? (
        <div className="hub-state" role="alert">
          <h3>{text("Chưa tải được danh bạ", "The directory could not be loaded")}</h3>
          <p>{query.error.message}</p>
          <button type="button" className="cp-button" onClick={() => void query.refetch()}>
            {text("Thử lại", "Retry")}
          </button>
        </div>
      ) : !rows.length && complete ? (
        <div className="hub-state">
          <h3>
            {kind || narrowed
              ? text("Không có trang nào khớp bộ lọc", "No pages match the filters")
              : text("Danh bạ đang được xây dựng", "The directory is being built")}
          </h3>
          <p>
            {kind || narrowed
              ? text("Thử một loại trang hoặc một khu vực khác.", "Try another kind of page or another region.")
              : text(
                  "Trang đã đối chiếu và công bố sẽ xuất hiện tại đây.",
                  "Pages that have been cross-checked and published will appear here.",
                )}
          </p>
          {(kind || narrowed) && (
            <button type="button" className="cp-button" onClick={() => update({ kind: "", region: "" })}>
              {text("Xóa bộ lọc", "Clear filters")}
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
      {!hub && (
        <InfiniteScroll
          query={more}
          label={text("Đang tải thêm trang", "Loading more pages")}
          retryLabel={text("Tải lại phần tiếp theo", "Load the next part again")}
        />
      )}
    </section>
  )
}

/**
 * The regions behind one button, which shows the flag of the one in use. Opening it asks for the count, so the menu
 * says so until the whole directory is in.
 */
function RegionMenu({
  regions,
  value,
  onOpen,
  onChange,
}: {
  /** Null until every page is counted. */
  regions: Region[] | null
  value: string
  onOpen: () => void
  onChange: (value: string) => void
}) {
  const { text, languageTag } = useStreamLocale()
  // One region, or none, leaves nothing to choose between.
  if (regions && !value && regions.filter((entry) => entry.key !== UNRECORDED).length < 2) return null
  const name = value && value !== UNRECORDED ? regionName(value, languageTag) : null
  const choice = (key: string, label: string, count?: number) => (
    <DropdownMenuItem
      key={key}
      className={key === value ? "hub-menu-item pg-region-current" : "hub-menu-item"}
      onSelect={() => onChange(key)}
    >
      <RegionMark code={key && key !== UNRECORDED ? key : "GLOBAL"} size={20} />
      {label}
      {count != null && <small>{count.toLocaleString(languageTag)}</small>}
    </DropdownMenuItem>
  )
  return (
    <DropdownMenu onOpenChange={(open) => open && onOpen()}>
      <DropdownMenuTrigger asChild>
        <button type="button" className="pg-region-button" data-active={value ? "" : undefined}>
          <RegionMark code={name ? value : "GLOBAL"} size={18} />
          <span>{!value ? text("Khu vực", "Region") : (name ?? text("Chưa ghi khu vực", "No region recorded"))}</span>
          <StreamIcon name="chevronRight" size={12} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        collisionPadding={12}
        className="hub-popover pg-region-menu"
        drawerTitle={text("Khu vực", "Region")}
      >
        {choice("", text("Mọi khu vực", "All regions"))}
        {regions ? (
          regions.map((entry) => choice(entry.key, entry.name, entry.count))
        ) : (
          <p className="pg-region-wait" role="status">
            {text("Đang đếm trang theo khu vực…", "Counting pages by region…")}
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
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
  const { text, languageTag } = useStreamLocale()
  const follow = useFollowPage()
  const name = profile.content?.name || profile.code
  const followed = following?.has(profile.id) ?? false
  const community = isCommunityProfile(profile.kind)
  // A person's own role says more than the generic staff label, also in a list of people.
  const roles = (profile.kind === "PERSON" && profile.content?.personRoles) || []
  const what = roles.length
    ? roles.map((role) => text(personRoleLabels[role], personRoleEnglish[role])).join(", ")
    : hideKind
      ? null
      : text(profileKindLabels[profile.kind], profileKindEnglish[profile.kind])
  const where = hideRegion ? null : regionName(profile.content?.country, languageTag)
  return (
    <article className="pg-card">
      <Link className="pg-card-link" to={`/pages/${profile.code}`} aria-label={name} />
      <ProfileMark profile={profile} size={52} />
      <div className="pg-card-body">
        <strong className="pg-card-name" title={name}>
          <OfficialName name={name} official={community && profile.represented} />
        </strong>
        {(what || where) && (
          <span className="pg-card-meta">
            {what}
            {what && where && " · "}
            {where && (
              <>
                <RegionMark code={regionKey(profile.content?.country)} size={16} /> {where}
              </>
            )}
          </span>
        )}
        {community && profile.followers > 0 && (
          <span className="pg-card-meta">{followersLabel(profile.followers)}</span>
        )}
      </div>
      {community && following && (
        <button
          type="button"
          className={followed ? "cp-follow-chip" : "cp-follow-chip cp-follow-primary"}
          aria-pressed={followed}
          aria-label={text(`Theo dõi ${name}`, `Follow ${name}`)}
          title={followed ? text("Đang theo dõi", "Following") : text("Theo dõi", "Follow")}
          disabled={follow.isPending}
          onClick={() => follow.mutate({ pageId: profile.id, following: !followed })}
        >
          <StreamIcon name={followed ? "check" : "plus"} size={14} />
          <span className="cp-follow-label">
            {followed ? text("Đang theo dõi", "Following") : text("Theo dõi", "Follow")}
          </span>
        </button>
      )}
    </article>
  )
}
