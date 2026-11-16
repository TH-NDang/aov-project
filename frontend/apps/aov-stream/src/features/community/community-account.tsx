import { useState, type CSSProperties } from "react"
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
import { StreamShell } from "../../components/stream-shell"
import { StreamBrand } from "../../components/stream-brand"
import { StreamIcon } from "../../components/stream-icon"
import { useStreamLocale } from "../../components/stream-locale"
import { communityApi } from "./community-api"
import { signIn, useCommunitySession } from "./community-auth"
import { CommunityFeed } from "./community-feed"
import {
  useFollowedPages,
  useFollowPage,
  useNotificationInbox,
  useReadNotifications,
  useUnreadCount,
} from "./community-queries"
import { SOCIAL_PLATFORM_NAMES, SocialPlatformIcon, socialPlatformName } from "@aov/ui/components/social-platform-icon"
import { Avatar, followersLabel, hueOf } from "./community-ui"

const accountTabIcons = {
  profile: "user",
  settings: "sliders",
  follows: "heart",
  notifications: "bell",
  pages: "building",
} as const
import { AccountAvatar, AccountProfile } from "../account/account-profile"
import { AccountSettings } from "../account/account-settings"
import { useOwnProfile } from "../account/profile-api"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"

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
  const ownProfile = useOwnProfile()
  const [params, setParams] = useSearchParams()
  const requested = params.get("tab") as AccountTab | null
  const tab = accountTabs.some(([value]) => value === requested) ? requested! : "profile"
  const enabled = session.status === "authenticated"
  const unread = useUnreadCount()
  return (
    <StreamShell>
      <title>{text("Tài khoản — AOV Stream", "Account — AOV Stream")}</title>
      <div className="cp-container">
        <header className="hub-card cp-page-header">
          <div className="hub-banner hub-art cp-account-banner" style={{ "--hub-hue": 232 } as CSSProperties}>
            {enabled ? (
              <AccountAvatar
                url={ownProfile.data?.avatarUrl}
                name={ownProfile.data?.displayName || session.name}
                large
              />
            ) : (
              <span className="hub-banner-mark" aria-hidden="true">
                <StreamBrand compact />
              </span>
            )}
            <div className="hub-banner-copy">
              <span className="hub-kicker">{text("Tài khoản", "Account")}</span>
              <h1>
                {enabled
                  ? ownProfile.data?.displayName || session.name
                  : text("Tham gia cộng đồng", "Join the community")}
              </h1>
              <p>
                {text(
                  "Chỉnh sửa hồ sơ, theo dõi các trang bạn quan tâm và quản lý hoạt động của mình.",
                  "Edit your profile, follow the pages you care about and manage your activity.",
                )}
              </p>
            </div>
          </div>
          {enabled && (
            <nav className="cp-tabs cp-header-tabs" aria-label={text("Mục tài khoản", "Account sections")}>
              {accountTabs.map(([value, label]) => (
                <button
                  key={value}
                  aria-current={tab === value ? "page" : undefined}
                  onClick={() => setParams(value === "profile" ? {} : { tab: value })}
                >
                  <StreamIcon name={accountTabIcons[value as keyof typeof accountTabIcons] ?? "user"} size={15} />
                  {text(...label)}
                  {value === "notifications" && !!unread.data?.unread && (
                    <span className="cp-tab-count">{unread.data.unread}</span>
                  )}
                </button>
              ))}
            </nav>
          )}
        </header>
        {!enabled ? (
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
  const { text } = useStreamLocale()
  const follows = useFollowedPages()
  const follow = useFollowPage()
  return (
    <section className="cp-panel">
      <h2>{text("Trang đang theo dõi", "Pages you follow")}</h2>
      <p className="cp-muted">
        {text(
          'Bài mới từ các trang này xuất hiện ở mục "Đang theo dõi" của cộng đồng.',
          'New posts from these pages appear in the "Following" section of the community.',
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
      {follows.data && !follows.data.items.length && (
        <div className="hub-state">
          <StreamIcon name="heart" size={28} />
          <h3>{text("Bạn chưa theo dõi trang nào", "You are not following any pages yet")}</h3>
          <Link className="cp-button cp-primary" to="/explore">
            {text("Khám phá trang", "Explore pages")}
          </Link>
        </div>
      )}
      {follows.data?.items.map((profile) => (
        <div className="cp-list-row cp-link-row" key={profile.id}>
          <Avatar profile={profile} className="cp-row-avatar" />
          <Link to={`/pages/${profile.code}`} className="cp-row-title">
            <strong>{profile.content?.name || profile.code}</strong>
            <span className="cp-meta">
              {profileKindLabels[profile.kind]} · {followersLabel(profile.followers)}
            </span>
          </Link>
          <button
            className="cp-follow-chip"
            disabled={follow.isPending}
            onClick={() => follow.mutate({ pageId: profile.id, following: false })}
          >
            {text("Bỏ theo dõi", "Unfollow")}
          </button>
        </div>
      ))}
      {follow.isError && <p className="cp-error">{follow.error.message}</p>}
    </section>
  )
}

function NotificationInbox() {
  const { text, languageTag } = useStreamLocale()
  const inbox = useNotificationInbox(24)
  const notifications = inbox.data?.pages.flatMap((page) => page.items) ?? []
  const unread = useUnreadCount()
  const read = useReadNotifications()
  return (
    <section className="cp-panel" id="notifications">
      <div className="cp-panel-heading">
        <h2>{text("Thông báo", "Notifications")}</h2>
        <button
          className="cp-text-button"
          disabled={!unread.data?.unread || read.all.isPending}
          onClick={() => read.all.mutate()}
        >
          <StreamIcon name="check" size={14} />
          {text("Đánh dấu đã đọc tất cả", "Mark all as read")}
        </button>
      </div>
      {inbox.isLoadingError && <p className="cp-error">{inbox.error.message}</p>}
      {inbox.data && !notifications.length && (
        <p className="cp-muted">{text("Thông báo mới sẽ xuất hiện tại đây.", "New notifications will appear here.")}</p>
      )}
      {notifications.map((item) => (
        <article className="cp-notification" data-unread={!item.read || undefined} key={item.id}>
          <Link to={`/pages/${item.pageId}`} onClick={() => !item.read && read.one.mutate(item.id)}>
            {item.message}
          </Link>
          <small>
            <LocalTime value={item.createdAt} locale={languageTag} />
          </small>
          {!item.read && (
            <button className="cp-text-button" disabled={read.one.isPending} onClick={() => read.one.mutate(item.id)}>
              {text("Đánh dấu đã đọc", "Mark as read")}
            </button>
          )}
        </article>
      ))}
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
    queryKey: ["managed-pages", session.revision],
    queryFn: () => communityApi<CommunityProfile[]>("/me/pages"),
  })
  const claims = useQuery({
    queryKey: ["my-claims", session.revision],
    queryFn: () => communityApi<PageClaim[]>("/me/claims"),
  })
  return (
    <div className="cp-columns cp-columns-even">
      <section className="cp-panel">
        <h2>{text("Trang bạn quản lý", "Pages you manage")}</h2>
        {managed.isError && <p className="cp-error">{managed.error.message}</p>}
        {managed.data?.length ? (
          managed.data.map((profile) => (
            <Link className="cp-list-row cp-link-row" key={profile.id} to={`/manage/${profile.id}`}>
              <span
                className="cp-row-mark"
                style={{ "--hub-hue": hueOf(profile.content?.name || profile.code) } as CSSProperties}
                aria-hidden="true"
              >
                {(profile.content?.name || profile.code).slice(0, 1).toUpperCase()}
              </span>
              <strong>{profile.content?.name || profile.code}</strong>
              <span className="cp-row-action">
                {text("Quản lý", "Manage")}
                <StreamIcon name="chevronRight" size={16} />
              </span>
            </Link>
          ))
        ) : (
          <p className="cp-muted">
            {text(
              "Bạn chưa quản lý trang nào. Mở trang của mình và gửi yêu cầu nhận quyền đại diện.",
              "You do not manage any pages yet. Open your page and send a request to represent it.",
            )}
          </p>
        )}
      </section>
      <section className="cp-panel">
        <h2>{text("Yêu cầu đại diện của bạn", "Your representation requests")}</h2>
        {claims.isError && <p className="cp-error">{claims.error.message}</p>}
        {claims.data?.length ? (
          claims.data.map((claim) => (
            <article className="cp-list-row" key={claim.id}>
              <div>
                <Link to={`/pages/${claim.pageId}`}>
                  <strong>{claim.pageName}</strong>
                </Link>
                {claim.resolution && <p className="cp-meta">{claim.resolution}</p>}
              </div>
              <span className="cp-badge" data-status={claim.status}>
                {text(...claimLabels[claim.status])}
              </span>
            </article>
          ))
        ) : (
          <p className="cp-muted">{text("Chưa có yêu cầu.", "No requests yet.")}</p>
        )}
      </section>
    </div>
  )
}

export function SignInPrompt() {
  const { text } = useStreamLocale()
  return (
    <div className="hub-state cp-signin">
      <StreamBrand compact />
      <h2>{text("Một tài khoản cho cộng đồng của bạn", "One account for your community")}</h2>
      <p>
        {text(
          "Đăng nhập để theo dõi, thảo luận và quản lý trang được ủy quyền.",
          "Sign in to follow, discuss and manage the pages you are authorized for.",
        )}
      </p>
      <ul className="cp-benefits">
        <li>
          <StreamIcon name="heart" size={16} />
          {text("Theo dõi đội tuyển, thích bài viết", "Follow teams, like posts")}
        </li>
        <li>
          <StreamIcon name="message" size={16} />
          {text("Bình luận và thảo luận", "Comment and discuss")}
        </li>
        <li>
          <StreamIcon name="shield" size={16} />
          {text("Quản lý trang được ủy quyền", "Manage the pages you are authorized for")}
        </li>
      </ul>
      <div className="cp-actions">
        <button className="cp-button cp-primary" onClick={() => void signIn()}>
          {text("Đăng nhập", "Sign in")}
        </button>
        <button className="cp-button" onClick={() => void signIn(true)}>
          {text("Tạo tài khoản", "Create account")}
        </button>
      </div>
    </div>
  )
}

export function CommunityPageManager() {
  const { text } = useStreamLocale()
  const { id = "" } = useParams()
  const session = useCommunitySession()
  const enabled = session.status === "authenticated"
  const profile = useQuery({
    queryKey: ["managed-page", session.revision, id],
    queryFn: () => communityApi<CommunityProfile>(`/me/pages/${id}/profile`),
    enabled,
  })
  const viewer = useQuery({
    queryKey: ["page-viewer", session.revision, id],
    queryFn: () => communityApi<PageViewer>(`/me/pages/${id}`),
    enabled,
  })
  return (
    <StreamShell>
      <div className="cp-container">
        {!enabled ? (
          <SignInPrompt />
        ) : profile.isError || viewer.isError ? (
          <p className="cp-error" role="alert">
            {profile.error?.message || viewer.error?.message}
          </p>
        ) : !profile.data || !viewer.data ? (
          <div
            className="hub-skeleton cp-header-skeleton"
            role="status"
            aria-label={text("Đang tải trang", "Loading page")}
          />
        ) : !viewer.data.role ? (
          <div className="hub-state">
            <StreamIcon name="shield" size={28} />
            <h2>{text("Bạn chưa có quyền quản lý trang này.", "You are not allowed to manage this page yet.")}</h2>
            <Link className="cp-button" to="/account">
              {text("Về tài khoản", "Back to account")}
            </Link>
          </div>
        ) : (
          <Manager key={`${id}:${viewer.data.version}`} profile={profile.data} viewer={viewer.data} />
        )}
      </div>
    </StreamShell>
  )
}
function Manager({ profile, viewer }: { profile: CommunityProfile; viewer: PageViewer }) {
  const { text } = useStreamLocale()
  const session = useCommunitySession()
  const client = useQueryClient()
  const [tab, setTab] = useState("presentation")
  const [presentation, setPresentation] = useState<ProfilePresentation>({
    biography: profile.content?.biography,
    avatarUrl: profile.content?.avatarUrl,
    coverUrl: profile.content?.coverUrl,
    links: profile.content?.links || [],
  })
  const [inviteRole, setInviteRole] = useState("EDITOR")
  const [invitation, setInvitation] = useState("")
  const [confirmation, setConfirmation] = useState<{ id: string; action: "revoke" | "transfer" } | null>(null)
  const members = useQuery({
    queryKey: ["page-members", session.revision, profile.id],
    queryFn: () => communityApi<PageManager[]>(`/me/pages/${profile.id}/members`),
  })
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["page-viewer"] })
    await client.invalidateQueries({ queryKey: ["public-page"] })
    await client.invalidateQueries({ queryKey: ["managed-page"] })
    await client.invalidateQueries({ queryKey: ["page-members"] })
  }
  const save = useMutation({
    mutationFn: () =>
      communityApi(`/me/pages/${profile.id}/presentation`, { version: viewer.version, content: presentation }, "PUT"),
    onSuccess: refresh,
  })
  const invite = useMutation({
    mutationFn: () => communityApi<{ token: string }>(`/me/pages/${profile.id}/invitations`, { role: inviteRole }),
    onSuccess: (value) => setInvitation(`${location.origin}${import.meta.env.BASE_URL}invitations#${value.token}`),
  })
  const membership = useMutation({
    mutationFn: () => communityApi(`/me/pages/${profile.id}/members/${confirmation!.id}/${confirmation!.action}`, {}),
    onSuccess: async () => {
      setConfirmation(null)
      await refresh()
    },
  })
  return (
    <>
      <title>
        {text(
          `Quản lý ${profile.content?.name || "trang"} — AOV Stream`,
          `Manage ${profile.content?.name || "page"} — AOV Stream`,
        )}
      </title>
      <Link className="cp-back" to={`/pages/${profile.code}`}>
        <StreamIcon name="back" size={16} />
        {text("Xem trang công khai", "View public page")}
      </Link>
      <header className="hub-card cp-page-header">
        <div
          className="hub-banner hub-art cp-manage-banner"
          style={{ "--hub-hue": hueOf(profile.content?.name || profile.code) } as CSSProperties}
        >
          <div className="hub-banner-copy">
            <span className="hub-kicker">{text("Quản lý trang", "Manage page")}</span>
            <h1>{profile.content?.name}</h1>
            <p>
              {text("Đại diện của trang", "Page representative")} ·{" "}
              {viewer.role ? text(...roleLabels[viewer.role]) : ""}
            </p>
          </div>
        </div>
        <nav className="cp-tabs cp-header-tabs" aria-label={text("Mục quản lý", "Management sections")}>
          {[
            ["presentation", text("Giới thiệu", "About")],
            ["posts", text("Bài viết", "Posts")],
            ["members", text("Người quản lý", "Managers")],
          ].map(([value, label]) => (
            <button key={value} aria-current={tab === value ? "page" : undefined} onClick={() => setTab(value!)}>
              {label}
            </button>
          ))}
        </nav>
      </header>
      {tab === "presentation" && (
        <form
          className="cp-panel"
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate()
          }}
        >
          <h2>{text("Thông tin do đại diện cung cấp", "Information provided by the representative")}</h2>
          <p className="cp-muted">
            {text(
              "Lịch sử và kết quả thi đấu được biên tập riêng. Bạn có thể gửi đề xuất chỉnh sửa từ trang công khai.",
              "History and competition results are edited separately. You can send an edit suggestion from the public page.",
            )}
          </p>
          <fieldset disabled={viewer.role === "MODERATOR" || save.isPending}>
            <label>
              {text("Giới thiệu", "Introduction")}
              <textarea
                rows={6}
                maxLength={10000}
                value={presentation.biography || ""}
                onChange={(e) => setPresentation({ ...presentation, biography: e.target.value })}
              />
            </label>
            <div className="cp-form-grid">
              <label>
                {text("Ảnh đại diện", "Avatar")}
                <ImageLinkPreview url={presentation.avatarUrl} />
                <input
                  type="url"
                  placeholder="https://…"
                  value={presentation.avatarUrl || ""}
                  onChange={(e) => setPresentation({ ...presentation, avatarUrl: e.target.value })}
                />
              </label>
              <label>
                {text("Ảnh bìa", "Cover image")}
                <ImageLinkPreview url={presentation.coverUrl} wide />
                <input
                  type="url"
                  placeholder="https://…"
                  value={presentation.coverUrl || ""}
                  onChange={(e) => setPresentation({ ...presentation, coverUrl: e.target.value })}
                />
              </label>
            </div>
            <datalist id="cp-channel-names">
              {SOCIAL_PLATFORM_NAMES.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            {presentation.links.map((link, i) => (
              <div className="cp-form-grid" key={i}>
                <label>
                  {text("Đường dẫn", "Link")}
                  <input
                    type="url"
                    required
                    placeholder="https://…"
                    value={link.url}
                    onChange={(e) =>
                      setPresentation({
                        ...presentation,
                        links: presentation.links.map((item, index) =>
                          i === index
                            ? {
                                ...item,
                                url: e.target.value,
                                // The name follows the link until someone writes their own.
                                label:
                                  !item.label || item.label === socialPlatformName(item.url)
                                    ? (socialPlatformName(e.target.value) ?? item.label)
                                    : item.label,
                              }
                            : item,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  <span className="cp-channel-label">
                    {link.url && <SocialPlatformIcon url={link.url} size={15} />}
                    {text("Tên kênh", "Channel name")}
                  </span>
                  <input
                    required
                    list="cp-channel-names"
                    placeholder={text("Tự điền theo đường dẫn", "Auto-filled from the link")}
                    value={link.label}
                    onChange={(e) =>
                      setPresentation({
                        ...presentation,
                        links: presentation.links.map((item, index) =>
                          i === index ? { ...item, label: e.target.value } : item,
                        ),
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="cp-text-button"
                  onClick={() =>
                    setPresentation({ ...presentation, links: presentation.links.filter((_, index) => index !== i) })
                  }
                >
                  {text("Gỡ kênh", "Remove channel")}
                </button>
              </div>
            ))}
            <div className="cp-actions">
              <button
                type="button"
                className="cp-button"
                onClick={() =>
                  setPresentation({ ...presentation, links: [...presentation.links, { label: "", url: "" }] })
                }
              >
                {text("Thêm kênh", "Add channel")}
              </button>
              <button className="cp-button cp-primary">{text("Lưu giới thiệu", "Save introduction")}</button>
            </div>
          </fieldset>
          {save.isError && (
            <p className="cp-error" role="alert">
              {save.error.message}
            </p>
          )}
        </form>
      )}
      {tab === "posts" && (
        <CommunityFeed
          pageId={profile.id}
          pageName={profile.content!.name}
          role={viewer.role}
          represented={profile.represented}
          manage
        />
      )}
      {tab === "members" && (
        <section className="cp-panel">
          <h2>{text("Người quản lý trang", "Page managers")}</h2>
          {members.isError && <p className="cp-error">{members.error.message}</p>}
          {members.data?.map((member) => (
            <div className="cp-list-row" key={member.id}>
              <div>
                <strong>
                  {member.name}
                  {member.self ? text(" (bạn)", " (you)") : ""}
                </strong>
                <p className="cp-meta">{text(...roleLabels[member.role])}</p>
              </div>
              {viewer.role === "OWNER" && !member.self && (
                <div className="cp-actions">
                  <button className="cp-button" onClick={() => setConfirmation({ id: member.id, action: "revoke" })}>
                    {text("Thu hồi", "Revoke")}
                  </button>
                  <button className="cp-button" onClick={() => setConfirmation({ id: member.id, action: "transfer" })}>
                    {text("Chuyển quyền chính", "Transfer ownership")}
                  </button>
                </div>
              )}
            </div>
          ))}
          {confirmation && (
            <div className="cp-confirm" role="alert">
              <p>
                {confirmation.action === "transfer"
                  ? text(
                      "Người này sẽ trở thành quản trị chính; bạn chuyển thành biên tập viên. Các lời mời cũ sẽ hết hiệu lực.",
                      "This person will become the owner; you will become an editor. Old invitations will no longer be valid.",
                    )
                  : text(
                      "Người này sẽ mất quyền quản lý trang.",
                      "This person will lose management access to the page.",
                    )}
              </p>
              <div className="cp-actions">
                <button
                  className="cp-button cp-primary"
                  disabled={membership.isPending}
                  onClick={() => membership.mutate()}
                >
                  {text("Xác nhận", "Confirm")}
                </button>
                <button className="cp-button" onClick={() => setConfirmation(null)}>
                  {text("Hủy", "Cancel")}
                </button>
              </div>
            </div>
          )}
          {membership.isError && <p className="cp-error">{membership.error.message}</p>}
          {viewer.role === "OWNER" && (
            <div className="cp-invite">
              <h3>{text("Mời người quản lý", "Invite a manager")}</h3>
              <div className="cp-actions">
                <select
                  aria-label={text("Quyền của người được mời", "Role of the invited person")}
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  <option value="EDITOR">{text("Biên tập viên", "Editor")}</option>
                  <option value="MODERATOR">{text("Kiểm duyệt viên", "Moderator")}</option>
                </select>
                <button className="cp-button" disabled={invite.isPending} onClick={() => invite.mutate()}>
                  {text("Tạo liên kết mời", "Create invitation link")}
                </button>
              </div>
              {invite.isError && <p className="cp-error">{invite.error.message}</p>}
              {invitation && (
                <label>
                  {text("Liên kết dùng một lần, có hiệu lực 7 ngày", "Single-use link, valid for 7 days")}
                  <input readOnly value={invitation} onFocus={(e) => e.target.select()} />
                  <span className="cp-meta">
                    {text(
                      "Chỉ gửi liên kết này cho người bạn muốn cấp quyền.",
                      "Only send this link to the person you want to grant access to.",
                    )}
                  </span>
                </label>
              )}
            </div>
          )}
        </section>
      )}
    </>
  )
}
export function CommunityInvitation() {
  const { text } = useStreamLocale()
  const session = useCommunitySession()
  const navigate = useNavigate()
  const [token] = useState(() => location.hash.slice(1))
  const accept = useMutation({
    mutationFn: () => communityApi<{ pageId: string }>("/me/invitations/accept", { token }),
    onSuccess: (result) => navigate(`/manage/${result.pageId}`, { replace: true }),
  })
  return (
    <StreamShell>
      <title>{text("Lời mời quản lý trang — AOV Stream", "Invitation to manage a page — AOV Stream")}</title>
      <div className="cp-container">
        <section className="hub-state cp-invitation">
          <StreamIcon name="shield" size={28} />
          <h1>{text("Lời mời quản lý trang", "Invitation to manage a page")}</h1>
          {session.status !== "authenticated" ? (
            <SignInPrompt />
          ) : (
            <>
              <p>
                {text(
                  `Chấp nhận để liên kết quyền quản lý với tài khoản ${session.name}.`,
                  `Accept to link management access to the account ${session.name}.`,
                )}
              </p>
              <button
                className="cp-button cp-primary"
                disabled={!token || accept.isPending}
                onClick={() => accept.mutate()}
              >
                {text("Chấp nhận lời mời", "Accept invitation")}
              </button>
              {accept.isError && (
                <p className="cp-error" role="alert">
                  {accept.error.message}
                </p>
              )}
            </>
          )}
        </section>
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
      <span className="cp-image-link-error">
        {text("Không xem trước được ảnh từ liên kết này.", "The image from this link could not be previewed.")}
      </span>
    )
  return (
    <img
      className={wide ? "cp-image-link-preview cp-image-link-wide" : "cp-image-link-preview"}
      src={value}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailed(value)}
    />
  )
}
