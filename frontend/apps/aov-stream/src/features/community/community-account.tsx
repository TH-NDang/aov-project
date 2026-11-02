import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  CommunityProfile,
  CommunityNotification,
  PageClaim,
  PageManager,
  PageViewer,
  PageSlice,
  ProfilePresentation,
} from "@aov/community-contracts"
import { StreamShell } from "../../components/stream-shell"
import { communityApi } from "./community-api"
import { signIn, useCommunitySession } from "./community-auth"
import { CommunityFeed } from "./community-feed"
import { AccountProfile } from "../account/account-profile"
import { useOwnProfile } from "../account/profile-api"

export function CommunityAccount() {
  const session = useCommunitySession()
  const ownProfile = useOwnProfile()
  const client = useQueryClient()
  const [page, setPage] = useState(0)
  const enabled = session.status === "authenticated"
  const managed = useQuery({
    queryKey: ["managed-pages", session.revision],
    queryFn: () => communityApi<CommunityProfile[]>("/me/pages"),
    enabled,
  })
  const claims = useQuery({
    queryKey: ["my-claims", session.revision],
    queryFn: () => communityApi<PageClaim[]>("/me/claims"),
    enabled,
  })
  const inbox = useQuery({
    queryKey: ["notifications", session.revision, page],
    queryFn: () => communityApi<PageSlice<CommunityNotification>>(`/me/notifications?page=${page}&size=24`),
    enabled,
  })
  const read = useMutation({
    mutationFn: (id: string) => communityApi(`/me/notifications/${id}/read`, {}),
    onSuccess: () => client.invalidateQueries({ queryKey: ["notifications"] }),
  })
  return (
    <StreamShell>
      <div className="cp-container">
        <div className="cp-heading">
          <span className="cp-eyebrow">TÀI KHOẢN</span>
          <h1>{enabled ? ownProfile.data?.displayName || session.name : "Tham gia cộng đồng"}</h1>
          <p>Chỉnh sửa hồ sơ, theo dõi các trang bạn quan tâm và quản lý hoạt động của mình.</p>
        </div>
        {!enabled ? (
          <SignInPrompt />
        ) : (
          <>
            <AccountProfile />
            <div className="cp-columns">
              <div className="cp-main-column">
                <section className="cp-panel">
                  <h2>Trang bạn quản lý</h2>
                  {managed.isError && <p className="cp-error">{managed.error.message}</p>}
                  {managed.data?.length ? (
                    managed.data.map((profile) => (
                      <Link className="cp-list-row" key={profile.id} to={`/manage/${profile.id}`}>
                        <strong>{profile.content?.name || profile.code}</strong>
                        <span>Quản lý →</span>
                      </Link>
                    ))
                  ) : (
                    <p className="cp-muted">
                      Bạn chưa quản lý trang nào. Mở hồ sơ của mình và gửi yêu cầu nhận quyền đại diện.
                    </p>
                  )}
                </section>
                <section className="cp-panel">
                  <h2>Yêu cầu đại diện của bạn</h2>
                  {claims.isError && <p className="cp-error">{claims.error.message}</p>}
                  {claims.data?.length ? (
                    claims.data.map((claim) => (
                      <article className="cp-list-row" key={claim.id}>
                        <div>
                          <Link to={`/pages/${claim.pageId}`}>
                            <strong>{claim.pageName}</strong>
                          </Link>
                          <p>
                            {claim.status === "PENDING"
                              ? "Đang chờ xét duyệt"
                              : claim.status === "APPROVED"
                                ? "Đã chấp thuận"
                                : "Chưa được chấp thuận"}
                          </p>
                          {claim.resolution && <p className="cp-meta">{claim.resolution}</p>}
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="cp-muted">Chưa có yêu cầu.</p>
                  )}
                </section>
              </div>
              <aside className="cp-side-column">
                <section className="cp-panel">
                  <h2>Thông báo</h2>
                  {inbox.isError && <p className="cp-error">{inbox.error.message}</p>}
                  {!inbox.data?.items.length && <p className="cp-muted">Thông báo mới sẽ xuất hiện tại đây.</p>}
                  {inbox.data?.items.map((item) => (
                    <article className="cp-notification" key={item.id}>
                      <Link to={`/pages/${item.pageId}`}>{item.message}</Link>
                      <small>{new Date(item.createdAt).toLocaleString("vi-VN")}</small>
                      {!item.read && (
                        <button
                          className="cp-text-button"
                          disabled={read.isPending}
                          onClick={() => read.mutate(item.id)}
                        >
                          Đánh dấu đã đọc
                        </button>
                      )}
                    </article>
                  ))}
                  <div className="cp-actions">
                    <button className="cp-button" disabled={!page} onClick={() => setPage(page - 1)}>
                      Trước
                    </button>
                    <button
                      className="cp-button"
                      disabled={!inbox.data || (page + 1) * 24 >= inbox.data.totalElements}
                      onClick={() => setPage(page + 1)}
                    >
                      Tiếp
                    </button>
                  </div>
                </section>
              </aside>
            </div>
          </>
        )}
      </div>
    </StreamShell>
  )
}
export function SignInPrompt() {
  return (
    <div className="cp-panel cp-empty">
      <h2>Một tài khoản cho cộng đồng của bạn</h2>
      <p>Đăng nhập để theo dõi, thảo luận và quản lý trang được ủy quyền.</p>
      <div className="cp-actions">
        <button className="cp-button cp-primary" onClick={() => void signIn()}>
          Đăng nhập
        </button>
        <button className="cp-button" onClick={() => void signIn(true)}>
          Tạo tài khoản
        </button>
      </div>
    </div>
  )
}

export function CommunityPageManager() {
  const { id = "" } = useParams()
  const session = useCommunitySession()
  const enabled = session.status === "authenticated"
  const profile = useQuery({
    queryKey: ["managed-page", session.revision, id],
    queryFn: () => communityApi<CommunityProfile>(`/me/pages/${id}/profile`),
    enabled,
  })
  const viewer = useQuery({
    queryKey: ["page-viewer", session.revision, id],
    queryFn: () => communityApi<PageViewer>(`/me/pages/${id}`),
    enabled,
  })
  return (
    <StreamShell>
      <div className="cp-container">
        {!enabled ? (
          <SignInPrompt />
        ) : profile.isError || viewer.isError ? (
          <p className="cp-error" role="alert">
            {profile.error?.message || viewer.error?.message}
          </p>
        ) : !profile.data || !viewer.data ? (
          <p>Đang tải trang…</p>
        ) : !viewer.data.role ? (
          <p>Bạn chưa có quyền quản lý trang này.</p>
        ) : (
          <Manager key={`${id}:${viewer.data.version}`} profile={profile.data} viewer={viewer.data} />
        )}
      </div>
    </StreamShell>
  )
}
function Manager({ profile, viewer }: { profile: CommunityProfile; viewer: PageViewer }) {
  const session = useCommunitySession()
  const client = useQueryClient()
  const [tab, setTab] = useState("presentation")
  const [presentation, setPresentation] = useState<ProfilePresentation>({
    biography: profile.content?.biography,
    avatarUrl: profile.content?.avatarUrl,
    coverUrl: profile.content?.coverUrl,
    links: profile.content?.links || [],
  })
  const [inviteRole, setInviteRole] = useState("EDITOR")
  const [invitation, setInvitation] = useState("")
  const [confirmation, setConfirmation] = useState<{ id: string; action: "revoke" | "transfer" } | null>(null)
  const members = useQuery({
    queryKey: ["page-members", session.revision, profile.id],
    queryFn: () => communityApi<PageManager[]>(`/me/pages/${profile.id}/members`),
  })
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["page-viewer"] })
    await client.invalidateQueries({ queryKey: ["public-page"] })
    await client.invalidateQueries({ queryKey: ["managed-page"] })
    await client.invalidateQueries({ queryKey: ["page-members"] })
  }
  const save = useMutation({
    mutationFn: () =>
      communityApi(`/me/pages/${profile.id}/presentation`, { version: viewer.version, content: presentation }, "PUT"),
    onSuccess: refresh,
  })
  const invite = useMutation({
    mutationFn: () => communityApi<{ token: string }>(`/me/pages/${profile.id}/invitations`, { role: inviteRole }),
    onSuccess: (value) => setInvitation(`${location.origin}/invitations#${value.token}`),
  })
  const membership = useMutation({
    mutationFn: () => communityApi(`/me/pages/${profile.id}/members/${confirmation!.id}/${confirmation!.action}`, {}),
    onSuccess: async () => {
      setConfirmation(null)
      await refresh()
    },
  })
  return (
    <>
      <Link className="cp-back" to={`/pages/${profile.code}`}>
        ← Xem trang công khai
      </Link>
      <div className="cp-heading">
        <span className="cp-eyebrow">QUẢN LÝ TRANG</span>
        <h1>{profile.content?.name}</h1>
        <p>
          Đại diện của trang ·{" "}
          {viewer.role === "OWNER" ? "Quản trị chính" : viewer.role === "EDITOR" ? "Biên tập viên" : "Kiểm duyệt viên"}
        </p>
      </div>
      <nav className="cp-tabs">
        {[
          ["presentation", "Giới thiệu"],
          ["posts", "Bài viết"],
          ["members", "Người quản lý"],
        ].map(([value, label]) => (
          <button key={value} aria-current={tab === value ? "page" : undefined} onClick={() => setTab(value)}>
            {label}
          </button>
        ))}
      </nav>
      {tab === "presentation" && (
        <form
          className="cp-panel"
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate()
          }}
        >
          <h2>Thông tin do đại diện cung cấp</h2>
          <p className="cp-muted">
            Lịch sử và kết quả thi đấu được biên tập riêng. Bạn có thể gửi đề xuất chỉnh sửa từ trang công khai.
          </p>
          <fieldset disabled={viewer.role === "MODERATOR" || save.isPending}>
            <label>
              Giới thiệu
              <textarea
                rows={6}
                maxLength={10000}
                value={presentation.biography || ""}
                onChange={(e) => setPresentation({ ...presentation, biography: e.target.value })}
              />
            </label>
            <div className="cp-form-grid">
              <label>
                Ảnh đại diện
                <input
                  type="url"
                  value={presentation.avatarUrl || ""}
                  onChange={(e) => setPresentation({ ...presentation, avatarUrl: e.target.value })}
                />
              </label>
              <label>
                Ảnh bìa
                <input
                  type="url"
                  value={presentation.coverUrl || ""}
                  onChange={(e) => setPresentation({ ...presentation, coverUrl: e.target.value })}
                />
              </label>
            </div>
            {presentation.links.map((link, i) => (
              <div className="cp-form-grid" key={i}>
                <label>
                  Tên kênh
                  <input
                    required
                    value={link.label}
                    onChange={(e) =>
                      setPresentation({
                        ...presentation,
                        links: presentation.links.map((item, index) =>
                          i === index ? { ...item, label: e.target.value } : item,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Đường dẫn
                  <input
                    type="url"
                    required
                    value={link.url}
                    onChange={(e) =>
                      setPresentation({
                        ...presentation,
                        links: presentation.links.map((item, index) =>
                          i === index ? { ...item, url: e.target.value } : item,
                        ),
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="cp-text-button"
                  onClick={() =>
                    setPresentation({ ...presentation, links: presentation.links.filter((_, index) => index !== i) })
                  }
                >
                  Gỡ kênh
                </button>
              </div>
            ))}
            <div className="cp-actions">
              <button
                type="button"
                className="cp-button"
                onClick={() =>
                  setPresentation({ ...presentation, links: [...presentation.links, { label: "", url: "" }] })
                }
              >
                Thêm kênh
              </button>
              <button className="cp-button cp-primary">Lưu giới thiệu</button>
            </div>
          </fieldset>
          {save.isError && (
            <p className="cp-error" role="alert">
              {save.error.message}
            </p>
          )}
        </form>
      )}
      {tab === "posts" && (
        <CommunityFeed pageId={profile.id} pageName={profile.content!.name} role={viewer.role} manage />
      )}
      {tab === "members" && (
        <section className="cp-panel">
          <h2>Người quản lý trang</h2>
          {members.isError && <p className="cp-error">{members.error.message}</p>}
          {members.data?.map((member) => (
            <div className="cp-list-row" key={member.id}>
              <div>
                <strong>
                  {member.name}
                  {member.self ? " (bạn)" : ""}
                </strong>
                <p className="cp-meta">
                  {member.role === "OWNER"
                    ? "Quản trị chính"
                    : member.role === "EDITOR"
                      ? "Biên tập viên"
                      : "Kiểm duyệt viên"}
                </p>
              </div>
              {viewer.role === "OWNER" && !member.self && (
                <div className="cp-actions">
                  <button className="cp-button" onClick={() => setConfirmation({ id: member.id, action: "revoke" })}>
                    Thu hồi
                  </button>
                  <button className="cp-button" onClick={() => setConfirmation({ id: member.id, action: "transfer" })}>
                    Chuyển quyền chính
                  </button>
                </div>
              )}
            </div>
          ))}
          {confirmation && (
            <div className="cp-confirm" role="alert">
              <p>
                {confirmation.action === "transfer"
                  ? "Người này sẽ trở thành quản trị chính; bạn chuyển thành biên tập viên. Các lời mời cũ sẽ hết hiệu lực."
                  : "Người này sẽ mất quyền quản lý trang."}
              </p>
              <div className="cp-actions">
                <button
                  className="cp-button cp-primary"
                  disabled={membership.isPending}
                  onClick={() => membership.mutate()}
                >
                  Xác nhận
                </button>
                <button className="cp-button" onClick={() => setConfirmation(null)}>
                  Hủy
                </button>
              </div>
            </div>
          )}
          {membership.isError && <p className="cp-error">{membership.error.message}</p>}
          {viewer.role === "OWNER" && (
            <div className="cp-invite">
              <h3>Mời người quản lý</h3>
              <div className="cp-actions">
                <select
                  aria-label="Quyền của người được mời"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  <option value="EDITOR">Biên tập viên</option>
                  <option value="MODERATOR">Kiểm duyệt viên</option>
                </select>
                <button className="cp-button" disabled={invite.isPending} onClick={() => invite.mutate()}>
                  Tạo liên kết mời
                </button>
              </div>
              {invite.isError && <p className="cp-error">{invite.error.message}</p>}
              {invitation && (
                <label>
                  Liên kết dùng một lần, có hiệu lực 7 ngày
                  <input readOnly value={invitation} onFocus={(e) => e.target.select()} />
                  <span className="cp-meta">Chỉ gửi liên kết này cho người bạn muốn cấp quyền.</span>
                </label>
              )}
            </div>
          )}
        </section>
      )}
    </>
  )
}
export function CommunityInvitation() {
  const session = useCommunitySession()
  const navigate = useNavigate()
  const [token] = useState(() => location.hash.slice(1))
  const accept = useMutation({
    mutationFn: () => communityApi<{ pageId: string }>("/me/invitations/accept", { token }),
    onSuccess: (result) => navigate(`/manage/${result.pageId}`, { replace: true }),
  })
  return (
    <StreamShell>
      <div className="cp-container">
        <section className="cp-panel cp-empty">
          <h1>Lời mời quản lý trang</h1>
          {session.status !== "authenticated" ? (
            <SignInPrompt />
          ) : (
            <>
              <p>Chấp nhận để liên kết quyền quản lý với tài khoản {session.name}.</p>
              <button
                className="cp-button cp-primary"
                disabled={!token || accept.isPending}
                onClick={() => accept.mutate()}
              >
                Chấp nhận lời mời
              </button>
              {accept.isError && (
                <p className="cp-error" role="alert">
                  {accept.error.message}
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </StreamShell>
  )
}
