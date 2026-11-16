import { Link, useSearchParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import type { CommunityProfile } from "@aov/community-contracts"
import { StreamIcon } from "../../components/stream-icon"
import { useStreamLocale } from "../../components/stream-locale"
import { competitionsQuery, formatDay } from "./community-ui"
import { regionName } from "./profile-aside"
import { CompetitionList } from "./public-competitions"
import { ProfileOptions } from "./profile-options"
import { ProfileSocials } from "./profile-socials"
import { communityApi } from "./community-api"
import "./circuit-profile.css"

const tabs = [
  ["overview", ["Tổng quan", "Overview"], "info"],
  ["seasons", ["Các mùa giải", "Seasons"], "calendar"],
  ["history", ["Lịch sử", "History"], "clock"],
] as const

export function CircuitProfile({ profile }: { profile: CommunityProfile }) {
  const { text, languageTag } = useStreamLocale()
  const content = profile.content!
  const [params, setParams] = useSearchParams()
  const tab = tabs.find(([value]) => value === params.get("tab"))?.[0] || "overview"
  const seasons = useQuery(competitionsQuery({ circuitPageId: profile.id }, 0))
  const country = regionName(content.country, languageTag)
  function selectTab(value: string) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (value === "overview") next.delete("tab")
      else next.set("tab", value)
      return next
    })
  }

  return (
    <article className="cp-container circuit-page">
      <title>
        {text(`${content.name} — Hệ thống giải · AOV Stream`, `${content.name} — Tournament circuit · AOV Stream`)}
      </title>
      <nav className="circuit-breadcrumb" aria-label={text("Đường dẫn", "Breadcrumb")}>
        <Link to="/competitions">{text("Giải đấu", "Tournaments")}</Link>
        <StreamIcon name="chevronRight" size={14} />
        <Link to="/explore?kind=CIRCUIT">{text("Hệ thống giải", "Tournament circuits")}</Link>
      </nav>
      <header className="hub-card circuit-header">
        {content.coverUrl && (
          <img
            className="circuit-cover"
            src={content.coverUrl}
            alt={text(`Ảnh bìa ${content.name}`, `${content.name} cover image`)}
          />
        )}
        <div className="circuit-heading">
          <div className="circuit-logo">
            {content.avatarUrl ? (
              <img src={content.avatarUrl} alt={text(`Logo ${content.name}`, `${content.name} logo`)} />
            ) : (
              <StreamIcon name="trophy" size={40} />
            )}
          </div>
          <div className="circuit-title">
            <span className="hub-kicker">
              <StreamIcon name="trophy" size={14} /> {text("Hệ thống giải", "Tournament circuit")}
            </span>
            <h1>{content.name}</h1>
            <div className="circuit-meta">
              {content.shortName && <span>{content.shortName}</span>}
              {country && (
                <span>
                  <StreamIcon name="flag" size={14} />
                  {country}
                </span>
              )}
              <span>{text("Thông tin do AthaHub biên tập", "Information edited by AthaHub")}</span>
            </div>
          </div>
          <ProfileOptions profile={profile} />
        </div>
        <nav className="cp-tabs circuit-tabs" aria-label={text("Nội dung hệ thống giải", "Circuit content")}>
          {tabs.map(([value, label, icon]) => (
            <button
              key={value}
              type="button"
              aria-current={tab === value ? "page" : undefined}
              onClick={() => selectTab(value)}
            >
              <StreamIcon name={icon} size={16} />
              {text(label[0], label[1])}
            </button>
          ))}
        </nav>
      </header>
      <div className="circuit-layout">
        <div className="circuit-main">
          {tab === "overview" && (
            <>
              <section className="cp-panel">
                <h2>{text("Về hệ thống giải", "About the circuit")}</h2>
                <p className="cp-prose">
                  {content.biography ||
                    text(
                      "Thông tin giới thiệu đang được bổ sung từ các nguồn công khai.",
                      "The introduction is being compiled from public sources.",
                    )}
                </p>
              </section>
              <div className="circuit-reference-inline">
                <CircuitReference content={content} country={country} />
              </div>
              <section className="cp-panel circuit-season-intro">
                <div className="circuit-section-heading">
                  <h2>{text("Các mùa giải", "Seasons")}</h2>
                  {seasons.data && (
                    <span className="hub-chip">
                      {text(
                        `${seasons.data.totalElements} mùa đã công bố`,
                        `${seasons.data.totalElements} published ${seasons.data.totalElements === 1 ? "season" : "seasons"}`,
                      )}
                    </span>
                  )}
                </div>
                <p className="cp-prose">
                  {text(
                    "Đội tham dự, đội hình, lịch thi đấu và kết quả được cập nhật riêng theo từng mùa.",
                    "Participating teams, rosters, schedule and results are updated separately for each season.",
                  )}
                </p>
                {seasons.isError ? (
                  <p className="cp-error" role="alert">
                    {text("Chưa tải được các mùa giải.", "The seasons could not be loaded.")}{" "}
                    <button className="cp-text-button" onClick={() => void seasons.refetch()}>
                      {text("Thử lại", "Retry")}
                    </button>
                  </p>
                ) : seasons.isPending ? (
                  <p role="status" className="cp-muted">
                    {text("Đang tải các mùa giải…", "Loading seasons…")}
                  </p>
                ) : seasons.data.totalElements === 0 ? (
                  <p className="circuit-empty">{text("Chưa có mùa giải được công bố.", "No seasons published yet.")}</p>
                ) : (
                  <button className="cp-button" onClick={() => selectTab("seasons")}>
                    {text("Khám phá các mùa giải", "Explore the seasons")} <StreamIcon name="arrow" size={16} />
                  </button>
                )}
              </section>
            </>
          )}
          {tab === "seasons" && <CompetitionList profile={profile} />}
          {tab === "history" && (
            <section className="cp-panel">
              <h2>{text("Lịch sử hệ thống giải", "Circuit history")}</h2>
              {!content.history.length && (
                <p className="circuit-empty">
                  {text(
                    "Các cột mốc sẽ xuất hiện khi có nguồn thông tin được đối chiếu.",
                    "Milestones will appear once there are cross-checked sources.",
                  )}
                </p>
              )}
              <div className="cp-timeline">
                {content.history.map((item, index) => (
                  <article key={index}>
                    <span className="cp-meta">
                      {item.startsOn ? formatDay(item.startsOn) : text("Chưa rõ thời điểm", "Unknown date")}
                      {item.endsOn ? ` — ${formatDay(item.endsOn)}` : ""}
                    </span>
                    <h3>
                      {item.relatedPageId ? <Link to={`/pages/${item.relatedPageId}`}>{item.title}</Link> : item.title}
                    </h3>
                    {item.role && <p className="cp-prose">{item.role}</p>}
                    {item.sourceUrl && (
                      <a className="cp-source" href={item.sourceUrl} target="_blank" rel="noreferrer">
                        {text("Nguồn đối chiếu", "Reference source")} <StreamIcon name="external" size={14} />
                      </a>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
        <aside className="circuit-aside" aria-label={text("Thông tin tham khảo", "Reference information")}>
          <CircuitReference content={content} country={country} />
        </aside>
      </div>
    </article>
  )
}

/** Facts, official channels and sources: beside the content on wide screens, inside the overview tab otherwise. */
function CircuitReference({
  content,
  country,
}: {
  content: NonNullable<CommunityProfile["content"]>
  country: string | null | undefined
}) {
  const { text } = useStreamLocale()
  return (
    <>
      <section className="cp-panel">
        <h2>{text("Thông tin chung", "General information")}</h2>
        <dl className="circuit-facts">
          {content.shortName && (
            <div>
              <dt>{text("Tên viết tắt", "Short name")}</dt>
              <dd>{content.shortName}</dd>
            </div>
          )}
          {country && (
            <div>
              <dt>{text("Quốc gia / khu vực", "Country / region")}</dt>
              <dd>{country}</dd>
            </div>
          )}
          <div>
            <dt>{text("Cột mốc lịch sử", "Historical milestones")}</dt>
            <dd>{content.history.length}</dd>
          </div>
        </dl>
        {(content.links.length > 0 || content.channelOrganizationId) && (
          <div className="circuit-links">
            <h3>{text("Kênh thông tin chính thức", "Official channels")}</h3>
            {content.links.length > 0 && <ProfileSocials links={content.links} />}
            {content.channelOrganizationId && <CircuitChannelOrganization id={content.channelOrganizationId} />}
          </div>
        )}
      </section>
      <section className="cp-panel">
        <h2>{text("Nguồn thông tin", "Sources")}</h2>
        {content.sources.length ? (
          <ul className="circuit-sources">
            {content.sources.map((source, index) => (
              <li key={index}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  <StreamIcon name="link" size={16} />
                  <span>{source.label || new URL(source.url).hostname}</span>
                  <StreamIcon name="external" size={14} />
                </a>
                {source.checkedOn && (
                  <p className="cp-meta">
                    {text(`Đối chiếu ${formatDay(source.checkedOn)}`, `Checked on ${formatDay(source.checkedOn)}`)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="cp-muted">{text("Chưa có nguồn được công bố.", "No sources published yet.")}</p>
        )}
      </section>
    </>
  )
}

function CircuitChannelOrganization({ id }: { id: string }) {
  const { text } = useStreamLocale()
  const organization = useQuery({
    queryKey: ["public-page", id],
    queryFn: () => communityApi<CommunityProfile>(`/pages/${encodeURIComponent(id)}`),
  })
  if (organization.isPending)
    return (
      <p className="cp-meta" role="status">
        {text("Đang tải tổ chức cung cấp kênh…", "Loading the organization that provides the channels…")}
      </p>
    )
  if (organization.isError || organization.data.kind !== "ORGANIZATION")
    return (
      <p className="cp-meta">
        {text(
          "Thông tin tổ chức cung cấp kênh hiện chưa được công bố.",
          "Information about the organization that provides the channels has not been published yet.",
        )}
      </p>
    )

  const profile = organization.data
  return (
    <div className="circuit-channel-organization">
      <p className="cp-meta">{text("Kênh dùng chung với tổ chức", "Channels shared with the organization")}</p>
      <Link to={`/pages/${profile.code}`} className="cp-source">
        <StreamIcon name="building" size={16} />
        {profile.content?.name || profile.code}
        <StreamIcon name="arrow" size={14} />
      </Link>
    </div>
  )
}
