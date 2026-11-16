import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import {
  isIndividualProfile,
  profileKindLabels,
  type CommunityProfile,
  type PageSlice,
  type ProfileLink,
} from "@aov/community-contracts"
import { OfficialBadge } from "@aov/ui/components/official-badge"
import { SocialPlatformIcon } from "@aov/ui/components/social-platform-icon"
import { StreamIcon } from "../../components/stream-icon"
import { useStreamLocale } from "../../components/stream-locale"
import { communityApi } from "./community-api"
import { Avatar, followersLabel, formatDay, profileKindEnglish, regionKey, regionName } from "./community-ui"

function linkName(link: ProfileLink) {
  if (link.label) return link.label
  try {
    return new URL(link.url).hostname
  } catch {
    return link.url
  }
}

/**
 * What a page says about itself and where that comes from: introduction and facts, channels, sources and related
 * pages. A wide layout shows it as the column beside the content; a compact one as the content of its own tab,
 * where `channels` is off because the page head already carries them as icons.
 */
export function ProfileAside({ profile, channels = true }: { profile: CommunityProfile; channels?: boolean }) {
  const { text, languageTag } = useStreamLocale()
  const content = profile.content!
  const region = regionName(content.country, languageTag)
  return (
    <aside className="pf-side" aria-label={text("Giới thiệu và nguồn thông tin", "Introduction and sources")}>
      <section className="tn-side-card pf-about">
        <h2>{text("Thông tin chung", "General information")}</h2>
        {content.biography && <p className="pf-bio">{content.biography}</p>}
        <dl className="tn-facts">
          {content.shortName && (
            <div>
              <dt>{text("Tên viết tắt", "Short name")}</dt>
              <dd>{content.shortName}</dd>
            </div>
          )}
          {region && (
            <div>
              <dt>{text("Quốc gia / khu vực", "Country / region")}</dt>
              <dd>{region}</dd>
            </div>
          )}
          <div>
            <dt>{text("Quản lý trang", "Page management")}</dt>
            <dd>
              {profile.represented ? (
                <>
                  {text("Đại diện đã xác minh", "Verified representative")}{" "}
                  <OfficialBadge label={text("Đại diện đã xác minh", "Verified representative")} />
                </>
              ) : (
                text("AthaHub tổng hợp từ nguồn công khai", "Compiled by AthaHub from public sources")
              )}
            </dd>
          </div>
        </dl>
        {!profile.represented && (
          <p className="cp-meta">
            {text(
              "Bạn là người đại diện? Chọn nút ⋯ ở đầu trang để gửi yêu cầu quản lý.",
              "Are you a representative? Select the ⋯ button at the top of the page to send a request to manage it.",
            )}
          </p>
        )}
      </section>
      {channels && content.links.length > 0 && (
        <section className="tn-side-card">
          <h2>{text("Kênh liên hệ", "Contact channels")}</h2>
          <ul className="pf-links">
            {content.links.map((link, index) => (
              <li key={`${link.url}-${index}`}>
                <a href={link.url} target="_blank" rel="noreferrer">
                  <SocialPlatformIcon url={link.url} size={18} />
                  <span>{linkName(link)}</span>
                  {link.official && <OfficialBadge label={text("Kênh chính thức", "Official channel")} />}
                  <StreamIcon name="external" size={14} />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      {content.sources.length > 0 && (
        <section className="tn-side-card">
          <h2>{text("Nguồn thông tin", "Sources")}</h2>
          <ul className="pf-links">
            {content.sources.map((source, index) => (
              <li key={`${source.url}-${index}`}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  <span>
                    {linkName(source)}
                    {source.checkedOn && (
                      <small>
                        {text("Đối chiếu", "Checked on")} {formatDay(source.checkedOn)}
                      </small>
                    )}
                  </span>
                  <StreamIcon name="external" size={14} />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      <RelatedPages profile={profile} />
    </aside>
  )
}

/**
 * Other pages of the same kind from the same country, so a visitor can move between a region's teams or players.
 * They come from the most recently updated pages of that kind, the only order the service lists pages in.
 */
function RelatedPages({ profile }: { profile: CommunityProfile }) {
  const { text } = useStreamLocale()
  const region = regionKey(profile.content?.country)
  const pages = useQuery({
    queryKey: ["related-pages", profile.kind],
    queryFn: () => communityApi<PageSlice<CommunityProfile>>(`/pages?kind=${profile.kind}&size=40`),
    staleTime: 5 * 60_000,
    enabled: !!region,
  })
  const related = (pages.data?.items || [])
    .filter((page) => page.id !== profile.id && regionKey(page.content?.country) === region)
    .slice(0, 4)
  if (!related.length) return null
  return (
    <section className="tn-side-card pf-related">
      <h2>
        {text(
          `${profileKindLabels[profile.kind]} cùng khu vực`,
          `${profileKindEnglish[profile.kind]} pages in the same region`,
        )}
      </h2>
      <ul className="tn-mini-list">
        {related.map((page) => (
          <li key={page.id}>
            <Link to={`/pages/${page.code}`} data-person={isIndividualProfile(page.kind) || undefined}>
              <Avatar profile={page} />
              <span>
                <strong>{page.content?.name || page.code}</strong>
                {page.followers > 0 && <small>{followersLabel(page.followers)}</small>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
