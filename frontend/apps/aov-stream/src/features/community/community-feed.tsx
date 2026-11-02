import { useState, type CSSProperties } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { CommunityPost, CommunityComment, PageSlice, PageRole } from "@aov/community-contracts"
import { OfficialBadge } from "@aov/ui/components/official-badge"
import { StreamIcon } from "../../components/stream-icon"
import { initials } from "../account/profile-model"
import { communityApi } from "./community-api"
import { signIn, useCommunitySession } from "./community-auth"
import { hueOf } from "./community-ui"

function AuthorMark({ name, small = false }: { name: string; small?: boolean }) {
  return (
    <span
      className={small ? "cp-author-mark cp-author-mark-small" : "cp-author-mark"}
      style={{ "--hub-hue": hueOf(name) } as CSSProperties}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  )
}

export function CommunityFeed({
  pageId,
  pageName,
  role,
  manage = false,
  represented = false,
}: {
  pageId: string
  pageName: string
  role: PageRole | ""
  manage?: boolean
  /** Posts made as a page with a verified representative carry the official badge. */
  represented?: boolean
}) {
  const session = useCommunitySession()
  const client = useQueryClient()
  const [page, setPage] = useState(0)
  const [body, setBody] = useState("")
  const [asPage, setAsPage] = useState(manage && ["OWNER", "EDITOR"].includes(role))
  const posts = useQuery({
    queryKey: ["page-posts", session.revision, pageId, page, manage],
    queryFn: () =>
      communityApi<PageSlice<CommunityPost>>(
        `${manage || session.status === "authenticated" ? "/me" : ""}/pages/${pageId}/${!manage && session.status === "authenticated" ? "feed" : "posts"}?page=${page}&size=20`,
      ),
  })
  const write = useMutation({
    mutationFn: (publish: boolean) => communityApi(`/me/pages/${pageId}/posts`, { body, asPage, publish }),
    onSuccess: async () => {
      setBody("")
      setPage(0)
      await client.invalidateQueries({ queryKey: ["page-posts"] })
    },
  })
  return (
    <div className="cp-feed">
      <section className="cp-panel cp-composer">
        <h2>Bài viết & thảo luận</h2>
        {session.status !== "authenticated" ? (
          <div className="cp-composer-guest">
            <span className="hub-link-icon" aria-hidden="true">
              <StreamIcon name="message" size={18} />
            </span>
            <p className="cp-muted">Đăng nhập để chia sẻ và tham gia thảo luận.</p>
            <button className="cp-button cp-primary" onClick={() => void signIn()}>
              Đăng nhập
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              write.mutate(true)
            }}
          >
            <label>
              Chia sẻ với cộng đồng
              <textarea
                required
                rows={4}
                maxLength={20000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Viết nội dung của bạn…"
              />
            </label>
            <div className="cp-actions cp-composer-actions">
              <label className="cp-inline-label">
                Đăng với tư cách
                <select value={asPage ? "page" : "self"} onChange={(e) => setAsPage(e.target.value === "page")}>
                  <option value="self">{session.name}</option>
                  {["OWNER", "EDITOR"].includes(role) && <option value="page">{pageName}</option>}
                </select>
              </label>
              <button className="cp-button cp-primary" disabled={write.isPending}>
                <StreamIcon name="send" size={16} />
                Đăng bài
              </button>
              <button
                type="button"
                className="cp-button"
                disabled={write.isPending || !body.trim()}
                onClick={() => write.mutate(false)}
              >
                Lưu nháp
              </button>
            </div>
            {write.isError && (
              <p role="alert" className="cp-error">
                {write.error.message}
              </p>
            )}
          </form>
        )}
      </section>
      {posts.isPending ? (
        <div className="hub-skeleton-rows" role="status" aria-label="Đang tải bài viết" />
      ) : posts.isError ? (
        <p role="alert" className="cp-error">
          {posts.error.message}
        </p>
      ) : !posts.data.items.length ? (
        <div className="hub-state">
          <StreamIcon name="message" size={28} />
          <h3>Chưa có bài viết</h3>
          <p>Thông tin hồ sơ vẫn được cập nhật ở các mục bên cạnh.</p>
        </div>
      ) : (
        posts.data.items.map((post) => <Post key={post.id} post={post} role={role} represented={represented} />)
      )}
      {posts.data && posts.data.totalElements > 20 && (
        <div className="hub-pagination">
          <button className="cp-button" disabled={!page} onClick={() => setPage(page - 1)}>
            Trước
          </button>
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
function Post({ post, role, represented }: { post: CommunityPost; role: PageRole | ""; represented: boolean }) {
  const session = useCommunitySession()
  const client = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [body, setBody] = useState("")
  const [asPage, setAsPage] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reason, setReason] = useState("")
  const [commentPage, setCommentPage] = useState(0)
  const [editing, setEditing] = useState(false)
  const [editedBody, setEditedBody] = useState(post.body)
  const [reportedComment, setReportedComment] = useState<string | undefined>()
  // A like shown before the feed refetches; a newer `post` from the server replaces it.
  const [liking, setLiking] = useState<{ source: CommunityPost; liked: boolean; likes: number } | null>(null)
  const shown = liking?.source === post ? liking : post
  const like = useMutation({
    mutationFn: (liked: boolean) =>
      communityApi<{ liked: boolean; likes: number }>(`/me/posts/${post.id}/like`, { liked }),
    onMutate: (liked) => {
      const previous = liking
      setLiking({ source: post, liked, likes: Math.max(0, shown.likes + (liked ? 1 : -1)) })
      return previous
    },
    onSuccess: (result) => setLiking({ source: post, ...result }),
    onError: (_error, _liked, previous) => setLiking(previous ?? null),
  })
  const edit = useMutation({
    mutationFn: (publish: boolean) =>
      communityApi(
        `/me/pages/${post.pageId}/posts/${post.id}`,
        { version: post.version, body: editedBody, asPage: post.asPage, publish },
        "PUT",
      ),
    onSuccess: async () => {
      setEditing(false)
      await client.invalidateQueries({ queryKey: ["page-posts"] })
    },
  })
  const comments = useQuery({
    queryKey: ["post-comments", post.id, commentPage],
    queryFn: () => communityApi<PageSlice<CommunityComment>>(`/posts/${post.id}/comments?page=${commentPage}&size=30`),
    enabled: expanded && post.status === "PUBLISHED",
  })
  const reply = useMutation({
    mutationFn: () => communityApi(`/me/posts/${post.id}/comments`, { body, asPage }),
    onSuccess: async () => {
      setBody("")
      await client.invalidateQueries({ queryKey: ["post-comments", post.id] })
    },
  })
  const report = useMutation({
    mutationFn: () =>
      communityApi(`/me/pages/${post.pageId}/reports`, { postId: post.id, commentId: reportedComment, reason }),
    onSuccess: () => {
      setReporting(false)
      setReason("")
    },
  })
  const hide = useMutation({
    mutationFn: (commentId?: string) =>
      communityApi(`/me/pages/${post.pageId}/moderate`, {
        postId: post.id,
        commentId,
        hidden: commentId ? true : post.status !== "HIDDEN",
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["page-posts"] })
      await client.invalidateQueries({ queryKey: ["post-comments", post.id] })
    },
  })
  return (
    <article className="cp-panel cp-post">
      <header className="cp-post-header">
        <AuthorMark name={post.authorName} />
        <div className="cp-post-author">
          <strong>
            {post.authorName}
            {post.asPage && represented && <OfficialBadge label="Bài đăng của đại diện đã xác minh" />}
          </strong>
          <span className="cp-meta">
            {post.asPage ? "Đăng bởi đại diện trang" : "Thành viên cộng đồng"} ·{" "}
            <time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleString("vi-VN")}</time>
          </span>
        </div>
        {post.status !== "PUBLISHED" && (
          <span className="cp-badge" data-status={post.status}>
            {post.status === "HIDDEN" ? "Đã ẩn" : "Bản nháp"}
          </span>
        )}
      </header>
      <p className="cp-prose">{post.body}</p>
      {editing && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            edit.mutate(true)
          }}
        >
          <label>
            Nội dung bài viết
            <textarea
              required
              maxLength={20000}
              rows={5}
              value={editedBody}
              onChange={(event) => setEditedBody(event.target.value)}
            />
          </label>
          <div className="cp-actions">
            <button className="cp-button cp-primary" disabled={edit.isPending}>
              Lưu & đăng
            </button>
            <button
              type="button"
              className="cp-button"
              disabled={edit.isPending || !editedBody.trim()}
              onClick={() => edit.mutate(false)}
            >
              Giữ ở bản nháp
            </button>
            <button type="button" className="cp-button" onClick={() => setEditing(false)}>
              Hủy
            </button>
          </div>
        </form>
      )}
      {edit.isError && (
        <p className="cp-error" role="alert">
          {edit.error.message}
        </p>
      )}
      <div className="cp-post-actions">
        {post.status === "PUBLISHED" && (
          <button
            className="cp-like"
            aria-pressed={shown.liked}
            disabled={like.isPending}
            onClick={() => (session.status === "authenticated" ? like.mutate(!shown.liked) : void signIn())}
          >
            <StreamIcon name="heart" size={16} />
            {shown.liked ? "Đã thích" : "Thích"}
            {shown.likes > 0 && <span className="cp-like-count">{shown.likes.toLocaleString("vi-VN")}</span>}
          </button>
        )}
        {post.status !== "HIDDEN" && (post.own || (post.asPage && ["OWNER", "EDITOR"].includes(role))) && (
          <button
            className="cp-post-tool"
            onClick={() => {
              setEditedBody(post.body)
              setEditing(!editing)
            }}
          >
            <StreamIcon name="edit" size={16} />
            Chỉnh sửa
          </button>
        )}
        <button
          className="cp-like"
          aria-expanded={expanded}
          disabled={post.status !== "PUBLISHED"}
          onClick={() => setExpanded(!expanded)}
        >
          <StreamIcon name="message" size={16} />
          Bình luận
        </button>
        {session.status === "authenticated" && post.status === "PUBLISHED" && (
          <button
            className="cp-post-tool"
            onClick={() => {
              setReportedComment(undefined)
              setReporting(!reporting)
            }}
          >
            <StreamIcon name="flag" size={16} />
            Báo cáo
          </button>
        )}
        {post.status !== "DRAFT" && ["OWNER", "MODERATOR"].includes(role) && (
          <button className="cp-post-tool" disabled={hide.isPending} onClick={() => hide.mutate(undefined)}>
            <StreamIcon name={post.status === "HIDDEN" ? "eye" : "eyeOff"} size={16} />
            {post.status === "HIDDEN" ? "Khôi phục hiển thị" : "Ẩn bài viết"}
          </button>
        )}
      </div>
      {reporting && (
        <form
          className="cp-inline-form"
          onSubmit={(e) => {
            e.preventDefault()
            report.mutate()
          }}
        >
          <label>
            Lý do báo cáo
            <textarea required maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <button className="cp-button" disabled={report.isPending}>
            Gửi báo cáo
          </button>
        </form>
      )}
      {report.isSuccess && (
        <p className="cp-success" role="status">
          Đã gửi báo cáo.
        </p>
      )}
      {(report.isError || hide.isError || reply.isError || like.isError) && (
        <p className="cp-error" role="alert">
          {report.error?.message || hide.error?.message || reply.error?.message || like.error?.message}
        </p>
      )}
      {expanded && (
        <div className="cp-comments">
          {comments.isError && <p role="alert">{comments.error.message}</p>}
          {comments.data?.items.map((comment) => (
            <div className="cp-comment" key={comment.id}>
              <AuthorMark name={comment.authorName} small />
              <div className="cp-comment-body">
                <div className="cp-comment-bubble">
                  <strong>
                    {comment.authorName}
                    {comment.asPage ? " · Đại diện trang" : ""}
                  </strong>
                  <p className="cp-prose">{comment.body}</p>
                </div>
                <div className="cp-comment-tools">
                  <time className="cp-meta" dateTime={comment.createdAt}>
                    {new Date(comment.createdAt).toLocaleString("vi-VN")}
                  </time>
                  {session.status === "authenticated" && (
                    <button
                      className="cp-text-button"
                      onClick={() => {
                        setReportedComment(comment.id)
                        setReporting(true)
                      }}
                    >
                      Báo cáo bình luận
                    </button>
                  )}
                  {["OWNER", "MODERATOR"].includes(role) && (
                    <button className="cp-text-button" onClick={() => hide.mutate(comment.id)}>
                      Ẩn bình luận
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {comments.isLoading && <p className="cp-muted">Đang tải bình luận…</p>}
          {comments.data && !comments.data.items.length && (
            <p className="cp-muted">Chưa có bình luận. Hãy là người đầu tiên chia sẻ suy nghĩ.</p>
          )}
          {comments.data && comments.data.totalElements > 30 && (
            <div className="cp-actions">
              <button className="cp-button" disabled={!commentPage} onClick={() => setCommentPage(commentPage - 1)}>
                Trước
              </button>
              <button
                className="cp-button"
                disabled={(commentPage + 1) * 30 >= comments.data.totalElements}
                onClick={() => setCommentPage(commentPage + 1)}
              >
                Tiếp
              </button>
            </div>
          )}
          {session.status === "authenticated" && (
            <form
              className="cp-reply"
              onSubmit={(e) => {
                e.preventDefault()
                reply.mutate()
              }}
            >
              <label>
                Bình luận của bạn
                <textarea required rows={2} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} />
              </label>
              <div className="cp-actions">
                {role && (
                  <label className="cp-inline-label">
                    <input type="checkbox" checked={asPage} onChange={(e) => setAsPage(e.target.checked)} />
                    Trả lời với tư cách trang
                  </label>
                )}
                <button className="cp-button cp-primary" disabled={reply.isPending}>
                  <StreamIcon name="send" size={16} />
                  Gửi bình luận
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </article>
  )
}
