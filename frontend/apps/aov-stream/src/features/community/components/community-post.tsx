import { useState } from "react"
import { Link } from "react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { CommunityPost, PageCard, PageRole } from "@aov/community-contracts"
import { profileKindLabels } from "@aov/community-contracts"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@aov/ui/components/public-overlay"
import { OfficialBadge } from "@aov/ui/components/official-badge"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { communityApi } from "../../../lib/community-api"
import { refreshPostLists } from "../../../lib/community-keys"
import { useCommunitySession } from "../../../lib/stream-auth"
import { useFollowPage } from "../../../lib/community-queries"
import { useSignedInAction } from "../../../components/community-signin"
import { CardAvatar, profileKindEnglish, TimeAgo } from "../../../components/community-ui"
import { PostImages, PostVideo } from "./post-media"
import { AuthorMark, PostComments } from "./post-comments"
import { PostEditForm, PostReportForm } from "./post-forms"

const longPost = (body: string) => body.length > 420 || body.split("\n").length > 7

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
  const [editing, setEditing] = useState(false)
  // The report being written; the counter starts a fresh form each time a report is asked for.
  const [reporting, setReporting] = useState<{ commentId?: string; at: number } | null>(null)
  const refreshLists = () => refreshPostLists(client)
  // A like shown before the feed refetches; a newer `post` from the server replaces it.
  const [liking, setLiking] = useState<{ source: CommunityPost; liked: boolean; likes: number } | null>(null)
  const shown = liking?.source === post ? liking : post
  const like = useMutation({
    mutationFn: (liked: boolean) => communityApi.likePost(post.id, liked),
    onMutate: (liked) => {
      const previous = liking
      setLiking({ source: post, liked, likes: Math.max(0, shown.likes + (liked ? 1 : -1)) })
      return previous
    },
    onSuccess: (result) => setLiking({ source: post, ...result }),
    onError: (_error, _liked, previous) => setLiking(previous ?? null),
  })
  const hide = useMutation({
    mutationFn: () => communityApi.moderate(post.pageId, { postId: post.id, hidden: post.status !== "HIDDEN" }),
    onSuccess: refreshLists,
  })
  const pin = useMutation({
    mutationFn: () => communityApi.pin(post.pageId, post.id, !post.pinned),
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
      () => setReporting({ commentId, at: Date.now() }),
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
                <DropdownMenuItem className="hub-menu-item" onSelect={() => setEditing(true)}>
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
                <DropdownMenuItem className="hub-menu-item" disabled={hide.isPending} onSelect={() => hide.mutate()}>
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
      {editing && <PostEditForm post={post} onClose={() => setEditing(false)} />}
      {pin.isError && (
        <p className="cp-error" role="alert">
          {pin.error.message}
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
        <PostReportForm
          key={reporting.at}
          post={post}
          commentId={reporting.commentId}
          onClose={() => setReporting(null)}
        />
      )}
      {(hide.isError || like.isError) && (
        <p className="cp-error" role="alert">
          {hide.error?.message || like.error?.message}
        </p>
      )}
      {expanded && <PostComments post={post} role={role} onReport={startReport} />}
    </article>
  )
}
