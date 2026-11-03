import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router"
import { PublicAccountMenu, PublicAccountSummary } from "@aov/ui/components/public-account-menu"
import { publicAuthError } from "@aov/ui/lib/public-auth"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { WikiHeader } from "../../components/wiki-header"
import { signIn, signOut, completeLogin, useWikiSession } from "./wiki-auth"

export function WikiAccountMenu({ inline = false }: { inline?: boolean }) {
  const { locale, setLocale } = useWikiContext()
  const session = useWikiSession()
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
      <main id="main" className="mx-auto grid max-w-lg flex-1 content-center gap-5 p-8 text-center">
        <img src="/images/mole-logo-v4.png" alt="" width={72} height={72} className="mx-auto rounded-2xl" />
        <h1 className="text-xl font-bold text-gold">
          {error
            ? wikiText(locale, "Đăng nhập chưa hoàn tất", "Sign-in incomplete")
            : wikiText(locale, "Đang hoàn tất đăng nhập…", "Completing sign-in…")}
        </h1>
        {error ? (
          <>
            <p role="alert">{publicAuthError(locale)}</p>
            <button
              className="rounded-lg border border-gold/40 p-3 text-gold"
              onClick={() => void signIn().catch(() => setError(true))}
            >
              {wikiText(locale, "Thử đăng nhập lại", "Try again")}
            </button>
            <Link to={href("/")}>{wikiText(locale, "Về trang chủ", "Back home")}</Link>
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
