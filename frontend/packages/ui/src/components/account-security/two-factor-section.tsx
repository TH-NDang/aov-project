import { useState } from "react"
import { ShieldCheck } from "lucide-react"
import type { AccountAction } from "../../lib/public-auth"
import type { AccountSecurityApi, SecurityOverview } from "../../lib/account-security"
import type { Text } from "../../lib/account-security-model"
import { LocalTime } from "../local-time"
import type { PublicAccountSecurityProps } from "../public-account-security"
import { factLine, Section } from "./security-section"

/**
 * Two-step sign-in with an authenticator app and its recovery codes. Turning it on, regenerating the codes and turning
 * it off happen on the sign-in pages of the identity provider.
 */
export function TwoFactorSection({
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
