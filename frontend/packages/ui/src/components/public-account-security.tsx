import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"
import { KeyRound, Laptop, LogOut, MonitorSmartphone, RefreshCw, ShieldCheck, Smartphone } from "lucide-react"
import type { AccountAction, AccountActionResult, SignInOptions } from "../lib/public-auth"
import {
  AccountSecurityError,
  applicationName,
  deviceName,
  type AccountSecurityApi,
  type AccountSession,
  type PasswordChallenge,
  type SecurityOverview,
  type SessionList,
} from "../lib/account-security"
import { LocalTime } from "./local-time"
import { isEnglishLocale, localeText } from "@aov/ui/lib/locale-text"
import "./public-account-security.css"

type Text = (vi: string, en: string) => string
type Notice = { tone: "success" | "info" | "error"; message: string } | null

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

function actionNotice(result: AccountActionResult, text: Text): Notice {
  if (result.status === "cancelled") return { tone: "info", message: text("Bạn đã hủy thao tác.", "You cancelled.") }
  if (result.status === "error")
    return { tone: "error", message: text("Thao tác chưa hoàn tất. Vui lòng thử lại.", "The action did not finish.") }
  if (result.action === "CONFIGURE_RECOVERY_AUTHN_CODES")
    return {
      tone: "success",
      message: text(
        "Đã tạo mã khôi phục mới. Xác thực hai bước đang bật.",
        "New recovery codes were created. Two-step sign-in is on.",
      ),
    }
  if (result.action.startsWith("delete_credential:"))
    return { tone: "success", message: text("Đã tắt xác thực hai bước.", "Two-step sign-in is off.") }
  return { tone: "success", message: text("Đã lưu thay đổi.", "Saved.") }
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="pas-section">
      <h2>
        {icon}
        {title}
      </h2>
      {children}
    </section>
  )
}

/** The parts of one line of facts, with a dot between the ones that are there. */
function factLine(parts: ReactNode[]) {
  return parts
    .filter(Boolean)
    .flatMap((part, at) => (at === 0 ? [part] : [" · ", part]))
    .map((part, at) => <Fragment key={at}>{part}</Fragment>)
}

function relative(value: string | null, locale: string) {
  if (!value) return null
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000)
  const format = new Intl.RelativeTimeFormat(isEnglishLocale(locale) ? "en" : "vi", { numeric: "auto" })
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ]
  for (const [unit, size] of units)
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit)
  return format.format(0, "minute")
}

function passwordError(error: unknown, text: Text) {
  if (!(error instanceof AccountSecurityError))
    return text("Chưa thực hiện được. Vui lòng thử lại.", "Something went wrong. Please try again.")
  switch (error.code) {
    case "USER_PASSWORD_CODE_INVALID": {
      const left = Number(error.context.attemptsRemaining ?? 0)
      return left > 0
        ? text(`Mã chưa đúng. Còn ${left} lần thử.`, `Incorrect code. ${left} attempts left.`)
        : text(
            "Mã chưa đúng và đã hết lượt thử. Hãy gửi mã mới.",
            "Incorrect code and no attempts left. Send a new code.",
          )
    }
    case "USER_PASSWORD_CODE_EXPIRED":
      return text("Mã đã hết hạn hoặc không còn dùng được. Hãy gửi mã mới.", "The code expired. Send a new code.")
    case "USER_PASSWORD_CODE_RATE_LIMITED": {
      const seconds = Number(error.context.retryAfterSeconds ?? 60)
      const minutes = Math.ceil(seconds / 60)
      return text(
        `Bạn đã yêu cầu nhiều mã. Thử lại sau ${seconds < 120 ? `${seconds} giây` : `${minutes} phút`}.`,
        `Too many codes requested. Try again in ${seconds < 120 ? `${seconds} seconds` : `${minutes} minutes`}.`,
      )
    }
    case "USER_PASSWORD_REJECTED":
      return policyMessage(String(error.context.policy ?? ""), text)
    case "USER_PASSWORD_CHANGE_IN_PROGRESS":
      return text("Yêu cầu đổi mật khẩu đang được xử lý.", "The password change is already being applied.")
    case "USER_EMAIL_MISSING":
      return text("Tài khoản chưa có email để nhận mã.", "Your account has no email to receive the code.")
    case "USER_MAIL_UNAVAILABLE":
      return text("Chưa gửi được email. Vui lòng thử lại sau.", "The email could not be sent. Try again later.")
    case "USER_PASSWORD_CHALLENGE_NOT_FOUND":
      return text("Không tìm thấy yêu cầu đổi mật khẩu. Hãy gửi mã mới.", "Request not found. Send a new code.")
    default:
      return text("Chưa thực hiện được. Vui lòng thử lại.", "Something went wrong. Please try again.")
  }
}

function policyMessage(policy: string, text: Text) {
  if (policy.includes("MinLength")) return text("Mật khẩu quá ngắn so với yêu cầu.", "The password is too short.")
  if (policy.includes("History"))
    return text("Không dùng lại mật khẩu đã dùng gần đây.", "Do not reuse a recent password.")
  if (policy.includes("NotUsername") || policy.includes("NotEmail"))
    return text(
      "Mật khẩu không được trùng tên đăng nhập hoặc email.",
      "The password must not match your username or email.",
    )
  if (policy.includes("Blacklist"))
    return text("Mật khẩu này quá phổ biến. Hãy chọn mật khẩu khác.", "This password is too common.")
  return text(
    "Mật khẩu chưa đạt yêu cầu bảo mật. Thêm chữ hoa, chữ số hoặc ký tự đặc biệt rồi thử lại.",
    "The password does not meet the security rules. Add capitals, digits or symbols and try again.",
  )
}

function PasswordSection({
  overview,
  api,
  locale,
  text,
  onChanged,
}: {
  overview: SecurityOverview
  api: AccountSecurityApi
  locale: string
  text: Text
  onChanged: (message: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [visible, setVisible] = useState(false)
  const [challenge, setChallenge] = useState<PasswordChallenge | null>(null)
  const [code, setCode] = useState("")
  const [signOutOthers, setSignOutOthers] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [now, setNow] = useState(() => Date.now())
  const id = useId()
  useEffect(() => {
    if (!challenge) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [challenge])
  const hasPassword = overview.password.set

  function reset() {
    setOpen(false)
    setPassword("")
    setConfirmation("")
    setChallenge(null)
    setCode("")
    setError("")
    setSignOutOthers(true)
  }

  async function sendCode(event?: FormEvent) {
    event?.preventDefault()
    if (password.length < 8) return setError(text("Mật khẩu cần ít nhất 8 ký tự.", "Use at least 8 characters."))
    if (password !== confirmation) return setError(text("Mật khẩu nhập lại chưa khớp.", "The passwords do not match."))
    setBusy(true)
    setError("")
    try {
      setChallenge(await api.startPasswordChange(locale))
      setCode("")
    } catch (failure) {
      setError(passwordError(failure, text))
    } finally {
      setBusy(false)
    }
  }

  async function confirm(event: FormEvent) {
    event.preventDefault()
    if (!challenge) return
    if (!/^[0-9]{6}$/.test(code)) return setError(text("Nhập đủ 6 chữ số của mã.", "Enter the 6-digit code."))
    setBusy(true)
    setError("")
    try {
      const result = await api.confirmPasswordChange(challenge.challengeId, {
        code,
        newPassword: password,
        signOutOtherSessions: signOutOthers,
        language: locale,
      })
      reset()
      await onChanged(
        result.otherSessions === "SIGNED_OUT"
          ? text(
              `Đã đổi mật khẩu và đăng xuất ${result.signedOut} thiết bị khác.`,
              `Password changed and ${result.signedOut} other devices signed out.`,
            )
          : result.otherSessions === "FAILED"
            ? text(
                "Đã đổi mật khẩu nhưng chưa đăng xuất được thiết bị khác. Hãy dùng nút đăng xuất bên dưới.",
                "Password changed, but other devices are still signed in. Use the sign-out button below.",
              )
            : text("Đã đổi mật khẩu.", "Password changed."),
      )
    } catch (failure) {
      setError(passwordError(failure, text))
    } finally {
      setBusy(false)
    }
  }

  const resendIn = challenge
    ? Math.max(0, Math.ceil((new Date(challenge.resendAvailableAt).getTime() - now) / 1000))
    : 0
  return (
    <Section icon={<KeyRound size={18} aria-hidden="true" />} title={text("Mật khẩu", "Password")}>
      <p className="pas-muted">
        {hasPassword ? (
          overview.password.updatedAt ? (
            <>
              {text("Đổi lần gần nhất: ", "Last changed ")}
              <LocalTime value={overview.password.updatedAt} locale={locale} />.
            </>
          ) : (
            text("Tài khoản đang dùng mật khẩu.", "Your account has a password.")
          )
        ) : (
          text(
            "Tài khoản chưa có mật khẩu (ví dụ chỉ đăng nhập bằng Google). Bạn có thể đặt mật khẩu.",
            "Your account has no password yet (for example Google-only sign-in). You can set one.",
          )
        )}
      </p>
      {!overview.passwordChangeAvailable ? (
        <p className="pas-muted">
          {text(
            "Chưa đổi được mật khẩu ở đây: tài khoản chưa có email hoặc máy chủ chưa cấu hình gửi email.",
            "Password changes are unavailable: the account has no email or email delivery is not configured.",
          )}
        </p>
      ) : !open ? (
        <button type="button" className="pas-button" onClick={() => setOpen(true)}>
          {hasPassword ? text("Đổi mật khẩu", "Change password") : text("Đặt mật khẩu", "Set password")}
        </button>
      ) : !challenge ? (
        <form className="pas-form" onSubmit={(event) => void sendCode(event)} noValidate>
          <label htmlFor={`${id}-new`}>
            <span>{text("Mật khẩu mới", "New password")}</span>
            <input
              id={`${id}-new`}
              type={visible ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              maxLength={1024}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby={`${id}-hint`}
              required
            />
          </label>
          <label htmlFor={`${id}-repeat`}>
            <span>{text("Nhập lại mật khẩu mới", "Repeat new password")}</span>
            <input
              id={`${id}-repeat`}
              type={visible ? "text" : "password"}
              autoComplete="new-password"
              value={confirmation}
              maxLength={1024}
              onChange={(event) => setConfirmation(event.target.value)}
              required
            />
          </label>
          <label className="pas-check" htmlFor={`${id}-show`}>
            <input
              id={`${id}-show`}
              type="checkbox"
              checked={visible}
              onChange={(event) => setVisible(event.target.checked)}
            />
            <span>{text("Hiện mật khẩu", "Show password")}</span>
          </label>
          <p id={`${id}-hint`} className="pas-muted">
            {text(
              "Tối thiểu 8 ký tự. Mật khẩu chỉ có hiệu lực sau khi bạn nhập mã gửi tới email.",
              "At least 8 characters. It takes effect only after you enter the code sent to your email.",
            )}
          </p>
          {error && (
            <p className="pas-error" role="alert">
              {error}
            </p>
          )}
          <div className="pas-actions">
            <button type="submit" className="pas-button pas-button-primary" disabled={busy}>
              {busy ? text("Đang gửi mã…", "Sending code…") : text("Gửi mã xác nhận", "Send confirmation code")}
            </button>
            <button type="button" className="pas-button" onClick={reset} disabled={busy}>
              {text("Hủy", "Cancel")}
            </button>
          </div>
        </form>
      ) : (
        <form className="pas-form" onSubmit={(event) => void confirm(event)} noValidate>
          <p>
            {text(
              `Đã gửi mã 6 số tới ${challenge.emailHint}. Mã hết hạn lúc `,
              `A 6-digit code was sent to ${challenge.emailHint}. It expires at `,
            )}
            <LocalTime value={challenge.expiresAt} locale={locale} />.
          </p>
          <label htmlFor={`${id}-code`}>
            <span>{text("Mã xác nhận", "Confirmation code")}</span>
            <input
              id={`${id}-code`}
              className="pas-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              required
            />
          </label>
          <label className="pas-check" htmlFor={`${id}-others`}>
            <input
              id={`${id}-others`}
              type="checkbox"
              checked={signOutOthers}
              onChange={(event) => setSignOutOthers(event.target.checked)}
            />
            <span>{text("Đăng xuất khỏi các thiết bị khác", "Sign out of other devices")}</span>
          </label>
          {error && (
            <p className="pas-error" role="alert">
              {error}
            </p>
          )}
          <div className="pas-actions">
            <button type="submit" className="pas-button pas-button-primary" disabled={busy}>
              {busy ? text("Đang đổi…", "Changing…") : text("Đổi mật khẩu", "Change password")}
            </button>
            <button
              type="button"
              className="pas-button"
              disabled={busy || resendIn > 0}
              onClick={() => void sendCode()}
            >
              {resendIn > 0
                ? text(`Gửi lại mã sau ${resendIn} giây`, `Resend in ${resendIn}s`)
                : text("Gửi lại mã", "Resend code")}
            </button>
            <button type="button" className="pas-button" onClick={reset} disabled={busy}>
              {text("Hủy", "Cancel")}
            </button>
          </div>
        </form>
      )}
    </Section>
  )
}

function SessionsSection({
  sessions,
  api,
  locale,
  text,
  onChanged,
}: {
  sessions: SessionList | null
  api: AccountSecurityApi
  locale: string
  text: Text
  onChanged: () => Promise<unknown>
}) {
  const [confirming, setConfirming] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState("")
  const others = sessions?.sessions.filter((session) => !session.current) ?? []

  async function run(key: string, work: () => Promise<unknown>) {
    setBusy(key)
    setError("")
    try {
      await work()
      setConfirming(null)
      await onChanged()
    } catch {
      setError(text("Chưa đăng xuất được. Vui lòng thử lại.", "Could not sign out. Please try again."))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Section
      icon={<MonitorSmartphone size={18} aria-hidden="true" />}
      title={text("Thiết bị đăng nhập", "Signed-in devices")}
    >
      <p className="pas-muted">
        {text(
          "Các nơi tài khoản đang đăng nhập. Vị trí hiển thị dưới dạng địa chỉ IP.",
          "Where your account is signed in. Location is shown as an IP address.",
        )}
      </p>
      {sessions && !sessions.deviceDetails && (
        <p className="pas-muted">
          {text(
            "Chưa lấy được tên trình duyệt; vẫn hiển thị IP và thời gian.",
            "Browser names are unavailable; IP and times are still shown.",
          )}
        </p>
      )}
      <ul className="pas-sessions">
        {sessions?.sessions.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            locale={locale}
            text={text}
            confirming={confirming === session.id}
            busy={busy === session.id}
            onAsk={() => setConfirming(session.id)}
            onCancel={() => setConfirming(null)}
            onConfirm={() => void run(session.id, () => api.signOutSession(session.id))}
          />
        ))}
      </ul>
      {error && (
        <p className="pas-error" role="alert">
          {error}
        </p>
      )}
      {others.length > 0 && (
        <div className="pas-actions">
          {confirming === "others" ? (
            <>
              <button
                type="button"
                className="pas-button pas-button-danger"
                disabled={busy !== null}
                onClick={() => void run("others", api.signOutOtherSessions)}
              >
                {busy === "others"
                  ? text("Đang đăng xuất…", "Signing out…")
                  : text(
                      `Xác nhận đăng xuất ${others.length} thiết bị`,
                      `Confirm signing out ${others.length} devices`,
                    )}
              </button>
              <button type="button" className="pas-button" onClick={() => setConfirming(null)}>
                {text("Hủy", "Cancel")}
              </button>
            </>
          ) : (
            <button type="button" className="pas-button" onClick={() => setConfirming("others")}>
              <LogOut size={16} aria-hidden="true" />
              {text("Đăng xuất mọi thiết bị khác", "Sign out all other devices")}
            </button>
          )}
        </div>
      )}
    </Section>
  )
}

function SessionRow({
  session,
  locale,
  text,
  confirming,
  busy,
  onAsk,
  onCancel,
  onConfirm,
}: {
  session: AccountSession
  locale: string
  text: Text
  confirming: boolean
  busy: boolean
  onAsk: () => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const name = deviceName(session.device) ?? text("Thiết bị không rõ", "Unknown device")
  const Icon = session.device?.mobile ? Smartphone : Laptop
  const apps = session.applications.map(applicationName).join(", ")
  return (
    <li className="pas-session" data-current={session.current || undefined}>
      <Icon size={20} aria-hidden="true" />
      <div>
        <strong>
          {name}
          {session.current && <span className="pas-badge pas-badge-ok">{text("Thiết bị này", "This device")}</span>}
        </strong>
        <span>
          {[
            session.ipAddress && `IP ${session.ipAddress}`,
            session.lastAccessAt &&
              text(
                `Hoạt động ${relative(session.lastAccessAt, locale)}`,
                `Active ${relative(session.lastAccessAt, locale)}`,
              ),
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <span>
          {factLine([
            session.startedAt && (
              <>
                {text("Đăng nhập ", "Signed in ")}
                <LocalTime value={session.startedAt} locale={locale} />
              </>
            ),
            apps,
          ])}
        </span>
      </div>
      {!session.current &&
        (confirming ? (
          <div className="pas-row-actions">
            <button type="button" className="pas-button pas-button-danger" disabled={busy} onClick={onConfirm}>
              {busy ? text("Đang đăng xuất…", "Signing out…") : text("Xác nhận", "Confirm")}
            </button>
            <button type="button" className="pas-button" onClick={onCancel} disabled={busy}>
              {text("Hủy", "Cancel")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="pas-button"
            onClick={onAsk}
            aria-label={text(`Đăng xuất ${name}`, `Sign out ${name}`)}
          >
            {text("Đăng xuất", "Sign out")}
          </button>
        ))}
    </li>
  )
}

function TwoFactorSection({
  overview,
  api,
  locale,
  text,
  startAction,
  onChanged,
}: {
  overview: SecurityOverview
  api: AccountSecurityApi
  locale: string
  text: Text
  startAction: PublicAccountSecurityProps["startAction"]
  onChanged: () => Promise<unknown>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const factor = overview.twoFactor
  const codes = factor.recoveryCodes

  async function go(action: AccountAction, reauthenticate = false) {
    setBusy(true)
    setError("")
    try {
      await startAction(action, { reauthenticate })
    } catch {
      setError(text("Chưa mở được trang xác thực. Vui lòng thử lại.", "Could not open the sign-in page."))
      setBusy(false)
    }
  }

  async function removeOrphanCodes() {
    setBusy(true)
    setError("")
    try {
      await api.removeRecoveryCodes()
      await onChanged()
    } catch {
      setError(text("Chưa xóa được mã khôi phục.", "Could not remove the recovery codes."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section icon={<ShieldCheck size={18} aria-hidden="true" />} title={text("Xác thực hai bước", "Two-step sign-in")}>
      {factor.enabled ? (
        <>
          <p>
            <span className="pas-badge pas-badge-ok">{text("Đang bật", "On")}</span>{" "}
            {text(
              "Đăng nhập cần mật khẩu và mã 6 số từ ứng dụng xác thực.",
              "Sign-in asks for your password and a 6-digit app code.",
            )}
          </p>
          <p className="pas-muted">
            {factLine([
              factor.label && text(`Thiết bị: ${factor.label}`, `Device: ${factor.label}`),
              factor.createdAt && (
                <>
                  {text("Bật từ ", "On since ")}
                  <LocalTime value={factor.createdAt} locale={locale} />
                </>
              ),
            ])}
          </p>
          <p className="pas-muted">
            {codes
              ? text(
                  `Còn ${codes.remaining ?? "?"}/${codes.total ?? "?"} mã khôi phục. Mỗi mã dùng được một lần khi không có điện thoại.`,
                  `${codes.remaining ?? "?"}/${codes.total ?? "?"} recovery codes left. Each works once if you lose your phone.`,
                )
              : text(
                  "Chưa có mã khôi phục. Hãy tạo để không bị khóa tài khoản khi mất điện thoại.",
                  "No recovery codes yet. Create them so you are not locked out if you lose your phone.",
                )}
          </p>
          <div className="pas-actions">
            <button
              type="button"
              className="pas-button"
              disabled={busy}
              onClick={() => void go("CONFIGURE_RECOVERY_AUTHN_CODES", true)}
            >
              {codes
                ? text("Tạo lại mã khôi phục", "Regenerate recovery codes")
                : text("Tạo mã khôi phục", "Create recovery codes")}
            </button>
            {factor.credentialId && (
              <button
                type="button"
                className="pas-button pas-button-danger"
                disabled={busy}
                onClick={() => void go(`delete_credential:${factor.credentialId}`, true)}
              >
                {text("Tắt xác thực hai bước", "Turn off two-step sign-in")}
              </button>
            )}
          </div>
          <p className="pas-muted">
            {text(
              "Tạo lại mã hoặc tắt xác thực hai bước sẽ yêu cầu nhập lại mật khẩu và mã 6 số trên trang đăng nhập AOV.",
              "Regenerating codes or turning it off asks for your password and a 6-digit code on the AOV sign-in page.",
            )}
          </p>
        </>
      ) : (
        <>
          <p>
            <span className="pas-badge">{text("Đang tắt", "Off")}</span>{" "}
            {text(
              "Thêm một lớp bảo vệ: sau mật khẩu, đăng nhập sẽ hỏi mã 6 số từ Google Authenticator, Microsoft Authenticator hoặc ứng dụng tương tự.",
              "Add a second layer: after your password, sign-in asks for a 6-digit code from Google Authenticator, Microsoft Authenticator or a similar app.",
            )}
          </p>
          <p className="pas-muted">
            {text(
              "Bạn sẽ sang trang đăng nhập AOV để quét mã QR (hoặc nhập khóa), nhập mã đầu tiên và lưu mã khôi phục, rồi quay lại đây.",
              "You will scan a QR code (or enter a key) on the AOV sign-in page, enter the first code and save recovery codes, then return here.",
            )}
          </p>
          <div className="pas-actions">
            <button
              type="button"
              className="pas-button pas-button-primary"
              disabled={busy}
              onClick={() => void go("CONFIGURE_TOTP")}
            >
              {busy ? text("Đang mở…", "Opening…") : text("Bật xác thực hai bước", "Turn on two-step sign-in")}
            </button>
            {codes && (
              <button type="button" className="pas-button" disabled={busy} onClick={() => void removeOrphanCodes()}>
                {text("Xóa mã khôi phục cũ", "Remove old recovery codes")}
              </button>
            )}
          </div>
        </>
      )}
      {error && (
        <p className="pas-error" role="alert">
          {error}
        </p>
      )}
    </Section>
  )
}
