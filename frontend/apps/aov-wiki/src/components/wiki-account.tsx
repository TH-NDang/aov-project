import { useEffect, useState } from "react"
import { WikiIcon } from "./wiki-icon"
import { Link, useNavigate } from "react-router"
import { PublicAccountMenu, PublicAccountSummary } from "@aov/ui/components/public-account-menu"
import { publicAuthError } from "@aov/ui/lib/public-auth"
import { useWikiContext, wikiText } from "../context/wiki-context"
import { WikiHeader } from "./wiki-header"
import { signIn, signOut, completeLogin, useWikiSession } from "../lib/wiki-auth"
import "./wiki-account.css"

export function WikiAccountMenu({ inline = false }: { inline?: boolean }) {
  const { locale, setLocale, href } = useWikiContext()
  const session = useWikiSession()
  const settings =
    session.status === "authenticated" ? (
      <Link to={href("/account")}>
        <WikiIcon name="settings" size={17} />
        {wikiText(locale, "Cài đặt tài khoản", "Account settings")}
      </Link>
    ) : undefined
  const accountProps = {
    product: "wiki" as const,
    locale,
    onLocaleChange: setLocale,
    languages: [
      { code: "vi-VN", name: "Tiếng Việt" },
      { code: "en-US", name: "English" },
    ],
    name: session.status === "authenticated" ? session.name : undefined,
    loading: session.status === "loading",
    onSignIn: () => signIn(),
    onSignOut: () => signOut(),
    children: settings,
  }
  return inline ? (
    <div className="public-account-panel public-account-inline" data-product="wiki">
      <PublicAccountSummary {...accountProps} />
    </div>
  ) : (
    <PublicAccountMenu {...accountProps} />
  )
}

export function WikiLoginCallback() {
  const navigate = useNavigate()
  const { locale, href } = useWikiContext()
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    void completeLogin()
      .then((path) => {
        if (active) navigate(path, { replace: true })
      })
      .catch(() => {
        if (active) setError(true)
      })
    return () => {
      active = false
    }
  }, [navigate])
  return (
    <>
      <WikiHeader />
      <main id="main" tabIndex={-1} className="wiki-login-callback wiki-mascot-state">
        <h1>
          {error
            ? wikiText(locale, "Đăng nhập chưa hoàn tất", "Sign-in incomplete")
            : wikiText(locale, "Đang hoàn tất đăng nhập…", "Completing sign-in…")}
        </h1>
        {error ? (
          <>
            <p role="alert">{publicAuthError(locale)}</p>
            <div className="wiki-login-callback-actions">
              <button
                type="button"
                className="wiki-button"
                data-primary=""
                onClick={() => void signIn().catch(() => setError(true))}
              >
                {wikiText(locale, "Thử đăng nhập lại", "Try again")}
              </button>
              <Link className="wiki-button" to={href("/")}>
                {wikiText(locale, "Về trang chủ", "Back home")}
              </Link>
            </div>
          </>
        ) : (
          <p role="status">
            {wikiText(
              locale,
              "Bạn sẽ trở lại trang đang xem trong giây lát.",
              "You will return to your previous page shortly.",
            )}
          </p>
        )}
      </main>
    </>
  )
}
