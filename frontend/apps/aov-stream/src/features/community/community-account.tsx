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

const accountTabIcons = { profile: "user", follows: "heart", notifications: "bell", pages: "building" } as const
import { AccountAvatar, AccountProfile } from "../account/account-profile"
import { useOwnProfile } from "../account/profile-api"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"

const roleLabels = { OWNER: "Quản trị chính", EDITOR: "Biên tập viên", MODERATOR: "Kiểm duyệt viên" } as const
const claimLabels = { PENDING: "Đang chờ xét duyệt", APPROVED: "Đã chấp thuận", REJECTED: "Chưa được chấp thuận" }

type AccountTab = "profile" | "follows" | "notifications" | "pages"
const accountTabs: [AccountTab, string][] = [
  ["profile", "Hồ sơ"],
  ["follows", "Đang theo dõi"],
  ["notifications", "Thông báo"],
  ["pages", "Trang & yêu cầu"],
]

export function CommunityAccount() {
  const session = useCommunitySession()
  const ownProfile = useOwnProfile()
  const [params, setParams] = useSearchParams()
  const requested = params.get("tab") as AccountTab | null
  const tab = accountTabs.some(([value]) => value === requested) ? requested! : "profile"
  const enabled = session.status === "authenticated"
  const unread = useUnreadCount()
  return (
    <StreamShell>
      <title>Tài khoản — AOV Stream</title>
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
              <span className="hub-kicker">Tài khoản</span>
              <h1>{enabled ? ownProfile.data?.displayName || session.name : "Tham gia cộng đồng"}</h1>
              <p>Chỉnh sửa hồ sơ, theo dõi các trang bạn quan tâm và quản lý hoạt động của mình.</p>
            </div>
          </div>
          {enabled && (
            <nav className="cp-tabs cp-header-tabs" aria-label="Mục tài khoản">
              {accountTabs.map(([value, label]) => (
                <button
                  key={value}
                  aria-current={tab === value ? "page" : undefined}
                  onClick={() => setParams(value === "profile" ? {} : { tab: value })}
                >
                  <StreamIcon name={accountTabIcons[value as keyof typeof accountTabIcons] ?? "user"} size={15} />
                  {label}
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
  const follows = useFollowedPages()
  const follow = useFollowPage()
  return (
    <section className="cp-panel">
      <h2>Trang đang theo dõi</h2>
      <p className="cp-muted">Bài mới từ các trang này xuất hiện ở mục "Đang theo dõi" của cộng đồng.</p>
      {follows.isPending && <div className="hub-skeleton-rows" role="status" aria-label="Đang tải trang theo dõi" />}
      {follows.isError && <p className="cp-error">{follows.error.message}</p>}
      {follows.data && !follows.data.items.length && (
        <div className="hub-state">
          <StreamIcon name="heart" size={28} />
          <h3>Bạn chưa theo dõi trang nào</h3>
          <Link className="cp-button cp-primary" to="/explore">
            Khám phá trang
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
            Bỏ theo dõi
          </button>
        </div>
      ))}
      {follow.isError && <p className="cp-error">{follow.error.message}</p>}
    </section>
  )
}

function NotificationInbox() {
  const inbox = useNotificationInbox(24)
  const notifications = inbox.data?.pages.flatMap((page) => page.items) ?? []
  const unread = useUnreadCount()
  const read = useReadNotifications()
  return (
    <section className="cp-panel" id="notifications">
      <div className="cp-panel-heading">
        <h2>Thông báo</h2>
        <button
          className="cp-text-button"
          disabled={!unread.data?.unread || read.all.isPending}
          onClick={() => read.all.mutate()}
        >
          <StreamIcon name="check" size={14} />
          Đánh dấu đã đọc tất cả
        </button>
      </div>
      {inbox.isLoadingError && <p className="cp-error">{inbox.error.message}</p>}
      {inbox.data && !notifications.length && <p className="cp-muted">Thông báo mới sẽ xuất hiện tại đây.</p>}
      {notifications.map((item) => (
        <article className="cp-notification" data-unread={!item.read || undefined} key={item.id}>
          <Link to={`/pages/${item.pageId}`} onClick={() => !item.read && read.one.mutate(item.id)}>
            {item.message}
          </Link>
          <small>
            <LocalTime value={item.createdAt} />
          </small>
          {!item.read && (
            <button className="cp-text-button" disabled={read.one.isPending} onClick={() => read.one.mutate(item.id)}>
              Đánh dấu đã đọc
            </button>
          )}
        </article>
      ))}
      <InfiniteScroll query={inbox} label="Đang tải thêm thông báo" />
    </section>
  )
}

function ManagedPages() {
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
        <h2>Trang bạn quản lý</h2>
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
                Quản lý
                <StreamIcon name="chevronRight" size={16} />
              </span>
            </Link>
          ))
        ) : (
          <p className="cp-muted">Bạn chưa quản lý trang nào. Mở trang của mình và gửi yêu cầu nhận quyền đại diện.</p>
        )}
      </section>
      <section className="cp-panel">
        <h2>Yêu cầu đại diện của bạn</h2>
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
                {claimLabels[claim.status]}
              </span>
            </article>
          ))
        ) : (
          <p className="cp-muted">Chưa có yêu cầu.</p>
        )}
      </section>
    </div>
  )
}

export function SignInPrompt() {
  return (
    <div className="hub-state cp-signin">
      <StreamBrand compact />
      <h2>Một tài khoản cho cộng đồng của bạn</h2>
      <p>Đăng nhập để theo dõi, thảo luận và quản lý trang được ủy quyền.</p>
      <ul className="cp-benefits">
        <li>
          <StreamIcon name="heart" size={16} />
          Theo dõi đội tuyển, thích bài viết
        </li>
        <li>
          <StreamIcon name="message" size={16} />
          Bình luận và thảo luận
        </li>
        <li>
          <StreamIcon name="shield" size={16} />
          Quản lý trang được ủy quyền
        </li>
      </ul>
      <div className="cp-actions">
        <button className="cp-button cp-primary" onClick={() => void signIn()}>
          Đăng nhập
        </button>
        <button className="cp-button" onClick={() => void signIn(true)}>
          Tạo tài khoản
        </button>
      </div>
    </div>
  )
}

export function CommunityPageManager() {
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
          <div className="hub-skeleton cp-header-skeleton" role="status" aria-label="Đang tải trang" />
        ) : !viewer.data.role ? (
          <div className="hub-state">
            <StreamIcon name="shield" size={28} />
            <h2>Bạn chưa có quyền quản lý trang này.</h2>
            <Link className="cp-button" to="/account">
              Về tài khoản
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
    onSuccess: (value) => setInvitation(`${location.origin}/invitations#${value.token}`),
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
      <title>{`Quản lý ${profile.content?.name || "trang"} — AOV Stream`}</title>
      <Link className="cp-back" to={`/pages/${profile.code}`}>
        <StreamIcon name="back" size={16} />
        Xem trang công khai
      </Link>
      <header className="hub-card cp-page-header">
        <div
          className="hub-banner hub-art cp-manage-banner"
          style={{ "--hub-hue": hueOf(profile.content?.name || profile.code) } as CSSProperties}
        >
          <div className="hub-banner-copy">
            <span className="hub-kicker">Quản lý trang</span>
            <h1>{profile.content?.name}</h1>
            <p>Đại diện của trang · {viewer.role ? roleLabels[viewer.role] : ""}</p>
          </div>
        </div>
        <nav className="cp-tabs cp-header-tabs" aria-label="Mục quản lý">
          {[
            ["presentation", "Giới thiệu"],
            ["posts", "Bài viết"],
            ["members", "Người quản lý"],
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
          <h2>Thông tin do đại diện cung cấp</h2>
          <p className="cp-muted">
            Lịch sử và kết quả thi đấu được biên tập riêng. Bạn có thể gửi đề xuất chỉnh sửa từ trang công khai.
          </p>
          <fieldset disabled={viewer.role === "MODERATOR" || save.isPending}>
            <label>
              Giới thiệu
              <textarea
                rows={6}
                maxLength={10000}
                value={presentation.biography || ""}
                onChange={(e) => setPresentation({ ...presentation, biography: e.target.value })}
              />
            </label>
            <div className="cp-form-grid">
              <label>
                Ảnh đại diện
                <ImageLinkPreview url={presentation.avatarUrl} />
                <input
                  type="url"
                  placeholder="https://…"
                  value={presentation.avatarUrl || ""}
                  onChange={(e) => setPresentation({ ...presentation, avatarUrl: e.target.value })}
                />
              </label>
              <label>
                Ảnh bìa
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
                  Đường dẫn
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
                    Tên kênh
                  </span>
                  <input
                    required
                    list="cp-channel-names"
                    placeholder="Tự điền theo đường dẫn"
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
                  Gỡ kênh
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
                Thêm kênh
              </button>
              <button className="cp-button cp-primary">Lưu giới thiệu</button>
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
          <h2>Người quản lý trang</h2>
          {members.isError && <p className="cp-error">{members.error.message}</p>}
          {members.data?.map((member) => (
            <div className="cp-list-row" key={member.id}>
              <div>
                <strong>
                  {member.name}
                  {member.self ? " (bạn)" : ""}
                </strong>
                <p className="cp-meta">{roleLabels[member.role]}</p>
              </div>
              {viewer.role === "OWNER" && !member.self && (
                <div className="cp-actions">
                  <button className="cp-button" onClick={() => setConfirmation({ id: member.id, action: "revoke" })}>
                    Thu hồi
                  </button>
                  <button className="cp-button" onClick={() => setConfirmation({ id: member.id, action: "transfer" })}>
                    Chuyển quyền chính
                  </button>
                </div>
              )}
            </div>
          ))}
          {confirmation && (
            <div className="cp-confirm" role="alert">
              <p>
                {confirmation.action === "transfer"
                  ? "Người này sẽ trở thành quản trị chính; bạn chuyển thành biên tập viên. Các lời mời cũ sẽ hết hiệu lực."
                  : "Người này sẽ mất quyền quản lý trang."}
              </p>
              <div className="cp-actions">
                <button
                  className="cp-button cp-primary"
                  disabled={membership.isPending}
                  onClick={() => membership.mutate()}
                >
                  Xác nhận
                </button>
                <button className="cp-button" onClick={() => setConfirmation(null)}>
                  Hủy
                </button>
              </div>
            </div>
          )}
          {membership.isError && <p className="cp-error">{membership.error.message}</p>}
          {viewer.role === "OWNER" && (
            <div className="cp-invite">
              <h3>Mời người quản lý</h3>
              <div className="cp-actions">
                <select
                  aria-label="Quyền của người được mời"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  <option value="EDITOR">Biên tập viên</option>
                  <option value="MODERATOR">Kiểm duyệt viên</option>
                </select>
                <button className="cp-button" disabled={invite.isPending} onClick={() => invite.mutate()}>
                  Tạo liên kết mời
                </button>
              </div>
              {invite.isError && <p className="cp-error">{invite.error.message}</p>}
              {invitation && (
                <label>
                  Liên kết dùng một lần, có hiệu lực 7 ngày
                  <input readOnly value={invitation} onFocus={(e) => e.target.select()} />
                  <span className="cp-meta">Chỉ gửi liên kết này cho người bạn muốn cấp quyền.</span>
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
  const session = useCommunitySession()
  const navigate = useNavigate()
  const [token] = useState(() => location.hash.slice(1))
  const accept = useMutation({
    mutationFn: () => communityApi<{ pageId: string }>("/me/invitations/accept", { token }),
    onSuccess: (result) => navigate(`/manage/${result.pageId}`, { replace: true }),
  })
  return (
    <StreamShell>
      <title>Lời mời quản lý trang — AOV Stream</title>
      <div className="cp-container">
        <section className="hub-state cp-invitation">
          <StreamIcon name="shield" size={28} />
          <h1>Lời mời quản lý trang</h1>
          {session.status !== "authenticated" ? (
            <SignInPrompt />
          ) : (
            <>
              <p>Chấp nhận để liên kết quyền quản lý với tài khoản {session.name}.</p>
              <button
                className="cp-button cp-primary"
                disabled={!token || accept.isPending}
                onClick={() => accept.mutate()}
              >
                Chấp nhận lời mời
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
  const [failed, setFailed] = useState<string | null>(null)
  const value = url?.trim()
  if (!value || !/^https?:\/\//i.test(value)) return null
  if (failed === value) return <span className="cp-image-link-error">Không xem trước được ảnh từ liên kết này.</span>
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
