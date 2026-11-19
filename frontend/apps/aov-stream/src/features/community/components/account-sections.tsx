import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { profileKindLabels, type PageClaim } from "@aov/community-contracts"
import { LocalTime } from "@aov/ui/components/local-time"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { communityApi } from "../../../lib/community-api"
import { communityKeys } from "../../../lib/community-keys"
import { useCommunitySession } from "../../../lib/stream-auth"
import {
  useFollowedPages,
  useFollowPage,
  useNotificationInbox,
  useReadNotifications,
  useUnreadCount,
} from "../../../lib/community-queries"
import { Avatar, followersLabel, profileKindEnglish } from "../../../components/community-ui"
import { notificationText } from "../../../lib/notification-text"

/** How a representation request stands, in Vietnamese and in English. */
const claimLabels: Record<PageClaim["status"], readonly [string, string]> = {
  PENDING: ["Đang chờ xét duyệt", "Pending review"],
  APPROVED: ["Đã chấp thuận", "Approved"],
  REJECTED: ["Chưa được chấp thuận", "Not approved"],
}

/** The account's "Following" section: the pages the reader follows, each with a way to stop. */
export function FollowedPages() {
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

/** The account's notifications, newest first and loaded as the reader scrolls, each one markable as read. */
export function NotificationInbox() {
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

/** The pages the reader manages and the representation requests they sent, side by side. */
export function ManagedPages() {
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
