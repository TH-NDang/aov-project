import { useEffect, useRef, useState, type CSSProperties } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  profileKindLabels,
  type CommunityProfile,
  type PageClaim,
  type PageManager,
  type PageViewer,
  type ProfilePresentation,
} from "@aov/community-contracts"
import { LocalTime } from "@aov/ui/components/local-time"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@aov/ui/components/public-overlay"
import { SOCIAL_PLATFORM_NAMES, SocialPlatformIcon, socialPlatformName } from "@aov/ui/components/social-platform-icon"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { StreamShell } from "../../../components/stream-shell"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { AccountProfile } from "../../../components/account/account-profile"
import { AccountSettings } from "../../../components/account/account-settings"
import { initials } from "../../../lib/profile-model"
import { communityApi } from "../../../lib/community-api"
import { communityKeys } from "../../../lib/community-keys"
import { useCommunitySession } from "../../../lib/stream-auth"
import { CommunityFeed } from "../components/community-feed"
import { openSignIn, SignInBenefits } from "../../../components/community-signin"
import {
  useFollowedPages,
  useFollowPage,
  useNotificationInbox,
  useReadNotifications,
  useUnreadCount,
} from "../../../lib/community-queries"
import { Avatar, followersLabel, hueOf, profileKindEnglish } from "../../../components/community-ui"
import { notificationText } from "../../../lib/notification-text"

const roleLabels: Record<PageManager["role"], readonly [string, string]> = {
  OWNER: ["Quản trị chính", "Owner"],
  EDITOR: ["Biên tập viên", "Editor"],
  MODERATOR: ["Kiểm duyệt viên", "Moderator"],
}
const claimLabels: Record<PageClaim["status"], readonly [string, string]> = {
  PENDING: ["Đang chờ xét duyệt", "Pending review"],
  APPROVED: ["Đã chấp thuận", "Approved"],
  REJECTED: ["Chưa được chấp thuận", "Not approved"],
}

type AccountTab = "profile" | "settings" | "follows" | "notifications" | "pages"
const accountTabs: [AccountTab, [string, string]][] = [
  ["profile", ["Hồ sơ", "Profile"]],
  ["settings", ["Cài đặt", "Settings"]],
  ["follows", ["Đang theo dõi", "Following"]],
  ["notifications", ["Thông báo", "Notifications"]],
  ["pages", ["Trang & yêu cầu", "Pages & requests"]],
]

export function CommunityAccount() {
  const { text } = useStreamLocale()
  const session = useCommunitySession()
  const [params, setParams] = useSearchParams()
  const requested = params.get("tab") as AccountTab | null
  const tab = accountTabs.some(([value]) => value === requested) ? requested! : "profile"
  const enabled = session.status === "authenticated"
  const unread = useUnreadCount()
  const tabRow = useRef<HTMLElement>(null)
  // A tab opened from a link may sit past the edge of the row on a phone, also once the unread count widens the row;
  // the row scrolls sideways to it, and the page stays where it is.
  useEffect(() => {
    const row = tabRow.current
    const chosen = row?.querySelector<HTMLElement>("[aria-current]")
    if (!row || !chosen) return
    const box = row.getBoundingClientRect()
    const shown = chosen.getBoundingClientRect()
    if (shown.left >= box.left && shown.right <= box.right) return
    row.scrollLeft += shown.left - box.left - (box.width - shown.width) / 2
  }, [tab, enabled, unread.data?.unread])
  return (
    <StreamShell>
      <title>{text("Tài khoản — AOV Stream", "Account — AOV Stream")}</title>
      <div className="cp-container">
        <header className="tn-page-head">
          <div>
            <h1>{text("Tài khoản", "Account")}</h1>
            <p>
              {enabled
                ? text(
                    `${session.name} · hồ sơ và cài đặt dùng chung cho AOV Stream, Wiki và Admin`,
                    `${session.name} · profile and settings shared by AOV Stream, Wiki and Admin`,
                  )
                : text(
                    "Một tài khoản AOV dùng chung cho AOV Stream, Wiki và Admin.",
                    "One AOV account shared by AOV Stream, Wiki and Admin.",
                  )}
            </p>
          </div>
        </header>
        {enabled && (
          <nav ref={tabRow} className="cp-tabs" aria-label={text("Mục tài khoản", "Account sections")}>
            {accountTabs.map(([value, label]) => (
              <button
                key={value}
                aria-current={tab === value ? "page" : undefined}
                onClick={() => setParams(value === "profile" ? {} : { tab: value })}
              >
                {text(...label)}
                {value === "notifications" && !!unread.data?.unread && (
                  <span
                    className="cp-tab-count"
                    aria-label={text(`${unread.data.unread} chưa đọc`, `${unread.data.unread} unread`)}
                  >
                    {unread.data.unread}
                  </span>
                )}
              </button>
            ))}
          </nav>
        )}
        {session.status === "loading" ? (
          <div
            className="hub-skeleton-rows"
            role="status"
            aria-label={text("Đang tải tài khoản", "Loading the account")}
          />
        ) : !enabled ? (
          <SignInPrompt />
        ) : tab === "settings" ? (
          <AccountSettings />
        ) : tab === "follows" ? (
          <FollowedPages />
        ) : tab === "notifications" ? (
          <NotificationInbox />
        ) : tab === "pages" ? (
          <ManagedPages />
        ) : (
          <AccountProfile />
        )}
      </div>
    </StreamShell>
  )
}

function FollowedPages() {
  const { text, languageTag } = useStreamLocale()
  const follows = useFollowedPages()
  const follow = useFollowPage()
  const items = follows.data?.items ?? []
  return (
    <section className="cp-section" aria-labelledby="account-follows">
      <div className="tn-heading" data-flush="">
        <h2 id="account-follows">
          {text("Trang đang theo dõi", "Pages you follow")}{" "}
          {!!items.length && <small>{items.length.toLocaleString(languageTag)}</small>}
        </h2>
      </div>
      <p className="cp-section-lead">
        {text(
          "Bài mới của các trang này có ở mục Đang theo dõi trên bảng tin.",
          "New posts from these pages appear under Following in the feed.",
        )}
      </p>
      {follows.isPending && (
        <div
          className="hub-skeleton-rows"
          role="status"
          aria-label={text("Đang tải trang theo dõi", "Loading followed pages")}
        />
      )}
      {follows.isError && <p className="cp-error">{follows.error.message}</p>}
      {follows.data && !items.length && (
        <div className="cp-empty">
          <p>{text("Bạn chưa theo dõi trang nào.", "You are not following any pages yet.")}</p>
          <Link className="cp-button cp-primary" to="/explore">
            {text("Khám phá trang", "Explore pages")}
          </Link>
        </div>
      )}
      {!!items.length && (
        <ul className="cp-rows">
          {items.map((profile) => (
            <li key={profile.id} className="cp-row">
              <Avatar profile={profile} className="cp-row-avatar" />
              <Link to={`/pages/${profile.code}`} className="cp-row-text">
                <strong>{profile.content?.name || profile.code}</strong>
                <small>
                  {text(profileKindLabels[profile.kind], profileKindEnglish[profile.kind])} ·{" "}
                  {followersLabel(profile.followers)}
                </small>
              </Link>
              <button
                className="cp-button cp-quiet"
                disabled={follow.isPending}
                onClick={() => follow.mutate({ pageId: profile.id, following: false })}
                aria-label={text(
                  `Bỏ theo dõi ${profile.content?.name || profile.code}`,
                  `Unfollow ${profile.content?.name || profile.code}`,
                )}
              >
                {text("Bỏ theo dõi", "Unfollow")}
              </button>
            </li>
          ))}
        </ul>
      )}
      {follow.isError && (
        <p className="cp-field-error" role="alert">
          {follow.error.message}
        </p>
      )}
    </section>
  )
}

function NotificationInbox() {
  const { text, languageTag } = useStreamLocale()
  const inbox = useNotificationInbox(24)
  const notifications = inbox.data?.pages.flatMap((page) => page.items) ?? []
  const unread = useUnreadCount()
  const read = useReadNotifications()
  const count = unread.data?.unread ?? 0
  return (
    <section className="cp-section" aria-labelledby="account-notifications">
      <div className="tn-heading" data-flush="">
        <h2 id="account-notifications">{text("Thông báo", "Notifications")}</h2>
        {count > 0 && (
          <button type="button" disabled={read.all.isPending} onClick={() => read.all.mutate()}>
            <StreamIcon name="check" size={15} />
            {text("Đánh dấu đã đọc tất cả", "Mark all as read")}
          </button>
        )}
      </div>
      {inbox.isPending && (
        <div
          className="hub-skeleton-rows"
          role="status"
          aria-label={text("Đang tải thông báo", "Loading notifications")}
        />
      )}
      {inbox.isLoadingError && <p className="cp-error">{inbox.error.message}</p>}
      {inbox.data && !notifications.length && (
        <p className="cp-section-lead">
          {text(
            "Chưa có thông báo. Theo dõi trang để nhận tin khi có bài mới.",
            "No notifications yet. Follow pages to hear about their new posts.",
          )}
        </p>
      )}
      {!!notifications.length && (
        <ul className="cp-rows">
          {notifications.map((item) => (
            <li key={item.id} className="cp-row cp-note" data-unread={!item.read || undefined}>
              <span className="cp-note-dot" aria-hidden="true" />
              <span className="cp-row-text">
                <Link to={`/pages/${item.pageId}`} onClick={() => !item.read && read.one.mutate(item.id)}>
                  {!item.read && <span className="sr-only">{text("Chưa đọc: ", "Unread: ")}</span>}
                  {notificationText(item, text)}
                </Link>
                <small>
                  <LocalTime value={item.createdAt} locale={languageTag} />
                </small>
              </span>
              {!item.read && (
                <button
                  className="hub-icon-button cp-note-read"
                  disabled={read.one.isPending}
                  onClick={() => read.one.mutate(item.id)}
                  aria-label={text("Đánh dấu đã đọc", "Mark as read")}
                  title={text("Đánh dấu đã đọc", "Mark as read")}
                >
                  <StreamIcon name="check" size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <InfiniteScroll
        query={inbox}
        label={text("Đang tải thêm thông báo", "Loading more notifications")}
        retryLabel={text("Tải lại phần tiếp theo", "Load the next part again")}
      />
    </section>
  )
}

function ManagedPages() {
  const { text } = useStreamLocale()
  const session = useCommunitySession()
  const managed = useQuery({
    queryKey: communityKeys.managedPages(session.revision),
    queryFn: () => communityApi.managedPages(),
  })
  const claims = useQuery({
    queryKey: communityKeys.claims(session.revision),
    queryFn: () => communityApi.claims(),
  })
  return (
    <div className="cp-section-pair">
      <section className="cp-section" aria-labelledby="account-managed">
        <div className="tn-heading" data-flush="">
          <h2 id="account-managed">{text("Trang bạn quản lý", "Pages you manage")}</h2>
        </div>
        {managed.isPending && (
          <div
            className="hub-skeleton-rows"
            role="status"
            aria-label={text("Đang tải trang quản lý", "Loading the pages you manage")}
          />
        )}
        {managed.isError && <p className="cp-error">{managed.error.message}</p>}
        {managed.data &&
          (managed.data.length ? (
            <ul className="cp-rows">
              {managed.data.map((profile) => (
                <li key={profile.id}>
                  <Link className="cp-row cp-row-link" to={`/manage/${profile.id}`}>
                    <Avatar profile={profile} className="cp-row-avatar" />
                    <span className="cp-row-text">
                      <strong>{profile.content?.name || profile.code}</strong>
                      <small>{text(profileKindLabels[profile.kind], profileKindEnglish[profile.kind])}</small>
                    </span>
                    <span className="cp-row-go">
                      {text("Quản lý", "Manage")}
                      <StreamIcon name="chevronRight" size={16} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="cp-section-lead">
              {text(
                "Bạn chưa quản lý trang nào. Mở trang của đội hoặc tuyển thủ bạn đại diện và gửi yêu cầu quản lý từ nút ⋯.",
                "You do not manage any pages yet. Open the page of the team or player you represent and send a management request from the ⋯ button.",
              )}
            </p>
          ))}
      </section>
      <section className="cp-section" aria-labelledby="account-claims">
        <div className="tn-heading" data-flush="">
          <h2 id="account-claims">{text("Yêu cầu đại diện", "Representation requests")}</h2>
        </div>
        {claims.isPending && (
          <div className="hub-skeleton-rows" role="status" aria-label={text("Đang tải yêu cầu", "Loading requests")} />
        )}
        {claims.isError && <p className="cp-error">{claims.error.message}</p>}
        {claims.data &&
          (claims.data.length ? (
            <ul className="cp-rows">
              {claims.data.map((claim) => (
                <li key={claim.id} className="cp-row">
                  <span className="cp-row-text">
                    <Link to={`/pages/${claim.pageId}`}>
                      <strong>{claim.pageName}</strong>
                    </Link>
                    {claim.resolution && <small>{claim.resolution}</small>}
                  </span>
                  <span className="cp-badge" data-status={claim.status}>
                    {text(...claimLabels[claim.status])}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="cp-section-lead">
              {text("Bạn chưa gửi yêu cầu nào.", "You have not sent any requests yet.")}
            </p>
          ))}
      </section>
    </div>
  )
}

/** What an account gives a visitor, with the two ways in. The one prompt of the account screens. */
export function SignInPrompt({ title }: { title?: string }) {
  const { text } = useStreamLocale()
  const [error, setError] = useState("")
  return (
    <section className="cp-signin" aria-labelledby="signin-title">
      <h2 id="signin-title">{title ?? text("Đăng nhập để tham gia cộng đồng", "Sign in to join the community")}</h2>
      <SignInBenefits />
      <div className="cp-signin-actions">
        <button className="cp-button cp-primary" onClick={() => openSignIn(false, setError)}>
          {text("Đăng nhập", "Sign in")}
        </button>
        <button className="cp-button" onClick={() => openSignIn(true, setError)}>
          {text("Tạo tài khoản", "Create account")}
        </button>
      </div>
      {error && (
        <p className="cp-field-error" role="alert">
          {error}
        </p>
      )}
      <p className="cp-signin-note">
        {text(
          "Đăng nhập qua trang tài khoản AOV; AOV Stream không lưu mật khẩu.",
          "Sign in through the AOV account page; AOV Stream does not store passwords.",
        )}
      </p>
    </section>
  )
}

export function CommunityPageManager() {
  const { text } = useStreamLocale()
  const { id = "" } = useParams()
  const session = useCommunitySession()
  const enabled = session.status === "authenticated"
  const profile = useQuery({
    queryKey: communityKeys.managedPage(session.revision, id),
    queryFn: () => communityApi.managedPage(id),
    enabled,
  })
  const viewer = useQuery({
    queryKey: communityKeys.viewer(session.revision, id),
    queryFn: () => communityApi.viewer(id),
    enabled,
  })
  return (
    <StreamShell>
      <div className="cp-container">
        {session.status === "loading" ? (
          <ManagerSkeleton />
        ) : !enabled ? (
          <>
            <title>{text("Quản lý trang — AOV Stream", "Manage page — AOV Stream")}</title>
            <header className="tn-page-head">
              <div>
                <h1>{text("Quản lý trang", "Manage page")}</h1>
                <p>
                  {text(
                    "Người đại diện cập nhật giới thiệu, đăng bài và mời người cùng quản lý trang.",
                    "Representatives update the introduction, post and invite others to manage the page.",
                  )}
                </p>
              </div>
            </header>
            <SignInPrompt title={text("Đăng nhập để quản lý trang", "Sign in to manage the page")} />
          </>
        ) : profile.isError || viewer.isError ? (
          <p className="cp-error" role="alert">
            {profile.error?.message || viewer.error?.message}
          </p>
        ) : !profile.data || !viewer.data ? (
          <ManagerSkeleton />
        ) : !viewer.data.role ? (
          <div className="hub-state">
            <h2>{text("Bạn chưa có quyền quản lý trang này.", "You are not allowed to manage this page yet.")}</h2>
            <p>
              {text(
                "Trang bạn quản lý được liệt kê trong tài khoản, mục “Trang và yêu cầu”.",
                "The pages you manage are listed in your account, under “Pages and requests”.",
              )}
            </p>
            <div className="hub-state-actions">
              <Link className="cp-button" to="/account?tab=pages">
                {text("Về Trang & yêu cầu", "Back to Pages & requests")}
              </Link>
            </div>
          </div>
        ) : (
          <Manager key={`${id}:${viewer.data.version}`} profile={profile.data} viewer={viewer.data} />
        )}
      </div>
    </StreamShell>
  )
}

function ManagerSkeleton() {
  const { text } = useStreamLocale()
  return (
    <div className="cp-manage-skeleton" role="status" aria-label={text("Đang tải trang", "Loading page")}>
      <span className="hub-skeleton" />
      <span className="hub-skeleton" />
      <div className="hub-skeleton-rows" />
    </div>
  )
}

type ProfileLink = ProfilePresentation["links"][number]

type ManagerTab = "presentation" | "posts" | "members"
const managerTabs: [ManagerTab, readonly [string, string]][] = [
  ["presentation", ["Giới thiệu", "About"]],
  ["posts", ["Bài viết", "Posts"]],
  ["members", ["Người quản lý", "Managers"]],
]

function Manager({ profile, viewer }: { profile: CommunityProfile; viewer: PageViewer }) {
  const { text } = useStreamLocale()
  const [tab, setTab] = useState<ManagerTab>("presentation")
  const name = profile.content?.name || profile.code
  return (
    <>
      <title>{text(`Quản lý ${name} — AOV Stream`, `Manage ${name} — AOV Stream`)}</title>
      <Link className="cp-back" to="/account?tab=pages">
        <StreamIcon name="back" size={16} />
        {text("Trang bạn quản lý", "Pages you manage")}
      </Link>
      <header className="tn-page-head cp-manage-head">
        <div className="cp-manage-identity">
          <Avatar profile={profile} />
          <div>
            <h1>{name}</h1>
            <p>
              {text(profileKindLabels[profile.kind], profileKindEnglish[profile.kind])} · {text("bạn là", "your role:")}{" "}
              {viewer.role ? text(...roleLabels[viewer.role]).toLowerCase() : ""}
            </p>
          </div>
        </div>
        <Link
          className="cp-button cp-manage-public"
          to={`/pages/${profile.code}`}
          aria-label={text("Xem trang công khai", "View public page")}
        >
          <span>{text("Xem trang công khai", "View public page")}</span>
          <StreamIcon name="arrow" size={15} />
        </Link>
      </header>
      <nav className="cp-tabs" aria-label={text("Mục quản lý", "Management sections")}>
        {managerTabs.map(([value, label]) => (
          <button key={value} aria-current={tab === value ? "page" : undefined} onClick={() => setTab(value)}>
            {text(...label)}
          </button>
        ))}
      </nav>
      {tab === "presentation" && <PresentationForm profile={profile} viewer={viewer} />}
      {tab === "posts" && (
        <section className="cp-section" aria-labelledby="manage-posts">
          <div className="tn-heading" data-flush="">
            <h2 id="manage-posts">{text("Bài viết của trang", "The page's posts")}</h2>
          </div>
          <CommunityFeed
            pageId={profile.id}
            pageName={name}
            role={viewer.role}
            represented={profile.represented}
            manage
          />
        </section>
      )}
      {tab === "members" && <Members profile={profile} viewer={viewer} />}
    </>
  )
}

function useManagerRefresh() {
  const client = useQueryClient()
  return async () => {
    await client.invalidateQueries({ queryKey: communityKeys.viewerAll })
    await client.invalidateQueries({ queryKey: communityKeys.publicPageAll })
    await client.invalidateQueries({ queryKey: communityKeys.managedPageAll })
    await client.invalidateQueries({ queryKey: communityKeys.memberAll })
  }
}

function PresentationForm({ profile, viewer }: { profile: CommunityProfile; viewer: PageViewer }) {
  const { text } = useStreamLocale()
  const refresh = useManagerRefresh()
  const [presentation, setPresentation] = useState<ProfilePresentation>({
    biography: profile.content?.biography,
    avatarUrl: profile.content?.avatarUrl,
    coverUrl: profile.content?.coverUrl,
    links: profile.content?.links || [],
  })
  const save = useMutation({
    mutationFn: () => communityApi.savePresentation(profile.id, { version: viewer.version, content: presentation }),
    onSuccess: refresh,
  })
  const readOnly = viewer.role === "MODERATOR"
  const setLink = (index: number, change: (link: ProfileLink) => ProfileLink) =>
    setPresentation({
      ...presentation,
      links: presentation.links.map((item, position) => (position === index ? change(item) : item)),
    })
  return (
    <form
      className="cp-section"
      aria-labelledby="manage-presentation"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate()
      }}
    >
      <div className="tn-heading" data-flush="">
        <h2 id="manage-presentation">{text("Giới thiệu trang", "Page introduction")}</h2>
      </div>
      <p className="cp-section-lead">
        {readOnly
          ? text(
              "Kiểm duyệt viên xem được phần này; quản trị chính và biên tập viên mới sửa được.",
              "Moderators can see this part; only the main administrator and editors can change it.",
            )
          : text(
              "Lịch sử và kết quả thi đấu được biên tập riêng; bạn có thể đề xuất chỉnh sửa từ trang công khai.",
              "History and competition results are edited separately; you can suggest edits from the public page.",
            )}
      </p>
      <fieldset disabled={readOnly || save.isPending}>
        <label>
          {text("Giới thiệu", "Introduction")}
          <textarea
            rows={6}
            maxLength={10000}
            value={presentation.biography || ""}
            onChange={(event) => setPresentation({ ...presentation, biography: event.target.value })}
          />
        </label>
        <div className="cp-field-pair">
          <label>
            {text("Ảnh đại diện", "Avatar")}
            <input
              type="url"
              placeholder="https://…"
              value={presentation.avatarUrl || ""}
              onChange={(event) => setPresentation({ ...presentation, avatarUrl: event.target.value })}
            />
            <ImageLinkPreview url={presentation.avatarUrl} />
          </label>
          <label>
            {text("Ảnh bìa", "Cover image")}
            <input
              type="url"
              placeholder="https://…"
              value={presentation.coverUrl || ""}
              onChange={(event) => setPresentation({ ...presentation, coverUrl: event.target.value })}
            />
            <ImageLinkPreview url={presentation.coverUrl} wide />
          </label>
        </div>
        <h3 className="cp-subheading">{text("Kênh liên hệ", "Contact channels")}</h3>
        <datalist id="cp-channel-names">
          {SOCIAL_PLATFORM_NAMES.map((platform) => (
            <option key={platform} value={platform} />
          ))}
        </datalist>
        {!presentation.links.length && (
          <p className="cp-section-lead">
            {text("Trang chưa có kênh liên hệ nào.", "The page has no contact channel yet.")}
          </p>
        )}
        {presentation.links.map((link, index) => (
          <div className="cp-link-field" key={index}>
            <label>
              <span className="cp-link-label">{text("Đường dẫn", "Link")}</span>
              <input
                type="url"
                required
                placeholder="https://…"
                value={link.url}
                onChange={(event) =>
                  setLink(index, (item) => ({
                    ...item,
                    url: event.target.value,
                    // The name follows the link until someone writes their own.
                    label:
                      !item.label || item.label === socialPlatformName(item.url)
                        ? (socialPlatformName(event.target.value) ?? item.label)
                        : item.label,
                  }))
                }
              />
            </label>
            <label>
              <span className="cp-link-label">
                {link.url && <SocialPlatformIcon url={link.url} size={15} />}
                {text("Tên kênh", "Channel name")}
              </span>
              <input
                required
                list="cp-channel-names"
                placeholder={text("Tự điền theo đường dẫn", "Auto-filled from the link")}
                value={link.label}
                onChange={(event) => setLink(index, (item) => ({ ...item, label: event.target.value }))}
              />
            </label>
            <button
              type="button"
              className="hub-icon-button cp-link-remove"
              aria-label={text(
                `Gỡ kênh ${link.label || link.url || index + 1}`,
                `Remove channel ${link.label || link.url || index + 1}`,
              )}
              title={text("Gỡ kênh", "Remove channel")}
              onClick={() =>
                setPresentation({
                  ...presentation,
                  links: presentation.links.filter((_, position) => position !== index),
                })
              }
            >
              <StreamIcon name="close" size={16} />
            </button>
          </div>
        ))}
        {!readOnly && (
          <button
            type="button"
            className="cp-button cp-quiet cp-link-add"
            onClick={() => setPresentation({ ...presentation, links: [...presentation.links, { label: "", url: "" }] })}
          >
            <StreamIcon name="plus" size={15} />
            {text("Thêm kênh", "Add channel")}
          </button>
        )}
      </fieldset>
      {save.isError && (
        <p className="cp-field-error" role="alert">
          {save.error.message}
        </p>
      )}
      {!readOnly && (
        <div className="cp-form-actions">
          <button className="cp-button cp-primary" disabled={save.isPending}>
            {save.isPending ? text("Đang lưu…", "Saving…") : text("Lưu giới thiệu", "Save introduction")}
          </button>
        </div>
      )}
    </form>
  )
}

function Members({ profile, viewer }: { profile: CommunityProfile; viewer: PageViewer }) {
  const { text } = useStreamLocale()
  const session = useCommunitySession()
  const refresh = useManagerRefresh()
  const [inviteRole, setInviteRole] = useState("EDITOR")
  const [invitation, setInvitation] = useState("")
  const [copied, setCopied] = useState(false)
  const [confirmation, setConfirmation] = useState<{ id: string; action: "revoke" | "transfer" } | null>(null)
  const members = useQuery({
    queryKey: communityKeys.members(session.revision, profile.id),
    queryFn: () => communityApi.members(profile.id),
  })
  const invite = useMutation({
    mutationFn: () => communityApi.invite(profile.id, inviteRole),
    onSuccess: (value) => {
      setCopied(false)
      setInvitation(`${location.origin}${import.meta.env.BASE_URL}invitations#${value.token}`)
    },
  })
  const membership = useMutation({
    mutationFn: () => communityApi.changeMember(profile.id, confirmation!.id, confirmation!.action),
    onSuccess: async () => {
      setConfirmation(null)
      await refresh()
    },
  })
  const owner = viewer.role === "OWNER"
  const copy = () =>
    void navigator.clipboard
      ?.writeText(invitation)
      .then(() => setCopied(true))
      .catch(() => setCopied(false))
  return (
    <section className="cp-section" aria-labelledby="manage-members">
      <div className="tn-heading" data-flush="">
        <h2 id="manage-members">
          {text("Người quản lý", "Managers")} {!!members.data?.length && <small>{members.data.length}</small>}
        </h2>
      </div>
      <p className="cp-section-lead">
        {text(
          "Biên tập viên đăng bài dưới tên trang; kiểm duyệt viên ẩn nội dung vi phạm. Chỉ quản trị chính mời và thu hồi.",
          "Editors post under the page's name; moderators hide content that breaks the rules. Only the main admin invites and removes people.",
        )}
      </p>
      {members.isPending && (
        <div
          className="hub-skeleton-rows"
          role="status"
          aria-label={text("Đang tải người quản lý", "Loading managers")}
        />
      )}
      {members.isError && <p className="cp-error">{members.error.message}</p>}
      {!!members.data?.length && (
        <ul className="cp-rows">
          {members.data.map((member) => (
            <li key={member.id}>
              <div className="cp-row">
                <span
                  className="cp-row-avatar cp-initial"
                  style={{ "--hub-hue": hueOf(member.name) } as CSSProperties}
                  aria-hidden="true"
                >
                  {initials(member.name)}
                </span>
                <span className="cp-row-text">
                  <strong>
                    {member.name}
                    {member.self && text(" (bạn)", " (you)")}
                  </strong>
                  <small>{text(...roleLabels[member.role])}</small>
                </span>
                {owner && !member.self && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="hub-icon-button cp-more"
                        aria-label={text(`Thao tác với ${member.name}`, `Actions for ${member.name}`)}
                      >
                        <StreamIcon name="more" size={18} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="hub-popover hub-post-menu" drawerTitle={member.name}>
                      <DropdownMenuItem
                        className="hub-menu-item"
                        onSelect={() => setConfirmation({ id: member.id, action: "transfer" })}
                      >
                        <StreamIcon name="shield" size={16} />
                        {text("Chuyển quyền chính", "Transfer ownership")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="hub-menu-item"
                        variant="destructive"
                        onSelect={() => setConfirmation({ id: member.id, action: "revoke" })}
                      >
                        <StreamIcon name="close" size={16} />
                        {text("Thu hồi quyền", "Revoke access")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              {confirmation?.id === member.id && (
                <div
                  className="cp-confirm"
                  role="group"
                  aria-label={text("Xác nhận thay đổi quyền", "Confirm the role change")}
                >
                  <p>
                    {confirmation.action === "transfer"
                      ? text(
                          `${member.name} sẽ trở thành quản trị chính; bạn chuyển thành biên tập viên. Các lời mời cũ hết hiệu lực.`,
                          `${member.name} will become the owner; you will become an editor. Old invitations will no longer be valid.`,
                        )
                      : text(
                          `${member.name} sẽ mất quyền quản lý trang này.`,
                          `${member.name} will lose management access to this page.`,
                        )}
                  </p>
                  <div className="cp-actions">
                    <button
                      className={confirmation.action === "revoke" ? "cp-button cp-danger" : "cp-button cp-primary"}
                      disabled={membership.isPending}
                      onClick={() => membership.mutate()}
                    >
                      {confirmation.action === "revoke"
                        ? text("Thu hồi quyền", "Revoke access")
                        : text("Chuyển quyền chính", "Transfer ownership")}
                    </button>
                    <button className="cp-button cp-quiet" onClick={() => setConfirmation(null)}>
                      {text("Hủy", "Cancel")}
                    </button>
                  </div>
                  {membership.isError && (
                    <p className="cp-field-error" role="alert">
                      {membership.error.message}
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {owner && (
        <div className="cp-invite">
          <h3 className="cp-subheading">{text("Mời người quản lý", "Invite a manager")}</h3>
          <p className="cp-section-lead">
            {text(
              "Tạo một liên kết dùng một lần, có hiệu lực 7 ngày, rồi gửi riêng cho người bạn muốn cấp quyền.",
              "Create a single-use link, valid for 7 days, then send it privately to the person you want to grant access to.",
            )}
          </p>
          <div className="cp-invite-row">
            <label className="cp-invite-role">
              {text("Quyền", "Role")}
              <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>
                <option value="EDITOR">{text("Biên tập viên", "Editor")}</option>
                <option value="MODERATOR">{text("Kiểm duyệt viên", "Moderator")}</option>
              </select>
            </label>
            <button className="cp-button cp-primary" disabled={invite.isPending} onClick={() => invite.mutate()}>
              {text("Tạo liên kết mời", "Create invitation link")}
            </button>
          </div>
          {invite.isError && (
            <p className="cp-field-error" role="alert">
              {invite.error.message}
            </p>
          )}
          {invitation && (
            <div className="cp-invite-row">
              <label>
                {text("Liên kết mời", "Invitation link")}
                <input readOnly value={invitation} onFocus={(event) => event.target.select()} />
              </label>
              <button type="button" className="cp-button" onClick={copy}>
                <StreamIcon name={copied ? "check" : "link"} size={15} />
                {copied ? text("Đã sao chép", "Copied") : text("Sao chép", "Copy")}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export function CommunityInvitation() {
  const { text } = useStreamLocale()
  const session = useCommunitySession()
  const navigate = useNavigate()
  const [token] = useState(() => location.hash.slice(1))
  const accept = useMutation({
    mutationFn: () => communityApi.acceptInvitation(token),
    onSuccess: (result) => navigate(`/manage/${result.pageId}`, { replace: true }),
  })
  return (
    <StreamShell>
      <title>{text("Lời mời quản lý trang — AOV Stream", "Invitation to manage a page — AOV Stream")}</title>
      <div className="cp-container">
        <header className="tn-page-head">
          <div>
            <h1>{text("Lời mời quản lý trang", "Invitation to manage a page")}</h1>
            <p>
              {text(
                "Người quản trị chính của một trang mời bạn cùng quản lý trang đó.",
                "The main admin of a page invites you to manage it with them.",
              )}
            </p>
          </div>
        </header>
        {session.status === "loading" ? (
          <div className="hub-skeleton-rows" role="status" aria-label={text("Đang tải", "Loading")} />
        ) : session.status !== "authenticated" ? (
          <SignInPrompt title={text("Đăng nhập để nhận lời mời", "Sign in to accept the invitation")} />
        ) : !token ? (
          <section className="cp-signin" aria-labelledby="invitation-title">
            <h2 id="invitation-title">{text("Liên kết mời chưa đầy đủ", "The invitation link is incomplete")}</h2>
            <p className="cp-section-lead">
              {text(
                "Liên kết thiếu mã mời. Hãy mở lại đúng liên kết bạn nhận được, hoặc xin người quản trị chính tạo liên kết mới.",
                "The link has no invitation code. Open the exact link you received again, or ask the main admin for a new one.",
              )}
            </p>
          </section>
        ) : (
          <section className="cp-signin" aria-labelledby="invitation-title">
            <h2 id="invitation-title">{text("Nhận quyền quản lý", "Accept the invitation")}</h2>
            <p className="cp-section-lead">
              {text(
                "Chấp nhận để liên kết quyền quản lý với tài khoản",
                "Accept to link management access to the account",
              )}{" "}
              <strong>{session.name}</strong>.{" "}
              {text("Liên kết chỉ dùng được một lần.", "The link can be used only once.")}
            </p>
            <div className="cp-signin-actions">
              <button className="cp-button cp-primary" disabled={accept.isPending} onClick={() => accept.mutate()}>
                {accept.isPending
                  ? text("Đang chấp nhận…", "Accepting…")
                  : text("Chấp nhận lời mời", "Accept invitation")}
              </button>
            </div>
            {accept.isError && (
              <p className="cp-field-error" role="alert">
                {accept.error.message}
              </p>
            )}
          </section>
        )}
      </div>
    </StreamShell>
  )
}

/** Shows what an image link points to, so a wrong link is noticed before saving. */
function ImageLinkPreview({ url, wide = false }: { url?: string | null; wide?: boolean }) {
  const { text } = useStreamLocale()
  const [failed, setFailed] = useState<string | null>(null)
  const value = url?.trim()
  if (!value || !/^https?:\/\//i.test(value)) return null
  if (failed === value)
    return (
      <span className="cp-field-error">
        {text("Không xem trước được ảnh từ liên kết này.", "The image from this link could not be previewed.")}
      </span>
    )
  return (
    <img
      className={wide ? "cp-image-preview cp-image-preview-wide" : "cp-image-preview"}
      src={value}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailed(value)}
    />
  )
}
