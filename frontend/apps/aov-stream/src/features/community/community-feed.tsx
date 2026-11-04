import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  postKindLabels,
  type CommunityPost,
  type PageSlice,
  type PageRole,
  type PostKind,
} from "@aov/community-contracts"
import { StreamIcon } from "../../components/stream-icon"
import { communityApi } from "./community-api"
import { useCommunitySession } from "./community-auth"
import { PostCard } from "./community-post"

const kinds = Object.keys(postKindLabels) as PostKind[]

/** Image links typed one per line; the service accepts four. */
const imageLines = (value: string) =>
  value
    .split(/\s+/)
    .map((line) => line.trim())
    .filter(Boolean)

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
  const session = useCommunitySession()
  const client = useQueryClient()
  const [page, setPage] = useState(0)
  const [body, setBody] = useState("")
  const [postKind, setPostKind] = useState<PostKind>(kind || "TEXT")
  const [title, setTitle] = useState("")
  const [videoUrl, setVideoUrl] = useState("")
  const [images, setImages] = useState("")
  const [asPage, setAsPage] = useState(manage && ["OWNER", "EDITOR"].includes(role))
  const personal = !manage && session.status === "authenticated"
  const posts = useQuery({
    queryKey: ["page-posts", session.revision, pageId, page, manage, kind],
    queryFn: () =>
      communityApi<PageSlice<CommunityPost>>(
        `${manage || personal ? "/me" : ""}/pages/${pageId}/${personal ? "feed" : "posts"}?${new URLSearchParams({
          page: String(page),
          size: "20",
          ...(kind && !manage && !personal ? { kind } : {}),
        })}`,
      ),
  })
  const items = (posts.data?.items || []).filter((post) => !kind || (post.kind || "TEXT") === kind)
  const imageUrls = imageLines(images)
  const ready =
    (postKind === "VIDEO" ? !!videoUrl.trim() : !!body.trim()) &&
    (postKind !== "NEWS" || !!title.trim()) &&
    imageUrls.length <= 4
  const write = useMutation({
    mutationFn: (publish: boolean) =>
      communityApi(`/me/pages/${pageId}/posts`, {
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
      setPage(0)
      await client.invalidateQueries({ queryKey: ["page-posts"] })
      await client.invalidateQueries({ queryKey: ["community-feed"] })
    },
  })
  return (
    <div className="cp-feed">
      {composer && session.status === "authenticated" && (
        <section className="cp-panel cp-composer">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (ready) write.mutate(true)
            }}
          >
            <div className="hub-pills" role="group" aria-label="Dạng bài viết">
              {kinds.map((value) => (
                <button key={value} type="button" aria-pressed={postKind === value} onClick={() => setPostKind(value)}>
                  <StreamIcon name={value === "VIDEO" ? "play" : value === "NEWS" ? "feed" : "message"} size={14} />
                  {postKindLabels[value]}
                </button>
              ))}
            </div>
            {postKind === "NEWS" && (
              <label>
                <span className="sr-only">Tiêu đề tin</span>
                <input
                  required
                  maxLength={200}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Tiêu đề tin tức"
                />
              </label>
            )}
            {postKind === "VIDEO" && (
              <label>
                <span className="sr-only">Đường dẫn video</span>
                <input
                  required
                  type="url"
                  maxLength={2000}
                  value={videoUrl}
                  onChange={(event) => setVideoUrl(event.target.value)}
                  placeholder="Link YouTube, Facebook hoặc TikTok"
                />
              </label>
            )}
            <label>
              <span className="sr-only">Chia sẻ với cộng đồng</span>
              <textarea
                required={postKind !== "VIDEO"}
                rows={3}
                maxLength={20000}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder={
                  postKind === "VIDEO" ? "Mô tả video (không bắt buộc)" : `Chia sẻ suy nghĩ của bạn về ${pageName}…`
                }
              />
            </label>
            <details className="cp-composer-images">
              <summary>Thêm ảnh bằng đường dẫn (tối đa 4)</summary>
              <textarea
                rows={2}
                value={images}
                onChange={(event) => setImages(event.target.value)}
                placeholder="Mỗi dòng một đường dẫn ảnh https://…"
                aria-invalid={imageUrls.length > 4 || undefined}
              />
              {imageUrls.length > 4 && <p className="cp-error">Chỉ đính kèm được tối đa 4 ảnh.</p>}
            </details>
            <div className="cp-actions cp-composer-actions">
              <label className="cp-inline-label">
                Đăng với tư cách
                <select value={asPage ? "page" : "self"} onChange={(event) => setAsPage(event.target.value === "page")}>
                  <option value="self">{session.name}</option>
                  {["OWNER", "EDITOR"].includes(role) && <option value="page">{pageName}</option>}
                </select>
              </label>
              <button
                type="button"
                className="cp-button"
                disabled={write.isPending || !ready}
                onClick={() => write.mutate(false)}
              >
                Lưu nháp
              </button>
              <button className="cp-button cp-primary" disabled={write.isPending || !ready}>
                <StreamIcon name="send" size={16} />
                Đăng bài
              </button>
            </div>
            {write.isError && (
              <p role="alert" className="cp-error">
                {write.error.message}
              </p>
            )}
          </form>
        </section>
      )}
      {posts.isPending ? (
        <div className="hub-skeleton-rows" role="status" aria-label="Đang tải bài viết" />
      ) : posts.isError ? (
        <div className="hub-state" role="alert">
          <StreamIcon name="reset" size={28} />
          <h3>{posts.error.message}</h3>
          <button className="cp-button" onClick={() => void posts.refetch()}>
            Thử lại
          </button>
        </div>
      ) : !items.length ? (
        <div className="hub-state">
          <StreamIcon name={kind === "VIDEO" ? "play" : "message"} size={28} />
          <h3>{kind === "VIDEO" ? "Chưa có video" : "Chưa có bài viết"}</h3>
          <p>Thông tin hồ sơ vẫn được cập nhật ở các mục khác của trang.</p>
        </div>
      ) : (
        <div className="cp-post-list">
          {items.map((post) => (
            <PostCard key={post.id} post={post} role={role} represented={represented} />
          ))}
        </div>
      )}
      {posts.data && posts.data.totalElements > 20 && (
        <div className="hub-pagination">
          <button className="cp-button" disabled={!page} onClick={() => setPage(page - 1)}>
            Trước
          </button>
          <span>Trang {page + 1}</span>
          <button
            className="cp-button"
            disabled={(page + 1) * 20 >= posts.data.totalElements}
            onClick={() => setPage(page + 1)}
          >
            Tiếp
          </button>
        </div>
      )}
    </div>
  )
}
