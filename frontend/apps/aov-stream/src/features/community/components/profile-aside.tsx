import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { profileKindLabels, type CommunityProfile, type ProfileLink } from "@aov/community-contracts"
import { OfficialBadge } from "@aov/ui/components/official-badge"
import { ProfileMark } from "../../../components/page-mark"
import { ReferenceText } from "../../../components/reference-text"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { communityApi } from "../../../lib/community-api"
import { communityKeys } from "../../../lib/community-keys"
import { pageReferenceKey } from "../../../lib/reference-model"
import { followersLabel, formatDay, profileKindEnglish, regionKey, regionName } from "../../../components/community-ui"
import "./profile-aside.css"

function linkName(link: ProfileLink) {
  if (link.label) return link.label
  try {
    return new URL(link.url).hostname
  } catch {
    return link.url
  }
}

/**
 * What a page says about itself and where that comes from: introduction and facts, sources and related pages, straight
 * on the page. A wide layout shows it as the `column` beside the content, a compact one as the content of its own tab.
 * `missing` names what the page does not record yet.
 */
export function ProfileAside({
  profile,
  missing,
  column = false,
}: {
  profile: CommunityProfile
  missing: string[]
  column?: boolean
}) {
  const { text, languageTag } = useStreamLocale()
  const content = profile.content!
  const region = regionName(content.country, languageTag)
  return (
    <aside
      className="pa"
      data-column={column || undefined}
      aria-label={text("Giới thiệu và nguồn thông tin", "Introduction and sources")}
    >
      <section>
        <h2>{text("Giới thiệu", "About")}</h2>
        {content.biography && (
          <p className="pa-bio">
            <ReferenceText text={content.biography} about={[pageReferenceKey(profile)]} />
          </p>
        )}
        <dl className="pa-facts">
          {content.shortName && (
            <div>
              <dt>{text("Tên viết tắt", "Short name")}</dt>
              <dd>{content.shortName}</dd>
            </div>
          )}
          {region && (
            <div>
              <dt>{text("Khu vực", "Region")}</dt>
              <dd>{region}</dd>
            </div>
          )}
          <div>
            <dt>{text("Quản lý trang", "Managed by")}</dt>
            <dd>
              {profile.represented ? (
                <>
                  {text("Đại diện đã xác minh", "Verified representative")}{" "}
                  <OfficialBadge label={text("Đại diện đã xác minh", "Verified representative")} />
                </>
              ) : (
                text("AthaHub, từ nguồn công khai", "AthaHub, from public sources")
              )}
            </dd>
          </div>
        </dl>
        {(missing.length > 0 || !profile.represented) && (
          <p className="pa-note">
            {missing.length > 0 &&
              text(
                `Trang chưa ghi nhận ${missing.join(", ")}. `,
                `This page has no ${missing.join(", ")} recorded yet. `,
              )}
            {!profile.represented &&
              text(
                "Bạn có thông tin hoặc là người đại diện? Chọn nút ⋯ ở đầu trang.",
                "Know more, or represent this page? Choose the ⋯ button at the top.",
              )}
          </p>
        )}
      </section>
      {content.sources.length > 0 && (
        <section>
          <h2>{text("Nguồn", "Sources")}</h2>
          <ul className="pa-links">
            {content.sources.map((source, index) => (
              <li key={`${source.url}-${index}`}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  <span>{linkName(source)}</span>
                  <StreamIcon name="external" size={13} />
                </a>
                {source.checkedOn && (
                  <small>
                    {text("đối chiếu", "checked on")} {formatDay(source.checkedOn)}
                  </small>
                )}
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
    queryKey: communityKeys.relatedPages(profile.kind),
    queryFn: () => communityApi.pages({ kind: profile.kind, size: "40" }),
    staleTime: 5 * 60_000,
    enabled: !!region,
  })
  const related = (pages.data?.items || [])
    .filter((page) => page.id !== profile.id && regionKey(page.content?.country) === region)
    .slice(0, 4)
  if (!related.length) return null
  return (
    <section>
      <h2>
        {text(
          `${profileKindLabels[profile.kind]} cùng khu vực`,
          `${profileKindEnglish[profile.kind]} pages in the same region`,
        )}
      </h2>
      <ul className="tn-mini-list">
        {related.map((page) => (
          <li key={page.id}>
            <Link to={`/pages/${page.code}`}>
              <ProfileMark profile={page} size={40} />
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
