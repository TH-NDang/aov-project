/** The words of the account settings screen (ADR-028): notices, password errors and relative times. */
import type { AccountActionResult } from "./public-auth"
import { AccountSecurityError } from "./account-security"
import { isEnglishLocale } from "@aov/ui/lib/locale-text"

export type Text = (vi: string, en: string) => string
export type Notice = { tone: "success" | "info" | "error"; message: string } | null

/** What the screen says after an action that returned from the identity provider. */
export function actionNotice(result: AccountActionResult, text: Text): Notice {
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

/** "2 hours ago", "in 3 days", in English or Vietnamese; null without a time. */
export function relativeTime(value: string | null, locale: string) {
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

/** What a failed step of the password change means for the reader, read from the stable error code. */
export function passwordError(error: unknown, text: Text) {
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
