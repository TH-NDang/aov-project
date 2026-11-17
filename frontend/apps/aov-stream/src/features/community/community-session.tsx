import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "react-router"
import { PublicAccountMenu, PublicAccountSettings, PublicAccountSummary } from "@aov/ui/components/public-account-menu"
import { PublicPreferencesDrawer } from "@aov/ui/components/public-preferences-drawer"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useAccountCurrency } from "@aov/ui/lib/currency"
import { publicAuthError } from "@aov/ui/lib/public-auth"
import { useAccountTimeZone } from "@aov/ui/lib/time-zone"
import { useStreamTheme } from "../../components/stream-theme"
import { useStreamLocale } from "../../components/stream-locale"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/public-overlay"
import { completeLogin, signIn, signOut, useCommunitySession } from "./community-auth"
import { useNotifications, useReadNotifications, useUnreadCount } from "./community-queries"
import { TimeAgo } from "./community-ui"
import { StreamShell, WIKI_URL } from "../../components/stream-shell"
import owlMark from "../../assets/stream-owl.svg"
import { StreamIcon, type StreamIconName } from "../../components/stream-icon"
import { profileKey, saveProfile, useOwnProfile, wikiRequest } from "../account/profile-api"
import { profileDraft, profileRequest, type UserProfile } from "../account/profile-model"
import { useAccountDateFormat } from "@aov/ui/lib/time-zone"

export function CommunitySessionButton() {
  const session = useCommunitySession()
  const profile = useOwnProfile()
  const client = useQueryClient()
  useAccountTimeZone(profile.data, async (timeZone) => {
    // Wiki and Admin share this profile, so the copy on this page may be out of date.
    const latest = await wikiRequest<UserProfile>("/users/me")
    const saved = await saveProfile(profileRequest({ ...profileDraft(latest), timeZone }, latest.version))
    client.setQueryData(profileKey(session.revision), saved)
  })
  useAccountDateFormat(profile.data, async (dateFormat) => {
    const latest = await wikiRequest<UserProfile>("/users/me")
    const saved = await saveProfile({ ...profileRequest(profileDraft(latest), latest.version), dateFormat })
    client.setQueryData(profileKey(session.revision), saved)
  })
  useAccountCurrency(profile.data, async (currency) => {
    const latest = await wikiRequest<UserProfile>("/users/me")
    const saved = await saveProfile(profileRequest({ ...profileDraft(latest), currency }, latest.version))
    client.setQueryData(profileKey(session.revision), saved)
  })
  const { locale, setLocale, text } = useStreamLocale()
  const { theme, setTheme } = useStreamTheme()
  const mobile = usePageLayout() === "compact"
  const accountProps = {
    product: "stream" as const,
    locale,
    onLocaleChange: setLocale,
    theme,
    onThemeChange: setTheme,
    name: session.status === "authenticated" ? profile.data?.displayName || session.name : undefined,
    avatarUrl: session.status === "authenticated" ? profile.data?.avatarUrl : undefined,
    loading: session.status === "loading",
    onSignIn: () => signIn(),
    onSignOut: () => signOut(),
  }
  const links =
    session.status === "authenticated" &&
    accountLinks.map((item) => (
      <Link key={item.to} to={item.to}>
        <StreamIcon name={item.icon} size={16} />
        {text(item.label, item.english)}
      </Link>
    ))
  const wikiLogoUrl = new URL("images/mole-logo-v4.png", `${WIKI_URL.replace(/\/$/, "")}/`).href
  return (
    <div className="cp-session">
      {session.status === "authenticated" && <NotificationBell />}
      {mobile ? (
        <PublicPreferencesDrawer
          product="stream"
          locale={locale}
          trigger={
            <button type="button" className="public-account-trigger" aria-label={text("Tùy chọn", "Preferences")}>
              <StreamIcon name="more" size={20} />
            </button>
          }
        >
          <PublicAccountSummary {...accountProps} />
          {links && <div className="public-account-links">{links}</div>}
          <div className="public-preferences-label">{text("Chọn ứng dụng", "Choose application")}</div>
          <nav className="public-preferences-apps" aria-label={text("Chọn ứng dụng", "Choose application")}>
            <a className="public-preferences-app" href={WIKI_URL}>
              <img src={wikiLogoUrl} alt="" width={30} height={30} />
              <span>
                <strong>AOV WiKi</strong>
                <small>{text("Mở ứng dụng", "Open app")}</small>
              </span>
              <StreamIcon name="chevronRight" size={13} />
            </a>
            <Link className="public-preferences-app" data-current="true" aria-current="true" to="/">
              <img src={owlMark} alt="" width={30} height={30} />
              <span>
                <strong>AOV Stream</strong>
                <small>{text("Đang xem", "Current")}</small>
              </span>
              <StreamIcon name="check" size={13} />
            </Link>
          </nav>
          <div className="public-preferences-label">{text("Cài đặt", "Settings")}</div>
          <PublicAccountSettings {...accountProps} />
        </PublicPreferencesDrawer>
      ) : (
        <PublicAccountMenu {...accountProps}>{links}</PublicAccountMenu>
      )}
    </div>
  )
}

function NotificationBell() {
  const { text } = useStreamLocale()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const unread = useUnreadCount()
  const latest = useNotifications(0, 8)
  const read = useReadNotifications()
  const count = unread.data?.unread ?? 0
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="hub-icon-button hub-bell"
          aria-label={
            count
              ? text(`Thông báo, ${count} chưa đọc`, `Notifications, ${count} unread`)
              : text("Thông báo", "Notifications")
          }
          title={text("Thông báo", "Notifications")}
        >
          <StreamIcon name="bell" size={18} />
          {count > 0 && <span className="hub-badge">{count > 99 ? "99+" : count}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="hub-popover hub-notifications"
        drawerTitle={text("Thông báo", "Notifications")}
      >
        <div className="hub-popover-header">
          <strong>{text("Thông báo", "Notifications")}</strong>
          <button className="cp-text-button" disabled={!count || read.all.isPending} onClick={() => read.all.mutate()}>
            {text("Đánh dấu đã đọc tất cả", "Mark all as read")}
          </button>
        </div>
        {latest.isPending && (
          <div
            className="hub-skeleton-rows"
            role="status"
            aria-label={text("Đang tải thông báo", "Loading notifications")}
          />
        )}
        {latest.isError && (
          <p className="hub-popover-empty">{text("Chưa tải được thông báo.", "Notifications could not be loaded.")}</p>
        )}
        {latest.data && !latest.data.items.length && (
          <p className="hub-popover-empty">
            {text(
              "Bạn chưa có thông báo. Theo dõi trang để nhận tin bài mới.",
              "You have no notifications yet. Follow pages to hear about new posts.",
            )}
          </p>
        )}
        <div className="hub-notification-list">
          {latest.data?.items.map((item) => (
            <button
              key={item.id}
              className="hub-notification"
              data-unread={!item.read || undefined}
              onClick={() => {
                if (!item.read) read.one.mutate(item.id)
                setOpen(false)
                navigate(`/pages/${item.pageId}`)
              }}
            >
              <span>{item.message}</span>
              <TimeAgo value={item.createdAt} />
            </button>
          ))}
        </div>
        <Link className="hub-popover-footer" to="/account?tab=notifications" onClick={() => setOpen(false)}>
          {text("Xem tất cả thông báo", "See all notifications")}
        </Link>
      </PopoverContent>
    </Popover>
  )
}

const accountLinks: { to: string; label: string; english: string; icon: StreamIconName }[] = [
  { to: "/account", label: "Hồ sơ của tôi", english: "My profile", icon: "user" },
  { to: "/account?tab=follows", label: "Trang đang theo dõi", english: "Following", icon: "heart" },
  { to: "/account?tab=notifications", label: "Thông báo", english: "Notifications", icon: "bell" },
  { to: "/account?tab=pages", label: "Trang tôi quản lý", english: "My pages", icon: "building" },
]

export function CommunityLoginCallback() {
  const { locale, text } = useStreamLocale()
  const navigate = useNavigate()
  const [error, setError] = useState("")
  useEffect(() => {
    let active = true
    void completeLogin()
      .then((path) => {
        if (active) navigate(path, { replace: true })
      })
      .catch(() => {
        if (active) setError(publicAuthError(locale))
      })
    return () => {
      active = false
    }
  }, [navigate, locale])
  return (
    <StreamShell>
      <div className="cp-container">
        <section className="hub-state">
          <h1>
            {error
              ? text("Đăng nhập chưa hoàn tất", "Sign-in incomplete")
              : text("Đang hoàn tất đăng nhập…", "Completing sign-in…")}
          </h1>
          {error && (
            <>
              <p role="alert">{error}</p>
              <div className="hub-state-actions">
                <button
                  className="cp-button cp-primary"
                  onClick={() => void signIn().catch(() => setError(publicAuthError(locale)))}
                >
                  {text("Thử đăng nhập lại", "Try again")}
                </button>
                <Link className="cp-button" to="/">
                  {text("Về trang chủ", "Back to home")}
                </Link>
              </div>
            </>
          )}
        </section>
      </div>
    </StreamShell>
  )
}
