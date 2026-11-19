import { useEffect, useState, type FormEvent } from "react"
import type { AccountSecurityApi, PasswordChallenge } from "../../lib/account-security"
import { passwordError, type Text } from "../../lib/account-security-model"

type PasswordChangeOptions = {
  api: AccountSecurityApi
  locale: string
  text: Text
  onChanged: (message: string) => Promise<void>
}

/**
 * The two steps of a password change: the new password sends a code to the account's email, and the code applies it.
 * Holds the form fields, the challenge of the code that was sent and the seconds left before another may be sent.
 */
export function usePasswordChange({ api, locale, text, onChanged }: PasswordChangeOptions) {
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
  useEffect(() => {
    if (!challenge) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [challenge])

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
  return {
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
  }
}
