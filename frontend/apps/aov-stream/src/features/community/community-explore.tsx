import { Link, useSearchParams } from "react-router"
import { useInfiniteQuery, useQueries, useQuery } from "@tanstack/react-query"
import {
  profileKindLabels,
  type CommunityProfile,
  type CompetitionView,
  type FeedPost,
  type PageSlice,
  type ProfileKind,
} from "@aov/community-contracts"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { nextPageOf } from "@aov/ui/lib/page-slice"
import { StreamShell } from "../../components/stream-shell"
import { StreamIcon } from "../../components/stream-icon"
import { useStreamLocale } from "../../components/stream-locale"
import { communityApi } from "./community-api"
import { PageDirectory, ProfileCard, profileKinds } from "./community-directory"
import { LiveCards, useLivePages, videoThumbnail } from "./community-live"
import { PostCard } from "./community-post"
import { useFollowedIds } from "./community-queries"
import { competitionStatus, profileKindEnglish, TimeAgo } from "./community-ui"
import { CompetitionCard } from "../tournaments/competition-card"
import { competitionCatalogQuery } from "../tournaments/tournament-api"
import "./community.css"
import "./community-explore.css"

/** The order search results come in: who plays, who works around them, then who organizes. */
const SEARCH_KINDS: ProfileKind[] = ["TEAM", "PLAYER", "PERSON", "ORGANIZATION", "CIRCUIT"]
/** Pages a search shows per kind before the link to all of them: two rows of the widest grid. */
const GROUP_SIZE = 8

/**
 * Without a search: who is live, the newest videos, then the page directory with its kind and region filters. The
 * header search (`q`) turns the page into results: pages by kind, competitions, then posts. `kind` beside `q` opens
 * one kind of page in full.
 */
export function CommunityExplore() {
  const { text } = useStreamLocale()
  const [params] = useSearchParams()
  const query = params.get("q")?.trim() || ""
  const requested = params.get("kind") as ProfileKind | null
  const kind = requested && profileKinds.includes(requested) ? requested : null
  return (
    <StreamShell>
      <title>{text("Khám phá — AOV Stream", "Explore — AOV Stream")}</title>
      <div className="cp-container ex-page">
        {!query ? <Browse /> : kind ? <KindResults query={query} kind={kind} /> : <SearchResults query={query} />}
      </div>
    </StreamShell>
  )
}

function Browse() {
  const { text } = useStreamLocale()
  return (
    <>
      <header className="tn-page-head">
        <div>
          <h1>{text("Khám phá", "Explore")}</h1>
          <p>Trang của các hệ thống giải, tổ chức, đội tuyển, tuyển thủ và ban huấn luyện.</p>
        </div>
      </header>
      <LiveNow />
      <NewVideos />
      <PageDirectory />
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
    queryKey: ["video-highlights"],
    queryFn: () => communityApi<PageSlice<FeedPost>>("/posts?kind=VIDEO&size=4"),
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
          Tất cả video
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

const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d")

/** Published competitions whose name or circuit holds the search, those not yet finished first, then the newest. */
function matchingCompetitions(catalog: CompetitionView[], search: string) {
  return catalog
    .filter((entry) =>
      normalize(`${entry.content.tournament.name} ${entry.content.plan.circuit}`).includes(normalize(search)),
    )
    .sort(
      (a, b) =>
        Number(competitionStatus(a.content.tournament) === "FINISHED") -
          Number(competitionStatus(b.content.tournament) === "FINISHED") ||
        (b.content.tournament.year || 0) - (a.content.tournament.year || 0),
    )
}

/** Everything a search found: pages by kind, competitions, then posts, which keep loading as the reader scrolls. */
function SearchResults({ query }: { query: string }) {
  const { text, languageTag } = useStreamLocale()
  const layout = usePageLayout()
  const following = useFollowedIds()
  const pages = useQueries({
    queries: SEARCH_KINDS.map((kind) => ({
      queryKey: ["page-search", kind, query],
      queryFn: () =>
        communityApi<PageSlice<CommunityProfile>>(
          `/pages?${new URLSearchParams({ kind, q: query, size: String(GROUP_SIZE) })}`,
        ),
      staleTime: 60_000,
    })),
  })
  const catalog = useQuery(competitionCatalogQuery)
  const posts = useInfiniteQuery({
    queryKey: ["post-search", query],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      communityApi<PageSlice<FeedPost>>(
        `/posts?${new URLSearchParams({ q: query, page: String(pageParam), size: "10" })}`,
      ),
    getNextPageParam: nextPageOf,
  })
  const competitions = matchingCompetitions(catalog.data || [], query)
  const postItems = posts.data?.pages.flatMap((page) => page.items) ?? []
  const totals = {
    pages: pages.reduce((sum, group) => sum + (group.data?.totalElements ?? 0), 0),
    competitions: competitions.length,
    posts: posts.data?.pages[0]?.totalElements ?? 0,
  }
  const searching = pages.some((group) => group.isPending) || catalog.isPending || posts.isPending
  const failed = pages.some((group) => group.isError) || (catalog.isError && !catalog.data) || posts.isLoadingError
  const nothing = !searching && !failed && !totals.pages && !totals.competitions && !totals.posts
  const pageCount = totals.pages.toLocaleString(languageTag)
  const competitionCount = totals.competitions.toLocaleString(languageTag)
  const postCount = totals.posts.toLocaleString(languageTag)
  const summary = [
    totals.pages && text(`${pageCount} trang`, `${pageCount} ${totals.pages === 1 ? "page" : "pages"}`),
    totals.competitions &&
      text(
        `${competitionCount} giải đấu`,
        `${competitionCount} ${totals.competitions === 1 ? "tournament" : "tournaments"}`,
      ),
    totals.posts && text(`${postCount} bài viết`, `${postCount} ${totals.posts === 1 ? "post" : "posts"}`),
  ].filter(Boolean)
  const preview = layout === "compact" ? { pages: 4, competitions: 3 } : { pages: GROUP_SIZE, competitions: 6 }
  return (
    <>
      <header className="tn-page-head">
        <div>
          <h1>{text(`Kết quả cho “${query}”`, `Results for “${query}”`)}</h1>
          {!searching && summary.length > 0 && <p>{summary.join(" · ")}</p>}
        </div>
      </header>
      {nothing && (
        <div className="hub-state">
          <h2>Không tìm thấy gì cho “{query}”</h2>
          <p>Thử một phần của tên, gõ có dấu như cách tên được viết.</p>
          <Link className="cp-button" to="/explore">
            Xem danh bạ trang
          </Link>
        </div>
      )}
      {SEARCH_KINDS.map((kind, index) => {
        const group = pages[index]!
        if (group.isError)
          return (
            <p key={kind} className="cp-error" role="alert">
              Chưa tìm được {profileKindLabels[kind].toLowerCase()}.{" "}
              <button type="button" onClick={() => void group.refetch()}>
                {text("Thử lại", "Retry")}
              </button>
            </p>
          )
        if (!group.data?.items.length) return null
        const total = group.data.totalElements
        const shown = group.data.items.slice(0, preview.pages)
        return (
          <section key={kind} aria-labelledby={`search-${kind}`}>
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
          Chưa tìm được trong các giải đấu.{" "}
          <button type="button" onClick={() => void catalog.refetch()}>
            {text("Thử lại", "Retry")}
          </button>
        </p>
      ) : (
        competitions.length > 0 && (
          <section aria-labelledby="search-competitions">
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
          Chưa tìm được bài viết.{" "}
          <button type="button" onClick={() => void posts.refetch()}>
            {text("Thử lại", "Retry")}
          </button>
        </p>
      ) : (
        postItems.length > 0 && (
          <section className="ex-posts" aria-labelledby="search-posts">
            <div className="tn-heading">
              <h2 id="search-posts">
                {text("Bài viết", "Posts")} <small>{totals.posts.toLocaleString(languageTag)}</small>
              </h2>
            </div>
            <div className="cp-post-list">
              {postItems.map(({ post, page }) => (
                <PostCard
                  key={post.id}
                  post={post}
                  page={page}
                  role=""
                  represented={page.represented}
                  following={following}
                />
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
        <div className="ex-searching" role="status" aria-label={`Đang tìm “${query}”`}>
          <span className="hub-skeleton" />
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
    queryKey: ["page-search-list", kind, query],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      communityApi<PageSlice<CommunityProfile>>(
        `/pages?${new URLSearchParams({ kind, q: query, page: String(pageParam), size: "24" })}`,
      ),
    getNextPageParam: nextPageOf,
  })
  const items = pages.data?.pages.flatMap((page) => page.items) ?? []
  const total = pages.data?.pages[0]?.totalElements
  const back = `/explore?${new URLSearchParams({ q: query })}`
  return (
    <>
      <Link className="cp-back" to={back}>
        <StreamIcon name="back" size={16} />
        Tất cả kết quả
      </Link>
      <header className="tn-page-head">
        <div>
          <h1>{text(`Kết quả cho “${query}”`, `Results for “${query}”`)}</h1>
        </div>
      </header>
      <section aria-labelledby="search-kind">
        <div className="tn-heading">
          <h2 id="search-kind">
            {text(profileKindLabels[kind], profileKindEnglish[kind])}{" "}
            {total != null && <small>{total.toLocaleString(languageTag)}</small>}
          </h2>
        </div>
        {pages.isPending ? (
          <div className="cp-grid" role="status" aria-label="Đang tìm trang">
            {Array.from({ length: 8 }, (_, index) => (
              <div className="hub-skeleton cp-card-skeleton" key={index} />
            ))}
          </div>
        ) : pages.isLoadingError ? (
          <div className="hub-state" role="alert">
            <h3>Chưa tìm được trang</h3>
            <p>{pages.error.message}</p>
            <button type="button" className="cp-button" onClick={() => void pages.refetch()}>
              {text("Thử lại", "Retry")}
            </button>
          </div>
        ) : !items.length ? (
          <div className="hub-state">
            <h3>
              Không có {profileKindLabels[kind].toLowerCase()} nào khớp “{query}”
            </h3>
            <Link className="cp-button" to={back}>
              Xem tất cả kết quả
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
