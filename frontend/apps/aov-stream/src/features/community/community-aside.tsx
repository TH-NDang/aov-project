import { Link } from "react-router"
import { profileKindLabels } from "@aov/community-contracts"
import { OfficialBadge } from "@aov/ui/components/official-badge"
import { StreamBrand } from "../../components/stream-brand"
import { StreamIcon } from "../../components/stream-icon"
import { useStreamLocale } from "../../components/stream-locale"
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
import { Avatar, followersLabel, TimeAgo } from "./community-ui"
import { TodaySchedule } from "./community-schedule"
import { profileKindEnglish } from "./profile-aside"

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
  const { text } = useStreamLocale()
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
          <h2 className="hub-card-title">{text("Bạn là người đại diện?", "Are you a representative?")}</h2>
          <p className="hub-card-text">
            {text(
              "Mở trang của đội tuyển, tuyển thủ hoặc tổ chức rồi gửi yêu cầu quản lý để cập nhật giới thiệu và đăng bài dưới tên trang.",
              "Open the page of a team, player or organization, then send a management request to update the introduction and post under the page's name.",
            )}
          </p>
        </section>
      )}
    </>
  )
}

function GuestCard() {
  const { text } = useStreamLocale()
  return (
    <section className="hub-card hub-session-card hub-session-guest">
      <div className="hub-session-body">
        <StreamBrand compact />
        <strong>{text("Tham gia cộng đồng", "Join the community")}</strong>
        <span className="hub-card-text">
          {text(
            "Ai cũng đọc được bài viết. Đăng nhập để theo dõi trang, nhận thông báo, thích và bình luận.",
            "Anyone can read posts. Sign in to follow pages, get notifications, like and comment.",
          )}
        </span>
        <div className="hub-session-actions">
          <button className="cp-button cp-primary" onClick={() => void signIn()}>
            {text("Đăng nhập", "Sign in")}
          </button>
          <button className="cp-button" onClick={() => void signIn(true)}>
            {text("Tạo tài khoản", "Create account")}
          </button>
        </div>
      </div>
    </section>
  )
}

function AccountCard() {
  const { text } = useStreamLocale()
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
        <span className="hub-card-text">{text("Thành viên cộng đồng AOV Stream", "AOV Stream community member")}</span>
        <div className="hub-session-stats">
          <Link to="/account?tab=follows">
            <strong>{follows.data?.totalElements ?? "—"}</strong>
            <span>{text("Đang theo dõi", "Following")}</span>
          </Link>
          <Link to="/account?tab=notifications">
            <strong>{unread.data?.unread ?? "—"}</strong>
            <span>{text("Chưa đọc", "Unread")}</span>
          </Link>
        </div>
        <Link className="cp-button" to="/account">
          <StreamIcon name="user" size={16} />
          {text("Tài khoản của bạn", "Your account")}
        </Link>
      </div>
    </section>
  )
}

function NotificationsCard() {
  const { text } = useStreamLocale()
  const latest = useNotifications(0, 8)
  const read = useReadNotifications()
  const items = latest.data?.items.slice(0, 4) || []
  return (
    <section className="hub-card hub-card-padded">
      <div className="hub-card-heading">
        <h2 className="hub-card-title">{text("Thông báo", "Notifications")}</h2>
        <Link to="/account?tab=notifications" className="hub-card-more">
          {text("Xem tất cả", "See all")}
        </Link>
      </div>
      {latest.isPending && (
        <div
          className="hub-skeleton-rows"
          role="status"
          aria-label={text("Đang tải thông báo", "Loading notifications")}
        />
      )}
      {latest.isError && (
        <p className="hub-card-text">{text("Chưa tải được thông báo.", "Notifications could not be loaded.")}</p>
      )}
      {latest.data && !items.length && (
        <p className="hub-card-text">
          {text("Thông báo mới sẽ xuất hiện tại đây.", "New notifications will appear here.")}
        </p>
      )}
      {items.map((item) => (
        <Link
          key={item.id}
          className="hub-notification hub-notification-row"
          data-unread={!item.read || undefined}
          to={`/pages/${item.pageId}`}
          onClick={() => !item.read && read.one.mutate(item.id)}
        >
          <span>{item.message}</span>
          <TimeAgo value={item.createdAt} />
        </Link>
      ))}
    </section>
  )
}

/** Quick access to the pages the viewer follows; replaces the old row of page chips above the feed. */
function FollowingCard() {
  const { text } = useStreamLocale()
  const pages = useFollowedPages()
  const items = pages.data?.items || []
  if (!items.length) return null
  return (
    <section className="hub-card hub-card-padded">
      <div className="hub-card-heading">
        <h2 className="hub-card-title">{text("Đang theo dõi", "Following")}</h2>
        <Link to="/account?tab=follows" className="hub-card-more">
          {text("Xem tất cả", "See all")}
        </Link>
      </div>
      <ul className="cp-following">
        {items.slice(0, 6).map((profile) => (
          <li key={profile.id}>
            <Link to={`/pages/${profile.code}`}>
              <Avatar profile={profile} />
              <span>{profile.content?.name || profile.code}</span>
              {profile.live && <span className="cp-live-badge">{text("Trực tiếp", "Live")}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function FollowSuggestions() {
  const { text } = useStreamLocale()
  const pages = useSuggestions(5)
  const follow = useFollowPage()
  return (
    <section className="hub-card hub-card-padded hub-follow-suggestions">
      <div className="hub-card-heading">
        <h2 className="hub-card-title">{text("Gợi ý theo dõi", "Who to follow")}</h2>
        <Link to="/explore" className="hub-card-more">
          {text("Xem tất cả", "See all")}
        </Link>
      </div>
      {pages.isPending && (
        <div className="hub-skeleton-rows" role="status" aria-label={text("Đang tải gợi ý", "Loading suggestions")} />
      )}
      {pages.isError && (
        <p className="hub-card-text">{text("Chưa tải được gợi ý.", "Suggestions could not be loaded.")}</p>
      )}
      {pages.data && !pages.data.items.length && (
        <p className="hub-card-text">
          {text(
            "Bạn đã theo dõi mọi trang hiện có. Trang mới sẽ được gợi ý tại đây.",
            "You already follow every page available. New pages will be suggested here.",
          )}
        </p>
      )}
      {pages.data?.items.map((profile) => (
        <div key={profile.id} className="hub-suggestion">
          <Link to={`/pages/${profile.code}`} className="hub-suggestion-link">
            <Avatar profile={profile} />
            <span>
              <strong>
                <span>{profile.content?.name || profile.code}</span>
                {profile.represented && (
                  <OfficialBadge label={text("Đại diện đã xác minh", "Verified representative")} />
                )}
              </strong>
              <small>
                {text(profileKindLabels[profile.kind], profileKindEnglish[profile.kind])}
                {profile.followers > 0 && ` · ${followersLabel(profile.followers)}`}
              </small>
            </span>
          </Link>
          <button
            className="cp-follow-chip cp-follow-primary hub-follow-icon"
            disabled={follow.isPending}
            onClick={() => follow.mutate({ pageId: profile.id, following: true })}
            aria-label={text(
              `Theo dõi ${profile.content?.name || profile.code}`,
              `Follow ${profile.content?.name || profile.code}`,
            )}
          >
            <StreamIcon name="plus" size={14} />
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
