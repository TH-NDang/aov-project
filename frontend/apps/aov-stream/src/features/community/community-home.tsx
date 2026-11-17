import { Link, Navigate, useNavigate, useSearchParams } from "react-router"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { isCommunityProfile, type PostKind } from "@aov/community-contracts"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { nextPageOf } from "@aov/ui/lib/page-slice"
import { StreamShell } from "../../components/stream-shell"
import { StreamIcon } from "../../components/stream-icon"
import { useStreamLocale } from "../../components/stream-locale"
import { communityApi } from "./community-api"
import { communityKeys } from "./community-keys"
import { CommunityAside } from "./community-aside"
import { useCommunitySession } from "../../lib/stream-auth"
import { ProfileCard } from "./community-directory"
import { PostCard } from "./community-post"
import { LiveRow } from "./community-live"
import { HomeCompetitions, HomeMatches } from "./home-matches"
import { useFollowedIds } from "./community-queries"
import { useSignedInAction } from "./community-signin"
import "./community.css"

type Tab = "latest" | "following" | "video" | "news"

const filters: { value: Tab; label: string; english: string; icon: "feed" | "heart" | "play" | "news" }[] = [
  { value: "latest", label: "Tất cả", english: "All", icon: "feed" },
  { value: "following", label: "Đang theo dõi", english: "Following", icon: "heart" },
  { value: "video", label: "Video", english: "Videos", icon: "play" },
  { value: "news", label: "Tin tức", english: "News", icon: "news" },
]
const tabKinds: Partial<Record<Tab, PostKind>> = { video: "VIDEO", news: "NEWS" }

export function CommunityHome() {
  const { text } = useStreamLocale()
  const session = useCommunitySession()
  const signedIn = useSignedInAction()
  const [params, setParams] = useSearchParams()
  // The page directory moved to the explore page; old links keep their search and kind.
  if (params.has("q") || params.has("kind") || params.get("tab") === "directory") {
    const moved = new URLSearchParams(params)
    moved.delete("tab")
    const search = moved.toString()
    return <Navigate to={search ? `/explore?${search}` : "/explore"} replace />
  }
  const requested = params.get("tab")
  if (requested === "results") return <Navigate to="/competitions?tab=schedule&scope=results" replace />
  const tab: Tab =
    requested === "following"
      ? session.status === "authenticated"
        ? "following"
        : "latest"
      : filters.find((filter) => filter.value === requested)?.value || "latest"
  const open = (next: Tab) => setParams(next === "latest" ? {} : { tab: next })
  return (
    <StreamShell
      lead={
        <>
          <h1 className="sr-only">{text("Bảng tin cộng đồng", "Community feed")}</h1>
          <HomeMatches />
        </>
      }
      aside={
        <>
          <HomeCompetitions />
          <CommunityAside />
        </>
      }
    >
      <title>{text("Bảng tin — AOV Stream", "Feed — AOV Stream")}</title>
      <div className="cp-container">
        <section>
          <div className="hub-feed-header">
            <div className="hub-pills" role="group" aria-label={text("Lọc bảng tin", "Filter the feed")}>
              {filters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  aria-pressed={tab === filter.value}
                  onClick={() =>
                    filter.value === "following"
                      ? signedIn(
                          text(
                            "Đăng nhập để xem bài mới từ các trang bạn theo dõi.",
                            "Sign in to see new posts from the pages you follow.",
                          ),
                          () => open("following"),
                        )
                      : open(filter.value)
                  }
                >
                  <StreamIcon name={filter.icon} size={15} />
                  {text(filter.label, filter.english)}
                </button>
              ))}
            </div>
          </div>
          <div className="hub-feed-body">
            {tab === "latest" && <LiveRow />}
            <CrossFeed key={tab} following={tab === "following"} kind={tabKinds[tab]} />
          </div>
        </section>
      </div>
    </StreamShell>
  )
}

function CrossFeed({ following, kind }: { following: boolean; kind?: PostKind }) {
  const { text } = useStreamLocale()
  const navigate = useNavigate()
  const session = useCommunitySession()
  const followedIds = useFollowedIds()
  const signedIn = session.status === "authenticated"
  const feed = useInfiniteQuery({
    queryKey: communityKeys.feed(following, kind, signedIn ? session.revision : 0),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      (signedIn ? communityApi.feed : communityApi.posts)({
        ...(signedIn ? { following: String(following) } : {}),
        ...(kind ? { kind } : {}),
        page: String(pageParam),
        size: "10",
      }),
    getNextPageParam: nextPageOf,
  })
  const items = feed.data?.pages.flatMap((page) => page.items) || []
  if (feed.isPending)
    return (
      <div className="cp-post-list" role="status" aria-label={text("Đang tải bảng tin", "Loading the feed")}>
        <div className="hub-skeleton cp-post-skeleton" />
        <div className="hub-skeleton cp-post-skeleton" />
      </div>
    )
  if (feed.isLoadingError)
    return (
      <div className="hub-state" role="alert">
        <h3>{text("Chưa tải được bảng tin", "The feed could not be loaded")}</h3>
        <p>{feed.error.message}</p>
        <button className="cp-button" onClick={() => void feed.refetch()}>
          {text("Thử lại", "Retry")}
        </button>
      </div>
    )
  if (!items.length)
    return following ? (
      <div className="hub-state">
        <h3>{text("Chưa có bài mới từ trang bạn theo dõi", "No new posts from the pages you follow yet")}</h3>
        <p>
          {text(
            "Theo dõi tổ chức, đội tuyển hoặc tuyển thủ để thấy bài viết của họ tại đây.",
            "Follow organizations, teams or players to see their posts here.",
          )}
        </p>
        <button className="cp-button cp-primary" onClick={() => navigate("/explore")}>
          {text("Khám phá trang", "Explore pages")}
        </button>
      </div>
    ) : kind ? (
      <div className="hub-state">
        <h3>{kind === "VIDEO" ? text("Chưa có video", "No videos yet") : text("Chưa có tin tức", "No news yet")}</h3>
        <p>
          {text(
            `Bài ${kind === "VIDEO" ? "video" : "tin tức"} của các trang sẽ xuất hiện tại đây ngay khi được đăng.`,
            `${kind === "VIDEO" ? "Video" : "News"} posts from pages will appear here as soon as they are posted.`,
          )}
        </p>
      </div>
    ) : (
      <FeaturedPages />
    )
  return (
    <div className="cp-post-list">
      {items.map(({ post, page }) => (
        <PostCard
          key={post.id}
          post={post}
          page={page}
          role=""
          represented={page.represented}
          following={followedIds}
        />
      ))}
      <InfiniteScroll
        query={feed}
        label={text("Đang tải thêm bài viết", "Loading more posts")}
        retryLabel={text("Tải lại phần tiếp theo", "Load the next part again")}
      />
      {!feed.hasNextPage && items.length > 10 && (
        <p className="stream-load-more">{text("Bạn đã xem hết bài viết.", "You have seen all the posts.")}</p>
      )}
    </div>
  )
}

/** An empty feed still gives visitors somewhere to go: the published community pages, ready to follow. */
function FeaturedPages() {
  const { text } = useStreamLocale()
  const following = useFollowedIds()
  const pages = useQuery({
    queryKey: communityKeys.channels,
    queryFn: () => communityApi.pages({ size: "20" }),
    staleTime: 60_000,
  })
  const featured = (pages.data?.items || []).filter((page) => isCommunityProfile(page.kind)).slice(0, 6)
  return (
    <div className="cp-featured">
      <div className="cp-featured-intro">
        <h2>{text("Bắt đầu với các trang chính thức", "Start with the official pages")}</h2>
        <p>
          {text(
            "Chưa có bài viết công khai. Theo dõi trang để thấy bài mới ngay khi được đăng.",
            "No public posts yet. Follow pages to see new posts as soon as they are posted.",
          )}
        </p>
      </div>
      {pages.isPending ? (
        <div className="cp-grid" role="status" aria-label={text("Đang tải trang nổi bật", "Loading featured pages")}>
          {Array.from({ length: 3 }, (_, index) => (
            <div className="hub-skeleton cp-card-skeleton" key={index} />
          ))}
        </div>
      ) : featured.length ? (
        <div className="cp-grid">
          {featured.map((profile) => (
            <ProfileCard key={profile.id} profile={profile} following={following} />
          ))}
        </div>
      ) : null}
      <Link className="cp-button" to="/explore">
        {text("Xem tất cả trong Khám phá", "See all in Explore")}
        <StreamIcon name="arrow" size={15} />
      </Link>
    </div>
  )
}
