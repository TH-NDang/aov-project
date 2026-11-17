import { useState } from "react"
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { postKindLabels, type CommunityProfile, type PageRole, type PostKind } from "@aov/community-contracts"
import { StreamIcon } from "../../components/stream-icon"
import { useStreamLocale } from "../../components/stream-locale"
import { communityApi } from "./community-api"
import { communityKeys, refreshPostLists } from "./community-keys"
import { useCommunitySession } from "../../lib/stream-auth"
import { PostCard } from "./community-post"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { nextPageOf } from "@aov/ui/lib/page-slice"

const kinds = Object.keys(postKindLabels) as PostKind[]

/** The English name of each post kind; `postKindLabels` holds the Vietnamese one. */
const postKindEnglish: Record<PostKind, string> = { TEXT: "Post", NEWS: "News", VIDEO: "Video" }

/** Image links typed one per line; the service accepts four. */
const imageLines = (value: string) =>
  value
    .split(/\s+/)
    .map((line) => line.trim())
    .filter(Boolean)

/**
 * The page's own picture, for posts made as the page. The profile or manager around the feed has usually loaded the
 * page already, so it is read from there before asking the service.
 */
function usePagePicture(pageId: string) {
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
  return page.data?.content?.avatarUrl
}

/**
 * The posts of one page, with a composer for signed-in viewers. `kind` limits the list to one post kind; signed-in
 * readers get their personal feed filtered here so their likes and drafts stay correct.
 */
export function CommunityFeed({
  pageId,
  pageName,
  role,
  manage = false,
  represented = false,
  kind,
  composer = true,
}: {
  pageId: string
  pageName: string
  role: PageRole | ""
  manage?: boolean
  /** Posts made as a page with a verified representative carry the official badge. */
  represented?: boolean
  kind?: PostKind
  composer?: boolean
}) {
  const { text } = useStreamLocale()
  const session = useCommunitySession()
  const client = useQueryClient()
  const [body, setBody] = useState("")
  const [postKind, setPostKind] = useState<PostKind>(kind || "TEXT")
  const [title, setTitle] = useState("")
  const [videoUrl, setVideoUrl] = useState("")
  const [images, setImages] = useState("")
  const [asPage, setAsPage] = useState(manage && ["OWNER", "EDITOR"].includes(role))
  const pictureUrl = usePagePicture(pageId)
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
  const items = (posts.data?.pages.flatMap((page) => page.items) || []).filter(
    (post) => !kind || (post.kind || "TEXT") === kind,
  )
  const imageUrls = imageLines(images)
  const ready =
    (postKind === "VIDEO" ? !!videoUrl.trim() : !!body.trim()) &&
    (postKind !== "NEWS" || !!title.trim()) &&
    imageUrls.length <= 4
  const write = useMutation({
    mutationFn: (publish: boolean) =>
      communityApi.writePost(pageId, {
        kind: postKind,
        title: postKind === "NEWS" ? title : null,
        body,
        videoUrl: postKind === "VIDEO" ? videoUrl : null,
        imageUrls,
        asPage,
        publish,
      }),
    onSuccess: async () => {
      setBody("")
      setTitle("")
      setVideoUrl("")
      setImages("")
      await refreshPostLists(client)
    },
  })
  return (
    <div className="cp-feed">
      {composer && session.status === "authenticated" && (
        <section className="cp-composer" aria-label={text("Viết bài mới", "Write a new post")}>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (ready) write.mutate(true)
            }}
          >
            <div className="hub-pills" role="group" aria-label={text("Dạng bài viết", "Post type")}>
              {kinds.map((value) => (
                <button key={value} type="button" aria-pressed={postKind === value} onClick={() => setPostKind(value)}>
                  <StreamIcon name={value === "VIDEO" ? "play" : value === "NEWS" ? "news" : "message"} size={14} />
                  {text(postKindLabels[value], postKindEnglish[value])}
                </button>
              ))}
            </div>
            {postKind === "NEWS" && (
              <label>
                {text("Tiêu đề tin", "News title")}
                <input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} />
              </label>
            )}
            {postKind === "VIDEO" && (
              <label>
                {text("Đường dẫn video", "Video link")}
                <input
                  required
                  type="url"
                  maxLength={2000}
                  value={videoUrl}
                  onChange={(event) => setVideoUrl(event.target.value)}
                  placeholder={text("Link YouTube, Facebook hoặc TikTok", "YouTube, Facebook or TikTok link")}
                />
              </label>
            )}
            <label>
              <span className={postKind === "TEXT" ? "sr-only" : undefined}>
                {postKind === "VIDEO"
                  ? "Mô tả (không bắt buộc)"
                  : postKind === "NEWS"
                    ? "Nội dung"
                    : text("Nội dung bài viết", "Post content")}
              </span>
              <textarea
                required={postKind !== "VIDEO"}
                rows={3}
                maxLength={20000}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder={
                  postKind === "TEXT"
                    ? text(`Chia sẻ suy nghĩ của bạn về ${pageName}…`, `Share your thoughts about ${pageName}…`)
                    : undefined
                }
              />
            </label>
            <details className="cp-composer-images">
              <summary>{text("Thêm ảnh bằng đường dẫn (tối đa 4)", "Add images by link (up to 4)")}</summary>
              <label>
                <span className="sr-only">{text("Đường dẫn ảnh", "Image links")}</span>
                <textarea
                  rows={2}
                  value={images}
                  onChange={(event) => setImages(event.target.value)}
                  placeholder={text("Mỗi dòng một đường dẫn ảnh https://…", "One image link per line https://…")}
                  aria-invalid={imageUrls.length > 4 || undefined}
                />
              </label>
              {imageUrls.length > 4 && (
                <p className="cp-field-error">
                  {text("Chỉ đính kèm được tối đa 4 ảnh.", "Only up to 4 images can be attached.")}
                </p>
              )}
            </details>
            <div className="cp-composer-actions">
              {["OWNER", "EDITOR"].includes(role) && (
                <label className="cp-inline-label">
                  {text("Đăng với tư cách", "Post as")}
                  <select
                    value={asPage ? "page" : "self"}
                    onChange={(event) => setAsPage(event.target.value === "page")}
                  >
                    <option value="self">{session.name}</option>
                    <option value="page">{pageName}</option>
                  </select>
                </label>
              )}
              <button
                type="button"
                className="cp-button"
                disabled={write.isPending || !ready}
                onClick={() => write.mutate(false)}
              >
                {text("Lưu nháp", "Save draft")}
              </button>
              <button className="cp-button cp-primary" disabled={write.isPending || !ready}>
                <StreamIcon name="send" size={16} />
                {text("Đăng bài", "Post")}
              </button>
            </div>
            {write.isError && (
              <p role="alert" className="cp-field-error">
                {write.error.message}
              </p>
            )}
          </form>
        </section>
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
        <div className="cp-post-list">
          {items.map((post) => (
            <PostCard key={post.id} post={post} role={role} represented={represented} pictureUrl={pictureUrl} />
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
