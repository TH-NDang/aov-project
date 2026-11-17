import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import type { CommunityProfile } from "@aov/community-contracts"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { StreamIcon } from "../../components/stream-icon"
import { useStreamLocale } from "../../components/stream-locale"
import { communityApi } from "./community-api"
import { communityKeys } from "./community-keys"
import { competitionsFeedQuery, formatDay, regionName } from "./community-ui"
import { ProfileHead } from "./profile-head"
import { LiveBlock } from "./profile-home"
import { ProfileOptions } from "./profile-options"
import { HistoryRows, distinctHistory } from "./profile-records"
import { ProfileSocials } from "./profile-socials"
import { CompetitionList } from "./public-competitions"
import "./community.css"
import "./community-profile.css"

/**
 * A circuit's page: what it is, then its seasons, which are what a reader comes for. The facts stand beside them as
 * on a competition's own page. The history tab only exists for circuits that have milestones.
 */
export function CircuitProfile({ profile }: { profile: CommunityProfile }) {
  const { text, languageTag } = useStreamLocale()
  const content = profile.content!
  const [params, setParams] = useSearchParams()
  const history = distinctHistory(content.history)
  // The overview lists the seasons, so `?tab=seasons` and any other unknown tab open it.
  const tab = params.get("tab") === "history" && history.length ? "history" : "overview"
  const seasons = useInfiniteQuery(competitionsFeedQuery({ circuitPageId: profile.id }))
  const seasonCount = seasons.data?.pages[0]?.totalElements
  const region = regionName(content.country, languageTag)
  const selectTab = (value: "overview" | "history") =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (value === "overview") next.delete("tab")
      else next.set("tab", value)
      return next
    })
  return (
    <article className="cp-container pf-page">
      <title>
        {text(`${content.name} — Hệ thống giải · AOV Stream`, `${content.name} — Tournament circuit · AOV Stream`)}
      </title>
      <Link className="cp-back" to="/competitions">
        <StreamIcon name="back" size={16} />
        {text("Tất cả giải đấu", "All tournaments")}
      </Link>
      <ProfileHead
        profile={profile}
        kicker={
          <>
            <Link to="/explore?kind=CIRCUIT">{text("Hệ thống giải", "Tournament circuit")}</Link>
            {region && ` · ${region}`}
          </>
        }
        facts={[
          content.shortName,
          !!seasonCount &&
            text(`${seasonCount} mùa giải`, `${seasonCount} ${seasonCount === 1 ? "season" : "seasons"}`),
        ].filter((fact) => !!fact)}
        actions={<ProfileOptions profile={profile} />}
      />
      {history.length > 0 && (
        <nav className="cp-tabs" aria-label={text("Nội dung hệ thống giải", "Tournament circuit content")}>
          <button
            type="button"
            aria-current={tab === "overview" ? "page" : undefined}
            onClick={() => selectTab("overview")}
          >
            {text("Tổng quan", "Overview")}
          </button>
          <button
            type="button"
            aria-current={tab === "history" ? "page" : undefined}
            onClick={() => selectTab("history")}
          >
            {text("Lịch sử", "History")}
          </button>
        </nav>
      )}
      {tab === "history" ? (
        <section aria-label={text("Lịch sử hệ thống giải", "Tournament circuit history")}>
          <HistoryRows items={history} />
        </section>
      ) : (
        <div className="tn-overview">
          <div className="tn-overview-main">
            {profile.live && <LiveBlock live={profile.live} name={content.name} />}
            {content.biography && <CircuitIntro text={content.biography} />}
            <CompetitionList profile={profile} title={text("Các mùa giải", "Seasons")} />
          </div>
          <aside className="tn-overview-side" aria-label={text("Thông tin tham khảo", "Reference information")}>
            <CircuitFacts content={content} region={region} />
          </aside>
        </div>
      )}
    </article>
  )
}

/** Introductions longer than this fold on a compact layout. */
const INTRO_FOLD = 240

/**
 * The circuit's introduction. On a compact layout a long one folds to a few lines, so the seasons a reader comes for
 * stay close to the top of the page.
 */
function CircuitIntro({ text }: { text: string }) {
  // `text` is the introduction here, so the wording picker goes by `ui`.
  const { text: ui } = useStreamLocale()
  const [open, setOpen] = useState(false)
  const foldable = usePageLayout() === "compact" && text.length > INTRO_FOLD
  return (
    <div className="pf-intro">
      <p className="pf-bio" data-folded={(foldable && !open) || undefined}>
        {text}
      </p>
      {foldable && (
        <button type="button" className="tn-more" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? ui("Thu gọn", "Show less") : ui("Xem thêm", "Show more")}
        </button>
      )}
    </div>
  )
}

/** Short name, region, official channels and sources, in the side card a competition's page uses for its facts. */
function CircuitFacts({
  content,
  region,
}: {
  content: NonNullable<CommunityProfile["content"]>
  region: string | null | undefined
}) {
  const { text } = useStreamLocale()
  return (
    <section className="tn-side-card pf-about">
      <h2>{text("Thông tin", "Information")}</h2>
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
        {content.links.length > 0 && (
          <div>
            <dt>{text("Kênh chính thức", "Official channels")}</dt>
            <dd>
              <ProfileSocials links={content.links} />
            </dd>
          </div>
        )}
        {content.channelOrganizationId && (
          <div>
            <dt>{text("Kênh dùng chung với tổ chức", "Channels shared with the organization")}</dt>
            <dd>
              <CircuitChannelOrganization id={content.channelOrganizationId} />
            </dd>
          </div>
        )}
        <div>
          <dt>{text("Biên tập", "Edited by")}</dt>
          <dd>{text("AthaHub, từ nguồn công khai", "AthaHub, from public sources")}</dd>
        </div>
      </dl>
      {content.sources.length > 0 && (
        <ul className="tn-links">
          {content.sources.map((source, index) => (
            <li key={index}>
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                title={
                  source.checkedOn
                    ? text(`Đối chiếu ${formatDay(source.checkedOn)}`, `Checked on ${formatDay(source.checkedOn)}`)
                    : undefined
                }
              >
                {source.label || hostOf(source.url)}
                <StreamIcon name="external" size={13} />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function CircuitChannelOrganization({ id }: { id: string }) {
  const { text } = useStreamLocale()
  const organization = useQuery({
    queryKey: communityKeys.publicPage(id),
    queryFn: () => communityApi.page(id),
  })
  if (organization.isPending) return <span role="status">{text("Đang tải…", "Loading…")}</span>
  if (organization.isError || organization.data.kind !== "ORGANIZATION")
    return <span>{text("Chưa được công bố", "Not published yet")}</span>
  const profile = organization.data
  return (
    <Link className="cp-organizer" to={`/pages/${profile.code}`}>
      {profile.content?.avatarUrl && <img src={profile.content.avatarUrl} alt="" />}
      {profile.content?.name || profile.code}
    </Link>
  )
}
