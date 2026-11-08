import { useQuery } from "@tanstack/react-query"
import { Link, Navigate, useParams } from "react-router"
import { useWikiContext } from "../../context/wiki-context"
import { CatalogHeading } from "../../layout/catalog-heading"
import { modeMeta, notFoundMeta } from "../../lib/seo/page-meta"
import { usePageHead } from "../../lib/seo/use-page-head"
import { AutoChessGuide, GUIDE_TABS, type GuideTab } from "./auto-chess-guide"
import { guideQuery, modeQuery, ModeRequestError } from "./mode-api"
import {
  AvailabilityBadge,
  availabilityLabel,
  durationText,
  formatDay,
  GROUP_LABEL,
  ModeArt,
  RuleList,
} from "./mode-ui"
import "./modes.css"

/** One mode: art, length, availability and rules; a mode with a published guide shows it in tabs below. */
export function ModeDetailPage() {
  const { code = "", tab } = useParams()
  const { href, locale } = useWikiContext()
  const mode = useQuery(modeQuery(code))
  const hasGuide = !!mode.data?.hasGuide
  const guide = useQuery({ ...guideQuery(code), enabled: hasGuide })
  // Every tab shares the mode's address as canonical: only the mode page itself is prerendered.
  const headArt = mode.data?.content.artAssetId ? mode.data.images[mode.data.content.artAssetId] : null
  usePageHead(
    mode.data
      ? modeMeta(
          {
            code: mode.data.code,
            name: mode.data.content.name,
            summary: mode.data.content.summary,
            hasGuide,
            art: headArt,
          },
          locale,
        )
      : mode.error instanceof ModeRequestError && mode.error.status === 404
        ? notFoundMeta(locale, `/modes/${encodeURIComponent(code)}`, "modes")
        : null,
  )

  if (mode.isPending) return <p className="mode-empty">Đang tải chế độ…</p>
  if (mode.isError) {
    const missing = mode.error instanceof ModeRequestError && mode.error.status === 404
    return (
      <div className="mode-page">
        <p className="mode-empty">{missing ? "Chế độ này chưa có trên Wiki." : "Chưa tải được chế độ."}</p>
        <Link to={href("/modes")}>← Tất cả chế độ</Link>
      </div>
    )
  }

  const { content, images } = mode.data
  const known = GUIDE_TABS.some((item) => item.key === tab)
  if (tab && (!hasGuide || !known)) return <Navigate to={href(`/modes/${encodeURIComponent(code)}`)} replace />
  const activeTab = (tab ?? "tong-quan") as GuideTab
  const duration = durationText(content.duration)
  const art = content.artAssetId ? images[content.artAssetId] : null

  return (
    <div className="mode-page">
      <CatalogHeading title={content.name} section="Chế độ chơi" />
      <ModeArt
        className={activeTab === "tong-quan" ? "mode-banner" : "mode-banner mode-banner-compact"}
        image={art}
        name={content.name}
        eager
      >
        <div className="mode-banner-copy">
          <h1>{content.name}</h1>
          <p className="mode-meta">
            <span>{GROUP_LABEL[content.group]}</span>
            {duration && <span>{duration} / trận</span>}
            {content.playersLabel && <span>{content.playersLabel}</span>}
          </p>
          <span className="mode-badges">
            <AvailabilityBadge availability={content.availability} />
          </span>
        </div>
      </ModeArt>

      {hasGuide && (
        <nav className="guide-tabs" aria-label="Mục cẩm nang">
          {GUIDE_TABS.map((item) => (
            <Link
              key={item.key}
              className="mode-chip"
              aria-current={activeTab === item.key ? "page" : undefined}
              to={href(`/modes/${encodeURIComponent(code)}${item.key === "tong-quan" ? "" : `/${item.key}`}`)}
              preventScrollReset
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}

      {activeTab === "tong-quan" ? (
        <div className="mode-columns">
          <div className="mode-page">
            {content.summary && (
              <section className="mode-panel">
                <h2>Giới thiệu</h2>
                <p className="mode-prose">{content.summary}</p>
              </section>
            )}
            {content.rules.length > 0 && (
              <section className="mode-panel">
                <h2>Luật chơi</h2>
                <RuleList rules={content.rules} />
              </section>
            )}
            {hasGuide && guide.data && guide.data.content.rules.length > content.rules.length && (
              <section className="mode-panel">
                <h2>Luật chi tiết</h2>
                <RuleList rules={guide.data.content.rules} />
              </section>
            )}
            {content.heroes.length > 0 && (
              <section className="mode-panel">
                <h2>Tướng của chế độ</h2>
                <ul className="mode-facts">
                  {content.heroes.map((hero) => (
                    <li key={hero.name}>
                      {hero.heroCode ? <Link to={href(`/hero/${hero.heroCode}`)}>{hero.name}</Link> : hero.name}
                      {hero.note && <span className="mode-meta"> — {hero.note}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {content.specialItems.length > 0 && (
              <section className="mode-panel">
                <h2>Vật phẩm riêng</h2>
                <div className="guide-card-list">
                  {content.specialItems.map((item) => (
                    <article key={item.name} className="guide-card">
                      {item.iconAssetId && images[item.iconAssetId] ? (
                        <img className="guide-icon" src={images[item.iconAssetId]!.url} alt="" />
                      ) : (
                        <span />
                      )}
                      <div>
                        <h3>{item.name}</h3>
                        {item.description && <p>{item.description}</p>}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
            {!content.summary && !content.rules.length && !hasGuide && (
              <p className="mode-empty">Chế độ này mới có thông tin cơ bản. Luật chơi và hình ảnh sẽ được bổ sung.</p>
            )}
          </div>
          <aside className="mode-panel" aria-label="Thông tin nhanh">
            <h2>Thông tin nhanh</h2>
            <dl className="mode-facts">
              <div>
                <dt>Nhóm</dt>
                <dd>{GROUP_LABEL[content.group]}</dd>
              </div>
              {duration && (
                <div>
                  <dt>Thời lượng thường gặp</dt>
                  <dd>{duration}</dd>
                </div>
              )}
              {content.playersLabel && (
                <div>
                  <dt>Số người</dt>
                  <dd>{content.playersLabel}</dd>
                </div>
              )}
              <div>
                <dt>Tình trạng</dt>
                <dd>{availabilityLabel(content.availability) ?? "Chưa rõ"}</dd>
              </div>
              {(content.availability?.startsOn || content.availability?.endsOn) && (
                <div>
                  <dt>Thời gian mở</dt>
                  <dd>
                    {formatDay(content.availability.startsOn) ?? "?"} – {formatDay(content.availability.endsOn) ?? "?"}
                  </dd>
                </div>
              )}
              {content.availability?.observedOn && (
                <div>
                  <dt>Ghi nhận ngày</dt>
                  <dd>{formatDay(content.availability.observedOn)}</dd>
                </div>
              )}
              {content.availability?.note && (
                <div>
                  <dt>Ghi chú</dt>
                  <dd>{content.availability.note}</dd>
                </div>
              )}
              {hasGuide && guide.data?.content.edition && (
                <div>
                  <dt>Cẩm nang</dt>
                  <dd>{guide.data.content.edition}</dd>
                </div>
              )}
            </dl>
            {content.sources.length > 0 && (
              <p className="mode-sources">
                Nguồn: {content.sources.map((source) => source.label).join("; ")}. Hình ảnh: Garena / Liên Quân Mobile.
              </p>
            )}
            <Link to={href("/modes")}>← Tất cả chế độ</Link>
          </aside>
        </div>
      ) : guide.isPending ? (
        <p className="mode-empty">Đang tải cẩm nang…</p>
      ) : guide.isError ? (
        <p className="mode-empty">Chưa tải được cẩm nang.</p>
      ) : (
        <AutoChessGuide code={code} tab={activeTab} guide={guide.data} />
      )}
    </div>
  )
}
