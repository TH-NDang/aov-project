import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router"
import { PublicAccountSecurity } from "@aov/ui/components/public-account-security"
import { createAccountSecurityApi } from "@aov/ui/lib/account-security"
import { WikiHeader } from "../../components/wiki-header"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import {
  signIn,
  startAccountAction,
  accountActionResult,
  clearAccountActionResult,
  useWikiSession,
  wikiAccessToken,
} from "../auth/wiki-auth"

export function AccountSettingsPage() {
  const { href, locale } = useWikiContext()
  const session = useWikiSession()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const api = useMemo(() => createAccountSecurityApi(wikiAccessToken), [])
  // The callback stores the result of the Keycloak action that brought the reader back; keep it for this visit only.
  const [actionResult] = useState(accountActionResult)
  useEffect(() => clearAccountActionResult(), [])
  const [signInError, setSignInError] = useState(false)
  return (
    <>
      <title>{text("Cài đặt tài khoản — AOV Wiki", "Account settings — AOV Wiki")}</title>
      <WikiHeader />
      <main id="main" className="wiki-account-page">
        <Link to={href("/")} className="text-sm text-gold">
          ← {text("Về trang chủ", "Back home")}
        </Link>
        {session.status === "authenticated" ? (
          <PublicAccountSecurity
            key={session.revision}
            locale={locale}
            api={api}
            startAction={startAccountAction}
            actionResult={actionResult}
          />
        ) : (
          <section className="wiki-account-signin">
            <h1>{text("Cài đặt tài khoản", "Account settings")}</h1>
            <p>
              {session.status === "loading"
                ? text("Đang hoàn tất đăng nhập…", "Completing sign-in…")
                : text(
                    "Đăng nhập để đổi mật khẩu, xem thiết bị đang đăng nhập và bật xác thực hai bước.",
                    "Sign in to change your password, review signed-in devices and turn on two-step sign-in.",
                  )}
            </p>
            {session.status === "anonymous" && (
              <button
                type="button"
                className="wiki-account-signin-button"
                onClick={() => {
                  setSignInError(false)
                  void signIn().catch(() => setSignInError(true))
                }}
              >
                {text("Đăng nhập", "Sign in")}
              </button>
            )}
            {signInError && (
              <p role="alert">
                {text("Chưa mở được đăng nhập. Vui lòng thử lại.", "Could not open sign-in. Try again.")}
              </p>
            )}
          </section>
        )}
      </main>
    </>
  )
}
