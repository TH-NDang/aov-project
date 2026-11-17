import { localeText } from "@aov/ui/lib/locale-text"
import { useEffect, useMemo, useRef, type CSSProperties } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useParams, useSearchParams } from "react-router"
import { EntityRichText } from "@aov/ui/components/entity-rich-text"
import { termIcon } from "@aov/ui/components/gameplay-icons"
import { navArtIcons } from "@aov/ui/components/nav-art-icons"
import { createEntityIndex, defaultEntityColor, referenceTranslation } from "@aov/ui/lib/entity-rich-text"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiContext, useWikiText } from "../../context/wiki-context"
import { CatalogHeading } from "../../layout/catalog-heading"
import { wikiReferencesQuery } from "../../lib/wiki-references"
import { notFoundMeta, termMeta } from "../../lib/seo/page-meta"
import { usePageHead } from "../../lib/seo/use-page-head"
import { foldSearchText } from "@aov/ui/lib/search-text"
import "./terms.css"

/** An explanation this long, or one that holds a table, needs a row of its own instead of a third of one. */
const LONG_EXPLANATION = 320
const readsWide = (description: string) =>
  description.includes("<exampletable>") || description.length > LONG_EXPLANATION

/**
 * How the last short terms share their rows, so no term is left alone in one. `fromEnd` is 1 for the last short term.
 * In two columns a single last term takes the whole row. In three columns a last row of two is split in halves, and a
 * last row of one is avoided by setting the last four terms two to a row.
 */
function lastRowShare(short: number, fromEnd: number) {
  const left = short % 3
  return {
    two: short % 2 === 1 && fromEnd === 1 ? "full" : undefined,
    three: short === 1 ? "full" : (left === 1 && fromEnd <= 4) || (left === 2 && fromEnd <= 2) ? "half" : undefined,
  }
}

/** The public glossary. Term mentions anywhere in the wiki link to /terms/{id}. */
export function TermsPage() {
  const scope = useWikiContext()
  const { locale, href } = scope
  const t = localeText(locale)
  const text = useWikiText()
  const { termId } = useParams()
  const [params, setParams] = useSearchParams()
  const search = params.get("q") ?? ""
  const references = useQuery(wikiReferencesQuery(scope))
  const settings = references.data
  const fallback = settings?.fallbackLocale ?? "vi-VN"
  const index = useMemo(
    () => createEntityIndex(settings?.entities ?? [], locale, fallback),
    [settings, locale, fallback],
  )
  const terms = useMemo(
    () =>
      (settings?.entities ?? [])
        .filter((entity) => entity.kind === "term")
        .flatMap((entity) => {
          const translation = referenceTranslation(entity, locale, fallback)
          return translation ? [{ entity, translation, wide: readsWide(translation.description) }] : []
        })
        // By name; the few long explanations follow the short ones, where a full row does not break the grid.
        .sort(
          (a, b) => Number(a.wide) - Number(b.wide) || a.translation.name.localeCompare(b.translation.name, locale),
        ),
    [settings, locale, fallback],
  )
  const needle = foldSearchText(search.trim())
  const visible = terms.filter(({ translation }) =>
    foldSearchText([translation.name, ...translation.aliases, translation.description].join(" ")).includes(needle),
  )
  // Short terms come first; the styles need their number to fill the last row of the grid instead of leaving one alone.
  const short = visible.filter(({ wide }) => !wide).length
  const target = useRef<HTMLLIElement>(null)
  const known = !termId || terms.some(({ entity }) => entity.id === termId)
  const opened = terms.find(({ entity }) => entity.id === termId)
  usePageHead(
    opened
      ? termMeta({ id: opened.entity.id, ...opened.translation }, locale)
      : termId && references.isSuccess
        ? notFoundMeta(locale, `/terms/${encodeURIComponent(termId)}`, "terms")
        : null,
  )
  useEffect(() => {
    if (!termId || !terms.length) return
    // The app returns to the top of the page on every new address after this runs; the term is shown once it has.
    const frame = requestAnimationFrame(() => target.current?.scrollIntoView({ block: "center" }))
    return () => cancelAnimationFrame(frame)
  }, [termId, terms.length])

  function updateSearch(value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set("q", value)
    else next.delete("q")
    setParams(next, { replace: true })
  }

  return (
    <>
      <CatalogHeading
        title={t("Thuật ngữ", "Glossary")}
        lead={text(
          "Giải thích các từ dùng trong mô tả kỹ năng, trang bị và ghi chú cập nhật.",
          "Explains the words used in ability, item and patch descriptions.",
        )}
      />
      <div className="wiki-terms-tools">
        <label className="wiki-terms-search">
          <WikiIcon name="search" size={18} />
          <input
            type="search"
            aria-label={text("Tìm thuật ngữ", "Search terms")}
            value={search}
            maxLength={120}
            onChange={(event) => updateSearch(event.target.value)}
            placeholder={text("Tìm thuật ngữ…", "Search terms…")}
          />
          {search && (
            <button
              type="button"
              className="wiki-terms-clear"
              aria-label={text("Xóa tìm kiếm", "Clear search")}
              onClick={() => updateSearch("")}
            >
              <WikiIcon name="close" size={16} />
            </button>
          )}
        </label>
        {references.isSuccess && (
          <p className="wiki-terms-count" role="status">
            {text(`${visible.length} thuật ngữ`, visible.length === 1 ? "1 term" : `${visible.length} terms`)}
          </p>
        )}
      </div>

      {references.isPending ? (
        <>
          <p className="sr-only" role="status">
            {t("Đang tải…", "Loading…")}
          </p>
          <ul className="wiki-terms-list" aria-hidden="true">
            {Array.from({ length: 12 }, (_, position) => (
              <li className="wiki-term-skeleton" key={position} />
            ))}
          </ul>
        </>
      ) : references.isError ? (
        <div role="status" className="wiki-terms-state">
          <p>{text("Chưa tải được thuật ngữ.", "Could not load the glossary.")}</p>
          <button type="button" onClick={() => void references.refetch()}>
            {t("Thử lại", "Retry")}
          </button>
        </div>
      ) : (
        <>
          {!known && (
            <p role="status" className="wiki-terms-notice">
              {text(
                "Không tìm thấy thuật ngữ này. Bạn có thể xem danh sách bên dưới.",
                "This term was not found. See the list below.",
              )}
            </p>
          )}
          {visible.length ? (
            <ul className="wiki-terms-list">
              {visible.map(({ entity, translation, wide }, position) => {
                const current = entity.id === termId
                const color = entity.display?.color ?? defaultEntityColor(entity)
                const Art = termIcon(entity) ?? navArtIcons.glossary
                const share = wide ? undefined : lastRowShare(short, short - position)
                return (
                  <li
                    key={entity.id}
                    id={`term-${entity.id}`}
                    ref={current ? target : undefined}
                    data-wide={wide ? "" : undefined}
                    data-two={share?.two}
                    data-three={share?.three}
                  >
                    <article
                      className="wiki-term"
                      aria-current={current ? "true" : undefined}
                      style={color ? ({ "--term-color": color } as CSSProperties) : undefined}
                    >
                      <Art size={40} className="wiki-term-art" />
                      <div className="wiki-term-head">
                        <h2>
                          <Link to={href(`/terms/${encodeURIComponent(entity.id)}`)}>{translation.name}</Link>
                        </h2>
                        {translation.aliases.length > 0 && (
                          <p className="wiki-term-aliases">
                            {text("Còn gọi là", "Also called")} {translation.aliases.join(", ")}
                          </p>
                        )}
                      </div>
                      <div className="wiki-term-body">
                        {translation.description ? (
                          <EntityRichText
                            text={translation.description}
                            index={index}
                            locale={locale}
                            fallbackLocale={fallback}
                            autoRecognize={false}
                            context="wiki"
                          />
                        ) : (
                          text("Chưa có giải thích cho thuật ngữ này.", "This term has no explanation yet.")
                        )}
                      </div>
                    </article>
                  </li>
                )
              })}
            </ul>
          ) : terms.length ? (
            <div role="status" className="wiki-terms-state wiki-mascot-state">
              <p>{text("Không có thuật ngữ phù hợp.", "No matching terms.")}</p>
              <button type="button" onClick={() => updateSearch("")}>
                {text("Xóa tìm kiếm", "Clear search")}
              </button>
            </div>
          ) : (
            <p role="status" className="wiki-terms-state wiki-mascot-state">
              {text("Chưa có thuật ngữ được công bố.", "No terms have been published yet.")}
            </p>
          )}
        </>
      )}
    </>
  )
}
