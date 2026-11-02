import { useEffect, useRef, type CSSProperties } from "react"
import { Link, useSearchParams } from "react-router"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import type { CommunityProfile, FeedPost, PageSlice } from "@aov/community-contracts"
import { StreamShell } from "../../components/stream-shell"
import { StreamBrand } from "../../components/stream-brand"
import { StreamIcon } from "../../components/stream-icon"
import { communityApi } from "./community-api"
import { CommunityAside } from "./community-aside"
import { useCommunitySession } from "./community-auth"
import { PageDirectory } from "./community-directory"
import { PostCard } from "./community-post"
import { useFollowedIds } from "./community-queries"
import { useSignedInAction } from "./community-signin"
import { Avatar } from "./community-ui"
import "./community.css"

type Tab = "latest" | "following" | "directory"

export function CommunityHome() {
  const session = useCommunitySession()
  const signedIn = useSignedInAction()
  const [params, setParams] = useSearchParams()
  const requested = params.get("tab")
  const tab: Tab =
    params.has("q") || params.has("kind") || requested === "directory"
      ? "directory"
      : requested === "following" && session.status === "authenticated"
        ? "following"
        : "latest"
  const open = (next: Tab) => setParams(next === "latest" ? {} : { tab: next })
  return (
    <StreamShell aside={<CommunityAside suggestions />}>
      <title>Cộng đồng — AOV Stream</title>
      <div className="cp-container">
        <ChannelStrip />
        <header className="hub-banner hub-art cp-community-banner" style={{ "--hub-hue": 214 } as CSSProperties}>
          <div className="hub-banner-copy">
            <span className="hub-kicker">Cộng đồng Liên Quân</span>
            <h1>Tin mới từ đấu trường</h1>
            <p>
              Bài viết từ tổ chức, đội tuyển, tuyển thủ và người hâm mộ. Ai cũng đọc được; đăng nhập để thích, bình luận
              và theo dõi.
            </p>
          </div>
          <span className="hub-banner-mark" aria-hidden="true">
            <StreamBrand compact />
          </span>
        </header>
        <section className="hub-card hub-feed">
          <div className="hub-feed-header">
            <nav className="cp-tabs" aria-label="Nội dung cộng đồng">
              <button aria-current={tab === "latest" ? "page" : undefined} onClick={() => open("latest")}>
                Mới nhất
              </button>
              <button
                aria-current={tab === "following" ? "page" : undefined}
                onClick={() => signedIn("Đăng nhập để xem bài mới từ các trang bạn theo dõi.", () => open("following"))}
              >
                Đang theo dõi
              </button>
              <button aria-current={tab === "directory" ? "page" : undefined} onClick={() => open("directory")}>
                Danh bạ trang
              </button>
            </nav>
          </div>
          <div className="hub-feed-body">
            {tab === "directory" ? (
              <PageDirectory />
            ) : (
              <CrossFeed key={tab} following={tab === "following"} onExplore={() => open("directory")} />
            )}
          </div>
        </section>
      </div>
    </StreamShell>
  )
}

/** Published pages as channels, like a channel bar: the shared feed first, then each page. */
export function ChannelStrip({ active }: { active?: string }) {
  const pages = useQuery({
    queryKey: ["page-channels"],
    queryFn: () => communityApi<PageSlice<CommunityProfile>>("/pages?size=20"),
    staleTime: 60_000,
  })
  if (pages.data && !pages.data.items.length) return null
  return (
    <nav className="cp-channels" aria-label="Kênh cộng đồng">
      <Link to="/pages" className="cp-channel" aria-current={!active ? "page" : undefined}>
        <span className="cp-channel-icon">
          <StreamIcon name="feed" size={18} />
        </span>
        <span>Bảng tin</span>
      </Link>
      {pages.data?.items.map((page) => (
        <Link
          key={page.id}
          to={`/pages/${page.code}`}
          className="cp-channel"
          aria-current={active === page.code ? "page" : undefined}
          title={page.content?.name}
        >
          <Avatar profile={page} />
          <span>{page.content?.shortName || page.content?.name || page.code}</span>
        </Link>
      ))}
    </nav>
  )
}

function CrossFeed({ following, onExplore }: { following: boolean; onExplore: () => void }) {
  const session = useCommunitySession()
  const followedIds = useFollowedIds()
  const signedIn = session.status === "authenticated"
  const sentinel = useRef<HTMLDivElement>(null)
  const feed = useInfiniteQuery({
    queryKey: ["community-feed", following, signedIn ? session.revision : 0],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      communityApi<PageSlice<FeedPost>>(
        signedIn ? `/me/feed?following=${following}&page=${pageParam}&size=10` : `/posts?page=${pageParam}&size=10`,
      ),
    getNextPageParam: (last) => ((last.page + 1) * last.size < last.totalElements ? last.page + 1 : undefined),
  })
  const items = feed.data?.pages.flatMap((page) => page.items) || []
  useEffect(() => {
    if (!sentinel.current || !feed.hasNextPage || feed.isFetching || feed.isFetchNextPageError) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void feed.fetchNextPage()
      },
      { rootMargin: "400px" },
    )
    observer.observe(sentinel.current)
    return () => observer.disconnect()
  }, [feed.hasNextPage, feed.isFetching, feed.isFetchNextPageError, feed.fetchNextPage, items.length])

  if (feed.isPending)
    return (
      <div className="cp-post-list" role="status" aria-label="Đang tải bảng tin">
        <div className="hub-skeleton cp-post-skeleton" />
        <div className="hub-skeleton cp-post-skeleton" />
      </div>
    )
  if (feed.isError && !items.length)
    return (
      <div className="hub-state" role="alert">
        <StreamIcon name="reset" size={28} />
        <h3>Chưa tải được bảng tin</h3>
        <p>{feed.error.message}</p>
        <button className="cp-button" onClick={() => void feed.refetch()}>
          Thử lại
        </button>
      </div>
    )
  if (!items.length)
    return following ? (
      <div className="hub-state">
        <StreamIcon name="heart" size={28} />
        <h3>Chưa có bài mới từ trang bạn theo dõi</h3>
        <p>Theo dõi tổ chức, đội tuyển hoặc tuyển thủ để thấy bài viết của họ tại đây.</p>
        <button className="cp-button cp-primary" onClick={onExplore}>
          Khám phá trang
        </button>
      </div>
    ) : (
      <div className="hub-state">
        <StreamBrand compact />
        <h3>Chưa có bài viết công khai</h3>
        <p>Bài viết của tổ chức, đội tuyển, tuyển thủ và cộng đồng sẽ xuất hiện tại đây.</p>
        <button className="cp-button" onClick={onExplore}>
          Xem danh bạ trang
        </button>
      </div>
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
      <div ref={sentinel} className="stream-load-more" role="status">
        {feed.isFetchingNextPage ? (
          "Đang tải thêm bài viết…"
        ) : feed.isFetchNextPageError ? (
          <button type="button" onClick={() => void feed.fetchNextPage()}>
            Tải lại phần tiếp theo
          </button>
        ) : !feed.hasNextPage && items.length > 10 ? (
          "Bạn đã xem hết bài viết."
        ) : null}
      </div>
    </div>
  )
}
