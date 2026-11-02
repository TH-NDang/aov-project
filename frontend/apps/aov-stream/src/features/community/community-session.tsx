import { useEffect, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@aov/ui/components/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { completeLogin, signIn, signOut, useCommunitySession } from "./community-auth"
import { useNotifications, useReadNotifications, useUnreadCount } from "./community-queries"
import { timeAgo } from "./community-ui"
import { StreamShell } from "../../components/stream-shell"
import { StreamIcon, type StreamIconName } from "../../components/stream-icon"
import { AccountAvatar } from "../account/account-profile"
import { useOwnProfile } from "../account/profile-api"

export function CommunitySessionButton() {
  const session = useCommunitySession()
  const [error, setError] = useState("")
  if (session.status === "loading")
    return <span className="hub-session-pending" role="status" aria-label="Đang đăng nhập" />
  if (session.status !== "authenticated")
    return (
      <div className="cp-session">
        <button
          className="hub-signin"
          onClick={() => {
            setError("")
            void signIn().catch(() => setError("Chưa mở được đăng nhập."))
          }}
        >
          Đăng nhập
        </button>
        <button
          className="hub-signup"
          onClick={() => {
            setError("")
            void signIn(true).catch(() => setError("Chưa mở được đăng ký."))
          }}
        >
          Đăng ký
        </button>
        {error && (
          <span className="cp-session-error" role="alert">
            {error}
          </span>
        )}
      </div>
    )
  return (
    <div className="cp-session">
      <NotificationBell />
      <AccountMenu />
    </div>
  )
}

function NotificationBell() {
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
          aria-label={count ? `Thông báo, ${count} chưa đọc` : "Thông báo"}
          title="Thông báo"
        >
          <StreamIcon name="bell" size={18} />
          {count > 0 && <span className="hub-badge">{count > 99 ? "99+" : count}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="hub-popover hub-notifications">
        <div className="hub-popover-header">
          <strong>Thông báo</strong>
          <button className="cp-text-button" disabled={!count || read.all.isPending} onClick={() => read.all.mutate()}>
            Đánh dấu đã đọc tất cả
          </button>
        </div>
        {latest.isPending && <div className="hub-skeleton-rows" role="status" aria-label="Đang tải thông báo" />}
        {latest.isError && <p className="hub-popover-empty">Chưa tải được thông báo.</p>}
        {latest.data && !latest.data.items.length && (
          <p className="hub-popover-empty">Bạn chưa có thông báo. Theo dõi trang để nhận tin bài mới.</p>
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
              <time dateTime={item.createdAt}>{timeAgo(item.createdAt)}</time>
            </button>
          ))}
        </div>
        <Link className="hub-popover-footer" to="/account?tab=notifications" onClick={() => setOpen(false)}>
          Xem tất cả thông báo
        </Link>
      </PopoverContent>
    </Popover>
  )
}

const accountLinks: { to: string; label: string; icon: StreamIconName }[] = [
  { to: "/account", label: "Hồ sơ của tôi", icon: "user" },
  { to: "/account?tab=follows", label: "Trang đang theo dõi", icon: "heart" },
  { to: "/account?tab=notifications", label: "Thông báo", icon: "bell" },
  { to: "/account?tab=pages", label: "Trang tôi quản lý", icon: "shield" },
]

function AccountMenu() {
  const session = useCommunitySession()
  const profile = useOwnProfile()
  const location = useLocation()
  const name = profile.data?.displayName || session.name
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="account-session-link"
          aria-label={`Tài khoản: ${name}`}
          data-current={location.pathname === "/account" || undefined}
        >
          <AccountAvatar url={profile.data?.avatarUrl} name={name} />
          <span>{name}</span>
          <StreamIcon name="chevronRight" size={14} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="hub-popover hub-account-menu">
        <div className="hub-account-summary">
          <AccountAvatar url={profile.data?.avatarUrl} name={name} large />
          <span>
            <strong>{name}</strong>
            <small>Thành viên cộng đồng</small>
          </span>
        </div>
        <DropdownMenuSeparator />
        {accountLinks.map((item) => (
          <DropdownMenuItem key={item.to} asChild className="hub-menu-item">
            <Link to={item.to}>
              <StreamIcon name={item.icon} size={16} />
              {item.label}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="hub-menu-item" variant="destructive" onSelect={() => signOut()}>
          <StreamIcon name="logout" size={16} />
          Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function CommunityLoginCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState("")
  useEffect(() => {
    let active = true
    void completeLogin()
      .then((path) => {
        if (active) navigate(path, { replace: true })
      })
      .catch((error) => {
        if (active) setError(error.message)
      })
    return () => {
      active = false
    }
  }, [navigate])
  return (
    <StreamShell>
      <div className="cp-container">
        <section className="hub-state">
          <StreamIcon name={error ? "info" : "clock"} size={32} />
          <h1>{error ? "Đăng nhập chưa hoàn tất" : "Đang hoàn tất đăng nhập…"}</h1>
          {error && (
            <>
              <p role="alert">{error}</p>
              <div className="hub-state-actions">
                <button className="cp-button cp-primary" onClick={() => void signIn()}>
                  Thử đăng nhập lại
                </button>
                <Link className="cp-button" to="/pages">
                  Về cộng đồng
                </Link>
              </div>
            </>
          )}
        </section>
      </div>
    </StreamShell>
  )
}
