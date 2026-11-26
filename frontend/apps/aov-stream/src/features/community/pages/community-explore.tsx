import { Link, useSearchParams } from "react-router"
import { useInfiniteQuery, useQueries, useQuery } from "@tanstack/react-query"
import { profileKindLabels, type CompetitionParticipant, type ProfileKind } from "@aov/community-contracts"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { nextPageOf } from "@aov/ui/lib/page-slice"
import { PlaceTrail, useSections } from "../../../components/place-trail"
import { StreamShell } from "../../../components/stream-shell"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { communityApi } from "../../../lib/community-api"
import { communityKeys } from "../../../lib/community-keys"
import { PageDirectory, ProfileCard, profileKinds } from "../components/community-directory"
import { LiveCards, useLivePages, videoThumbnail } from "../components/community-live"
import { PostCard } from "../components/community-post"
import { useFollowedIds } from "../../../lib/community-queries"
import { profileKindEnglish, TimeAgo } from "../../../components/community-ui"
import { CompetitionCard } from "../../../components/competition-card"
import { isParticipantKind } from "../../../lib/participant-model"
import { matchingCompetitions } from "../../../lib/search-model"
import { pageSearchQuery, participantSearchQuery, SEARCH_GROUP_SIZE } from "../../../lib/search-queries"
import { competitionCatalogQuery } from "../../../lib/tournament-api"
import { ParticipantCard, ParticipantList } from "../../../components/participant-list"
import { StreamHead } from "../../../components/stream-head"
import "../components/community.css"
import "./community-explore.css"

/** The order search results come in: who plays, who works around them, then who organizes. */
const PARTICIPANTS = ["TEAM", "PLAYER", "PERSON"] as const
const SEARCH_KINDS: ProfileKind[] = ["ORGANIZATION", "CIRCUIT"]
const PARTICIPANT_SEARCH = {
  TEAM: ["Tìm đội tuyển", "Search teams"],
  PLAYER: ["Tìm tuyển thủ", "Search players"],
  PERSON: ["Tìm nhân sự", "Search staff"],
} as const

/**
 * Without a search: who is live, the newest videos, then the page directory with its kind and region filters. The
 * header search (`q`) turns the page into results: pages by kind, competitions, then posts. `kind` beside `q` opens
 * one kind of page in full.
 */
export function CommunityExplore() {
  const { text } = useStreamLocale()
  const [params, setParams] = useSearchParams()
  const query = params.get("q")?.trim() || ""
  const requested = params.get("kind") as ProfileKind | null
  const kind = requested && profileKinds.includes(requested) ? requested : null
  // The lists of teams, players and personnel are long, so the bar's search narrows them in place.
  const listed = !query && isParticipantKind(kind)
  return (
    <StreamShell
      search={
        listed
          ? {
              value: params.get("name") || "",
              onChange: (value) =>
                setParams(
                  (current) => {
                    const next = new URLSearchParams(current)
                    if (value) next.set("name", value)
                    else next.delete("name")
                    return next
                  },
                  { replace: true },
                ),
              label: text(PARTICIPANT_SEARCH[kind][0], PARTICIPANT_SEARCH[kind][1]),
              placeholder: `${text(PARTICIPANT_SEARCH[kind][0], PARTICIPANT_SEARCH[kind][1])}…`,
            }
          : undefined
      }
    >
      <StreamHead
        title={text("Khám phá — AOV Stream", "Explore — AOV Stream")}
        description={text(
          "Tìm đội tuyển, tuyển thủ, hệ thống giải và nhà tổ chức Liên Quân Mobile trên AOV Stream.",
          "Find Arena of Valor teams, players, tournament circuits and organisers on AOV Stream.",
        )}
      />
      <div className="cp-container ex-page">
        {!query ? (
          <Browse />
        ) : isParticipantKind(kind) ? (
          <ParticipantResults query={query} kind={kind} />
        ) : kind ? (
          <KindResults query={query} kind={kind} />
        ) : (
          <SearchResults query={query} />
        )}
      </div>
    </StreamShell>
  )
}

function Browse() {
  const { text } = useStreamLocale()
  return (
    <>
      <h1 className="sr-only">{text("Khám phá", "Explore")}</h1>
      <div className="ex-lead" data-place-head="">
        <LiveNow />
        <NewVideos />
      </div>
      <PageDirectory />
    </>
  )
}

/** Where the results of one kind stand: under everything the search found. */
function ResultsTrail({ query }: { query: string }) {
  const { text } = useStreamLocale()
  const { explore } = useSections()
  const results = {
    to: `/explore?${new URLSearchParams({ q: query })}`,
    name: text(`Kết quả cho “${query}”`, `Results for “${query}”`),
  }
  return <PlaceTrail places={[explore, results]} />
}

/** The teams, players or personnel whose name holds the search. */
function ParticipantResults({ query, kind }: { query: string; kind: CompetitionParticipant["kind"] }) {
  const { text } = useStreamLocale()
  return (
    <>
      <ResultsTrail query={query} />
      <h1 className="sr-only">{text(`Kết quả cho “${query}”`, `Results for “${query}”`)}</h1>
      <section aria-labelledby="explore-results">
        <div className="tn-heading">
          <h2 id="explore-results">{text(profileKindLabels[kind], profileKindEnglish[kind])}</h2>
        </div>
        <ParticipantList kind={kind} q={query} />
      </section>
    </>
  )
}

/** Pages broadcasting now; the section is absent while nobody is live. */
function LiveNow() {
  const { text } = useStreamLocale()
  const live = useLivePages()
  const pages = (live.data?.items || []).filter((page) => page.live)
  if (!pages.length) return null
  return (
    <section aria-labelledby="explore-live">
      <div className="tn-heading">
        <h2 id="explore-live">
          {text("Đang trực tiếp", "Live now")}{" "}
          <small>
            {text(`${pages.length} kênh`, `${pages.length} ${pages.length === 1 ? "channel" : "channels"}`)}
          </small>
        </h2>
      </div>
      <LiveCards pages={pages} />
    </section>
  )
}

/** The newest video posts, each opening the page that posted it. YouTube videos show their own picture. */
function NewVideos() {
  const { text } = useStreamLocale()
  const layout = usePageLayout()
  const videos = useQuery({
    queryKey: communityKeys.videoHighlights,
    queryFn: () => communityApi.posts({ kind: "VIDEO", size: "4" }),
    staleTime: 60_000,
  })
  const items = videos.data?.items || []
  if (!items.length) return null
  // Two columns on a compact layout: an odd video would stand alone in its row.
  const shown = layout === "compact" && items.length > 1 ? items.slice(0, items.length - (items.length % 2)) : items
  return (
    <section aria-labelledby="explore-videos">
      <div className="tn-heading">
        <h2 id="explore-videos">{text("Video mới", "New videos")}</h2>
        <Link to="/?tab=video">
          {text("Tất cả video", "All videos")}
          <StreamIcon name="arrow" size={15} />
        </Link>
      </div>
      <div className="ex-video-grid">
        {shown.map(({ post, page }) => {
          const picture = videoThumbnail(post.videoUrl)
          return (
            <Link key={post.id} to={`/pages/${page.code}`} className="ex-video">
              <span className="ex-video-thumb">
                {picture ? <img src={picture} alt="" loading="lazy" /> : <StreamIcon name="play" size={24} />}
              </span>
              <span className="ex-video-body">
                <strong>{post.title || post.body || "Video"}</strong>
                <small>
                  <span>{page.name}</span>
                  <span>
                    <TimeAgo value={post.createdAt} />
                  </span>
                </small>
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

/** Everything a search found: pages by kind, competitions, then posts, which keep loading as the reader scrolls. */
function SearchResults({ query }: { query: string }) {
  const { text, languageTag } = useStreamLocale()
  const layout = usePageLayout()
  const following = useFollowedIds()
  // The same reads as the suggestions under the field, so the results open on what they already found.
  const pages = useQueries({ queries: SEARCH_KINDS.map((kind) => pageSearchQuery(kind, query)) })
  const people = {
    TEAM: useInfiniteQuery(participantSearchQuery("TEAM", query)),
    PLAYER: useInfiniteQuery(participantSearchQuery("PLAYER", query)),
    PERSON: useInfiniteQuery(participantSearchQuery("PERSON", query)),
  }
  const peopleCount = PARTICIPANTS.reduce((sum, kind) => sum + (people[kind].data?.pages[0]?.totalElements ?? 0), 0)
  const catalog = useQuery(competitionCatalogQuery)
  const posts = useInfiniteQuery({
    queryKey: communityKeys.postSearch(query),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => communityApi.posts({ q: query, page: String(pageParam), size: "10" }),
    getNextPageParam: nextPageOf,
  })
  const competitions = matchingCompetitions(catalog.data || [], query)
  const postItems = posts.data?.pages.flatMap((page) => page.items) ?? []
  const totals = {
    pages: pages.reduce((sum, group) => sum + (group.data?.totalElements ?? 0), 0),
    competitions: competitions.length,
    posts: posts.data?.pages[0]?.totalElements ?? 0,
  }
  const searching =
    pages.some((group) => group.isPending) ||
    PARTICIPANTS.some((kind) => people[kind].isPending) ||
    catalog.isPending ||
    posts.isPending
  const failed = pages.some((group) => group.isError) || (catalog.isError && !catalog.data) || posts.isLoadingError
  const nothing = !searching && !failed && !peopleCount && !totals.pages && !totals.competitions && !totals.posts
  // One pill per group found, which scrolls to it: the counts say at once where the search landed.
  const groups = [
    ...PARTICIPANTS.map((kind) => ({
      id: `search-${kind}`,
      label: text(profileKindLabels[kind], profileKindEnglish[kind]),
      count: people[kind].data?.pages[0]?.totalElements ?? 0,
    })),
    ...SEARCH_KINDS.map((kind, index) => ({
      id: `search-${kind}`,
      label: text(profileKindLabels[kind], profileKindEnglish[kind]),
      count: pages[index]?.data?.totalElements ?? 0,
    })),
    { id: "search-competitions", label: text("Giải đấu", "Tournaments"), count: totals.competitions },
    { id: "search-posts", label: text("Bài viết", "Posts"), count: totals.posts },
  ].filter((group) => group.count > 0)
  const jump = (id: string) =>
    document
      .getElementById(id)
      ?.closest("section")
      ?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      })
  const preview = layout === "compact" ? { pages: 4, competitions: 3 } : { pages: SEARCH_GROUP_SIZE, competitions: 6 }
  return (
    <>
      <header className="tn-page-head ex-page-head">
        <div>
          <h1>{text(`Kết quả cho “${query}”`, `Results for “${query}”`)}</h1>
          {!searching && groups.length > 1 && (
            <nav className="hub-pills ex-jump" aria-label={text("Các nhóm kết quả", "Result groups")}>
              {groups.map((group) => (
                <button key={group.id} type="button" onClick={() => jump(group.id)}>
                  {group.label}
                  <small>{group.count.toLocaleString(languageTag)}</small>
                </button>
              ))}
            </nav>
          )}
        </div>
      </header>
      {nothing && (
        <div className="hub-state">
          <h2>{text(`Không tìm thấy gì cho “${query}”`, `Nothing found for “${query}”`)}</h2>
          <p>
            {text(
              "Thử một phần của tên, gõ có dấu như cách tên được viết.",
              "Try part of the name, with accents as the name is written.",
            )}
          </p>
          <Link className="cp-button" to="/explore">
            {text("Xem danh bạ trang", "Browse the page directory")}
          </Link>
        </div>
      )}
      {PARTICIPANTS.map((kind) => {
        const found = people[kind].data?.pages[0]
        if (!found?.items.length) return null
        const shown = found.items.slice(0, preview.pages)
        return (
          <section key={kind} className="ex-result" aria-labelledby={`search-${kind}`}>
            <div className="tn-heading">
              <h2 id={`search-${kind}`}>
                {text(profileKindLabels[kind], profileKindEnglish[kind])}{" "}
                <small>{found.totalElements.toLocaleString(languageTag)}</small>
              </h2>
              {found.totalElements > shown.length && (
                <Link to={`/explore?${new URLSearchParams({ q: query, kind })}`}>
                  {text("Xem tất cả", "See all")}
                  <StreamIcon name="arrow" size={15} />
                </Link>
              )}
            </div>
            <ul className="pt-cards">
              {shown.map((item) => (
                <ParticipantCard key={item.id} item={item} />
              ))}
            </ul>
          </section>
        )
      })}
      {SEARCH_KINDS.map((kind, index) => {
        const group = pages[index]!
        if (group.isError)
          return (
            <p key={kind} className="cp-error" role="alert">
              {text(
                `Chưa tìm được ${profileKindLabels[kind].toLowerCase()}.`,
                `No ${profileKindEnglish[kind].toLowerCase()} found.`,
              )}{" "}
              <button type="button" onClick={() => void group.refetch()}>
                {text("Thử lại", "Retry")}
              </button>
            </p>
          )
        if (!group.data?.items.length) return null
        const total = group.data.totalElements
        const shown = group.data.items.slice(0, preview.pages)
        return (
          <section key={kind} className="ex-result" aria-labelledby={`search-${kind}`}>
            <div className="tn-heading">
              <h2 id={`search-${kind}`}>
                {text(profileKindLabels[kind], profileKindEnglish[kind])}{" "}
                <small>{total.toLocaleString(languageTag)}</small>
              </h2>
              {total > shown.length && (
                <Link to={`/explore?${new URLSearchParams({ q: query, kind })}`}>
                  {text("Xem tất cả", "See all")}
                  <StreamIcon name="arrow" size={15} />
                </Link>
              )}
            </div>
            <div className="cp-grid">
              {shown.map((profile) => (
                <ProfileCard key={profile.id} profile={profile} following={following} hideKind />
              ))}
            </div>
          </section>
        )
      })}
      {catalog.isError && !catalog.data ? (
        <p className="cp-error" role="alert">
          {text("Chưa tìm được trong các giải đấu.", "Nothing found in tournaments.")}{" "}
          <button type="button" onClick={() => void catalog.refetch()}>
            {text("Thử lại", "Retry")}
          </button>
        </p>
      ) : (
        competitions.length > 0 && (
          <section className="ex-result" aria-labelledby="search-competitions">
            <div className="tn-heading">
              <h2 id="search-competitions">
                {text("Giải đấu", "Tournaments")} <small>{competitions.length.toLocaleString(languageTag)}</small>
              </h2>
              {competitions.length > preview.competitions && (
                <Link to={`/competitions?${new URLSearchParams({ q: query })}`}>
                  {text("Xem tất cả", "See all")}
                  <StreamIcon name="arrow" size={15} />
                </Link>
              )}
            </div>
            <div className="tn-card-grid">
              {competitions.slice(0, preview.competitions).map((entry) => (
                <CompetitionCard key={entry.id} entry={entry} />
              ))}
            </div>
          </section>
        )
      )}
      {posts.isLoadingError ? (
        <p className="cp-error" role="alert">
          {text("Chưa tìm được bài viết.", "No posts found.")}{" "}
          <button type="button" onClick={() => void posts.refetch()}>
            {text("Thử lại", "Retry")}
          </button>
        </p>
      ) : (
        postItems.length > 0 && (
          <section className="ex-result ex-posts" aria-labelledby="search-posts">
            <div className="tn-heading">
              <h2 id="search-posts">
                {text("Bài viết", "Posts")} <small>{totals.posts.toLocaleString(languageTag)}</small>
              </h2>
            </div>
            <div className="ps-list">
              {postItems.map(({ post, page }) => (
                <PostCard key={post.id} post={post} page={page} role="" following={following} />
              ))}
            </div>
            <InfiniteScroll
              query={posts}
              label={text("Đang tải thêm bài viết", "Loading more posts")}
              retryLabel={text("Tải lại phần tiếp theo", "Load the next part again")}
            />
          </section>
        )
      )}
      {searching && (
        <div
          className="ex-searching"
          role="status"
          aria-label={text(`Đang tìm “${query}”`, `Searching for “${query}”`)}
        >
          <span className="hub-skeleton ex-heading-skeleton" />
          <div className="cp-grid">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="hub-skeleton cp-card-skeleton" key={index} />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

/** Every page of one kind that matches the search, loading as the reader scrolls. */
function KindResults({ query, kind }: { query: string; kind: ProfileKind }) {
  const { text, languageTag } = useStreamLocale()
  const following = useFollowedIds()
  const pages = useInfiniteQuery({
    queryKey: communityKeys.pageSearchList(kind, query),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => communityApi.pages({ kind, q: query, page: String(pageParam), size: "24" }),
    getNextPageParam: nextPageOf,
  })
  const items = pages.data?.pages.flatMap((page) => page.items) ?? []
  const total = pages.data?.pages[0]?.totalElements
  const back = `/explore?${new URLSearchParams({ q: query })}`
  return (
    <>
      <ResultsTrail query={query} />
      <h1 className="sr-only">{text(`Kết quả cho “${query}”`, `Results for “${query}”`)}</h1>
      <section aria-labelledby="search-kind">
        <div className="tn-heading">
          <h2 id="search-kind">
            {text(profileKindLabels[kind], profileKindEnglish[kind])}{" "}
            {total != null && <small>{total.toLocaleString(languageTag)}</small>}
          </h2>
        </div>
        {pages.isPending ? (
          <div className="cp-grid" role="status" aria-label={text("Đang tìm trang", "Searching pages")}>
            {Array.from({ length: 8 }, (_, index) => (
              <div className="hub-skeleton cp-card-skeleton" key={index} />
            ))}
          </div>
        ) : pages.isLoadingError ? (
          <div className="hub-state" role="alert">
            <h3>{text("Chưa tìm được trang", "No pages found")}</h3>
            <p>{pages.error.message}</p>
            <button type="button" className="cp-button" onClick={() => void pages.refetch()}>
              {text("Thử lại", "Retry")}
            </button>
          </div>
        ) : !items.length ? (
          <div className="hub-state">
            <h3>
              {text(
                `Không có ${profileKindLabels[kind].toLowerCase()} nào khớp “${query}”`,
                `No ${profileKindEnglish[kind].toLowerCase()} matches “${query}”`,
              )}
            </h3>
            <Link className="cp-button" to={back}>
              {text("Xem tất cả kết quả", "See all results")}
            </Link>
          </div>
        ) : (
          <div className="cp-grid">
            {items.map((profile) => (
              <ProfileCard key={profile.id} profile={profile} following={following} hideKind />
            ))}
          </div>
        )}
        <InfiniteScroll
          query={pages}
          label={text("Đang tải thêm trang", "Loading more pages")}
          retryLabel={text("Tải lại phần tiếp theo", "Load the next part again")}
        />
      </section>
    </>
  )
}
