import { Link, useSearchParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import {
  isCommunityProfile,
  type CommunityProfile,
  type FeedPost,
  type PageSlice,
  type ProfileKind,
} from "@aov/community-contracts"
import { StreamShell } from "../../components/stream-shell"
import { StreamIcon } from "../../components/stream-icon"
import { useStreamLocale } from "../../components/stream-locale"
import { communityApi } from "./community-api"
import { PageDirectory } from "./community-directory"
import { LiveRow } from "./community-live"
import { PostCard } from "./community-post"
import { useFollowedIds } from "./community-queries"
import { Avatar, competitionStatus } from "./community-ui"
import { regionName } from "./profile-aside"
import { CompetitionEvent } from "./public-competitions"
import { competitionCatalogQuery } from "../tournaments/tournament-api"
import { videoEmbed } from "./post-media-model"
import "./community.css"

/**
 * Content grouped by type: live channels, new videos, teams and players, regions, then the searchable page
 * directory. The shared header search (`q`) lists matching tournaments, posts and pages.
 */
export function CommunityExplore() {
  const { text } = useStreamLocale()
  const [params] = useSearchParams()
  const query = params.get("q")?.trim() || ""
  return (
    <StreamShell>
      <title>{text("Khám phá — AOV Stream", "Explore — AOV Stream")}</title>
      <div className="cp-container cp-explore">
        <h1 className="cp-explore-title">
          {query ? text(`Kết quả cho “${query}”`, `Results for “${query}”`) : text("Khám phá", "Explore")}
        </h1>
        {query ? (
          <>
            <ExploreTournaments search={query} />
            <PostResults query={query} />
          </>
        ) : (
          <>
            <section className="hub-card hub-card-padded cp-explore-live">
              <LiveRow title={text("Trực tiếp", "Live")} />
            </section>
            <VideoHighlights />
            <PeopleRow kind="TEAM" title={text("Đội tuyển", "Teams")} />
            <PeopleRow kind="PLAYER" title={text("Tuyển thủ", "Players")} />
          </>
        )}
        {!query && <Regions />}
        <section className="hub-card hub-feed" aria-labelledby="explore-directory">
          <div className="hub-feed-body">
            <h2 id="explore-directory" className="cp-explore-heading">
              {text("Danh bạ trang", "Page directory")}
            </h2>
            <PageDirectory />
          </div>
        </section>
      </div>
    </StreamShell>
  )
}

/** Include published tournaments only when the shared search has a query. */
function ExploreTournaments({ search }: { search: string }) {
  const { text } = useStreamLocale()
  const query = useQuery(competitionCatalogQuery)
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
  const entries = (query.data || []).filter(
    (entry) =>
      !search ||
      normalize(`${entry.content.tournament.name} ${entry.content.plan.circuit}`).includes(normalize(search)),
  )
  const ranked = [...entries].sort(
    (a, b) =>
      Number(competitionStatus(a.content.tournament) === "FINISHED") -
        Number(competitionStatus(b.content.tournament) === "FINISHED") ||
      (b.content.tournament.year || 0) - (a.content.tournament.year || 0),
  )
  return (
    <section className="hub-card hub-card-padded" aria-labelledby="explore-competitions">
      <div className="hub-card-heading">
        <h2 id="explore-competitions" className="hub-card-title">
          {text("Giải đấu", "Tournaments")}
        </h2>
        <Link className="hub-card-more" to={`/competitions?${new URLSearchParams({ q: search })}`}>
          {text("Xem tất cả", "See all")}
        </Link>
      </div>
      {query.isPending ? (
        <div
          className="hub-skeleton-rows"
          role="status"
          aria-label={text("Đang tải giải đấu", "Loading tournaments")}
        />
      ) : query.isError && !query.data ? (
        <p className="cp-error" role="alert">
          {text("Chưa tải được giải đấu.", "Tournaments could not be loaded.")}{" "}
          <button onClick={() => void query.refetch()}>{text("Thử lại", "Retry")}</button>
        </p>
      ) : (
        <>
          {!entries.length && (
            <p className="cp-muted">{text("Chưa tìm thấy giải đấu phù hợp.", "No matching tournaments found.")}</p>
          )}
          <div className="hub-event-list">
            {ranked.slice(0, 3).map((entry) => (
              <CompetitionEvent key={entry.id} entry={entry} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

/** Posts whose title or text matches the search, first five. */
function PostResults({ query }: { query: string }) {
  const { text } = useStreamLocale()
  const following = useFollowedIds()
  const posts = useQuery({
    queryKey: ["post-search", query],
    queryFn: () => communityApi<PageSlice<FeedPost>>(`/posts?${new URLSearchParams({ q: query, size: "5" })}`),
  })
  return (
    <section className="hub-card hub-card-padded" aria-labelledby="explore-posts">
      <h2 id="explore-posts" className="hub-card-title">
        {text("Bài viết", "Posts")}
        {posts.data && <span className="cp-meta"> · {posts.data.totalElements}</span>}
      </h2>
      {posts.isPending ? (
        <div
          className="hub-skeleton cp-post-skeleton"
          role="status"
          aria-label={text("Đang tìm bài viết", "Searching for posts")}
        />
      ) : posts.isError ? (
        <p className="cp-error" role="alert">
          {text(
            "Chưa tìm được bài viết. Bạn vẫn có thể xem các trang phù hợp bên dưới.",
            "Post results could not be loaded. You can still see the matching pages below.",
          )}{" "}
          <button type="button" onClick={() => void posts.refetch()}>
            {text("Thử lại", "Retry")}
          </button>
        </p>
      ) : !posts.data.items.length ? (
        <p className="cp-muted">
          {text(
            "Chưa có bài viết nào khớp. Các trang phù hợp nằm trong danh bạ bên dưới.",
            "No matching posts yet. Matching pages are in the directory below.",
          )}
        </p>
      ) : (
        <div className="cp-post-list">
          {posts.data.items.map(({ post, page }) => (
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
      )}
    </section>
  )
}

/** The newest video posts as compact cards; YouTube videos show their thumbnail. */
function VideoHighlights() {
  const { text } = useStreamLocale()
  const videos = useQuery({
    queryKey: ["video-highlights"],
    queryFn: () => communityApi<PageSlice<FeedPost>>("/posts?kind=VIDEO&size=4"),
    staleTime: 60_000,
  })
  const items = videos.data?.items || []
  if (!items.length) return null
  return (
    <section className="hub-card hub-card-padded" aria-labelledby="explore-videos">
      <div className="hub-card-heading">
        <h2 id="explore-videos" className="hub-card-title">
          {text("Video mới", "New videos")}
        </h2>
        <Link to="/?tab=video" className="hub-card-more">
          {text("Xem tất cả", "See all")}
        </Link>
      </div>
      <div className="cp-video-cards">
        {items.map(({ post, page }) => {
          const embed = post.videoUrl ? videoEmbed(post.videoUrl) : null
          const youtube = embed?.kind === "youtube" ? embed.src.split("/").pop() : null
          return (
            <Link key={post.id} to={`/pages/${page.code}`} className="cp-video-card">
              <span className="cp-video-thumb">
                {youtube ? (
                  <img src={`https://i.ytimg.com/vi/${youtube}/hqdefault.jpg`} alt="" loading="lazy" />
                ) : (
                  <StreamIcon name="play" size={24} />
                )}
              </span>
              <strong>{post.title || post.body || "Video"}</strong>
              <small>{page.name}</small>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

/** Published pages of one kind as a row of avatars to browse. */
function PeopleRow({ kind, title }: { kind: ProfileKind; title: string }) {
  const { text } = useStreamLocale()
  const pages = useQuery({
    queryKey: ["people-row", kind],
    queryFn: () => communityApi<PageSlice<CommunityProfile>>(`/pages?kind=${kind}&size=12`),
    staleTime: 60_000,
  })
  const items = pages.data?.items || []
  if (!items.length) return null
  return (
    <section className="hub-card hub-card-padded" aria-label={title}>
      <div className="hub-card-heading">
        <h2 className="hub-card-title">{title}</h2>
        <Link to={`/explore?kind=${kind}`} className="hub-card-more">
          {text("Xem tất cả", "See all")}
        </Link>
      </div>
      <div className="cp-people-row">
        {items.map((page) => (
          <Link key={page.id} to={`/pages/${page.code}`} className="cp-person" title={page.content?.name}>
            <Avatar profile={page} />
            <span>{page.content?.shortName || page.content?.name || page.code}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

const OTHER_REGION = ["Khu vực khác", "Other regions"] as const

/** Published community pages grouped by their country, with Vietnam first. */
function Regions() {
  const { text, languageTag } = useStreamLocale()
  const pages = useQuery({
    queryKey: ["page-regions"],
    queryFn: () => communityApi<PageSlice<CommunityProfile>>("/pages?size=100"),
    staleTime: 60_000,
  })
  const groups = new Map<string, CommunityProfile[]>()
  for (const page of pages.data?.items || []) {
    if (!isCommunityProfile(page.kind)) continue
    const country = page.content?.country?.trim() || OTHER_REGION[0]
    groups.set(country, [...(groups.get(country) || []), page])
  }
  const rank = (country: string) => (country === "Việt Nam" ? 0 : country === OTHER_REGION[0] ? 2 : 1)
  const regions = [...groups].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b, "vi"))
  if (!regions.length) return null
  return (
    <section className="hub-card hub-card-padded cp-regions" aria-labelledby="explore-regions">
      <h2 id="explore-regions" className="hub-card-title">
        {text("Cộng đồng theo khu vực", "Community by region")}
      </h2>
      {regions.map(([country, items]) => (
        <div key={country} className="cp-region">
          <span className="cp-region-name">
            {country === OTHER_REGION[0] ? text(...OTHER_REGION) : regionName(country, languageTag)}
            <small>{text(`${items.length} trang`, `${items.length} ${items.length === 1 ? "page" : "pages"}`)}</small>
          </span>
          <div className="cp-region-pages">
            {items.map((page) => (
              <Link key={page.id} to={`/pages/${page.code}`} className="cp-channel" title={page.content?.name}>
                <Avatar profile={page} />
                <span>{page.content?.name || page.code}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
