import { useId } from "react"
import { KeyRound } from "lucide-react"
import type { AccountSecurityApi, SecurityOverview } from "../../lib/account-security"
import type { Text } from "../../lib/account-security-model"
import { LocalTime } from "../local-time"
import { Section } from "./security-section"
import { usePasswordChange } from "./use-password-change"

/** Sets or changes the password; the change applies only after the reader enters the code sent to their email. */
export function PasswordSection({
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
  const {
    open,
    setOpen,
    password,
    setPassword,
    confirmation,
    setConfirmation,
    visible,
    setVisible,
    challenge,
    code,
    setCode,
    signOutOthers,
    setSignOutOthers,
    busy,
    error,
    resendIn,
    reset,
    sendCode,
    confirm,
  } = usePasswordChange({ api, locale, text, onChanged })
  const id = useId()
  const hasPassword = overview.password.set

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
