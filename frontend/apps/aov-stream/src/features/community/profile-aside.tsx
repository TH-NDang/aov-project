import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import {
  isCommunityProfile,
  profileKindLabels,
  type CommunityProfile,
  type PageSlice,
  type ProfileKind,
  type ProfileLink,
} from "@aov/community-contracts"
import { OfficialBadge } from "@aov/ui/components/official-badge"
import { SocialPlatformIcon } from "@aov/ui/components/social-platform-icon"
import { knownCountryName } from "@aov/ui/lib/country-references"
import { StreamIcon } from "../../components/stream-icon"
import { useStreamLocale } from "../../components/stream-locale"
import { communityApi } from "./community-api"
import { Avatar, formatDay } from "./community-ui"

/** English names of the page kinds: `profileKindLabels` in the shared contracts carries the Vietnamese ones only. */
export const profileKindEnglish: Record<ProfileKind, string> = {
  CIRCUIT: "Tournament circuit",
  ORGANIZATION: "Organization",
  TEAM: "Team",
  PLAYER: "Player",
  PERSON: "Staff",
}

/**
 * Display a name for recognized country codes and preserve free-form country names. Pass the reader's language to show
 * the name; without one it reads in Vietnamese, which is what related pages are matched by.
 */
export function regionName(country?: string | null, locale = "vi") {
  const value = country?.trim()
  if (!value) return null
  if (/^[A-Z]{2}$/.test(value)) return new Intl.DisplayNames([locale], { type: "region" }).of(value) || value
  // Editors also type the name in Vietnamese; English readers get the countries this app knows in English.
  return locale.startsWith("en") ? (knownCountryName(value, locale) ?? value) : value
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
  const { text, languageTag } = useStreamLocale()
  const content = profile.content!
  const region = regionName(content.country, languageTag)
  const Wrapper = inline ? "div" : "aside"
  return (
    <Wrapper
      className={inline ? "cp-profile-aside-inline" : "cp-side-column cp-profile-aside"}
      aria-label={inline ? undefined : text("Thông tin tham khảo", "Reference information")}
    >
      <section className="cp-panel">
        <h2>{text("Thông tin chung", "General information")}</h2>
        <dl className="cp-profile-facts">
          <div>
            <dt>{text("Loại trang", "Page type")}</dt>
            <dd>{text(profileKindLabels[profile.kind], profileKindEnglish[profile.kind])}</dd>
          </div>
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
            <dt>{text("Người theo dõi", "Followers")}</dt>
            <dd>{profile.followers.toLocaleString(languageTag)}</dd>
          </div>
          <div>
            <dt>{text("Quản lý trang", "Page management")}</dt>
            <dd>
              {profile.represented ? (
                <>
                  {text("Đại diện đã xác minh", "Verified representative")}{" "}
                  <OfficialBadge label={text("Đại diện đã xác minh", "Verified representative")} />
                </>
              ) : (
                text("AthaHub tổng hợp", "Compiled by AthaHub")
              )}
            </dd>
          </div>
        </dl>
        {!profile.represented && (
          <p className="cp-meta">
            {text(
              "Bạn là người đại diện? Chọn nút ⋯ rồi gửi yêu cầu quản lý trang.",
              "Are you a representative? Select the ⋯ button, then send a request to manage the page.",
            )}
          </p>
        )}
      </section>
      {content.links.length > 0 && (
        <section className="cp-panel">
          <h2>{text("Kênh liên hệ", "Contact channels")}</h2>
          <ul className="cp-link-list">
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
      <section className="cp-panel">
        <h2>{text("Nguồn thông tin", "Sources")}</h2>
        {content.sources.length ? (
          <ul className="cp-link-list">
            {content.sources.map((source, index) => (
              <li key={`${source.url}-${index}`}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  <StreamIcon name="link" size={16} />
                  <span>{linkName(source)}</span>
                  <StreamIcon name="external" size={14} />
                </a>
                {source.checkedOn && (
                  <p className="cp-meta">
                    {text("Đối chiếu", "Checked on")} {formatDay(source.checkedOn)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="cp-muted">{text("Chưa có nguồn được công bố.", "No sources published yet.")}</p>
        )}
      </section>
      <RelatedPages profile={profile} />
    </Wrapper>
  )
}

/** Other community pages from the same country, so a visitor can move between a region's channels. */
function RelatedPages({ profile }: { profile: CommunityProfile }) {
  const { text } = useStreamLocale()
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
      <h2>{text("Trang liên quan", "Related pages")}</h2>
      <ul className="cp-related">
        {related.map((page) => (
          <li key={page.id}>
            <Link to={`/pages/${page.code}`}>
              <Avatar profile={page} />
              <span>
                <strong>{page.content?.name || page.code}</strong>
                <small>{text(profileKindLabels[page.kind], profileKindEnglish[page.kind])}</small>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
