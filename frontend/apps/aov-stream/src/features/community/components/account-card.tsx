import { useUserTimeZone } from "@aov/ui/lib/time-zone"
import { AccountAvatar } from "../../../components/account/account-profile"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { memberSince } from "../../../lib/account-model"
import { useFollowedPages, useManagedPages, useUnreadCount } from "../../../lib/community-queries"
import { useOwnProfile } from "../../../lib/profile-api"
import { useCommunitySession } from "../../../lib/stream-auth"
import "./account-card.css"

export type AccountCount = "follows" | "notifications" | "pages"

/**
 * The reader as the community sees them, at the head of the account screens: picture, name, what they wrote of
 * themselves, since when they are here, and three counts that open their tabs.
 */
export function AccountCard({ onOpen }: { onOpen: (tab: AccountCount) => void }) {
  const { text, languageTag } = useStreamLocale()
  const session = useCommunitySession()
  const profile = useOwnProfile()
  const follows = useFollowedPages()
  const unread = useUnreadCount()
  const managed = useManagedPages()
  const timeZone = useUserTimeZone()
  const name = profile.data?.displayName || session.name
  const biography = profile.data?.biography.trim()
  const since = memberSince(profile.data?.createdAt, languageTag, timeZone)
  const counts: [AccountCount, number | undefined, readonly [string, string]][] = [
    ["follows", follows.data?.items.length, ["Theo dõi", "Following"]],
    ["notifications", unread.data?.unread, ["Chưa đọc", "Unread"]],
    ["pages", managed.data?.length, ["Quản lý", "Managing"]],
  ]
  return (
    <section className="ac-card" aria-labelledby="account-name">
      <span className="ac-card-band" aria-hidden="true" />
      <span className="ac-card-avatar">
        <AccountAvatar url={profile.data?.avatarUrl} name={name} large />
      </span>
      <div className="ac-card-words">
        <p className="ac-card-eyebrow">{text("Tài khoản AOV", "AOV account")}</p>
        <h1 id="account-name">{name}</h1>
        {biography && <p className="ac-card-bio">{biography}</p>}
        {since && (
          <p className="ac-card-since">
            <StreamIcon name="calendar" size={14} />
            {text(`Tham gia ${since}`, `Joined ${since}`)}
          </p>
        )}
      </div>
      <div className="ac-card-counts">
        {counts.map(([tab, value, label]) => (
          <button
            key={tab}
            type="button"
            data-hot={(tab === "notifications" && !!value) || undefined}
            onClick={() => onOpen(tab)}
          >
            <b>{value === undefined ? "–" : value.toLocaleString(languageTag)}</b>
            <small>{text(...label)}</small>
          </button>
        ))}
      </div>
    </section>
  )
}
