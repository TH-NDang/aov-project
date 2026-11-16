import { useState, useSyncExternalStore } from "react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@aov/ui/components/public-overlay"
import owlMark from "../../assets/stream-owl.svg"
import { StreamIcon, type StreamIconName } from "../../components/stream-icon"
import { streamText, useStreamLocale } from "../../components/stream-locale"
import { signIn, useCommunitySession } from "./community-auth"

/** Why the sign-in prompt is open; null while it is closed. One prompt serves the whole app. */
let reason: string | null = null
const listeners = new Set<() => void>()
const show = (value: string | null) => {
  reason = value
  listeners.forEach((listener) => listener())
}

/** Runs `action` for signed-in viewers; others get a prompt explaining what the account is needed for. */
export function useSignedInAction() {
  const session = useCommunitySession()
  return (why: string, action: () => void) => (session.status === "authenticated" ? action() : show(why))
}

const benefits: [StreamIconName, string, string][] = [
  ["bell", "Theo dõi trang và nhận thông báo khi có bài mới", "Follow pages and get notified of new posts"],
  ["message", "Thích, bình luận và thảo luận cùng cộng đồng", "Like, comment and talk with the community"],
  [
    "shield",
    "Quản lý trang của đội hoặc tuyển thủ bạn đại diện",
    "Manage the page of the team or player you represent",
  ],
]

/** What an account gives a visitor, in three short lines; shared by the sign-in dialog and the account screens. */
export function SignInBenefits() {
  const { text } = useStreamLocale()
  return (
    <ul className="cp-benefits">
      {benefits.map(([icon, vi, en]) => (
        <li key={icon}>
          <span aria-hidden="true">
            <StreamIcon name={icon} size={16} />
          </span>
          {text(vi, en)}
        </li>
      ))}
    </ul>
  )
}

/** Opens the AOV sign-in page; `failed` receives the message to show when the page cannot be opened. */
export function openSignIn(register: boolean, failed: (message: string) => void) {
  failed("")
  void signIn(register).catch(() =>
    failed(
      streamText(
        "Chưa mở được trang đăng nhập. Vui lòng thử lại.",
        "The sign-in page could not be opened. Please try again.",
      ),
    ),
  )
}

export function SignInDialog() {
  const { text } = useStreamLocale()
  const current = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => reason,
  )
  const [error, setError] = useState("")
  return (
    <Dialog open={current !== null} onOpenChange={(value) => !value && show(null)}>
      <DialogContent className="cp-signin-dialog" showCloseButton={false}>
        <button
          type="button"
          className="hub-icon-button cp-dialog-close"
          aria-label={text("Đóng", "Close")}
          onClick={() => show(null)}
        >
          <StreamIcon name="close" size={16} />
        </button>
        <img className="cp-dialog-mark" src={owlMark} alt="" width={40} height={40} />
        <DialogTitle className="cp-dialog-title">{text("Đăng nhập để tiếp tục", "Sign in to continue")}</DialogTitle>
        <DialogDescription className="cp-dialog-text">{current}</DialogDescription>
        <SignInBenefits />
        <div className="cp-dialog-actions">
          <button type="button" className="cp-button cp-primary" onClick={() => openSignIn(false, setError)}>
            {text("Đăng nhập", "Sign in")}
          </button>
          <button type="button" className="cp-button" onClick={() => openSignIn(true, setError)}>
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
      </DialogContent>
    </Dialog>
  )
}
