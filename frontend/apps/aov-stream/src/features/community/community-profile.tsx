import { useState, type CSSProperties } from "react"
import { Link, useParams } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { profileKindLabels, type CommunityProfile, type PageViewer } from "@aov/community-contracts"
import { OfficialBadge } from "@aov/ui/components/official-badge"
import { StreamShell } from "../../components/stream-shell"
import { StreamIcon } from "../../components/stream-icon"
import { communityApi } from "./community-api"
import { signIn, useCommunitySession } from "./community-auth"
import { Avatar, followersLabel, hueOf, kindIcons } from "./community-ui"
import { CommunityFeed } from "./community-feed"
import { ProfileCompetitionSummary } from "./public-competitions"

export function CommunityProfilePage() {
  const { code = "" } = useParams()
  const profile = useQuery({
    queryKey: ["public-page", code],
    queryFn: () =>
      communityApi<CommunityProfile>(
        `/pages/${/^[0-9a-f-]{36}$/i.test(code) ? encodeURIComponent(code) : `by-code/${encodeURIComponent(code)}`}`,
      ),
  })
  return (
    <StreamShell>
      {profile.isPending ? (
        <div className="cp-container" role="status" aria-label="Đang tải hồ sơ">
          <div className="hub-skeleton cp-header-skeleton" />
        </div>
      ) : profile.isError ? (
        <div className="cp-container">
          <div className="hub-state">
            <StreamIcon name="info" size={28} />
            <h1>Chưa mở được hồ sơ</h1>
            <p role="alert">{profile.error.message}</p>
            <Link className="cp-button" to="/pages">
              Về danh bạ
            </Link>
          </div>
        </div>
      ) : (
        <Profile key={profile.data.id} profile={profile.data} />
      )}
    </StreamShell>
  )
}
function Profile({ profile }: { profile: CommunityProfile }) {
  const session = useCommunitySession()
  const client = useQueryClient()
  const [tab, setTab] = useState("overview")
  const [claiming, setClaiming] = useState(false)
  const [evidence, setEvidence] = useState("")
  const [suggesting, setSuggesting] = useState(false)
  const [suggestion, setSuggestion] = useState("")
  const viewer = useQuery({
    queryKey: ["page-viewer", session.revision, profile.id],
    queryFn: () => communityApi<PageViewer>(`/me/pages/${profile.id}`),
    enabled: session.status === "authenticated",
  })
  const follow = useMutation({
    mutationFn: () => communityApi(`/me/pages/${profile.id}/follow`, { following: !viewer.data?.following }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["page-viewer"] })
      await client.invalidateQueries({ queryKey: ["public-page"] })
    },
  })
  const claim = useMutation({
    mutationFn: () => communityApi(`/me/pages/${profile.id}/claims`, { evidence }),
    onSuccess: () => {
      setClaiming(false)
      setEvidence("")
    },
  })
  const suggest = useMutation({
    mutationFn: () => communityApi(`/me/pages/${profile.id}/reports`, { reason: suggestion }),
    onSuccess: () => {
      setSuggesting(false)
      setSuggestion("")
    },
  })
  const content = profile.content!
  const tabs = [
    ["overview", "Tổng quan"],
    ...(profile.kind === "PLAYER" ? [] : [["roster", "Thành viên"]]),
    ["history", profile.kind === "PLAYER" ? "Sự nghiệp" : "Lịch sử"],
    ["achievements", "Thành tích"],
    ["competitions", "Thi đấu"],
    ["posts", "Bài viết & thảo luận"],
  ]
  const authenticated = (action: () => void) => (session.status === "authenticated" ? action() : void signIn())
  return (
    <div className="cp-container">
      <title>{`${content.name} — AOV Stream`}</title>
      <Link className="cp-back" to="/pages">
        <StreamIcon name="back" size={16} />
        Danh bạ thi đấu
      </Link>
      <header className="hub-card cp-page-header">
        <div
          className="cp-cover hub-art"
          style={
            {
              "--hub-hue": hueOf(content.name),
              ...(content.coverUrl ? { backgroundImage: `url(${JSON.stringify(content.coverUrl)})` } : {}),
            } as CSSProperties
          }
        />
        <div className="cp-identity">
          <Avatar profile={profile} />
          <div className="cp-identity-title">
            <span className="hub-kicker">
              <StreamIcon name={kindIcons[profile.kind]} size={14} />
              {profileKindLabels[profile.kind]} {content.country ? `· ${content.country}` : ""}
            </span>
            <h1>
              {content.name}
              {profile.represented && <OfficialBadge className="cp-official" label="Đại diện đã xác minh" />}
            </h1>
            <p className="cp-identity-meta">
              <span>{profile.represented ? "Đại diện đã xác minh" : "Hồ sơ do AthaHub tổng hợp"}</span>
              <span>
                <StreamIcon name="users" size={14} />
                {followersLabel(profile.followers)}
              </span>
            </p>
          </div>
          <div className="cp-actions">
            <button
              className={viewer.data?.following ? "cp-button" : "cp-button cp-primary"}
              aria-pressed={viewer.data?.following ?? false}
              disabled={follow.isPending}
              onClick={() => authenticated(() => follow.mutate())}
            >
              <StreamIcon name={viewer.data?.following ? "check" : "plus"} size={16} />
              {viewer.data?.following ? "Đang theo dõi" : "Theo dõi"}
            </button>
            {viewer.data?.role && (
              <Link className="cp-button" to={`/manage/${profile.id}`}>
                <StreamIcon name="edit" size={16} />
                Quản lý trang
              </Link>
            )}
          </div>
        </div>
        <nav className="cp-tabs cp-header-tabs" aria-label="Nội dung hồ sơ">
          {tabs.map(([value, label]) => (
            <button key={value} aria-current={tab === value ? "page" : undefined} onClick={() => setTab(value!)}>
              {label}
            </button>
          ))}
        </nav>
      </header>
      {(follow.isError || viewer.isError) && (
        <p className="cp-error" role="alert">
          {follow.error?.message || viewer.error?.message}
        </p>
      )}
      <div className="cp-columns">
        <div className="cp-main-column">
          {tab === "competitions" && <ProfileCompetitionSummary profile={profile} />}
          {tab === "overview" && (
            <>
              <section className="cp-panel">
                <h2>Giới thiệu</h2>
                <p className="cp-prose">
                  {content.biography || "Thông tin giới thiệu đang được bổ sung từ các nguồn công khai."}
                </p>
              </section>
              <section className="cp-panel">
                <h2>Điểm nhấn</h2>
                <div className="cp-stat-grid">
                  <div>
                    <StreamIcon name="trophy" size={20} />
                    <strong>{content.achievements.length}</strong>
                    <span>Thành tích đã ghi nhận</span>
                  </div>
                  <div>
                    <StreamIcon name="flag" size={20} />
                    <strong>{content.history.length}</strong>
                    <span>Mốc lịch sử</span>
                  </div>
                  <div>
                    <StreamIcon name="link" size={20} />
                    <strong>{content.sources.length}</strong>
                    <span>Nguồn đối chiếu</span>
                  </div>
                </div>
              </section>
              {content.achievements.slice(0, 3).map((item, i) => (
                <article className="cp-panel cp-highlight" key={i}>
                  <span className="cp-highlight-icon" aria-hidden="true">
                    <StreamIcon name="trophy" size={22} />
                  </span>
                  <div>
                    <span className="hub-kicker">{item.placement}</span>
                    <h2>{item.title}</h2>
                    <p className="cp-meta">{item.date || "Chưa xác định ngày"}</p>
                  </div>
                </article>
              ))}
            </>
          )}
          {tab === "roster" && (
            <section className="cp-panel">
              <h2>Thành viên và ban huấn luyện</h2>
              {!content.roster.length && <p className="cp-muted">Thông tin thành viên đang được bổ sung.</p>}
              {content.roster.map((item, i) => (
                <article className="cp-list-row" key={i}>
                  <div>
                    <h3>{item.pageId ? <Link to={`/pages/${item.pageId}`}>{item.name}</Link> : item.name}</h3>
                    <p>
                      {item.role} · {item.status || "Chưa rõ trạng thái"}
                    </p>
                    <p className="cp-meta">
                      {item.startsOn || "Chưa rõ ngày bắt đầu"} → {item.endsOn || "Chưa ghi nhận kết thúc"}
                    </p>
                  </div>
                  {item.sourceUrl && (
                    <a className="cp-source" href={item.sourceUrl} target="_blank" rel="noreferrer">
                      Nguồn
                      <StreamIcon name="external" size={12} />
                    </a>
                  )}
                </article>
              ))}
            </section>
          )}
          {tab === "history" && (
            <section className="cp-panel">
              <h2>{profile.kind === "PLAYER" ? "Hành trình thi đấu" : "Lịch sử"}</h2>
              {!content.history.length && (
                <p className="cp-muted">Các mốc có nguồn đối chiếu sẽ được bổ sung tại đây.</p>
              )}
              <div className="cp-timeline">
                {content.history.map((item, i) => (
                  <article key={i}>
                    <span className="cp-meta">
                      {item.startsOn || "Chưa rõ ngày"}
                      {item.endsOn ? ` — ${item.endsOn}` : ""}
                    </span>
                    <h3>
                      {item.relatedPageId ? <Link to={`/pages/${item.relatedPageId}`}>{item.title}</Link> : item.title}
                    </h3>
                    {item.role && <p>{item.role}</p>}
                    {item.sourceUrl && (
                      <a className="cp-source" href={item.sourceUrl} target="_blank" rel="noreferrer">
                        Nguồn đối chiếu
                        <StreamIcon name="external" size={12} />
                      </a>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}
          {tab === "achievements" && (
            <section className="cp-panel">
              <h2>Thành tích và danh hiệu</h2>
              {!content.achievements.length && <p className="cp-muted">Chưa có thành tích được ghi nhận.</p>}
              {content.achievements.map((item, i) => (
                <article className="cp-list-row" key={i}>
                  <span className="cp-placement">{item.placement}</span>
                  <div>
                    <h3>
                      {item.tournamentId ? (
                        <Link to={`/competitions/${item.tournamentId}`}>{item.title}</Link>
                      ) : (
                        item.title
                      )}
                    </h3>
                    <p className="cp-meta">{item.date || "Chưa xác định ngày"}</p>
                  </div>
                  {item.sourceUrl && (
                    <a className="cp-source" href={item.sourceUrl} target="_blank" rel="noreferrer">
                      Nguồn
                      <StreamIcon name="external" size={12} />
                    </a>
                  )}
                </article>
              ))}
            </section>
          )}
          {tab === "posts" && (
            <CommunityFeed
              pageId={profile.id}
              pageName={content.name}
              role={viewer.data?.role || ""}
              represented={profile.represented}
            />
          )}
        </div>
        <aside className="cp-side-column">
          <section className="cp-panel">
            <h2>Thông tin liên hệ</h2>
            {content.links.length ? (
              content.links.map((link, i) => (
                <a className="cp-external" key={i} href={link.url} target="_blank" rel="noreferrer">
                  <span className="hub-link-icon" aria-hidden="true">
                    <StreamIcon name="link" size={16} />
                  </span>
                  <span className="cp-link-label">
                    {link.label}
                    {link.official && <OfficialBadge label="Kênh chính thức" />}
                  </span>
                  <StreamIcon name="external" size={14} />
                </a>
              ))
            ) : (
              <p className="cp-muted">Chưa có kênh liên hệ được công bố.</p>
            )}
          </section>
          <section className="cp-panel">
            <h2>Nguồn thông tin</h2>
            {!content.sources.length && <p className="cp-muted">Chưa có nguồn được công bố.</p>}
            {content.sources.map((source, i) => (
              <div key={i} className="cp-source-row">
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.label}
                  <StreamIcon name="external" size={12} />
                </a>
                {source.checkedOn && <small>Đối chiếu {source.checkedOn}</small>}
              </div>
            ))}
            <button className="cp-text-button" onClick={() => authenticated(() => setSuggesting(!suggesting))}>
              <StreamIcon name="edit" size={14} />
              Đề xuất chỉnh sửa
            </button>
            {suggesting && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  suggest.mutate()
                }}
              >
                <label>
                  Nội dung và nguồn bổ sung
                  <textarea
                    required
                    maxLength={2000}
                    value={suggestion}
                    onChange={(e) => setSuggestion(e.target.value)}
                  />
                </label>
                <button className="cp-button" disabled={suggest.isPending}>
                  Gửi đề xuất
                </button>
              </form>
            )}
            {suggest.isSuccess && (
              <p className="cp-success" role="status">
                Đã gửi đề xuất đến đội ngũ biên tập.
              </p>
            )}
            {suggest.isError && (
              <p className="cp-error" role="alert">
                {suggest.error.message}
              </p>
            )}
          </section>
          {!viewer.data?.role && (
            <section className="cp-panel cp-claim-panel">
              <h2>Bạn là người đại diện?</h2>
              <p className="cp-muted">Nhận quyền quản lý để cập nhật giới thiệu và đăng bài dưới tên trang.</p>
              <button className="cp-button" onClick={() => authenticated(() => setClaiming(!claiming))}>
                Yêu cầu quản lý trang
              </button>
              {claiming && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    claim.mutate()
                  }}
                >
                  <label>
                    Kênh chính thức và bằng chứng đại diện
                    <textarea
                      required
                      rows={5}
                      maxLength={4000}
                      value={evidence}
                      onChange={(e) => setEvidence(e.target.value)}
                      placeholder="Vai trò của bạn, liên kết kênh chính thức và cách đối chiếu…"
                    />
                  </label>
                  <p className="cp-meta">Thông tin này chỉ dùng để xét duyệt, không hiển thị trên hồ sơ.</p>
                  <button className="cp-button cp-primary" disabled={claim.isPending}>
                    Gửi yêu cầu
                  </button>
                </form>
              )}
              {claim.isSuccess && (
                <p role="status" className="cp-success">
                  Đã gửi yêu cầu. Bạn có thể xem tiến trình tại tài khoản của mình.
                </p>
              )}
              {claim.isError && (
                <p role="alert" className="cp-error">
                  {claim.error.message}
                </p>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
