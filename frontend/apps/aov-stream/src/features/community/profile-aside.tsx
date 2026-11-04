import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import {
  isCommunityProfile,
  profileKindLabels,
  type CommunityProfile,
  type PageSlice,
  type ProfileLink,
} from "@aov/community-contracts"
import { OfficialBadge } from "@aov/ui/components/official-badge"
import { SocialPlatformIcon } from "@aov/ui/components/social-platform-icon"
import { StreamIcon } from "../../components/stream-icon"
import { communityApi } from "./community-api"
import { Avatar, formatDay } from "./community-ui"

/** Display a name for recognized country codes and preserve free-form country names. */
export function regionName(country?: string | null) {
  const value = country?.trim()
  if (!value) return null
  return /^[A-Z]{2}$/.test(value) ? new Intl.DisplayNames(["vi"], { type: "region" }).of(value) || value : value
}

function linkName(link: ProfileLink) {
  if (link.label) return link.label
  try {
    return new URL(link.url).hostname
  } catch {
    return link.url
  }
}

/**
 * The reference column of an organization, team or player page: facts, channels, sources and related pages. Wide
 * screens show it beside the content; narrow ones show the `inline` copy inside the introduction tab instead of
 * pushing the column below the posts.
 */
export function ProfileAside({ profile, inline = false }: { profile: CommunityProfile; inline?: boolean }) {
  const content = profile.content!
  const region = regionName(content.country)
  const Wrapper = inline ? "div" : "aside"
  return (
    <Wrapper
      className={inline ? "cp-profile-aside-inline" : "cp-side-column cp-profile-aside"}
      aria-label={inline ? undefined : "Thông tin tham khảo"}
    >
      <section className="cp-panel">
        <h2>Thông tin chung</h2>
        <dl className="cp-profile-facts">
          <div>
            <dt>Loại trang</dt>
            <dd>{profileKindLabels[profile.kind]}</dd>
          </div>
          {content.shortName && (
            <div>
              <dt>Tên viết tắt</dt>
              <dd>{content.shortName}</dd>
            </div>
          )}
          {region && (
            <div>
              <dt>Quốc gia / khu vực</dt>
              <dd>{region}</dd>
            </div>
          )}
          <div>
            <dt>Người theo dõi</dt>
            <dd>{profile.followers.toLocaleString("vi-VN")}</dd>
          </div>
          <div>
            <dt>Quản lý trang</dt>
            <dd>
              {profile.represented ? (
                <>
                  Đại diện đã xác minh <OfficialBadge label="Đại diện đã xác minh" />
                </>
              ) : (
                "AthaHub tổng hợp"
              )}
            </dd>
          </div>
        </dl>
        {!profile.represented && (
          <p className="cp-meta">Bạn là người đại diện? Chọn nút ⋯ rồi gửi yêu cầu quản lý trang.</p>
        )}
      </section>
      {content.links.length > 0 && (
        <section className="cp-panel">
          <h2>Kênh liên hệ</h2>
          <ul className="cp-link-list">
            {content.links.map((link, index) => (
              <li key={`${link.url}-${index}`}>
                <a href={link.url} target="_blank" rel="noreferrer">
                  <SocialPlatformIcon url={link.url} size={18} />
                  <span>{linkName(link)}</span>
                  {link.official && <OfficialBadge label="Kênh chính thức" />}
                  <StreamIcon name="external" size={14} />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="cp-panel">
        <h2>Nguồn thông tin</h2>
        {content.sources.length ? (
          <ul className="cp-link-list">
            {content.sources.map((source, index) => (
              <li key={`${source.url}-${index}`}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  <StreamIcon name="link" size={16} />
                  <span>{linkName(source)}</span>
                  <StreamIcon name="external" size={14} />
                </a>
                {source.checkedOn && <p className="cp-meta">Đối chiếu {formatDay(source.checkedOn)}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="cp-muted">Chưa có nguồn được công bố.</p>
        )}
      </section>
      <RelatedPages profile={profile} />
    </Wrapper>
  )
}

/** Other community pages from the same country, so a visitor can move between a region's channels. */
function RelatedPages({ profile }: { profile: CommunityProfile }) {
  const pages = useQuery({
    queryKey: ["page-regions"],
    queryFn: () => communityApi<PageSlice<CommunityProfile>>("/pages?size=100"),
    staleTime: 60_000,
  })
  const region = regionName(profile.content?.country)
  const related = (pages.data?.items || [])
    .filter(
      (page) =>
        page.id !== profile.id &&
        isCommunityProfile(page.kind) &&
        region &&
        regionName(page.content?.country) === region,
    )
    .slice(0, 4)
  if (!related.length) return null
  return (
    <section className="cp-panel">
      <h2>Trang liên quan</h2>
      <ul className="cp-related">
        {related.map((page) => (
          <li key={page.id}>
            <Link to={`/pages/${page.code}`}>
              <Avatar profile={page} />
              <span>
                <strong>{page.content?.name || page.code}</strong>
                <small>{profileKindLabels[page.kind]}</small>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
