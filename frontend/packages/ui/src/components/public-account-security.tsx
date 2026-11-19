import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { RefreshCw } from "lucide-react"
import type { AccountAction, AccountActionResult, SignInOptions } from "../lib/public-auth"
import type { AccountSecurityApi, SecurityOverview, SessionList } from "../lib/account-security"
import { actionNotice, type Notice, type Text } from "../lib/account-security-model"
import { localeText } from "@aov/ui/lib/locale-text"
import { PasswordSection } from "./account-security/password-section"
import { SessionsSection } from "./account-security/sessions-section"
import { TwoFactorSection } from "./account-security/two-factor-section"
import "./public-account-security.css"

export type PublicAccountSecurityProps = {
  locale: string
  api: AccountSecurityApi
  /** Opens the AOV sign-in pages of the identity provider for an account action. */
  startAction: (action: AccountAction, options?: Pick<SignInOptions, "reauthenticate">) => Promise<void>
  /** Result of the action that just returned from the identity provider, if any. */
  actionResult?: AccountActionResult | null
}

/** Account settings shared by the public apps: password, signed-in devices and two-step sign-in (ADR-028). */
export function PublicAccountSecurity({ locale, api, startAction, actionResult }: PublicAccountSecurityProps) {
  const text: Text = useMemo(() => localeText(locale), [locale])
  const [overview, setOverview] = useState<SecurityOverview | null>(null)
  const [sessions, setSessions] = useState<SessionList | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const handled = useRef(false)

  const refresh = useCallback(async () => {
    setLoadError(false)
    try {
      const [nextOverview, nextSessions] = await Promise.all([api.overview(), api.sessions()])
      setOverview(nextOverview)
      setSessions(nextSessions)
      return nextOverview
    } catch {
      setLoadError(true)
      return null
    }
  }, [api])

  useEffect(() => {
    if (handled.current) return
    handled.current = true
    void (async () => {
      const result = actionResult
      if (result?.action === "CONFIGURE_TOTP" && result.status === "success") {
        // The authenticator is set; show the one-time recovery codes right away.
        setNotice({ tone: "info", message: text("Đang mở trang mã khôi phục…", "Opening recovery codes…") })
        await startAction("CONFIGURE_RECOVERY_AUTHN_CODES").catch(() =>
          setNotice({
            tone: "error",
            message: text("Chưa mở được trang mã khôi phục.", "Could not open the recovery codes page."),
          }),
        )
        return
      }
      if (result?.action.startsWith("delete_credential:") && result.status === "success") {
        await api.removeRecoveryCodes().catch(() => undefined)
      }
      await refresh()
      if (result) setNotice(actionNotice(result, text))
    })()
  }, [actionResult, api, refresh, startAction, text])

  return (
    <div className="public-account-security">
      <header className="pas-intro">
        <h1>{text("Cài đặt tài khoản", "Account settings")}</h1>
        <p>
          {text(
            "Tài khoản AOV dùng chung cho Wiki và Stream. Thay đổi ở đây áp dụng cho mọi ứng dụng.",
            "Your AOV account is shared by Wiki and Stream. Changes here apply everywhere.",
          )}
        </p>
        {overview?.email && (
          <p className="pas-email">
            {overview.email}
            <span className={overview.emailVerified ? "pas-badge pas-badge-ok" : "pas-badge"}>
              {overview.emailVerified ? text("Đã xác minh", "Verified") : text("Chưa xác minh", "Not verified")}
            </span>
          </p>
        )}
      </header>
      {notice && (
        <p className={`pas-notice pas-notice-${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>
          {notice.message}
        </p>
      )}
      {loadError && (
        <div className="pas-notice pas-notice-error" role="alert">
          <span>
            {text(
              "Chưa kết nối được máy chủ tài khoản. Vui lòng thử lại.",
              "Could not reach the account server. Please try again.",
            )}
          </span>
          <button type="button" className="pas-button" onClick={() => void refresh()}>
            <RefreshCw size={16} aria-hidden="true" />
            {text("Thử lại", "Retry")}
          </button>
        </div>
      )}
      {!overview && !loadError ? (
        <p className="pas-muted" role="status">
          {text("Đang tải cài đặt…", "Loading settings…")}
        </p>
      ) : null}
      {overview && (
        <>
          <PasswordSection
            overview={overview}
            api={api}
            locale={locale}
            text={text}
            onChanged={async (message) => {
              setNotice({ tone: "success", message })
              await refresh()
            }}
          />
          <SessionsSection sessions={sessions} api={api} locale={locale} text={text} onChanged={refresh} />
          <TwoFactorSection
            overview={overview}
            api={api}
            locale={locale}
            text={text}
            startAction={startAction}
            onChanged={refresh}
          />
        </>
      )}
    </div>
  )
}
