import { useEffect, useMemo, useState } from "react"
import { PublicAccountSecurity } from "@aov/ui/components/public-account-security"
import { createAccountSecurityApi } from "@aov/ui/lib/account-security"
import { WikiHeader } from "../../components/wiki-header"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { CatalogHeading } from "../../layout/catalog-heading"
import {
  signIn,
  startAccountAction,
  accountActionResult,
  clearAccountActionResult,
  useWikiSession,
  wikiAccessToken,
} from "../../lib/wiki-auth"
import { SITE_NAME } from "../../lib/seo/page-meta"
import "./account.css"

/** Password, signed-in devices and two-step sign-in of the reader's account, which Wiki and Stream share. */
export function AccountSettingsPage() {
  const { locale } = useWikiContext()
  const session = useWikiSession()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const api = useMemo(() => createAccountSecurityApi(wikiAccessToken), [])
  // The callback stores the result of the Keycloak action that brought the reader back; keep it for this visit only.
  const [actionResult] = useState(accountActionResult)
  useEffect(() => clearAccountActionResult(), [])
  const [signInError, setSignInError] = useState(false)
  return (
    <>
      <title>{text(`Cài đặt tài khoản — ${SITE_NAME}`, `Account settings — ${SITE_NAME}`)}</title>
      <WikiHeader />
      <main id="main" tabIndex={-1} className="wiki-account-page">
        {session.status === "authenticated" ? (
          <PublicAccountSecurity
            key={session.revision}
            locale={locale}
            api={api}
            startAction={startAccountAction}
            actionResult={actionResult}
          />
        ) : (
          <>
            <CatalogHeading
              title={text("Cài đặt tài khoản", "Account settings")}
              lead={
                session.status === "loading"
                  ? text("Đang hoàn tất đăng nhập…", "Completing sign-in…")
                  : text(
                      "Đăng nhập để đổi mật khẩu, xem thiết bị đang đăng nhập và bật xác thực hai bước.",
                      "Sign in to change your password, review signed-in devices and turn on two-step sign-in.",
                    )
              }
              compact
            />
            {session.status === "anonymous" && (
              <div className="wiki-account-signin">
                <button
                  type="button"
                  className="wiki-button"
                  data-primary=""
                  onClick={() => {
                    setSignInError(false)
                    void signIn().catch(() => setSignInError(true))
                  }}
                >
                  {text("Đăng nhập", "Sign in")}
                </button>
                {signInError && (
                  <p role="alert">
                    {text("Chưa mở được đăng nhập. Vui lòng thử lại.", "Could not open sign-in. Try again.")}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </>
  )
}
