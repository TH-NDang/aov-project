import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import type { CommunityProfile } from "@aov/community-contracts"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { StreamIcon } from "../../components/stream-icon"
import { communityApi } from "./community-api"
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
  const content = profile.content!
  const [params, setParams] = useSearchParams()
  const history = distinctHistory(content.history)
  // The overview lists the seasons, so `?tab=seasons` and any other unknown tab open it.
  const tab = params.get("tab") === "history" && history.length ? "history" : "overview"
  const seasons = useInfiniteQuery(competitionsFeedQuery({ circuitPageId: profile.id }))
  const seasonCount = seasons.data?.pages[0]?.totalElements
  const region = regionName(content.country)
  const selectTab = (value: "overview" | "history") =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (value === "overview") next.delete("tab")
      else next.set("tab", value)
      return next
    })
  return (
    <article className="cp-container pf-page">
      <title>{`${content.name} — Hệ thống giải · AOV Stream`}</title>
      <Link className="cp-back" to="/competitions">
        <StreamIcon name="back" size={16} />
        Tất cả giải đấu
      </Link>
      <ProfileHead
        profile={profile}
        kicker={
          <>
            <Link to="/explore?kind=CIRCUIT">Hệ thống giải</Link>
            {region && ` · ${region}`}
          </>
        }
        facts={[content.shortName, !!seasonCount && `${seasonCount} mùa giải`].filter((fact) => !!fact)}
        actions={<ProfileOptions profile={profile} />}
      />
      {history.length > 0 && (
        <nav className="cp-tabs" aria-label="Nội dung hệ thống giải">
          <button
            type="button"
            aria-current={tab === "overview" ? "page" : undefined}
            onClick={() => selectTab("overview")}
          >
            Tổng quan
          </button>
          <button
            type="button"
            aria-current={tab === "history" ? "page" : undefined}
            onClick={() => selectTab("history")}
          >
            Lịch sử
          </button>
        </nav>
      )}
      {tab === "history" ? (
        <section aria-label="Lịch sử hệ thống giải">
          <HistoryRows items={history} />
        </section>
      ) : (
        <div className="tn-overview">
          <div className="tn-overview-main">
            {profile.live && <LiveBlock live={profile.live} name={content.name} />}
            {content.biography && <CircuitIntro text={content.biography} />}
            <CompetitionList profile={profile} title="Các mùa giải" />
          </div>
          <aside className="tn-overview-side" aria-label="Thông tin tham khảo">
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
  const [open, setOpen] = useState(false)
  const foldable = usePageLayout() === "compact" && text.length > INTRO_FOLD
  return (
    <div className="pf-intro">
      <p className="pf-bio" data-folded={(foldable && !open) || undefined}>
        {text}
      </p>
      {foldable && (
        <button type="button" className="tn-more" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Thu gọn" : "Xem thêm"}
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
  return (
    <section className="tn-side-card pf-about">
      <h2>Thông tin</h2>
      <dl className="tn-facts">
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
        {content.links.length > 0 && (
          <div>
            <dt>Kênh chính thức</dt>
            <dd>
              <ProfileSocials links={content.links} />
            </dd>
          </div>
        )}
        {content.channelOrganizationId && (
          <div>
            <dt>Kênh dùng chung với tổ chức</dt>
            <dd>
              <CircuitChannelOrganization id={content.channelOrganizationId} />
            </dd>
          </div>
        )}
        <div>
          <dt>Biên tập</dt>
          <dd>AthaHub, từ nguồn công khai</dd>
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
                title={source.checkedOn ? `Đối chiếu ${formatDay(source.checkedOn)}` : undefined}
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
  const organization = useQuery({
    queryKey: ["public-page", id],
    queryFn: () => communityApi<CommunityProfile>(`/pages/${encodeURIComponent(id)}`),
  })
  if (organization.isPending) return <span role="status">Đang tải…</span>
  if (organization.isError || organization.data.kind !== "ORGANIZATION") return <span>Chưa được công bố</span>
  const profile = organization.data
  return (
    <Link className="cp-organizer" to={`/pages/${profile.code}`}>
      {profile.content?.avatarUrl && <img src={profile.content.avatarUrl} alt="" />}
      {profile.content?.name || profile.code}
    </Link>
  )
}
