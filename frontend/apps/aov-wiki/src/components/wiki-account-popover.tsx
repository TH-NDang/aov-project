import { useState } from "react"
import { Link, useLocation } from "react-router"
import { LogIn, LogOut } from "lucide-react"
import { AccountAvatar } from "@aov/ui/components/public-account-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/public-overlay"
import { useWikiContext, useWikiText } from "../context/wiki-context"
import { signIn, signOut, useWikiSession } from "../lib/wiki-auth"
import { WikiIcon } from "./wiki-icon"
import "./wiki-account-popover.css"

/**
 * The account button of the wide header and its panel, opened on click like the market panel beside it. Signed out,
 * the panel says what an account is for and offers to sign in; signed in, it shows the reader's picture or initial and
 * name, then the account page and signing out. Display settings live in the market panel.
 */
export function WikiAccountPopover() {
  const { href } = useWikiContext()
  const t = useWikiText()
  const session = useWikiSession()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [openedAt, setOpenedAt] = useState(pathname)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const signedIn = session.status === "authenticated"
  const name = signedIn ? session.name : undefined
  // A new page closes the panel.
  if (open && openedAt !== pathname) setOpen(false)

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        setOpenedAt(pathname)
      }}
    >
      <PopoverTrigger className="wiki-account-trigger" aria-label={t("Tài khoản", "Account")}>
        <AccountAvatar name={name} className="wiki-account-avatar" />
      </PopoverTrigger>
      <PopoverContent
        className="wiki-account-panel"
        drawerTitle={t("Tài khoản", "Account")}
        align="end"
        sideOffset={10}
      >
        <div className="wiki-account-head">
          <AccountAvatar name={name} className="wiki-account-avatar wiki-account-avatar-large" />
          <span>
            <strong>{name || t("Chưa đăng nhập", "Not signed in")}</strong>
            <small>{t("Một tài khoản cho Wiki và Stream", "One account for Wiki and Stream")}</small>
          </span>
        </div>
        {signedIn ? (
          <nav className="wiki-account-rows" aria-label={t("Tài khoản", "Account")}>
            <Link to={href("/account")} onClick={() => setOpen(false)}>
              <WikiIcon name="settings" size={18} />
              {t("Cài đặt tài khoản", "Account settings")}
            </Link>
            <button type="button" onClick={() => signOut()}>
              <LogOut size={18} aria-hidden="true" />
              {t("Đăng xuất", "Sign out")}
            </button>
          </nav>
        ) : (
          <button
            type="button"
            className="wiki-account-signin"
            disabled={pending || session.status === "loading"}
            onClick={() => {
              setPending(true)
              setFailed(false)
              void signIn()
                .catch(() => setFailed(true))
                .finally(() => setPending(false))
            }}
          >
            <LogIn size={18} aria-hidden="true" />
            {pending || session.status === "loading" ? t("Đang kết nối…", "Connecting…") : t("Đăng nhập", "Sign in")}
          </button>
        )}
        {failed && (
          <p className="wiki-account-error" role="alert">
            {t("Chưa mở được đăng nhập. Thử lại nhé.", "Could not open sign-in. Try again.")}
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
