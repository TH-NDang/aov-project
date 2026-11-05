import { Link } from "react-router"
import { profileKindLabels } from "@aov/community-contracts"
import { OfficialBadge } from "@aov/ui/components/official-badge"
import { StreamBrand } from "../../components/stream-brand"
import { StreamIcon } from "../../components/stream-icon"
import { AccountAvatar } from "../account/account-profile"
import { useOwnProfile } from "../account/profile-api"
import { signIn, useCommunitySession } from "./community-auth"
import {
  useFollowedPages,
  useFollowPage,
  useNotifications,
  useReadNotifications,
  useSuggestions,
  useUnreadCount,
} from "./community-queries"
import { Avatar, followersLabel, timeAgo } from "./community-ui"
import { TodaySchedule } from "./community-schedule"

/**
 * The right column of portal pages. The invitation to sign in only appears on the feed; the account card, notifications and
 * page suggestions exist only for signed-in viewers.
 */
export function CommunityAside({
  suggestions = true,
  representative = false,
  schedule = false,
  guest = false,
}: {
  suggestions?: boolean
  representative?: boolean
  /** Lists today's matches, or the next ones, from the published competitions. */
  schedule?: boolean
  /** Invites visitors to sign in. Kept to the feed so it does not repeat on every page. */
  guest?: boolean
}) {
  const session = useCommunitySession()
  const signedIn = session.status === "authenticated"
  return (
    <>
      {signedIn ? <AccountCard /> : guest && <GuestCard />}
      {schedule && <TodaySchedule />}
      {signedIn && <NotificationsCard />}
      {signedIn && suggestions && <FollowingCard />}
      {signedIn && suggestions && <FollowSuggestions />}
      {representative && (
        <section className="hub-card hub-card-padded">
          <h2 className="hub-card-title">Bạn là người đại diện?</h2>
          <p className="hub-card-text">
            Mở trang của đội tuyển, tuyển thủ hoặc tổ chức rồi gửi yêu cầu quản lý để cập nhật giới thiệu và đăng bài
            dưới tên trang.
          </p>
        </section>
      )}
    </>
  )
}

function GuestCard() {
  return (
    <section className="hub-card hub-session-card hub-session-guest">
      <div className="hub-session-body">
        <StreamBrand compact />
        <strong>Tham gia cộng đồng</strong>
        <span className="hub-card-text">
          Ai cũng đọc được bài viết. Đăng nhập để theo dõi trang, nhận thông báo, thích và bình luận.
        </span>
        <div className="hub-session-actions">
          <button className="cp-button cp-primary" onClick={() => void signIn()}>
            Đăng nhập
          </button>
          <button className="cp-button" onClick={() => void signIn(true)}>
            Tạo tài khoản
          </button>
        </div>
      </div>
    </section>
  )
}

function AccountCard() {
  const session = useCommunitySession()
  const profile = useOwnProfile()
  const follows = useFollowedPages()
  const unread = useUnreadCount()
  const name = profile.data?.displayName || session.name
  return (
    <section className="hub-card hub-session-card">
      <div className="hub-session-cover" aria-hidden="true" />
      <div className="hub-session-body">
        <AccountAvatar url={profile.data?.avatarUrl} name={name} large />
        <strong>{name}</strong>
        <span className="hub-card-text">Thành viên cộng đồng AOV Stream</span>
        <div className="hub-session-stats">
          <Link to="/account?tab=follows">
            <strong>{follows.data?.totalElements ?? "—"}</strong>
            <span>Đang theo dõi</span>
          </Link>
          <Link to="/account?tab=notifications">
            <strong>{unread.data?.unread ?? "—"}</strong>
            <span>Chưa đọc</span>
          </Link>
        </div>
        <Link className="cp-button" to="/account">
          <StreamIcon name="user" size={16} />
          Tài khoản của bạn
        </Link>
      </div>
    </section>
  )
}

function NotificationsCard() {
  const latest = useNotifications(0, 8)
  const read = useReadNotifications()
  const items = latest.data?.items.slice(0, 4) || []
  return (
    <section className="hub-card hub-card-padded">
      <div className="hub-card-heading">
        <h2 className="hub-card-title">Thông báo</h2>
        <Link to="/account?tab=notifications" className="hub-card-more">
          Xem tất cả
        </Link>
      </div>
      {latest.isPending && <div className="hub-skeleton-rows" role="status" aria-label="Đang tải thông báo" />}
      {latest.isError && <p className="hub-card-text">Chưa tải được thông báo.</p>}
      {latest.data && !items.length && <p className="hub-card-text">Thông báo mới sẽ xuất hiện tại đây.</p>}
      {items.map((item) => (
        <Link
          key={item.id}
          className="hub-notification hub-notification-row"
          data-unread={!item.read || undefined}
          to={`/pages/${item.pageId}`}
          onClick={() => !item.read && read.one.mutate(item.id)}
        >
          <span>{item.message}</span>
          <time dateTime={item.createdAt}>{timeAgo(item.createdAt)}</time>
        </Link>
      ))}
    </section>
  )
}

/** Quick access to the pages the viewer follows; replaces the old row of page chips above the feed. */
function FollowingCard() {
  const pages = useFollowedPages()
  const items = pages.data?.items || []
  if (!items.length) return null
  return (
    <section className="hub-card hub-card-padded">
      <div className="hub-card-heading">
        <h2 className="hub-card-title">Đang theo dõi</h2>
        <Link to="/account?tab=follows" className="hub-card-more">
          Xem tất cả
        </Link>
      </div>
      <ul className="cp-following">
        {items.slice(0, 6).map((profile) => (
          <li key={profile.id}>
            <Link to={`/pages/${profile.code}`}>
              <Avatar profile={profile} />
              <span>{profile.content?.name || profile.code}</span>
              {profile.live && <span className="cp-live-badge">Trực tiếp</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function FollowSuggestions() {
  const pages = useSuggestions(5)
  const follow = useFollowPage()
  return (
    <section className="hub-card hub-card-padded">
      <div className="hub-card-heading">
        <h2 className="hub-card-title">Gợi ý theo dõi</h2>
        <Link to="/explore" className="hub-card-more">
          Xem tất cả
        </Link>
      </div>
      {pages.isPending && <div className="hub-skeleton-rows" role="status" aria-label="Đang tải gợi ý" />}
      {pages.isError && <p className="hub-card-text">Chưa tải được gợi ý.</p>}
      {pages.data && !pages.data.items.length && (
        <p className="hub-card-text">Bạn đã theo dõi mọi trang hiện có. Trang mới sẽ được gợi ý tại đây.</p>
      )}
      {pages.data?.items.map((profile) => (
        <div key={profile.id} className="hub-suggestion">
          <Link to={`/pages/${profile.code}`} className="hub-suggestion-link">
            <Avatar profile={profile} />
            <span>
              <strong>
                <span>{profile.content?.name || profile.code}</span>
                {profile.represented && <OfficialBadge label="Đại diện đã xác minh" />}
              </strong>
              <small>
                {profileKindLabels[profile.kind]} · {followersLabel(profile.followers)}
              </small>
            </span>
          </Link>
          <button
            className="cp-follow-chip cp-follow-primary"
            disabled={follow.isPending}
            onClick={() => follow.mutate({ pageId: profile.id, following: true })}
            aria-label={`Theo dõi ${profile.content?.name || profile.code}`}
          >
            <StreamIcon name="plus" size={14} />
            Theo dõi
          </button>
        </div>
      ))}
      {follow.isError && (
        <p className="cp-error" role="alert">
          {follow.error.message}
        </p>
      )}
    </section>
  )
}
