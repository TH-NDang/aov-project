import { useState, useSyncExternalStore } from "react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@aov/ui/components/dialog"
import { StreamBrand } from "../../components/stream-brand"
import { StreamIcon } from "../../components/stream-icon"
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

export function SignInDialog() {
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
  const open = (register: boolean) => {
    setError("")
    void signIn(register).catch(() => setError("Chưa mở được trang đăng nhập. Vui lòng thử lại."))
  }
  return (
    <Dialog open={current !== null} onOpenChange={(value) => !value && show(null)}>
      <DialogContent className="cp-signin-dialog" showCloseButton={false}>
        <button type="button" className="hub-icon-button cp-dialog-close" aria-label="Đóng" onClick={() => show(null)}>
          <StreamIcon name="close" size={16} />
        </button>
        <StreamBrand compact />
        <DialogTitle className="cp-dialog-title">Đăng nhập để tiếp tục</DialogTitle>
        <DialogDescription className="cp-dialog-text">{current}</DialogDescription>
        <ul className="cp-benefits">
          <li>
            <StreamIcon name="heart" size={16} />
            Thích bài viết và bình luận cùng cộng đồng
          </li>
          <li>
            <StreamIcon name="bell" size={16} />
            Theo dõi trang và nhận thông báo bài mới
          </li>
          <li>
            <StreamIcon name="spark" size={16} />
            Gợi ý trang phù hợp với bạn
          </li>
        </ul>
        <div className="cp-dialog-actions">
          <button type="button" className="cp-button cp-primary" onClick={() => open(false)}>
            Đăng nhập
          </button>
          <button type="button" className="cp-button" onClick={() => open(true)}>
            Tạo tài khoản
          </button>
        </div>
        {error && (
          <p className="cp-error" role="alert">
            {error}
          </p>
        )}
        <p className="cp-dialog-note">Đăng nhập qua trang tài khoản AOV; AOV Stream không lưu mật khẩu.</p>
      </DialogContent>
    </Dialog>
  )
}
