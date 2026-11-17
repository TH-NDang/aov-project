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
import { useStreamLocale } from "../../components/stream-locale"
import { initials } from "../account/profile-model"
import { communityApi } from "./community-api"
import { useCommunitySession } from "../../lib/stream-auth"
import { useFollowPage } from "./community-queries"
import { useSignedInAction } from "./community-signin"
import { CardAvatar, hueOf, profileKindEnglish, TimeAgo } from "./community-ui"
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

const REPORT_REASONS: readonly (readonly [string, string])[] = [
  ["Spam hoặc quảng cáo", "Spam or advertising"],
  ["Thông tin sai", "False information"],
  ["Ngôn từ xúc phạm", "Abusive language"],
  ["Nội dung phản cảm", "Offensive content"],
  ["Mạo danh", "Impersonation"],
]

/**
 * One post with its likes, comments and actions. With `page` it introduces the page it belongs to (cross-page feeds);
 * without it, the page is the surrounding profile, and `pictureUrl` is that page's picture for posts made as the page.
 * `following` is null for signed-out viewers, who see no follow buttons; their likes, comments and reports open the
 * sign-in prompt instead.
 */
export function PostCard({
  post,
  role,
  represented,
  page,
  pictureUrl,
  following = null,
}: {
  post: CommunityPost
  role: PageRole | ""
  represented: boolean
  page?: PageCard
  pictureUrl?: string | null
  following?: Set<string> | null
}) {
  const session = useCommunitySession()
  const signedIn = useSignedInAction()
  const client = useQueryClient()
  const follow = useFollowPage()
  const { text, languageTag } = useStreamLocale()
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
    signedIn(
      text(
        "Đăng nhập để báo cáo nội dung không phù hợp với đội ngũ kiểm duyệt.",
        "Sign in to report inappropriate content to the moderation team.",
      ),
      () => {
        setReportedComment(commentId)
        setReporting(true)
      },
    )
  return (
    <article className="cp-post">
      <header className="cp-post-header">
        {page ? (
          <Link to={`/pages/${page.code}`} className="cp-post-avatar" aria-label={page.name}>
            <CardAvatar name={page.name} url={page.avatarUrl} />
          </Link>
        ) : post.asPage ? (
          <CardAvatar name={post.authorName} url={pictureUrl} className="cp-post-avatar" />
        ) : (
          <AuthorMark name={post.authorName} />
        )}
        <div className="cp-post-author">
          <strong>
            {page ? <Link to={`/pages/${page.code}`}>{page.name}</Link> : <span>{post.authorName}</span>}
            {(page ? page.represented : post.asPage && represented) && (
              <OfficialBadge
                label={
                  page
                    ? text("Đại diện đã xác minh", "Verified representative")
                    : text("Bài đăng của đại diện đã xác minh", "Post by a verified representative")
                }
              />
            )}
          </strong>
          <span className="cp-post-meta">
            <span>
              {page
                ? post.asPage
                  ? text(profileKindLabels[page.kind], profileKindEnglish[page.kind])
                  : text(`${post.authorName} · Thành viên cộng đồng`, `${post.authorName} · Community member`)
                : post.asPage
                  ? text("Đăng bởi đại diện trang", "Posted by a page representative")
                  : text("Thành viên cộng đồng", "Community member")}
            </span>
            <span>
              <TimeAgo value={post.createdAt} />
            </span>
            {post.pinned && (
              <span className="cp-post-pinned">
                <StreamIcon name="pin" size={12} />
                <span>{text("Đã ghim", "Pinned")}</span>
              </span>
            )}
          </span>
        </div>
        {post.status !== "PUBLISHED" && (
          <span className="cp-badge" data-status={post.status}>
            {post.status === "HIDDEN" ? text("Đã ẩn", "Hidden") : text("Bản nháp", "Draft")}
          </span>
        )}
        {page && following && !following.has(page.id) && (
          <button
            className="cp-follow-chip"
            disabled={follow.isPending}
            onClick={() => follow.mutate({ pageId: page.id, following: true })}
            aria-label={text(`Theo dõi ${page.name}`, `Follow ${page.name}`)}
          >
            <StreamIcon name="plus" size={14} />
            <span className="cp-follow-label">{text("Theo dõi", "Follow")}</span>
          </button>
        )}
        {(published || canEdit || canModerate) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="hub-icon-button cp-more" aria-label={text("Thao tác với bài viết", "Post actions")}>
                <StreamIcon name="more" size={18} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="hub-popover hub-post-menu"
              drawerTitle={text("Tùy chọn bài viết", "Post options")}
            >
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
                  {text("Chỉnh sửa", "Edit")}
                </DropdownMenuItem>
              )}
              {canPin && (
                <DropdownMenuItem className="hub-menu-item" disabled={pin.isPending} onSelect={() => pin.mutate()}>
                  <StreamIcon name="pin" size={16} />
                  {post.pinned ? text("Bỏ ghim", "Unpin") : text("Ghim lên đầu trang", "Pin to the top of the page")}
                </DropdownMenuItem>
              )}
              {published && (
                <DropdownMenuItem className="hub-menu-item" onSelect={() => startReport()}>
                  <StreamIcon name="flag" size={16} />
                  {text("Báo cáo bài viết", "Report post")}
                </DropdownMenuItem>
              )}
              {canModerate && (
                <DropdownMenuItem
                  className="hub-menu-item"
                  disabled={hide.isPending}
                  onSelect={() => hide.mutate(undefined)}
                >
                  <StreamIcon name={post.status === "HIDDEN" ? "eye" : "eyeOff"} size={16} />
                  {post.status === "HIDDEN"
                    ? text("Khôi phục hiển thị", "Restore visibility")
                    : text("Ẩn bài viết", "Hide post")}
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
      {long && (
        <button className="cp-text-button cp-post-fold" aria-expanded={unfolded} onClick={() => setUnfolded(!unfolded)}>
          {unfolded ? text("Thu gọn", "Show less") : text("Xem thêm", "Show more")}
        </button>
      )}
      {post.videoUrl && (
        <PostVideo
          url={post.videoUrl}
          title={post.title || text(`Video của ${post.authorName}`, `Video by ${post.authorName}`)}
        />
      )}
      <PostImages urls={post.imageUrls || []} alt={post.title || post.authorName} />
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
              {text("Tiêu đề", "Title")}
              <input
                required
                maxLength={200}
                value={editedTitle}
                onChange={(event) => setEditedTitle(event.target.value)}
              />
            </label>
          )}
          <label>
            {text("Nội dung bài viết", "Post content")}
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
              {text("Lưu & đăng", "Save & post")}
            </button>
            <button
              type="button"
              className="cp-button"
              disabled={edit.isPending || (post.kind !== "VIDEO" && !editedBody.trim())}
              onClick={() => edit.mutate(false)}
            >
              {text("Giữ ở bản nháp", "Keep as draft")}
            </button>
            <button type="button" className="cp-button" onClick={() => setEditing(false)}>
              {text("Hủy", "Cancel")}
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
            className="cp-post-action"
            aria-pressed={session.status === "authenticated" ? shown.liked : undefined}
            aria-label={text(
              `${shown.liked ? "Bỏ thích" : "Thích"} · ${shown.likes.toLocaleString(languageTag)} lượt thích`,
              `${shown.liked ? "Unlike" : "Like"} · ${shown.likes.toLocaleString(languageTag)} ${shown.likes === 1 ? "like" : "likes"}`,
            )}
            disabled={like.isPending}
            onClick={() =>
              signedIn(text("Đăng nhập để thích bài viết này.", "Sign in to like this post."), () =>
                like.mutate(!shown.liked),
              )
            }
          >
            <StreamIcon name="heart" size={18} />
            <span>{shown.likes.toLocaleString(languageTag)}</span>
          </button>
        )}
        <button
          className="cp-post-action"
          aria-expanded={expanded}
          aria-label={text(
            `Bình luận · ${post.comments.toLocaleString(languageTag)}`,
            `${post.comments.toLocaleString(languageTag)} ${post.comments === 1 ? "comment" : "comments"}`,
          )}
          disabled={!published}
          onClick={() => setExpanded(!expanded)}
        >
          <StreamIcon name="message" size={18} />
          <span>{post.comments.toLocaleString(languageTag)}</span>
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
          <fieldset>
            <legend>
              {reportedComment
                ? text("Lý do báo cáo bình luận", "Reason for reporting the comment")
                : text("Lý do báo cáo bài viết", "Reason for reporting the post")}
            </legend>
            <div className="hub-pills">
              {REPORT_REASONS.map((names) => text(...names)).map((option) => (
                <button type="button" key={option} aria-pressed={reason === option} onClick={() => setReason(option)}>
                  {option}
                </button>
              ))}
            </div>
            <label>
              <span className="sr-only">Mô tả lý do</span>
              <textarea
                required
                rows={2}
                maxLength={2000}
                placeholder="Chọn một lý do ở trên hoặc tự mô tả…"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          </fieldset>
          <div className="cp-actions">
            <button className="cp-button cp-primary" disabled={report.isPending}>
              {text("Gửi báo cáo", "Send report")}
            </button>
            <button type="button" className="cp-button" onClick={() => setReporting(false)}>
              {text("Hủy", "Cancel")}
            </button>
          </div>
        </form>
      )}
      {report.isSuccess && (
        <p className="cp-success" role="status">
          {text("Đã gửi báo cáo.", "Report sent.")}
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
          {comments.isLoading && <p className="cp-muted">{text("Đang tải bình luận…", "Loading comments…")}</p>}
          {comments.data && !commentRows.length && (
            <p className="cp-muted">
              {text(
                "Chưa có bình luận. Hãy là người đầu tiên chia sẻ suy nghĩ.",
                "No comments yet. Be the first to share your thoughts.",
              )}
            </p>
          )}
          {commentRows.map((comment) => (
            <div className="cp-comment" key={comment.id}>
              <AuthorMark name={comment.authorName} small />
              <div className="cp-comment-body">
                <p className="cp-comment-head">
                  <strong>{comment.authorName}</strong>
                  {comment.asPage && <span>{text("Đại diện trang", "Page representative")}</span>}
                  <TimeAgo value={comment.createdAt} />
                </p>
                <p className="cp-prose">{comment.body}</p>
                <div className="cp-comment-tools">
                  <button className="cp-text-button" onClick={() => startReport(comment.id)}>
                    {text("Báo cáo", "Report")}
                  </button>
                  {["OWNER", "MODERATOR"].includes(role) && (
                    <button className="cp-text-button" onClick={() => hide.mutate(comment.id)}>
                      {text("Ẩn bình luận", "Hide comment")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          <InfiniteScroll
            query={comments}
            label={text("Đang tải thêm bình luận", "Loading more comments")}
            retryLabel={text("Tải lại phần tiếp theo", "Load the next part again")}
          />
          {session.status === "authenticated" ? (
            <form
              className="cp-reply"
              onSubmit={(event) => {
                event.preventDefault()
                reply.mutate()
              }}
            >
              <label>
                <span className="sr-only">{text("Bình luận của bạn", "Your comment")}</span>
                <textarea
                  required
                  rows={2}
                  maxLength={4000}
                  placeholder={text("Viết bình luận…", "Write a comment…")}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                />
              </label>
              <div className="cp-actions cp-reply-actions">
                {role && (
                  <label className="cp-check">
                    <input type="checkbox" checked={asPage} onChange={(event) => setAsPage(event.target.checked)} />
                    {text("Trả lời với tư cách trang", "Reply as the page")}
                  </label>
                )}
                <button className="cp-button cp-primary" disabled={reply.isPending || !body.trim()}>
                  <StreamIcon name="send" size={16} />
                  {text("Gửi bình luận", "Send comment")}
                </button>
              </div>
            </form>
          ) : (
            <button
              className="cp-button cp-reply-prompt"
              onClick={() =>
                signedIn(
                  text("Đăng nhập để bình luận và tham gia thảo luận.", "Sign in to comment and join the discussion."),
                  () => undefined,
                )
              }
            >
              <StreamIcon name="message" size={16} />
              {text("Đăng nhập để bình luận", "Sign in to comment")}
            </button>
          )}
        </div>
      )}
    </article>
  )
}
