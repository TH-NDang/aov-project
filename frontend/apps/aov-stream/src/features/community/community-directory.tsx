import { useState, type CSSProperties } from "react"
import { Link, useSearchParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { profileKindLabels, type CommunityProfile, type ProfileKind, type PageSlice } from "@aov/community-contracts"
import { OfficialBadge } from "@aov/ui/components/official-badge"
import { StreamShell } from "../../components/stream-shell"
import { StreamBrand } from "../../components/stream-brand"
import { StreamIcon } from "../../components/stream-icon"
import { communityApi } from "./community-api"
import { CommunityAside } from "./community-aside"
import { Avatar, followersLabel, hueOf, kindIcons } from "./community-ui"
import "./community.css"

const kinds = Object.keys(profileKindLabels) as ProfileKind[]

export function CommunityDirectory() {
  const [params, setParams] = useSearchParams()
  const requested = params.get("kind") as ProfileKind | null
  const kind = requested && kinds.includes(requested) ? requested : null
  const search = params.get("q") || ""
  // Changing the kind or the search starts again from the first page.
  const [paging, setPaging] = useState({ scope: "", page: 0 })
  const scope = `${kind}:${search}`
  const page = paging.scope === scope ? paging.page : 0
  const setPage = (next: number) => setPaging({ scope, page: next })
  const query = useQuery({
    queryKey: ["public-pages", kind, search, page],
    queryFn: () =>
      communityApi<PageSlice<CommunityProfile>>(
        `/pages?${new URLSearchParams({ ...(kind ? { kind } : {}), q: search, page: String(page), size: "24" })}`,
      ),
  })
  function update(key: "kind" | "q", value: string) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: key === "q" },
    )
  }
  return (
    <StreamShell aside={<CommunityAside suggestions={false} representative />}>
      <title>Cộng đồng — AOV Stream</title>
      <div className="cp-container">
        <header className="hub-banner hub-art" style={{ "--hub-hue": 200 } as CSSProperties}>
          <div className="hub-banner-copy">
            <span className="hub-kicker">Con người · Đội tuyển · Cộng đồng</span>
            <h1>Những gương mặt của đấu trường</h1>
            <p>Khám phá đội tuyển, theo dõi tuyển thủ và kết nối với những câu chuyện phía sau mỗi trận đấu.</p>
            {query.data && (
              <div className="hub-banner-stats">
                <span>
                  <StreamIcon name="users" size={14} />
                  {query.data.totalElements.toLocaleString("vi-VN")} trang
                  {kind ? ` ${profileKindLabels[kind].toLocaleLowerCase("vi-VN")}` : ""}
                </span>
              </div>
            )}
          </div>
          <span className="hub-banner-mark" aria-hidden="true">
            <StreamBrand compact />
          </span>
        </header>
        <div className="cp-toolbar">
          <div className="hub-pills" role="group" aria-label="Loại trang">
            <button aria-pressed={!kind} onClick={() => update("kind", "")}>
              <StreamIcon name="grid" size={16} />
              Tất cả
            </button>
            {kinds.map((type) => (
              <button key={type} aria-pressed={kind === type} onClick={() => update("kind", type)}>
                <StreamIcon name={kindIcons[type]} size={16} />
                {profileKindLabels[type]}
              </button>
            ))}
          </div>
          <label className="stream-search">
            <StreamIcon name="search" size={16} />
            <input
              aria-label="Tìm hồ sơ"
              placeholder="Tìm tên hoặc mã hồ sơ…"
              value={search}
              onChange={(event) => update("q", event.target.value)}
            />
          </label>
        </div>
        {query.isPending ? (
          <div className="cp-grid" role="status" aria-label="Đang tải danh bạ">
            {Array.from({ length: 6 }, (_, index) => (
              <div className="hub-skeleton cp-card-skeleton" key={index} />
            ))}
          </div>
        ) : query.isError ? (
          <div className="hub-state" role="alert">
            <StreamIcon name="reset" size={28} />
            <h2>{query.error.message}</h2>
            <button className="cp-button" onClick={() => void query.refetch()}>
              Thử lại
            </button>
          </div>
        ) : !query.data.items.length ? (
          <div className="hub-state">
            <StreamBrand compact />
            <h2>{search ? "Chưa tìm thấy hồ sơ phù hợp" : "Danh bạ đang được xây dựng"}</h2>
            <p>Hồ sơ đã đối chiếu và công bố sẽ xuất hiện tại đây.</p>
            {search && (
              <button className="cp-button" onClick={() => update("q", "")}>
                Xóa tìm kiếm
              </button>
            )}
          </div>
        ) : (
          <div className="cp-grid">
            {query.data.items.map((profile) => (
              <ProfileCard key={profile.id} profile={profile} />
            ))}
          </div>
        )}
        {query.data && query.data.totalElements > 24 && (
          <div className="hub-pagination">
            <button className="cp-button" disabled={!page} onClick={() => setPage(page - 1)}>
              <StreamIcon name="chevronLeft" size={16} />
              Trước
            </button>
            <span>Trang {page + 1}</span>
            <button
              className="cp-button"
              disabled={(page + 1) * 24 >= query.data.totalElements}
              onClick={() => setPage(page + 1)}
            >
              Tiếp
              <StreamIcon name="chevronRight" size={16} />
            </button>
          </div>
        )}
      </div>
    </StreamShell>
  )
}

function ProfileCard({ profile }: { profile: CommunityProfile }) {
  const name = profile.content?.name || profile.code
  const cover = profile.content?.coverUrl
  return (
    <Link className="cp-profile-card" to={`/pages/${profile.code}`}>
      <span
        className="cp-card-cover hub-art"
        style={
          {
            "--hub-hue": hueOf(name),
            ...(cover ? { backgroundImage: `url(${JSON.stringify(cover)})` } : {}),
          } as CSSProperties
        }
      />
      <span className="cp-card-content">
        <Avatar profile={profile} />
        <span className="cp-card-kind">
          <StreamIcon name={kindIcons[profile.kind]} size={14} />
          {profileKindLabels[profile.kind]}
          {profile.content?.country ? ` · ${profile.content.country}` : ""}
        </span>
        <strong className="cp-card-name">
          <span>{name}</span>
          {profile.represented && <OfficialBadge label="Đại diện đã xác minh" />}
        </strong>
        <span className="cp-card-meta">{followersLabel(profile.followers)}</span>
        <span className="cp-card-footer">
          <span>{profile.represented ? "Đại diện đã xác minh" : "Hồ sơ do AthaHub tổng hợp"}</span>
          <StreamIcon name="chevronRight" size={16} />
        </span>
      </span>
    </Link>
  )
}
