import { useEffect, useRef } from "react"
import { useSearchParams } from "react-router"
import { StreamShell } from "../../../components/stream-shell"
import { useStreamLocale } from "../../../components/stream-locale"
import { AccountProfile } from "../../../components/account/account-profile"
import { AccountSettings } from "../../../components/account/account-settings"
import { useCommunitySession } from "../../../lib/stream-auth"
import { useUnreadCount } from "../../../lib/community-queries"
import { FollowedPages, ManagedPages, NotificationInbox } from "../components/account-sections"
import { SignInPrompt } from "../components/sign-in-prompt"

type AccountTab = "profile" | "settings" | "follows" | "notifications" | "pages"
const accountTabs: [AccountTab, [string, string]][] = [
  ["profile", ["Hồ sơ", "Profile"]],
  ["settings", ["Cài đặt", "Settings"]],
  ["follows", ["Đang theo dõi", "Following"]],
  ["notifications", ["Thông báo", "Notifications"]],
  ["pages", ["Trang & yêu cầu", "Pages & requests"]],
]

/** `/account`: the reader's profile, settings, follows, notifications and pages, one section per tab. */
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
