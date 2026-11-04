import { Link, useSearchParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import type { CommunityProfile } from "@aov/community-contracts"
import { StreamIcon } from "../../components/stream-icon"
import { competitionsQuery, formatDay } from "./community-ui"
import { CompetitionList } from "./public-competitions"
import { ProfileOptions } from "./profile-options"
import { ProfileSocials } from "./profile-socials"
import { communityApi } from "./community-api"
import "./circuit-profile.css"

const tabs = [
  ["overview", "Tổng quan", "info"],
  ["seasons", "Các mùa giải", "calendar"],
  ["history", "Lịch sử", "clock"],
] as const

export function CircuitProfile({ profile }: { profile: CommunityProfile }) {
  const content = profile.content!
  const [params, setParams] = useSearchParams()
  const tab = tabs.find(([value]) => value === params.get("tab"))?.[0] || "overview"
  const seasons = useQuery(competitionsQuery({ circuitPageId: profile.id }, 0))
  const country = content.country
    ? /^[A-Z]{2}$/.test(content.country)
      ? new Intl.DisplayNames(["vi"], { type: "region" }).of(content.country)
      : content.country
    : null
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
      <title>{`${content.name} — Hệ thống giải · AOV Stream`}</title>
      <nav className="circuit-breadcrumb" aria-label="Đường dẫn">
        <Link to="/competitions">Giải đấu</Link>
        <StreamIcon name="chevronRight" size={14} />
        <Link to="/explore?kind=CIRCUIT">Hệ thống giải</Link>
      </nav>
      <header className="hub-card circuit-header">
        {content.coverUrl && <img className="circuit-cover" src={content.coverUrl} alt={`Ảnh bìa ${content.name}`} />}
        <div className="circuit-heading">
          <div className="circuit-logo">
            {content.avatarUrl ? (
              <img src={content.avatarUrl} alt={`Logo ${content.name}`} />
            ) : (
              <StreamIcon name="trophy" size={40} />
            )}
          </div>
          <div className="circuit-title">
            <span className="hub-kicker">
              <StreamIcon name="trophy" size={14} /> Hệ thống giải
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
              <span>Thông tin do AthaHub biên tập</span>
            </div>
          </div>
          <ProfileOptions profile={profile} />
        </div>
        <nav className="cp-tabs circuit-tabs" aria-label="Nội dung hệ thống giải">
          {tabs.map(([value, label, icon]) => (
            <button
              key={value}
              type="button"
              aria-current={tab === value ? "page" : undefined}
              onClick={() => selectTab(value)}
            >
              <StreamIcon name={icon} size={16} />
              {label}
            </button>
          ))}
        </nav>
      </header>
      <div className="circuit-layout">
        <div className="circuit-main">
          {tab === "overview" && (
            <>
              <section className="cp-panel">
                <h2>Về hệ thống giải</h2>
                <p className="cp-prose">
                  {content.biography || "Thông tin giới thiệu đang được bổ sung từ các nguồn công khai."}
                </p>
              </section>
              <div className="circuit-reference-inline">
                <CircuitReference content={content} country={country} />
              </div>
              <section className="cp-panel circuit-season-intro">
                <div className="circuit-section-heading">
                  <h2>Các mùa giải</h2>
                  {seasons.data && <span className="hub-chip">{seasons.data.totalElements} mùa đã công bố</span>}
                </div>
                <p className="cp-prose">
                  Đội tham dự, đội hình, lịch thi đấu và kết quả được cập nhật riêng theo từng mùa.
                </p>
                {seasons.isError ? (
                  <p className="cp-error" role="alert">
                    Chưa tải được các mùa giải.{" "}
                    <button className="cp-text-button" onClick={() => void seasons.refetch()}>
                      Thử lại
                    </button>
                  </p>
                ) : seasons.isPending ? (
                  <p role="status" className="cp-muted">
                    Đang tải các mùa giải…
                  </p>
                ) : seasons.data.totalElements === 0 ? (
                  <p className="circuit-empty">Chưa có mùa giải được công bố.</p>
                ) : (
                  <button className="cp-button" onClick={() => selectTab("seasons")}>
                    Khám phá các mùa giải <StreamIcon name="arrow" size={16} />
                  </button>
                )}
              </section>
            </>
          )}
          {tab === "seasons" && <CompetitionList profile={profile} />}
          {tab === "history" && (
            <section className="cp-panel">
              <h2>Lịch sử hệ thống giải</h2>
              {!content.history.length && (
                <p className="circuit-empty">Các cột mốc sẽ xuất hiện khi có nguồn thông tin được đối chiếu.</p>
              )}
              <div className="cp-timeline">
                {content.history.map((item, index) => (
                  <article key={index}>
                    <span className="cp-meta">
                      {item.startsOn ? formatDay(item.startsOn) : "Chưa rõ thời điểm"}
                      {item.endsOn ? ` — ${formatDay(item.endsOn)}` : ""}
                    </span>
                    <h3>
                      {item.relatedPageId ? <Link to={`/pages/${item.relatedPageId}`}>{item.title}</Link> : item.title}
                    </h3>
                    {item.role && <p className="cp-prose">{item.role}</p>}
                    {item.sourceUrl && (
                      <a className="cp-source" href={item.sourceUrl} target="_blank" rel="noreferrer">
                        Nguồn đối chiếu <StreamIcon name="external" size={14} />
                      </a>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
        <aside className="circuit-aside" aria-label="Thông tin tham khảo">
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
  return (
    <>
      <section className="cp-panel">
        <h2>Thông tin chung</h2>
        <dl className="circuit-facts">
          {content.shortName && (
            <div>
              <dt>Tên viết tắt</dt>
              <dd>{content.shortName}</dd>
            </div>
          )}
          {country && (
            <div>
              <dt>Quốc gia / khu vực</dt>
              <dd>{country}</dd>
            </div>
          )}
          <div>
            <dt>Cột mốc lịch sử</dt>
            <dd>{content.history.length}</dd>
          </div>
        </dl>
        {(content.links.length > 0 || content.channelOrganizationId) && (
          <div className="circuit-links">
            <h3>Kênh thông tin chính thức</h3>
            {content.links.length > 0 && <ProfileSocials links={content.links} />}
            {content.channelOrganizationId && <CircuitChannelOrganization id={content.channelOrganizationId} />}
          </div>
        )}
      </section>
      <section className="cp-panel">
        <h2>Nguồn thông tin</h2>
        {content.sources.length ? (
          <ul className="circuit-sources">
            {content.sources.map((source, index) => (
              <li key={index}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  <StreamIcon name="link" size={16} />
                  <span>{source.label || new URL(source.url).hostname}</span>
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
    </>
  )
}

function CircuitChannelOrganization({ id }: { id: string }) {
  const organization = useQuery({
    queryKey: ["public-page", id],
    queryFn: () => communityApi<CommunityProfile>(`/pages/${encodeURIComponent(id)}`),
  })
  if (organization.isPending)
    return (
      <p className="cp-meta" role="status">
        Đang tải tổ chức cung cấp kênh…
      </p>
    )
  if (organization.isError || organization.data.kind !== "ORGANIZATION")
    return <p className="cp-meta">Thông tin tổ chức cung cấp kênh hiện chưa được công bố.</p>

  const profile = organization.data
  return (
    <div className="circuit-channel-organization">
      <p className="cp-meta">Kênh dùng chung với tổ chức</p>
      <Link to={`/pages/${profile.code}`} className="cp-source">
        <StreamIcon name="building" size={16} />
        {profile.content?.name || profile.code}
        <StreamIcon name="arrow" size={14} />
      </Link>
    </div>
  )
}
