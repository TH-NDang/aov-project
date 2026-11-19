import { useState } from "react"
import { useNavigate } from "react-router"
import { useMutation } from "@tanstack/react-query"
import { StreamShell } from "../../../components/stream-shell"
import { useStreamLocale } from "../../../components/stream-locale"
import { communityApi } from "../../../lib/community-api"
import { useCommunitySession } from "../../../lib/stream-auth"
import { SignInPrompt } from "../components/sign-in-prompt"

/** `/invitations#<code>`: accepts the single-use link a page owner sent, then opens the manager of that page. */
export function CommunityInvitation() {
  const { text } = useStreamLocale()
  const session = useCommunitySession()
  const navigate = useNavigate()
  const [token] = useState(() => location.hash.slice(1))
  const accept = useMutation({
    mutationFn: () => communityApi.acceptInvitation(token),
    onSuccess: (result) => navigate(`/manage/${result.pageId}`, { replace: true }),
  })
  return (
    <StreamShell>
      <title>{text("Lời mời quản lý trang — AOV Stream", "Invitation to manage a page — AOV Stream")}</title>
      <div className="cp-container">
        <header className="tn-page-head">
          <div>
            <h1>{text("Lời mời quản lý trang", "Invitation to manage a page")}</h1>
            <p>
              {text(
                "Người quản trị chính của một trang mời bạn cùng quản lý trang đó.",
                "The main admin of a page invites you to manage it with them.",
              )}
            </p>
          </div>
        </header>
        {session.status === "loading" ? (
          <div className="hub-skeleton-rows" role="status" aria-label={text("Đang tải", "Loading")} />
        ) : session.status !== "authenticated" ? (
          <SignInPrompt title={text("Đăng nhập để nhận lời mời", "Sign in to accept the invitation")} />
        ) : !token ? (
          <section className="cp-signin" aria-labelledby="invitation-title">
            <h2 id="invitation-title">{text("Liên kết mời chưa đầy đủ", "The invitation link is incomplete")}</h2>
            <p className="cp-section-lead">
              {text(
                "Liên kết thiếu mã mời. Hãy mở lại đúng liên kết bạn nhận được, hoặc xin người quản trị chính tạo liên kết mới.",
                "The link has no invitation code. Open the exact link you received again, or ask the main admin for a new one.",
              )}
            </p>
          </section>
        ) : (
          <section className="cp-signin" aria-labelledby="invitation-title">
            <h2 id="invitation-title">{text("Nhận quyền quản lý", "Accept the invitation")}</h2>
            <p className="cp-section-lead">
              {text(
                "Chấp nhận để liên kết quyền quản lý với tài khoản",
                "Accept to link management access to the account",
              )}{" "}
              <strong>{session.name}</strong>.{" "}
              {text("Liên kết chỉ dùng được một lần.", "The link can be used only once.")}
            </p>
            <div className="cp-signin-actions">
              <button className="cp-button cp-primary" disabled={accept.isPending} onClick={() => accept.mutate()}>
                {accept.isPending
                  ? text("Đang chấp nhận…", "Accepting…")
                  : text("Chấp nhận lời mời", "Accept invitation")}
              </button>
            </div>
            {accept.isError && (
              <p className="cp-field-error" role="alert">
                {accept.error.message}
              </p>
            )}
          </section>
        )}
      </div>
    </StreamShell>
  )
}
