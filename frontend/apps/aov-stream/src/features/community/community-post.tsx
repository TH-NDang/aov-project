import { useState, type CSSProperties } from "react"
import { Link } from "react-router"
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { CommunityComment, CommunityPost, PageCard, PageRole, PageSlice } from "@aov/community-contracts"
import { profileKindLabels } from "@aov/community-contracts"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@aov/ui/components/public-overlay"
import { OfficialBadge } from "@aov/ui/components/official-badge"
import { StreamIcon } from "../../components/stream-icon"
import { initials } from "../account/profile-model"
import { communityApi } from "./community-api"
import { useCommunitySession } from "./community-auth"
import { useFollowPage } from "./community-queries"
import { useSignedInAction } from "./community-signin"
import { CardAvatar, hueOf, TimeAgo } from "./community-ui"
import { PostImages, PostVideo } from "./post-media"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { nextPageOf } from "@aov/ui/lib/page-slice"

/** Lists that show posts; every change to a post or its comments refreshes them all. */
const postLists = ["page-posts", "community-feed"]

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

const longPost = (body: string) => body.length > 420 || body.split("\n").length > 7

/**
 * One post with its likes, comments and actions. With `page` it introduces the page it belongs to (cross-page feeds);
 * without it, the page is the surrounding profile. `following` is null for signed-out viewers, who see no follow
 * buttons; their likes, comments and reports open the sign-in prompt instead.
 */
const REPORT_REASONS = ["Spam hoặc quảng cáo", "Thông tin sai", "Ngôn từ xúc phạm", "Nội dung phản cảm", "Mạo danh"]

export function PostCard({
  post,
  role,
  represented,
  page,
  following = null,
}: {
  post: CommunityPost
  role: PageRole | ""
  represented: boolean
  page?: PageCard
  following?: Set<string> | null
}) {
  const session = useCommunitySession()
  const signedIn = useSignedInAction()
  const client = useQueryClient()
  const follow = useFollowPage()
  const [expanded, setExpanded] = useState(false)
  const [unfolded, setUnfolded] = useState(false)
  const [body, setBody] = useState("")
  const [asPage, setAsPage] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reason, setReason] = useState("")
  const [editing, setEditing] = useState(false)
  const [editedBody, setEditedBody] = useState(post.body)
  const [editedTitle, setEditedTitle] = useState(post.title || "")
  const [reportedComment, setReportedComment] = useState<string | undefined>()
  const refreshLists = () => Promise.all(postLists.map((key) => client.invalidateQueries({ queryKey: [key] })))
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
        {
          version: post.version,
          kind: post.kind,
          title: editedTitle,
          body: editedBody,
          videoUrl: post.videoUrl,
          imageUrls: post.imageUrls,
          asPage: post.asPage,
          publish,
        },
        "PUT",
      ),
    onSuccess: async () => {
      setEditing(false)
      await refreshLists()
    },
  })
  const comments = useInfiniteQuery({
    queryKey: ["post-comments", post.id],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      communityApi<PageSlice<CommunityComment>>(`/posts/${post.id}/comments?page=${pageParam}&size=30`),
    getNextPageParam: nextPageOf,
    enabled: expanded && post.status === "PUBLISHED",
  })
  const commentRows = comments.data?.pages.flatMap((page) => page.items) ?? []
  const reply = useMutation({
    mutationFn: () => communityApi(`/me/posts/${post.id}/comments`, { body, asPage }),
    onSuccess: async () => {
      setBody("")
      await client.invalidateQueries({ queryKey: ["post-comments", post.id] })
      await refreshLists()
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
      await refreshLists()
      await client.invalidateQueries({ queryKey: ["post-comments", post.id] })
    },
  })
  const pin = useMutation({
    mutationFn: () => communityApi(`/me/pages/${post.pageId}/posts/${post.id}/pin`, { pinned: !post.pinned }),
    onSuccess: refreshLists,
  })
  const canEdit = post.status !== "HIDDEN" && (post.own || (post.asPage && ["OWNER", "EDITOR"].includes(role)))
  const canPin = post.asPage && post.status === "PUBLISHED" && ["OWNER", "EDITOR"].includes(role)
  const canModerate = post.status !== "DRAFT" && ["OWNER", "MODERATOR"].includes(role)
  const published = post.status === "PUBLISHED"
  const long = longPost(post.body)
  const startReport = (commentId?: string) =>
    signedIn("Đăng nhập để báo cáo nội dung không phù hợp với đội ngũ kiểm duyệt.", () => {
      setReportedComment(commentId)
      setReporting(true)
    })
  return (
    <article className="cp-post">
      <header className="cp-post-header">
        {page ? (
          <Link to={`/pages/${page.code}`} className="cp-post-page" aria-label={page.name}>
            <CardAvatar name={page.name} url={page.avatarUrl} />
          </Link>
        ) : (
          <AuthorMark name={post.authorName} />
        )}
        <div className="cp-post-author">
          {page ? (
            <>
              <strong>
                <Link to={`/pages/${page.code}`}>{page.name}</Link>
                {page.represented && <OfficialBadge label="Đại diện đã xác minh" />}
              </strong>
              <span className="cp-meta">
                {post.asPage ? profileKindLabels[page.kind] : `${post.authorName} · Thành viên cộng đồng`} ·{" "}
                <TimeAgo value={post.createdAt} />
              </span>
            </>
          ) : (
            <>
              <strong>
                {post.authorName}
                {post.asPage && represented && <OfficialBadge label="Bài đăng của đại diện đã xác minh" />}
              </strong>
              <span className="cp-meta">
                {post.asPage ? "Đăng bởi đại diện trang" : "Thành viên cộng đồng"} · <TimeAgo value={post.createdAt} />
              </span>
            </>
          )}
        </div>
        {post.pinned && (
          <span className="cp-badge cp-pin-badge">
            <StreamIcon name="pin" size={12} />
            Đã ghim
          </span>
        )}
        {post.status !== "PUBLISHED" && (
          <span className="cp-badge" data-status={post.status}>
            {post.status === "HIDDEN" ? "Đã ẩn" : "Bản nháp"}
          </span>
        )}
        {page && following && !following.has(page.id) && (
          <button
            className="cp-follow-chip"
            disabled={follow.isPending}
            onClick={() => follow.mutate({ pageId: page.id, following: true })}
            aria-label={`Theo dõi ${page.name}`}
          >
            <StreamIcon name="plus" size={14} />
            <span className="cp-follow-label">Theo dõi</span>
          </button>
        )}
        {(published || canEdit || canModerate) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="hub-icon-button cp-post-more" aria-label="Thao tác với bài viết">
                <StreamIcon name="more" size={18} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="hub-popover hub-post-menu" drawerTitle="Tùy chọn bài viết">
              {canEdit && (
                <DropdownMenuItem
                  className="hub-menu-item"
                  onSelect={() => {
                    setEditedBody(post.body)
                    setEditedTitle(post.title || "")
                    setEditing(true)
                  }}
                >
                  <StreamIcon name="edit" size={16} />
                  Chỉnh sửa
                </DropdownMenuItem>
              )}
              {canPin && (
                <DropdownMenuItem className="hub-menu-item" disabled={pin.isPending} onSelect={() => pin.mutate()}>
                  <StreamIcon name="pin" size={16} />
                  {post.pinned ? "Bỏ ghim" : "Ghim lên đầu trang"}
                </DropdownMenuItem>
              )}
              {published && (
                <DropdownMenuItem className="hub-menu-item" onSelect={() => startReport()}>
                  <StreamIcon name="flag" size={16} />
                  Báo cáo bài viết
                </DropdownMenuItem>
              )}
              {canModerate && (
                <DropdownMenuItem
                  className="hub-menu-item"
                  disabled={hide.isPending}
                  onSelect={() => hide.mutate(undefined)}
                >
                  <StreamIcon name={post.status === "HIDDEN" ? "eye" : "eyeOff"} size={16} />
                  {post.status === "HIDDEN" ? "Khôi phục hiển thị" : "Ẩn bài viết"}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>
      {post.title && <h3 className="cp-post-title">{post.title}</h3>}
      {post.body && (
        <p className="cp-prose cp-post-body" data-folded={(long && !unfolded) || undefined}>
          {post.body}
        </p>
      )}
      {post.videoUrl && <PostVideo url={post.videoUrl} title={post.title || `Video của ${post.authorName}`} />}
      <PostImages urls={post.imageUrls || []} alt={post.title || post.authorName} />
      {long && (
        <button className="cp-text-button" onClick={() => setUnfolded(!unfolded)}>
          {unfolded ? "Thu gọn" : "Xem thêm"}
        </button>
      )}
      {editing && (
        <form
          className="cp-inline-form"
          onSubmit={(event) => {
            event.preventDefault()
            edit.mutate(true)
          }}
        >
          {post.kind === "NEWS" && (
            <label>
              Tiêu đề
              <input
                required
                maxLength={200}
                value={editedTitle}
                onChange={(event) => setEditedTitle(event.target.value)}
              />
            </label>
          )}
          <label>
            Nội dung bài viết
            <textarea
              required={post.kind !== "VIDEO"}
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
              disabled={edit.isPending || (post.kind !== "VIDEO" && !editedBody.trim())}
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
      {(edit.isError || pin.isError) && (
        <p className="cp-error" role="alert">
          {edit.error?.message || pin.error?.message}
        </p>
      )}
      <div className="cp-post-actions">
        {published && (
          <button
            className="cp-like"
            aria-pressed={session.status === "authenticated" ? shown.liked : undefined}
            aria-label={`${shown.liked ? "Bỏ thích" : "Thích"} · ${shown.likes.toLocaleString("vi-VN")} lượt thích`}
            disabled={like.isPending}
            onClick={() => signedIn("Đăng nhập để thích bài viết này.", () => like.mutate(!shown.liked))}
          >
            <StreamIcon name="heart" size={16} />
            <span className="cp-like-count">{shown.likes.toLocaleString("vi-VN")}</span>
          </button>
        )}
        <button
          className="cp-like"
          aria-expanded={expanded}
          aria-label={`Bình luận · ${post.comments.toLocaleString("vi-VN")}`}
          disabled={!published}
          onClick={() => setExpanded(!expanded)}
        >
          <StreamIcon name="message" size={16} />
          <span className="cp-like-count">{post.comments.toLocaleString("vi-VN")}</span>
        </button>
      </div>
      {reporting && (
        <form
          className="cp-inline-form"
          onSubmit={(event) => {
            event.preventDefault()
            report.mutate()
          }}
        >
          <label>
            {reportedComment ? "Lý do báo cáo bình luận" : "Lý do báo cáo bài viết"}
            <span className="cp-reason-chips">
              {REPORT_REASONS.map((option) => (
                <button type="button" key={option} aria-pressed={reason === option} onClick={() => setReason(option)}>
                  {option}
                </button>
              ))}
            </span>
            <textarea required maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          <div className="cp-actions">
            <button className="cp-button cp-primary" disabled={report.isPending}>
              Gửi báo cáo
            </button>
            <button type="button" className="cp-button" onClick={() => setReporting(false)}>
              Hủy
            </button>
          </div>
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
          {comments.isLoadingError && (
            <p className="cp-error" role="alert">
              {comments.error.message}
            </p>
          )}
          {comments.isLoading && <p className="cp-muted">Đang tải bình luận…</p>}
          {comments.data && !commentRows.length && (
            <p className="cp-muted">Chưa có bình luận. Hãy là người đầu tiên chia sẻ suy nghĩ.</p>
          )}
          {commentRows.map((comment) => (
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
                  <TimeAgo className="cp-meta" value={comment.createdAt} />
                  <button className="cp-text-button" onClick={() => startReport(comment.id)}>
                    Báo cáo
                  </button>
                  {["OWNER", "MODERATOR"].includes(role) && (
                    <button className="cp-text-button" onClick={() => hide.mutate(comment.id)}>
                      Ẩn bình luận
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          <InfiniteScroll query={comments} label="Đang tải thêm bình luận" />
          {session.status === "authenticated" ? (
            <form
              className="cp-reply"
              onSubmit={(event) => {
                event.preventDefault()
                reply.mutate()
              }}
            >
              <label>
                <span className="sr-only">Bình luận của bạn</span>
                <textarea
                  required
                  rows={2}
                  maxLength={4000}
                  placeholder="Viết bình luận…"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                />
              </label>
              <div className="cp-actions cp-reply-actions">
                {role && (
                  <label className="cp-inline-label">
                    <input type="checkbox" checked={asPage} onChange={(event) => setAsPage(event.target.checked)} />
                    Trả lời với tư cách trang
                  </label>
                )}
                <button className="cp-button cp-primary" disabled={reply.isPending}>
                  <StreamIcon name="send" size={16} />
                  Gửi bình luận
                </button>
              </div>
            </form>
          ) : (
            <button
              className="cp-reply-prompt"
              onClick={() => signedIn("Đăng nhập để bình luận và tham gia thảo luận.", () => undefined)}
            >
              <StreamIcon name="message" size={16} />
              Đăng nhập để bình luận
            </button>
          )}
        </div>
      )}
    </article>
  )
}
