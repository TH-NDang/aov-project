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
import { StreamShell } from "../../components/stream-shell"
import { StreamIcon } from "../../components/stream-icon"
import { AccountProfile } from "../account/account-profile"
import { AccountSettings } from "../account/account-settings"
import { initials } from "../account/profile-model"
import { communityApi } from "./community-api"
import { useCommunitySession } from "./community-auth"
import { CommunityFeed } from "./community-feed"
import { openSignIn, SignInBenefits } from "./community-signin"
import {
  useFollowedPages,
  useFollowPage,
  useNotificationInbox,
  useReadNotifications,
  useUnreadCount,
} from "./community-queries"
import { Avatar, followersLabel, hueOf } from "./community-ui"

const roleLabels = { OWNER: "Quản trị chính", EDITOR: "Biên tập viên", MODERATOR: "Kiểm duyệt viên" } as const
const claimLabels = { PENDING: "Đang chờ xét duyệt", APPROVED: "Đã chấp thuận", REJECTED: "Chưa được chấp thuận" }

type AccountTab = "profile" | "settings" | "follows" | "notifications" | "pages"
const accountTabs: [AccountTab, string][] = [
  ["profile", "Hồ sơ"],
  ["settings", "Cài đặt"],
  ["follows", "Đang theo dõi"],
  ["notifications", "Thông báo"],
  ["pages", "Trang & yêu cầu"],
]

export function CommunityAccount() {
  const session = useCommunitySession()
  const [params, setParams] = useSearchParams()
  const requested = params.get("tab") as AccountTab | null
  const tab = accountTabs.some(([value]) => value === requested) ? requested! : "profile"
  const enabled = session.status === "authenticated"
  const unread = useUnreadCount()
  const tabRow = useRef<HTMLElement>(null)
  // A tab opened from a link may sit past the edge of the row on a phone; bring it into view.
  useEffect(() => {
    tabRow.current?.querySelector("[aria-current]")?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [tab, enabled, unread.data?.unread])
  return (
    <StreamShell>
      <title>Tài khoản — AOV Stream</title>
      <div className="cp-container">
        <header className="tn-page-head">
          <div>
            <h1>Tài khoản</h1>
            <p>
              {enabled
                ? `${session.name} · hồ sơ và cài đặt dùng chung cho AOV Stream, Wiki và Admin`
                : "Một tài khoản AOV dùng chung cho AOV Stream, Wiki và Admin."}
            </p>
          </div>
        </header>
        {enabled && (
          <nav ref={tabRow} className="cp-tabs" aria-label="Mục tài khoản">
            {accountTabs.map(([value, label]) => (
              <button
                key={value}
                aria-current={tab === value ? "page" : undefined}
                onClick={() => setParams(value === "profile" ? {} : { tab: value })}
              >
                {label}
                {value === "notifications" && !!unread.data?.unread && (
                  <span className="cp-tab-count" aria-label={`${unread.data.unread} chưa đọc`}>
                    {unread.data.unread}
                  </span>
                )}
              </button>
            ))}
          </nav>
        )}
        {session.status === "loading" ? (
          <div className="hub-skeleton-rows" role="status" aria-label="Đang tải tài khoản" />
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
  const follows = useFollowedPages()
  const follow = useFollowPage()
  const items = follows.data?.items ?? []
  return (
    <section className="cp-section" aria-labelledby="account-follows">
      <div className="tn-heading">
        <h2 id="account-follows">
          Trang đang theo dõi {!!items.length && <small>{items.length.toLocaleString("vi-VN")}</small>}
        </h2>
      </div>
      <p className="cp-section-lead">Bài mới của các trang này có ở mục Đang theo dõi trên bảng tin.</p>
      {follows.isPending && <div className="hub-skeleton-rows" role="status" aria-label="Đang tải trang theo dõi" />}
      {follows.isError && <p className="cp-error">{follows.error.message}</p>}
      {follows.data && !items.length && (
        <div className="cp-empty">
          <p>Bạn chưa theo dõi trang nào.</p>
          <Link className="cp-button cp-primary" to="/explore">
            Khám phá trang
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
                  {profileKindLabels[profile.kind]} · {followersLabel(profile.followers)}
                </small>
              </Link>
              <button
                className="cp-button cp-quiet"
                disabled={follow.isPending}
                onClick={() => follow.mutate({ pageId: profile.id, following: false })}
                aria-label={`Bỏ theo dõi ${profile.content?.name || profile.code}`}
              >
                Bỏ theo dõi
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
  const inbox = useNotificationInbox(24)
  const notifications = inbox.data?.pages.flatMap((page) => page.items) ?? []
  const unread = useUnreadCount()
  const read = useReadNotifications()
  const count = unread.data?.unread ?? 0
  return (
    <section className="cp-section" aria-labelledby="account-notifications">
      <div className="tn-heading">
        <h2 id="account-notifications">Thông báo</h2>
        {count > 0 && (
          <button type="button" disabled={read.all.isPending} onClick={() => read.all.mutate()}>
            <StreamIcon name="check" size={15} />
            Đánh dấu đã đọc tất cả
          </button>
        )}
      </div>
      {inbox.isPending && <div className="hub-skeleton-rows" role="status" aria-label="Đang tải thông báo" />}
      {inbox.isLoadingError && <p className="cp-error">{inbox.error.message}</p>}
      {inbox.data && !notifications.length && (
        <p className="cp-section-lead">Chưa có thông báo. Theo dõi trang để nhận tin khi có bài mới.</p>
      )}
      {!!notifications.length && (
        <ul className="cp-rows">
          {notifications.map((item) => (
            <li key={item.id} className="cp-row cp-note" data-unread={!item.read || undefined}>
              <span className="cp-note-dot" aria-hidden="true" />
              <span className="cp-row-text">
                <Link to={`/pages/${item.pageId}`} onClick={() => !item.read && read.one.mutate(item.id)}>
                  {!item.read && <span className="sr-only">Chưa đọc: </span>}
                  {item.message}
                </Link>
                <small>
                  <LocalTime value={item.createdAt} />
                </small>
              </span>
              {!item.read && (
                <button
                  className="hub-icon-button cp-note-read"
                  disabled={read.one.isPending}
                  onClick={() => read.one.mutate(item.id)}
                  aria-label="Đánh dấu đã đọc"
                  title="Đánh dấu đã đọc"
                >
                  <StreamIcon name="check" size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
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
    <div className="cp-section-pair">
      <section className="cp-section" aria-labelledby="account-managed">
        <div className="tn-heading">
          <h2 id="account-managed">Trang bạn quản lý</h2>
        </div>
        {managed.isPending && <div className="hub-skeleton-rows" role="status" aria-label="Đang tải trang quản lý" />}
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
                      <small>{profileKindLabels[profile.kind]}</small>
                    </span>
                    <span className="cp-row-go">
                      Quản lý
                      <StreamIcon name="chevronRight" size={16} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="cp-section-lead">
              Bạn chưa quản lý trang nào. Mở trang của đội hoặc tuyển thủ bạn đại diện và gửi yêu cầu quản lý từ nút ⋯.
            </p>
          ))}
      </section>
      <section className="cp-section" aria-labelledby="account-claims">
        <div className="tn-heading">
          <h2 id="account-claims">Yêu cầu đại diện</h2>
        </div>
        {claims.isPending && <div className="hub-skeleton-rows" role="status" aria-label="Đang tải yêu cầu" />}
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
                    {claimLabels[claim.status]}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="cp-section-lead">Bạn chưa gửi yêu cầu nào.</p>
          ))}
      </section>
    </div>
  )
}

/** What an account gives a visitor, with the two ways in. The one prompt of the account screens. */
export function SignInPrompt({ title = "Đăng nhập để tham gia cộng đồng" }: { title?: string }) {
  const [error, setError] = useState("")
  return (
    <section className="cp-signin" aria-labelledby="signin-title">
      <h2 id="signin-title">{title}</h2>
      <SignInBenefits />
      <div className="cp-signin-actions">
        <button className="cp-button cp-primary" onClick={() => openSignIn(false, setError)}>
          Đăng nhập
        </button>
        <button className="cp-button" onClick={() => openSignIn(true, setError)}>
          Tạo tài khoản
        </button>
      </div>
      {error && (
        <p className="cp-field-error" role="alert">
          {error}
        </p>
      )}
      <p className="cp-signin-note">Đăng nhập qua trang tài khoản AOV; AOV Stream không lưu mật khẩu.</p>
    </section>
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
        {session.status === "loading" ? (
          <ManagerSkeleton />
        ) : !enabled ? (
          <>
            <title>Quản lý trang — AOV Stream</title>
            <header className="tn-page-head">
              <div>
                <h1>Quản lý trang</h1>
                <p>Người đại diện cập nhật giới thiệu, đăng bài và mời người cùng quản lý trang.</p>
              </div>
            </header>
            <SignInPrompt title="Đăng nhập để quản lý trang" />
          </>
        ) : profile.isError || viewer.isError ? (
          <p className="cp-error" role="alert">
            {profile.error?.message || viewer.error?.message}
          </p>
        ) : !profile.data || !viewer.data ? (
          <ManagerSkeleton />
        ) : !viewer.data.role ? (
          <div className="hub-state">
            <h2>Bạn chưa có quyền quản lý trang này.</h2>
            <p>Trang bạn quản lý được liệt kê trong tài khoản, mục Trang & yêu cầu.</p>
            <div className="hub-state-actions">
              <Link className="cp-button" to="/account?tab=pages">
                Về Trang & yêu cầu
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
  return (
    <div className="cp-manage-skeleton" role="status" aria-label="Đang tải trang">
      <span className="hub-skeleton" />
      <span className="hub-skeleton" />
      <div className="hub-skeleton-rows" />
    </div>
  )
}

type ProfileLink = ProfilePresentation["links"][number]

type ManagerTab = "presentation" | "posts" | "members"
const managerTabs: [ManagerTab, string][] = [
  ["presentation", "Giới thiệu"],
  ["posts", "Bài viết"],
  ["members", "Người quản lý"],
]

function Manager({ profile, viewer }: { profile: CommunityProfile; viewer: PageViewer }) {
  const [tab, setTab] = useState<ManagerTab>("presentation")
  const name = profile.content?.name || profile.code
  return (
    <>
      <title>{`Quản lý ${name} — AOV Stream`}</title>
      <Link className="cp-back" to="/account?tab=pages">
        <StreamIcon name="back" size={16} />
        Trang bạn quản lý
      </Link>
      <header className="tn-page-head cp-manage-head">
        <div className="cp-manage-identity">
          <Avatar profile={profile} />
          <div>
            <h1>{name}</h1>
            <p>
              {profileKindLabels[profile.kind]} · bạn là {viewer.role ? roleLabels[viewer.role].toLowerCase() : ""}
            </p>
          </div>
        </div>
        <Link className="cp-button cp-manage-public" to={`/pages/${profile.code}`} aria-label="Xem trang công khai">
          <span>Xem trang công khai</span>
          <StreamIcon name="arrow" size={15} />
        </Link>
      </header>
      <nav className="cp-tabs" aria-label="Mục quản lý">
        {managerTabs.map(([value, label]) => (
          <button key={value} aria-current={tab === value ? "page" : undefined} onClick={() => setTab(value)}>
            {label}
          </button>
        ))}
      </nav>
      {tab === "presentation" && <PresentationForm profile={profile} viewer={viewer} />}
      {tab === "posts" && (
        <section className="cp-section" aria-label="Bài viết của trang">
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
    await client.invalidateQueries({ queryKey: ["page-viewer"] })
    await client.invalidateQueries({ queryKey: ["public-page"] })
    await client.invalidateQueries({ queryKey: ["managed-page"] })
    await client.invalidateQueries({ queryKey: ["page-members"] })
  }
}

function PresentationForm({ profile, viewer }: { profile: CommunityProfile; viewer: PageViewer }) {
  const refresh = useManagerRefresh()
  const [presentation, setPresentation] = useState<ProfilePresentation>({
    biography: profile.content?.biography,
    avatarUrl: profile.content?.avatarUrl,
    coverUrl: profile.content?.coverUrl,
    links: profile.content?.links || [],
  })
  const save = useMutation({
    mutationFn: () =>
      communityApi(`/me/pages/${profile.id}/presentation`, { version: viewer.version, content: presentation }, "PUT"),
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
      <div className="tn-heading">
        <h2 id="manage-presentation">Giới thiệu trang</h2>
      </div>
      <p className="cp-section-lead">
        {readOnly
          ? "Kiểm duyệt viên xem được phần này; quản trị chính và biên tập viên mới sửa được."
          : "Lịch sử và kết quả thi đấu được biên tập riêng; bạn có thể đề xuất chỉnh sửa từ trang công khai."}
      </p>
      <fieldset disabled={readOnly || save.isPending}>
        <label>
          Giới thiệu
          <textarea
            rows={6}
            maxLength={10000}
            value={presentation.biography || ""}
            onChange={(event) => setPresentation({ ...presentation, biography: event.target.value })}
          />
        </label>
        <div className="cp-field-pair">
          <label>
            Ảnh đại diện
            <input
              type="url"
              placeholder="https://…"
              value={presentation.avatarUrl || ""}
              onChange={(event) => setPresentation({ ...presentation, avatarUrl: event.target.value })}
            />
            <ImageLinkPreview url={presentation.avatarUrl} />
          </label>
          <label>
            Ảnh bìa
            <input
              type="url"
              placeholder="https://…"
              value={presentation.coverUrl || ""}
              onChange={(event) => setPresentation({ ...presentation, coverUrl: event.target.value })}
            />
            <ImageLinkPreview url={presentation.coverUrl} wide />
          </label>
        </div>
        <h3 className="cp-subheading">Kênh liên hệ</h3>
        <datalist id="cp-channel-names">
          {SOCIAL_PLATFORM_NAMES.map((platform) => (
            <option key={platform} value={platform} />
          ))}
        </datalist>
        {!presentation.links.length && <p className="cp-section-lead">Trang chưa có kênh liên hệ nào.</p>}
        {presentation.links.map((link, index) => (
          <div className="cp-link-field" key={index}>
            <label>
              <span className="cp-link-label">Đường dẫn</span>
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
                Tên kênh
              </span>
              <input
                required
                list="cp-channel-names"
                placeholder="Tự điền theo đường dẫn"
                value={link.label}
                onChange={(event) => setLink(index, (item) => ({ ...item, label: event.target.value }))}
              />
            </label>
            <button
              type="button"
              className="hub-icon-button cp-link-remove"
              aria-label={`Gỡ kênh ${link.label || link.url || index + 1}`}
              title="Gỡ kênh"
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
            Thêm kênh
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
            {save.isPending ? "Đang lưu…" : "Lưu giới thiệu"}
          </button>
        </div>
      )}
    </form>
  )
}

function Members({ profile, viewer }: { profile: CommunityProfile; viewer: PageViewer }) {
  const session = useCommunitySession()
  const refresh = useManagerRefresh()
  const [inviteRole, setInviteRole] = useState("EDITOR")
  const [invitation, setInvitation] = useState("")
  const [copied, setCopied] = useState(false)
  const [confirmation, setConfirmation] = useState<{ id: string; action: "revoke" | "transfer" } | null>(null)
  const members = useQuery({
    queryKey: ["page-members", session.revision, profile.id],
    queryFn: () => communityApi<PageManager[]>(`/me/pages/${profile.id}/members`),
  })
  const invite = useMutation({
    mutationFn: () => communityApi<{ token: string }>(`/me/pages/${profile.id}/invitations`, { role: inviteRole }),
    onSuccess: (value) => {
      setCopied(false)
      setInvitation(`${location.origin}${import.meta.env.BASE_URL}invitations#${value.token}`)
    },
  })
  const membership = useMutation({
    mutationFn: () => communityApi(`/me/pages/${profile.id}/members/${confirmation!.id}/${confirmation!.action}`, {}),
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
      <div className="tn-heading">
        <h2 id="manage-members">Người quản lý {!!members.data?.length && <small>{members.data.length}</small>}</h2>
      </div>
      <p className="cp-section-lead">
        Biên tập viên đăng bài dưới tên trang; kiểm duyệt viên ẩn nội dung vi phạm. Chỉ quản trị chính mời và thu hồi.
      </p>
      {members.isPending && <div className="hub-skeleton-rows" role="status" aria-label="Đang tải người quản lý" />}
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
                    {member.self && " (bạn)"}
                  </strong>
                  <small>{roleLabels[member.role]}</small>
                </span>
                {owner && !member.self && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="hub-icon-button cp-more" aria-label={`Thao tác với ${member.name}`}>
                        <StreamIcon name="more" size={18} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="hub-popover hub-post-menu" drawerTitle={member.name}>
                      <DropdownMenuItem
                        className="hub-menu-item"
                        onSelect={() => setConfirmation({ id: member.id, action: "transfer" })}
                      >
                        <StreamIcon name="shield" size={16} />
                        Chuyển quyền chính
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="hub-menu-item"
                        variant="destructive"
                        onSelect={() => setConfirmation({ id: member.id, action: "revoke" })}
                      >
                        <StreamIcon name="close" size={16} />
                        Thu hồi quyền
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              {confirmation?.id === member.id && (
                <div className="cp-confirm" role="group" aria-label="Xác nhận thay đổi quyền">
                  <p>
                    {confirmation.action === "transfer"
                      ? `${member.name} sẽ trở thành quản trị chính; bạn chuyển thành biên tập viên. Các lời mời cũ hết hiệu lực.`
                      : `${member.name} sẽ mất quyền quản lý trang này.`}
                  </p>
                  <div className="cp-actions">
                    <button
                      className={confirmation.action === "revoke" ? "cp-button cp-danger" : "cp-button cp-primary"}
                      disabled={membership.isPending}
                      onClick={() => membership.mutate()}
                    >
                      {confirmation.action === "revoke" ? "Thu hồi quyền" : "Chuyển quyền chính"}
                    </button>
                    <button className="cp-button cp-quiet" onClick={() => setConfirmation(null)}>
                      Hủy
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
          <h3 className="cp-subheading">Mời người quản lý</h3>
          <p className="cp-section-lead">
            Tạo một liên kết dùng một lần, có hiệu lực 7 ngày, rồi gửi riêng cho người bạn muốn cấp quyền.
          </p>
          <div className="cp-invite-row">
            <label className="cp-invite-role">
              Quyền
              <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>
                <option value="EDITOR">Biên tập viên</option>
                <option value="MODERATOR">Kiểm duyệt viên</option>
              </select>
            </label>
            <button className="cp-button cp-primary" disabled={invite.isPending} onClick={() => invite.mutate()}>
              Tạo liên kết mời
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
                Liên kết mời
                <input readOnly value={invitation} onFocus={(event) => event.target.select()} />
              </label>
              <button type="button" className="cp-button" onClick={copy}>
                <StreamIcon name={copied ? "check" : "link"} size={15} />
                {copied ? "Đã sao chép" : "Sao chép"}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
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
        <header className="tn-page-head">
          <div>
            <h1>Lời mời quản lý trang</h1>
            <p>Người quản trị chính của một trang mời bạn cùng quản lý trang đó.</p>
          </div>
        </header>
        {session.status === "loading" ? (
          <div className="hub-skeleton-rows" role="status" aria-label="Đang tải" />
        ) : session.status !== "authenticated" ? (
          <SignInPrompt title="Đăng nhập để nhận lời mời" />
        ) : !token ? (
          <section className="cp-signin" aria-labelledby="invitation-title">
            <h2 id="invitation-title">Liên kết mời chưa đầy đủ</h2>
            <p className="cp-section-lead">
              Liên kết thiếu mã mời. Hãy mở lại đúng liên kết bạn nhận được, hoặc xin người quản trị chính tạo liên kết
              mới.
            </p>
          </section>
        ) : (
          <section className="cp-signin" aria-labelledby="invitation-title">
            <h2 id="invitation-title">Nhận quyền quản lý</h2>
            <p className="cp-section-lead">
              Chấp nhận để liên kết quyền quản lý với tài khoản <strong>{session.name}</strong>. Liên kết chỉ dùng được
              một lần.
            </p>
            <div className="cp-signin-actions">
              <button className="cp-button cp-primary" disabled={accept.isPending} onClick={() => accept.mutate()}>
                {accept.isPending ? "Đang chấp nhận…" : "Chấp nhận lời mời"}
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
  const [failed, setFailed] = useState<string | null>(null)
  const value = url?.trim()
  if (!value || !/^https?:\/\//i.test(value)) return null
  if (failed === value) return <span className="cp-field-error">Không xem trước được ảnh từ liên kết này.</span>
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
