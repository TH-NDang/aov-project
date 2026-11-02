import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { profileKindLabels, type CommunityProfile, type PageSlice } from "@aov/community-contracts"
import { OfficialBadge } from "@aov/ui/components/official-badge"
import { StreamBrand } from "../../components/stream-brand"
import { StreamIcon } from "../../components/stream-icon"
import { ADMIN_URL, WIKI_URL } from "../../components/stream-shell"
import { AccountAvatar } from "../account/account-profile"
import { useOwnProfile } from "../account/profile-api"
import { communityApi } from "./community-api"
import { signIn, useCommunitySession } from "./community-auth"
import { Avatar, followersLabel } from "./community-ui"

/** The right column of portal pages: the viewer's account, pages worth following and the companion sites. */
export function CommunityAside({
  suggestions = true,
  representative = false,
}: {
  suggestions?: boolean
  representative?: boolean
}) {
  return (
    <>
      <SessionCard />
      {suggestions && <FollowSuggestions />}
      {representative && (
        <section className="hub-card hub-card-padded">
          <h2 className="hub-card-title">Bạn là người đại diện?</h2>
          <p className="hub-card-text">
            Mở trang của đội tuyển, tuyển thủ hoặc tổ chức rồi gửi yêu cầu quản lý để cập nhật giới thiệu và đăng bài
            dưới tên trang.
          </p>
        </section>
      )}
      <section className="hub-card hub-card-padded">
        <h2 className="hub-card-title">Khám phá thêm</h2>
        <a className="hub-link-row" href={WIKI_URL}>
          <span className="hub-link-icon">
            <StreamIcon name="spark" size={18} />
          </span>
          <span>
            <strong>AOV WiKi</strong>
            <small>Tướng, trang bị và phiên bản</small>
          </span>
          <StreamIcon name="external" size={14} />
        </a>
        <a className="hub-link-row" href={`${ADMIN_URL}/tournaments`}>
          <span className="hub-link-icon">
            <StreamIcon name="edit" size={18} />
          </span>
          <span>
            <strong>Đóng góp dữ liệu</strong>
            <small>Biên tập giải đấu và ván đấu</small>
          </span>
          <StreamIcon name="external" size={14} />
        </a>
      </section>
    </>
  )
}

function SessionCard() {
  const session = useCommunitySession()
  const profile = useOwnProfile()
  if (session.status === "authenticated") {
    const name = profile.data?.displayName || session.name
    return (
      <section className="hub-card hub-session-card">
        <div className="hub-session-cover" aria-hidden="true" />
        <div className="hub-session-body">
          <AccountAvatar url={profile.data?.avatarUrl} name={name} large />
          <strong>{name}</strong>
          <span className="hub-card-text">Thành viên cộng đồng AOV Stream</span>
          <Link className="cp-button" to="/account">
            <StreamIcon name="user" size={16} />
            Tài khoản của bạn
          </Link>
        </div>
      </section>
    )
  }
  return (
    <section className="hub-card hub-session-card hub-session-guest">
      <div className="hub-session-body">
        <StreamBrand compact />
        <strong>Tham gia cộng đồng</strong>
        <span className="hub-card-text">
          Theo dõi đội tuyển yêu thích, thích bài viết và cùng thảo luận về từng trận.
        </span>
        <div className="hub-session-actions">
          <button className="cp-button cp-primary" onClick={() => void signIn()}>
            Đăng nhập
          </button>
          <button className="cp-button" onClick={() => void signIn(true)}>
            Tạo tài khoản
          </button>
        </div>
      </div>
    </section>
  )
}

function FollowSuggestions() {
  const pages = useQuery({
    queryKey: ["page-suggestions"],
    queryFn: () => communityApi<PageSlice<CommunityProfile>>("/pages?size=5"),
    staleTime: 60_000,
  })
  return (
    <section className="hub-card hub-card-padded">
      <div className="hub-card-heading">
        <h2 className="hub-card-title">Gợi ý theo dõi</h2>
        <Link to="/pages" className="hub-card-more">
          Xem tất cả
        </Link>
      </div>
      {pages.isPending && <div className="hub-skeleton-rows" role="status" aria-label="Đang tải gợi ý" />}
      {pages.isError && <p className="hub-card-text">Chưa tải được gợi ý.</p>}
      {pages.data && !pages.data.items.length && (
        <p className="hub-card-text">Các trang đội tuyển, tuyển thủ và tổ chức sẽ xuất hiện khi được công bố.</p>
      )}
      {pages.data?.items.map((profile) => (
        <Link key={profile.id} className="hub-suggestion" to={`/pages/${profile.code}`}>
          <Avatar profile={profile} />
          <span>
            <strong>
              {profile.content?.name || profile.code}
              {profile.represented && <OfficialBadge label="Đại diện đã xác minh" />}
            </strong>
            <small>
              {profileKindLabels[profile.kind]} · {followersLabel(profile.followers)}
            </small>
          </span>
          <StreamIcon name="chevronRight" size={16} />
        </Link>
      ))}
    </section>
  )
}
