import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { CommunityPost, CommunityComment, PageSlice, PageRole } from "@aov/community-contracts"
import { StreamIcon } from "../../components/stream-icon"
import { communityApi } from "./community-api"
import { signIn, useCommunitySession } from "./community-auth"

export function CommunityFeed({
  pageId,
  pageName,
  role,
  manage = false,
}: {
  pageId: string
  pageName: string
  role: PageRole | ""
  manage?: boolean
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
      <section className="cp-panel">
        <h2>Bài viết & thảo luận</h2>
        {session.status !== "authenticated" ? (
          <div className="cp-actions">
            <p className="cp-muted">Đăng nhập để chia sẻ và tham gia thảo luận.</p>
            <button className="cp-button" onClick={() => void signIn()}>
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
            <div className="cp-actions">
              <label className="cp-inline-label">
                Đăng với tư cách
                <select value={asPage ? "page" : "self"} onChange={(e) => setAsPage(e.target.value === "page")}>
                  <option value="self">{session.name}</option>
                  {["OWNER", "EDITOR"].includes(role) && <option value="page">{pageName}</option>}
                </select>
              </label>
              <button className="cp-button cp-primary" disabled={write.isPending}>
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
        <p>Đang tải bài viết…</p>
      ) : posts.isError ? (
        <p role="alert" className="cp-error">
          {posts.error.message}
        </p>
      ) : !posts.data.items.length ? (
        <div className="cp-panel cp-empty">
          <p>Chưa có bài viết. Thông tin hồ sơ vẫn được cập nhật ở các mục bên cạnh.</p>
        </div>
      ) : (
        posts.data.items.map((post) => <Post key={post.id} post={post} role={role} />)
      )}
      {posts.data && posts.data.totalElements > 20 && (
        <div className="cp-actions">
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
function Post({ post, role }: { post: CommunityPost; role: PageRole | "" }) {
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
    <article className="cp-panel">
      <header className="cp-post-header">
        <strong>{post.authorName}</strong>
        <span className="cp-meta">{post.asPage ? "Đăng bởi đại diện trang" : "Thành viên cộng đồng"}</span>
        <time className="cp-meta">{new Date(post.createdAt).toLocaleString("vi-VN")}</time>
        {post.status !== "PUBLISHED" && (
          <span className="cp-badge">{post.status === "HIDDEN" ? "Đã ẩn" : "Bản nháp"}</span>
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
      <div className="cp-actions">
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
            className="cp-text-button"
            onClick={() => {
              setEditedBody(post.body)
              setEditing(!editing)
            }}
          >
            Chỉnh sửa
          </button>
        )}
        <button
          className="cp-text-button"
          disabled={post.status !== "PUBLISHED"}
          onClick={() => setExpanded(!expanded)}
        >
          Bình luận
        </button>
        {session.status === "authenticated" && post.status === "PUBLISHED" && (
          <button
            className="cp-text-button"
            onClick={() => {
              setReportedComment(undefined)
              setReporting(!reporting)
            }}
          >
            Báo cáo
          </button>
        )}
        {post.status !== "DRAFT" && ["OWNER", "MODERATOR"].includes(role) && (
          <button className="cp-text-button" disabled={hide.isPending} onClick={() => hide.mutate(undefined)}>
            {post.status === "HIDDEN" ? "Khôi phục hiển thị" : "Ẩn bài viết"}
          </button>
        )}
      </div>
      {reporting && (
        <form
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
      {report.isSuccess && <p className="cp-success">Đã gửi báo cáo.</p>}
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
              <strong>
                {comment.authorName}
                {comment.asPage ? " · Đại diện trang" : ""}
              </strong>
              <p className="cp-prose">{comment.body}</p>
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
          ))}
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
                <button className="cp-button" disabled={reply.isPending}>
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
