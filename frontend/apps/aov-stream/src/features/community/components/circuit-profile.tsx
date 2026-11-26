import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import type { CommunityProfile, CompetitionView } from "@aov/community-contracts"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { communityApi } from "../../../lib/community-api"
import { communityKeys } from "../../../lib/community-keys"
import { focusesFoldedLink } from "../../../lib/folded-text"
import { pageReferenceKey, plainReferences } from "../../../lib/reference-model"
import { pageSummary } from "../../../lib/stream-head"
import { formatDay, regionKey, regionName } from "../../../components/community-ui"
import { ReferenceText } from "../../../components/reference-text"
import { RegionMark } from "../../../components/region-mark"
import { useSections } from "../../../components/place-trail"
import { ProfileHead } from "./profile-head"
import { LiveBlock } from "./profile-home"
import { ProfileOptions } from "./profile-options"
import { HistoryRows } from "./profile-records"
import { distinctHistory } from "../model/profile-records-model"
import { ProfileSocials } from "./profile-socials"
import { championBanners } from "../../../lib/season-map"
import { competitionChampion } from "../../../lib/champion-model"
import { seasonName } from "../../../lib/season-name"
import { circuitIdOf } from "../../../lib/directory-model"
import { competitionCatalogQuery } from "../../../lib/tournament-api"
import { CircuitHonours } from "./circuit-honours"
import { Crest } from "../../../components/crest"
import { StreamHead } from "../../../components/stream-head"
import "./community.css"
import "./community-profile.css"
import "./profile-aside.css"

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
  const catalog = useQuery(competitionCatalogQuery)
  const views = (catalog.data ?? []).filter((view) => circuitIdOf(view) === profile.id)
  const seasonCount = views.filter((view) => !view.content.tournament.parentTournamentId).length
  const region = regionName(content.country, languageTag)
  const selectTab = (value: "overview" | "history") =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (value === "overview") next.delete("tab")
      else next.set("tab", value)
      return next
    })
  const compact = usePageLayout() === "compact"
  const { tournaments } = useSections()
  const tabRow = history.length > 0 && (
    <nav className="cp-tabs" aria-label={text("Nội dung hệ thống giải", "Tournament circuit content")}>
      <button
        type="button"
        aria-current={tab === "overview" ? "page" : undefined}
        onClick={() => selectTab("overview")}
      >
        {text("Tổng quan", "Overview")}
      </button>
      <button type="button" aria-current={tab === "history" ? "page" : undefined} onClick={() => selectTab("history")}>
        {text("Lịch sử", "History")}
      </button>
    </nav>
  )
  return (
    <article className="cp-container pf-page">
      <StreamHead
        title={text(
          `${content.name} — Hệ thống giải · AOV Stream`,
          `${content.name} — Tournament circuit · AOV Stream`,
        )}
        description={
          pageSummary(plainReferences(content.biography ?? "")) ||
          text(
            `${content.name}: các mùa giải, lịch thi đấu và kết quả Liên Quân Mobile.`,
            `${content.name}: seasons, schedule and results of Arena of Valor tournaments.`,
          )
        }
      />
      <ProfileHead
        profile={profile}
        places={[tournaments]}
        kicker={
          <>
            <Link to="/explore?kind=CIRCUIT">{text("Hệ thống giải", "Tournament circuit")}</Link>
            {region && (
              <>
                {" · "}
                <RegionMark code={regionKey(content.country)} size={18} /> {region}
              </>
            )}
          </>
        }
        figures={
          seasonCount
            ? [{ value: String(seasonCount), label: text("mùa giải", seasonCount === 1 ? "season" : "seasons") }]
            : []
        }
        channels={content.links.length > 0 && <ProfileSocials links={content.links} />}
        aside={<Holder views={views} name={content.name} />}
        actions={<ProfileOptions profile={profile} />}
        tabs={!compact && tabRow}
      />
      {compact && tabRow}
      {tab === "history" ? (
        <section aria-label={text("Lịch sử hệ thống giải", "Tournament circuit history")}>
          <HistoryRows items={history} about={pageReferenceKey(profile)} />
        </section>
      ) : (
        <div className="pf-layout">
          <div className="pf-main">
            {profile.live && <LiveBlock live={profile.live} name={content.name} />}
            {content.biography && <CircuitIntro text={content.biography} about={pageReferenceKey(profile)} />}
            <CircuitSeasons query={catalog} views={views} name={content.name} />
          </div>
          <aside className="pa" aria-label={text("Thông tin tham khảo", "Reference information")}>
            <CircuitFacts content={content} region={region} />
          </aside>
        </div>
      )}
    </article>
  )
}

/** The team that holds the circuit now, at the other end of its stage. */
function Holder({ views, name }: { views: CompetitionView[]; name: string }) {
  const { text } = useStreamLocale()
  const [banner] = championBanners(views)
  const won = banner && competitionChampion(banner.view)
  if (!won) return null
  return (
    <Link className="pf-holder" to={`/competitions/${banner.view.id}`}>
      <Crest team={won.winner} />
      <span>
        <span>{text("Đương kim vô địch", "Reigning champion")}</span>
        <strong>{won.winner.name}</strong>
        <span>{seasonName(banner.view.content.tournament.name, name)}</span>
      </span>
    </Link>
  )
}

/** The seasons of a circuit once the catalog is read, or why there are none. */
function CircuitSeasons({
  query,
  views,
  name,
}: {
  query: { isPending: boolean; isError: boolean; refetch: () => unknown }
  views: CompetitionView[]
  name: string
}) {
  const { text } = useStreamLocale()
  if (query.isPending)
    return <div className="hub-skeleton-rows" role="status" aria-label={text("Đang tải mùa giải", "Loading seasons")} />
  if (query.isError)
    return (
      <div className="hub-state" role="alert">
        <h2>{text("Chưa tải được các mùa giải", "The seasons could not be loaded")}</h2>
        <button type="button" className="cp-button" onClick={() => void query.refetch()}>
          {text("Thử lại", "Retry")}
        </button>
      </div>
    )
  if (!views.length)
    return (
      <p className="pf-note">
        {text("Hệ thống giải này chưa có mùa nào được công bố.", "No season of this circuit has been published yet.")}
      </p>
    )
  return <CircuitHonours views={views} circuit={name} />
}

/** Introductions longer than this fold on a compact layout. */
const INTRO_FOLD = 240

/**
 * The circuit's introduction. On a compact layout a long one folds to a few lines, so the seasons a reader comes for
 * stay close to the top of the page.
 */
function CircuitIntro({ text, about }: { text: string; about: string }) {
  // `text` is the introduction here, so the wording picker goes by `ui`.
  const { text: ui } = useStreamLocale()
  const [open, setOpen] = useState(false)
  const foldable = usePageLayout() === "compact" && text.length > INTRO_FOLD
  return (
    <div className="pf-intro">
      <p
        className="pf-bio"
        data-folded={(foldable && !open) || undefined}
        onFocus={(event) => {
          if (foldable && focusesFoldedLink(event)) setOpen(true)
        }}
      >
        <ReferenceText text={text} about={[about]} />
      </p>
      {foldable && (
        <button type="button" className="tn-more pf-intro-more" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? ui("Thu gọn", "Show less") : ui("Xem thêm", "Show more")}
        </button>
      )}
    </div>
  )
}

/** Short name, region, shared channels and sources, in the column a competition's page uses for its facts. */
function CircuitFacts({
  content,
  region,
}: {
  content: NonNullable<CommunityProfile["content"]>
  region: string | null | undefined
}) {
  const { text } = useStreamLocale()
  return (
    <section>
      <h2>{text("Thông tin", "Information")}</h2>
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
        {content.channelOrganizationId && (
          <div>
            <dt>{text("Kênh dùng chung", "Shared channels")}</dt>
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
        <ul className="pa-links">
          {content.sources.map((source, index) => (
            <li key={index}>
              <a href={source.url} target="_blank" rel="noreferrer">
                <span>{source.label || hostOf(source.url)}</span>
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
