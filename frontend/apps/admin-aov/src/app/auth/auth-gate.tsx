import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@aov/ui/components/button"
import { AovMark, AovWordmark } from "@aov/ui/components/aov-brand"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@aov/ui/components/dialog"
import { ArrowUpRight, Eye, EyeOff, LoaderCircle } from "lucide-react"
import {
  getSession,
  loginPassword,
  loginGoogle,
  logout,
  subscribeSession,
  verifySession,
  cancelLogin,
  authMessage,
} from "./session"

export function useSession() {
  return useSyncExternalStore(subscribeSession, getSession)
}

const inputStyle =
  "h-12 w-full rounded-xl border border-white/10 bg-[#24242b] px-3.5 text-base placeholder:text-[#85838f] focus:outline-2 focus:outline-[#e7bd7a] sm:text-sm"
export function AuthGate({ children }: { children: ReactNode }) {
  const session = useSession()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [visible, setVisible] = useState(false)
  const [method, setMethod] = useState<"account" | "google">("account")
  function changeOpen(value: boolean) {
    if (busy && method === "account") return
    if (!value) cancelLogin()
    setPassword("")
    setVisible(false)
    setError(null)
    setOpen(value)
  }
  async function choose(provider: "account" | "google") {
    setError(null)
    setBusy(true)
    setMethod(provider)
    try {
      if (provider === "google") await loginGoogle()
      else await loginPassword(username.trim(), password)
    } catch (cause) {
      setError(authMessage(cause))
    } finally {
      setBusy(false)
      setPassword("")
      setVisible(false)
    }
  }
  useEffect(() => {
    if (session.status !== "authenticated") queryClient.clear()
  }, [session.status, queryClient])
  if (session.status === "authenticated") return children
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6 text-foreground">
      <section className="w-full max-w-md space-y-5 rounded-2xl border bg-card p-8 shadow-sm" aria-live="polite">
        <div className="flex items-center gap-2.5">
          <AovMark className="size-9" />
          <AovWordmark product="Admin" className="text-xl" />
        </div>
        <h1 className="text-2xl font-semibold">
          {session.status === "loading" ? "Đang xác nhận phiên đăng nhập…" : "Đăng nhập quản trị"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {session.error ?? "Sử dụng tài khoản được cấp quyền để truy cập trang quản trị."}
        </p>
        {session.status === "anonymous" && <Button onClick={() => changeOpen(true)}>Đăng nhập tài khoản</Button>}
        {session.status === "error" && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void verifySession()}>Thử lại kết nối</Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Tải lại trang
            </Button>
            <Button variant="ghost" onClick={() => void logout()}>
              Đăng xuất
            </Button>
          </div>
        )}
      </section>
      <Dialog open={open && session.status === "anonymous"} onOpenChange={changeOpen}>
        <DialogContent
          showCloseButton={!busy}
          className="max-h-[calc(100svh-2rem)] overflow-y-auto gap-0 rounded-3xl border-white/10 bg-[#1b1b20] px-6 py-10 text-[#eeedf2] sm:max-w-[440px] sm:px-9"
        >
          <div className="mb-7 flex items-center justify-center gap-3">
            <AovMark className="size-11" />
            <AovWordmark product="Admin" className="text-3xl" />
          </div>
          <DialogTitle className="text-center text-2xl">Đăng nhập tài khoản</DialogTitle>
          <DialogDescription className="mt-3 text-center leading-relaxed text-[#aaa6b5]">
            Chào mừng trở lại cùng AOV WiKi.
          </DialogDescription>
          <form
            className="mt-7 space-y-5"
            onSubmit={(event) => {
              event.preventDefault()
              if (!busy) void choose("account")
            }}
          >
            <div className="space-y-2">
              <label htmlFor="admin-username" className="text-xs text-[#c4c2cc]">
                Tên người dùng hoặc email
              </label>
              <input
                id="admin-username"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                maxLength={254}
                disabled={busy}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Nhập tên người dùng hoặc email"
                className={inputStyle}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="admin-password" className="text-xs text-[#c4c2cc]">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  name="password"
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  maxLength={1024}
                  disabled={busy}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Nhập mật khẩu"
                  className={inputStyle + " pr-12"}
                />
                <button
                  type="button"
                  disabled={busy}
                  aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  aria-pressed={visible}
                  aria-controls="admin-password"
                  onClick={() => setVisible(!visible)}
                  className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-xl text-[#aaa6b5] focus-visible:outline-2 focus-visible:outline-[#e7bd7a]"
                >
                  {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={busy || !username.trim() || !password}
              className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#e7bd7a] px-4 font-semibold text-[#242019] hover:bg-[#f3cf99] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e7bd7a] disabled:opacity-50"
            >
              Đăng nhập <ArrowUpRight className="size-4" />
            </button>
          </form>
          <div className="my-6 flex items-center gap-3 text-xs text-[#908d9a]">
            <span className="h-px flex-1 bg-white/10" />
            hoặc
            <span className="h-px flex-1 bg-white/10" />
          </div>
          <button
            disabled={busy || !session.googleEnabled}
            onClick={() => void choose("google")}
            className="flex min-h-12 items-center justify-center gap-3 rounded-xl border border-white/15 bg-[#24242b] px-4 text-sm font-semibold hover:bg-[#303039] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e7bd7a] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <img src={import.meta.env.BASE_URL + "images/google.svg"} alt="" className="size-5" /> Đăng nhập với Google
          </button>
          {!session.googleEnabled && (
            <p className="mt-2 text-center text-xs text-[#aaa6b5]">Đăng nhập Google chưa được cấu hình.</p>
          )}
          {busy && (
            <p role="status" className="mt-5 flex items-center justify-center gap-2 text-sm text-[#e7bd7a]">
              <LoaderCircle className="size-4 animate-spin" />
              {method === "google" ? "Hoàn tất đăng nhập trong cửa sổ vừa mở." : "Đang đăng nhập…"}
            </p>
          )}
          {busy && method === "google" && (
            <button className="mt-3 text-sm underline" onClick={cancelLogin}>
              Hủy đăng nhập Google
            </button>
          )}
          {error && (
            <p role="alert" className="mt-5 text-sm text-red-300">
              {error}
            </p>
          )}
          <p className="mt-7 text-center text-xs leading-relaxed text-[#92909b]">
            Dành cho tài khoản được cấp quyền quản trị.
          </p>
        </DialogContent>
      </Dialog>
    </main>
  )
}
