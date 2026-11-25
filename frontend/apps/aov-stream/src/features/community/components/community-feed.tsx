import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query"
import type { CommunityProfile, PageCard, PageRole, PostKind } from "@aov/community-contracts"
import { useUserTimeZone } from "@aov/ui/lib/time-zone"
import { useStreamLocale } from "../../../components/stream-locale"
import { communityApi } from "../../../lib/community-api"
import { communityKeys } from "../../../lib/community-keys"
import { useCommunitySession } from "../../../lib/stream-auth"
import { dayOpenings } from "../model/post-form"
import { PostCard } from "./community-post"
import { PostComposer } from "./post-composer"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { nextPageOf } from "@aov/ui/lib/page-slice"

/**
 * The page as its posts name it. The profile or manager around the feed has usually loaded the page already, so it is
 * read from there before asking the service.
 */
function usePageCard(pageId: string): PageCard | undefined {
  const client = useQueryClient()
  const page = useQuery({
    queryKey: communityKeys.publicPage(pageId),
    queryFn: () => communityApi.page(pageId),
    initialData: () =>
      [
        ...client.getQueriesData<CommunityProfile>({ queryKey: communityKeys.publicPageAll }),
        ...client.getQueriesData<CommunityProfile>({ queryKey: communityKeys.managedPageAll }),
      ]
        .map(([, data]) => data)
        .find((data) => data?.id === pageId),
    staleTime: 60_000,
    retry: false,
  })
  if (!page.data) return undefined
  const { id, code, kind, content, represented } = page.data
  return { id, code, kind, name: content?.name || code, avatarUrl: content?.avatarUrl, represented }
}

/**
 * The posts of one page as its journal, with a composer for signed-in viewers. `kind` limits the list to one post
 * kind; signed-in readers get their personal feed filtered here so their likes and drafts stay correct.
 */
export function CommunityFeed({
  pageId,
  pageName,
  role,
  manage = false,
  kind,
  composer = true,
}: {
  pageId: string
  pageName: string
  role: PageRole | ""
  manage?: boolean
  kind?: PostKind
  composer?: boolean
}) {
  const { text } = useStreamLocale()
  const session = useCommunitySession()
  const zone = useUserTimeZone()
  const page = usePageCard(pageId)
  const personal = !manage && session.status === "authenticated"
  const posts = useInfiniteQuery({
    queryKey: communityKeys.pagePosts(session.revision, pageId, manage, kind),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      communityApi.pagePosts(
        pageId,
        { page: String(pageParam), size: "20", ...(kind && !manage && !personal ? { kind } : {}) },
        { manage, personal },
      ),
    getNextPageParam: nextPageOf,
  })
  const items = (posts.data?.pages.flatMap((part) => part.items) || []).filter(
    (post) => !kind || (post.kind || "TEXT") === kind,
  )
  const openings = dayOpenings(items, zone)
  return (
    <div className="cp-feed">
      {composer && session.status === "authenticated" && (
        <PostComposer pageId={pageId} pageName={pageName} role={role} manage={manage} />
      )}
      {posts.isPending ? (
        <div className="hub-skeleton-rows" role="status" aria-label={text("Đang tải bài viết", "Loading posts")} />
      ) : posts.isLoadingError ? (
        <div className="hub-state" role="alert">
          <h3>{posts.error.message}</h3>
          <button className="cp-button" onClick={() => void posts.refetch()}>
            {text("Thử lại", "Retry")}
          </button>
        </div>
      ) : !items.length ? (
        <div className="hub-state">
          <h3>
            {kind === "VIDEO" ? text("Chưa có video", "No videos yet") : text("Chưa có bài viết", "No posts yet")}
          </h3>
          <p>
            {text(
              "Thông tin hồ sơ vẫn được cập nhật ở các mục khác của trang.",
              "Profile information is still kept up to date in the other sections of the page.",
            )}
          </p>
        </div>
      ) : (
        <div className="ps-list">
          {items.map((post) => (
            <PostCard key={post.id} post={post} role={role} page={page} journal opensDay={openings.has(post.id)} />
          ))}
        </div>
      )}
      <InfiniteScroll
        query={posts}
        label={text("Đang tải thêm bài viết", "Loading more posts")}
        retryLabel={text("Tải lại phần tiếp theo", "Load the next part again")}
      />
    </div>
  )
}
