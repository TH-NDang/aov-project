import { useState } from "react"
import { useStreamLocale } from "../../../components/stream-locale"
import { openSignIn, SignInBenefits } from "../../../components/community-signin"

/** What an account gives a visitor, with the two ways in. The one prompt of the account screens. */
export function SignInPrompt({ title }: { title?: string }) {
  const { text } = useStreamLocale()
  const [error, setError] = useState("")
  return (
    <section className="cp-signin" aria-labelledby="signin-title">
      <h2 id="signin-title">{title ?? text("Đăng nhập để tham gia cộng đồng", "Sign in to join the community")}</h2>
      <SignInBenefits />
      <div className="cp-signin-actions">
        <button className="cp-button cp-primary" onClick={() => openSignIn(false, setError)}>
          {text("Đăng nhập", "Sign in")}
        </button>
        <button className="cp-button" onClick={() => openSignIn(true, setError)}>
          {text("Tạo tài khoản", "Create account")}
        </button>
      </div>
      {error && (
        <p className="cp-field-error" role="alert">
          {error}
        </p>
      )}
      <p className="cp-signin-note">
        {text(
          "Đăng nhập qua trang tài khoản AOV; AOV Stream không lưu mật khẩu.",
          "Sign in through the AOV account page; AOV Stream does not store passwords.",
        )}
      </p>
    </section>
  )
}
