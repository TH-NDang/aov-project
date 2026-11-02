import { useState } from "react"
import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { profileKindLabels, type CommunityProfile, type ProfileKind, type PageSlice } from "@aov/community-contracts"
import { StreamShell } from "../../components/stream-shell"
import { communityApi } from "./community-api"
import "./community.css"

export function CommunityDirectory() {
  const [kind, setKind] = useState<ProfileKind>("TEAM")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const query = useQuery({
    queryKey: ["public-pages", kind, search, page],
    queryFn: () =>
      communityApi<PageSlice<CommunityProfile>>(
        `/pages?${new URLSearchParams({ kind, q: search, page: String(page), size: "24" })}`,
      ),
  })
  return (
    <StreamShell>
      <div className="cp-container">
        <div className="cp-heading">
          <span className="cp-eyebrow">CON NGƯỜI · ĐỘI TUYỂN · CỘNG ĐỒNG</span>
          <h1>Những gương mặt của đấu trường</h1>
          <p>Khám phá đội tuyển, theo dõi tuyển thủ và kết nối với những câu chuyện phía sau mỗi trận đấu.</p>
        </div>
        <div className="cp-toolbar">
          <nav aria-label="Loại hồ sơ">
            {(Object.keys(profileKindLabels) as ProfileKind[]).map((type) => (
              <button
                key={type}
                aria-current={kind === type ? "page" : undefined}
                onClick={() => {
                  setKind(type)
                  setPage(0)
                }}
              >
                {profileKindLabels[type]}
              </button>
            ))}
          </nav>
          <input
            aria-label="Tìm hồ sơ"
            placeholder="Tìm tên hoặc mã hồ sơ…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
          />
        </div>
        {query.isPending ? (
          <p>Đang tải danh bạ…</p>
        ) : query.isError ? (
          <p role="alert">{query.error.message}</p>
        ) : !query.data.items.length ? (
          <div className="cp-empty">
            <h2>{search ? "Chưa tìm thấy hồ sơ phù hợp" : "Danh bạ đang được xây dựng"}</h2>
            <p>Hồ sơ đã đối chiếu và công bố sẽ xuất hiện tại đây.</p>
          </div>
        ) : (
          <div className="cp-grid">
            {query.data.items.map((profile) => (
              <Link key={profile.id} className="cp-profile-card" to={`/pages/${profile.code}`}>
                <div
                  className="cp-card-cover"
                  style={
                    profile.content?.coverUrl
                      ? { backgroundImage: `url(${JSON.stringify(profile.content.coverUrl)})` }
                      : undefined
                  }
                />
                <div className="cp-card-content">
                  <Avatar profile={profile} />
                  <span className="cp-eyebrow">{profileKindLabels[profile.kind]}</span>
                  <h2>{profile.content?.name}</h2>
                  <p>{profile.content?.country || "Hồ sơ thi đấu"}</p>
                  <span className="cp-meta">
                    {profile.represented ? "✓ Đại diện đã xác minh" : "Hồ sơ do AthaHub tổng hợp"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
        {query.data && query.data.totalElements > 24 && (
          <div className="cp-actions">
            <button className="cp-button" disabled={!page} onClick={() => setPage(page - 1)}>
              Trước
            </button>
            <span>Trang {page + 1}</span>
            <button
              className="cp-button"
              disabled={(page + 1) * 24 >= query.data.totalElements}
              onClick={() => setPage(page + 1)}
            >
              Tiếp
            </button>
          </div>
        )}
      </div>
    </StreamShell>
  )
}
export function Avatar({ profile }: { profile: CommunityProfile }) {
  return profile.content?.avatarUrl ? (
    <img className="cp-avatar" src={profile.content.avatarUrl} alt="" />
  ) : (
    <div className="cp-avatar cp-initial">{profile.content?.name?.slice(0, 2).toUpperCase() || "AH"}</div>
  )
}
