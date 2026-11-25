import { useState, type CSSProperties } from "react"
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { CommunityPost, PageCard, PageRole } from "@aov/community-contracts"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { nextPageOf } from "@aov/ui/lib/page-slice"
import { PageMark } from "../../../components/page-mark"
import { ReferenceText } from "../../../components/reference-text"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { useSignedInAction } from "../../../components/community-signin"
import { hueOf, TimeAgo } from "../../../components/community-ui"
import { communityApi } from "../../../lib/community-api"
import { communityKeys, refreshPostLists } from "../../../lib/community-keys"
import { initials } from "../../../lib/profile-model"
import { useCommunitySession } from "../../../lib/stream-auth"
import "./post-comments.css"

/** The initials of a member who wrote as themselves, in the color of their name. */
export function AuthorMark({ name, small = false }: { name: string; small?: boolean }) {
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

/**
 * The comments under a post, loaded as the reader scrolls, and the box to add one. `page` is the page the post is on,
 * whose representatives may answer as it. Moderators of the page can hide a comment; anyone signed in can report one
 * through `onReport`.
 */
export function PostComments({
  post,
  page,
  role,
  onReport,
}: {
  post: CommunityPost
  page?: PageCard
  role: PageRole | ""
  onReport: (commentId: string) => void
}) {
  const session = useCommunitySession()
  const signedIn = useSignedInAction()
  const client = useQueryClient()
  const { text } = useStreamLocale()
  const [body, setBody] = useState("")
  const [asPage, setAsPage] = useState(false)
  const comments = useInfiniteQuery({
    queryKey: communityKeys.comments(post.id),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => communityApi.comments(post.id, pageParam),
    getNextPageParam: nextPageOf,
    enabled: post.status === "PUBLISHED",
  })
  const rows = comments.data?.pages.flatMap((part) => part.items) ?? []
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: communityKeys.comments(post.id) })
    await refreshPostLists(client)
  }
  const reply = useMutation({
    mutationFn: () => communityApi.comment(post.id, { body, asPage }),
    onSuccess: async () => {
      setBody("")
      await refresh()
    },
  })
  const hide = useMutation({
    mutationFn: (commentId: string) => communityApi.moderate(post.pageId, { postId: post.id, commentId, hidden: true }),
    onSuccess: refresh,
  })
  const moderates = ["OWNER", "MODERATOR"].includes(role)
  return (
    <div className="pc">
      {comments.isLoadingError && (
        <p className="cp-error" role="alert">
          {comments.error.message}
        </p>
      )}
      {(reply.isError || hide.isError) && (
        <p className="cp-error" role="alert">
          {reply.error?.message || hide.error?.message}
        </p>
      )}
      {comments.isLoading && <p className="cp-muted">{text("Đang tải bình luận…", "Loading comments…")}</p>}
      {comments.data && !rows.length && (
        <p className="cp-muted">
          {text(
            "Chưa có bình luận. Hãy là người đầu tiên chia sẻ suy nghĩ.",
            "No comments yet. Be the first to share your thoughts.",
          )}
        </p>
      )}
      {rows.length > 0 && (
        <ol className="pc-list">
          {rows.map((comment) => (
            <li key={comment.id} className="pc-comment" data-page={comment.asPage || undefined}>
              {comment.asPage ? (
                <PageMark
                  kind={page?.kind ?? "ORGANIZATION"}
                  name={comment.authorName}
                  url={page?.avatarUrl}
                  size={32}
                />
              ) : (
                <AuthorMark name={comment.authorName} small />
              )}
              <div>
                <div className="pc-bubble">
                  <p className="pc-head">
                    <strong>{comment.authorName}</strong>
                    {comment.asPage && <span>{text("Đại diện trang", "Page representative")}</span>}
                  </p>
                  <p className="pc-text">
                    <ReferenceText text={comment.body} />
                  </p>
                </div>
                <p className="pc-tools">
                  <TimeAgo value={comment.createdAt} />
                  <button type="button" onClick={() => onReport(comment.id)}>
                    {text("Báo cáo", "Report")}
                  </button>
                  {moderates && (
                    <button type="button" disabled={hide.isPending} onClick={() => hide.mutate(comment.id)}>
                      {text("Ẩn bình luận", "Hide comment")}
                    </button>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
      <InfiniteScroll
        query={comments}
        label={text("Đang tải thêm bình luận", "Loading more comments")}
        retryLabel={text("Tải lại phần tiếp theo", "Load the next part again")}
      />
      {session.status === "authenticated" ? (
        <form
          className="pc-reply"
          onSubmit={(event) => {
            event.preventDefault()
            if (body.trim()) reply.mutate()
          }}
        >
          <span className="pc-self">
            <AuthorMark name={session.name} small />
          </span>
          <label className="pc-field">
            <span className="sr-only">{text("Bình luận của bạn", "Your comment")}</span>
            <textarea
              required
              rows={1}
              maxLength={4000}
              placeholder={text("Viết bình luận…", "Write a comment…")}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </label>
          <button
            className="pc-send"
            aria-label={text("Gửi bình luận", "Send comment")}
            title={text("Gửi bình luận", "Send comment")}
            disabled={reply.isPending || !body.trim()}
          >
            <StreamIcon name="send" size={18} />
          </button>
          {role && (
            <label className="cp-check pc-as">
              <input type="checkbox" checked={asPage} onChange={(event) => setAsPage(event.target.checked)} />
              {text("Trả lời với tư cách trang", "Reply as the page")}
            </label>
          )}
        </form>
      ) : (
        <button
          className="cp-button pc-prompt"
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
  )
}
