import { useState, type ReactNode } from "react"
import { Link } from "react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { CommunityPost, PageCard, PageRole, PostTranslation } from "@aov/community-contracts"
import { profileKindLabels } from "@aov/community-contracts"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@aov/ui/components/public-overlay"
import { LocalTime } from "@aov/ui/components/local-time"
import { formatInZone, useUserTimeZone } from "@aov/ui/lib/time-zone"
import { OfficialName } from "../../../components/official-name"
import { PageMark } from "../../../components/page-mark"
import { ReferenceText } from "../../../components/reference-text"
import { Stage } from "../../../components/stage"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { communityApi } from "../../../lib/community-api"
import { refreshPostLists } from "../../../lib/community-keys"
import { focusesFoldedLink } from "../../../lib/folded-text"
import { useCommunitySession } from "../../../lib/stream-auth"
import { useFollowPage } from "../../../lib/community-queries"
import { useSignedInAction } from "../../../components/community-signin"
import { profileKindEnglish, timeAgo, TimeAgo } from "../../../components/community-ui"
import { foldsBody, postForm } from "../model/post-form"
import { replacesWords } from "../model/post-translation"
import { PostImages, PostVideo } from "./post-media"
import { AuthorMark, PostComments } from "./post-comments"
import { PostEditForm, PostReportForm } from "./post-forms"
import { PostImageNotes, PostTranslationBar, usePostTranslationState } from "./post-translation"
import "./community-post.css"

/**
 * One post with its likes, comments and actions, laid out by what it carries (`postForm`). Its margin says who posted
 * it; in the `journal` of the page itself it keeps the day instead, which `opensDay` names once. `page` is the page the
 * post is on, missing while a journal still reads it. `following` is null for signed-out viewers, who see no follow
 * buttons; their likes, comments and reports open the sign-in prompt instead.
 */
export function PostCard({
  post,
  role,
  page,
  journal = false,
  opensDay = true,
  following = null,
}: {
  post: CommunityPost
  role: PageRole | ""
  page?: PageCard
  journal?: boolean
  opensDay?: boolean
  following?: Set<string> | null
}) {
  const session = useCommunitySession()
  const signedIn = useSignedInAction()
  const client = useQueryClient()
  const { text, languageTag } = useStreamLocale()
  const translation = usePostTranslationState(post)
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  // The report being written; the counter starts a fresh form each time a report is asked for.
  const [reporting, setReporting] = useState<{ commentId?: string; at: number } | null>(null)
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
    onSuccess: () => refreshPostLists(client),
  })
  const pin = useMutation({
    mutationFn: () => communityApi.pin(post.pageId, post.id, !post.pinned),
    onSuccess: () => refreshPostLists(client),
  })
  const canEdit = post.status !== "HIDDEN" && (post.own || (post.asPage && ["OWNER", "EDITOR"].includes(role)))
  const canPin = post.asPage && post.status === "PUBLISHED" && ["OWNER", "EDITOR"].includes(role)
  const canModerate = post.status !== "DRAFT" && ["OWNER", "MODERATOR"].includes(role)
  const published = post.status === "PUBLISHED"
  const form = postForm(post)
  const startReport = (commentId?: string) =>
    signedIn(
      text(
        "Đăng nhập để báo cáo nội dung không phù hợp với đội ngũ kiểm duyệt.",
        "Sign in to report inappropriate content to the moderation team.",
      ),
      () => setReporting({ commentId, at: Date.now() }),
    )
  const error = pin.error || hide.error || like.error
  return (
    <article className="ps-post" data-form={form} ref={translation.watch}>
      <header className="ps-margin">
        {page && !journal ? (
          <PostAuthor post={post} page={page} following={following} />
        ) : (
          <PostDay value={post.createdAt} opens={opensDay} />
        )}
        {post.pinned && (
          <span className="ps-pinned">
            <StreamIcon name="pin" size={14} />
            {text("Đã ghim", "Pinned")}
          </span>
        )}
      </header>
      <div className="ps-main">
        {!published && (
          <span className="cp-badge" data-status={post.status}>
            {post.status === "HIDDEN" ? text("Đã ẩn", "Hidden") : text("Bản nháp", "Draft")}
          </span>
        )}
        {!post.asPage && <PostMember name={post.authorName} />}
        <PostContent post={post} page={page} translation={editing ? null : translation.shown} />
        {!editing && <PostTranslationBar state={translation} post={post} />}
        {editing && <PostEditForm post={post} onClose={() => setEditing(false)} />}
        <div className="ps-actions">
          {published && (
            <button
              className="ps-action ps-like"
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
              <StreamIcon name="heart" size={20} />
              {shown.likes > 0 && <span>{shown.likes.toLocaleString(languageTag)}</span>}
            </button>
          )}
          <button
            className="ps-action"
            aria-expanded={expanded}
            aria-label={text(
              `Bình luận · ${post.comments.toLocaleString(languageTag)}`,
              `${post.comments.toLocaleString(languageTag)} ${post.comments === 1 ? "comment" : "comments"}`,
            )}
            disabled={!published}
            onClick={() => setExpanded(!expanded)}
          >
            <StreamIcon name="message" size={20} />
            {post.comments > 0 && <span>{post.comments.toLocaleString(languageTag)}</span>}
          </button>
          {(published || canEdit || canModerate) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ps-action ps-more" aria-label={text("Thao tác với bài viết", "Post actions")}>
                  <StreamIcon name="more" size={20} />
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
                {translation.offer && !translation.shown && !translation.loading && (
                  <DropdownMenuItem className="hub-menu-item" onSelect={translation.translate}>
                    <StreamIcon name="globe" size={16} />
                    {translation.offer === "images"
                      ? text("Dịch chữ trong ảnh", "Translate image text")
                      : text("Dịch bài viết", "Translate post")}
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
        </div>
        {error && (
          <p className="cp-error" role="alert">
            {error.message}
          </p>
        )}
        {reporting && (
          <PostReportForm
            key={reporting.at}
            post={post}
            commentId={reporting.commentId}
            onClose={() => setReporting(null)}
          />
        )}
        {expanded && <PostComments post={post} page={page} role={role} onReport={startReport} />}
      </div>
    </article>
  )
}

/**
 * What the post says, in the order its form gives it: pictures first, words after. News stands on the page's stage.
 * A `translation` replaces the words and adds what the pictures say.
 */
function PostContent({
  post,
  page,
  translation,
}: {
  post: CommunityPost
  page?: PageCard
  translation: PostTranslation | null
}) {
  const { text, languageTag } = useStreamLocale()
  const news = postForm(post) === "news"
  const replaced = translation && replacesWords(translation, post) ? translation : null
  const lang = replaced ? languageTag : undefined
  const shownTitle = replaced ? (replaced.title ?? post.title) : post.title
  const shownBody = replaced ? replaced.body : post.body
  const images = post.imageUrls || []
  const title = shownTitle && (
    <h3 className="ps-title" lang={lang}>
      {shownTitle}
    </h3>
  )
  const media = (
    <>
      {post.videoUrl && (
        <PostVideo
          url={post.videoUrl}
          title={post.title || text(`Video của ${post.authorName}`, `Video by ${post.authorName}`)}
        />
      )}
      <PostImages urls={images} alt={post.title || post.authorName} />
      {translation && <PostImageNotes translation={translation} count={Math.min(images.length, 4)} />}
    </>
  )
  const words = shownBody && <PostBody body={shownBody} lang={lang} />
  if (news)
    return (
      <Stage tint={page?.name ?? post.authorName} lights={[{ src: page?.avatarUrl, at: "left" }]} className="ps-news">
        {media}
        <div className="ps-news-words">
          {title}
          {words}
        </div>
      </Stage>
    )
  return (
    <>
      {media}
      {title}
      {words}
    </>
  )
}

/** The words of a post. Long ones fold, and open for a keyboard that reaches a link inside. */
function PostBody({ body, lang }: { body: string; lang?: string }) {
  const { text } = useStreamLocale()
  const [unfolded, setUnfolded] = useState(false)
  const long = foldsBody(body)
  return (
    <>
      <p
        className="cp-prose ps-body"
        lang={lang}
        data-folded={(long && !unfolded) || undefined}
        onFocus={(event) => {
          if (long && focusesFoldedLink(event)) setUnfolded(true)
        }}
      >
        <ReferenceText text={body} />
      </p>
      {long && (
        <button className="cp-text-button ps-fold" aria-expanded={unfolded} onClick={() => setUnfolded(!unfolded)}>
          {unfolded ? text("Thu gọn", "Show less") : text("Xem thêm", "Show more")}
        </button>
      )}
    </>
  )
}

/** The page a post is on, when it was posted, and the way to follow that page. */
function PostAuthor({ post, page, following }: { post: CommunityPost; page: PageCard; following: Set<string> | null }) {
  const { text } = useStreamLocale()
  const follow = useFollowPage()
  return (
    <div className="ps-author">
      <Link to={`/pages/${page.code}`} className="ps-author-mark" aria-label={page.name}>
        <PageMark kind={page.kind} name={page.name} url={page.avatarUrl} size={48} />
      </Link>
      <div className="ps-author-text">
        <strong>
          <Link to={`/pages/${page.code}`}>
            <OfficialName name={page.name} official={page.represented} />
          </Link>
        </strong>
        <span>
          <span className="ps-author-kind">{text(profileKindLabels[page.kind], profileKindEnglish[page.kind])}</span>
          <TimeAgo value={post.createdAt} />
        </span>
      </div>
      {following && !following.has(page.id) && (
        <button
          className="cp-follow-chip"
          disabled={follow.isPending}
          onClick={() => follow.mutate({ pageId: page.id, following: true })}
          aria-label={text(`Theo dõi ${page.name}`, `Follow ${page.name}`)}
        >
          <StreamIcon name="plus" size={14} />
          {text("Theo dõi", "Follow")}
        </button>
      )}
    </div>
  )
}

/**
 * The day a page posted something, as a wall calendar shows it, and the hour. The posts after the first of a day keep
 * the hour only.
 */
function PostDay({ value, opens }: { value: string; opens: boolean }) {
  const { text, languageTag } = useStreamLocale()
  const zone = useUserTimeZone()
  const part = (options: Intl.DateTimeFormatOptions) => formatInZone(value, zone, options, languageTag)
  const recent = Date.now() - Date.parse(value) < 86_400_000
  return (
    <div className="ps-day" data-same={!opens || undefined}>
      {opens && (
        <p>
          <b>{part({ day: "numeric" })}</b>
          <span>
            {text(`Tháng ${part({ month: "numeric" })}`, part({ month: "long" }))}
            <small>{part({ year: "numeric" })}</small>
          </span>
        </p>
      )}
      <LocalTime
        value={value}
        locale={languageTag}
        label={(shown): ReactNode =>
          recent
            ? timeAgo(value, Date.now(), shown, languageTag)
            : formatInZone(value, shown, { hour: "2-digit", minute: "2-digit" }, languageTag)
        }
      />
    </div>
  )
}

/** A member who wrote on the page as themselves. */
function PostMember({ name }: { name: string }) {
  const { text } = useStreamLocale()
  return (
    <p className="ps-member">
      <AuthorMark name={name} small />
      <strong>{name}</strong>
      <span>{text("Thành viên cộng đồng", "Community member")}</span>
    </p>
  )
}
