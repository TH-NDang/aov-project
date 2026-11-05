import { useEffect, useMemo, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useParams, useSearchParams } from "react-router"
import { EntityRichText } from "@aov/ui/components/entity-rich-text"
import {
  createEntityIndex,
  defaultEntityColor,
  foldEntitySearch,
  referenceTranslation,
} from "@aov/ui/lib/entity-rich-text"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { CatalogHeading } from "../../layout/catalog-heading"
import { wikiReferencesQuery } from "../../lib/wiki-references"
import "./terms.css"

/** The public glossary. Term mentions anywhere in the wiki link to /terms/{id}. */
export function TermsPage() {
  const scope = useWikiContext()
  const { locale, t, href } = scope
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
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
          return translation ? [{ entity, translation }] : []
        })
        .sort((a, b) => a.translation.name.localeCompare(b.translation.name, locale)),
    [settings, locale, fallback],
  )
  const needle = foldEntitySearch(search.trim())
  const visible = terms.filter(({ translation }) =>
    foldEntitySearch([translation.name, ...translation.aliases, translation.description].join(" ")).includes(needle),
  )
  const target = useRef<HTMLElement>(null)
  const known = !termId || terms.some(({ entity }) => entity.id === termId)
  useEffect(() => {
    if (termId && terms.length) target.current?.scrollIntoView({ block: "center" })
  }, [termId, terms.length])

  function updateSearch(value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set("q", value)
    else next.delete("q")
    setParams(next, { replace: true })
  }

  return (
    <div className="wiki-terms">
      <CatalogHeading title={t("terms")} section={t("news")} />
      <p className="wiki-terms-lead">
        {text(
          "Giải thích các từ dùng trong mô tả kỹ năng, trang bị và ghi chú cập nhật.",
          "Explains the words used in ability, item and patch descriptions.",
        )}
      </p>
      <label className="wiki-hero-search wiki-terms-search">
        <WikiIcon name="search" size={18} />
        <span className="sr-only">{text("Tìm thuật ngữ", "Search terms")}</span>
        <input
          type="search"
          value={search}
          maxLength={120}
          onChange={(event) => updateSearch(event.target.value)}
          placeholder={text("Tìm thuật ngữ…", "Search terms…")}
        />
      </label>

      {references.isPending ? (
        <p role="status" className="wiki-terms-state">
          {t("loading")}
        </p>
      ) : references.isError ? (
        <div role="status" className="wiki-terms-state">
          <p>{text("Chưa tải được thuật ngữ.", "Could not load the glossary.")}</p>
          <button type="button" onClick={() => void references.refetch()}>
            {t("retry")}
          </button>
        </div>
      ) : (
        <>
          {!known && (
            <p role="status" className="wiki-terms-state">
              {text(
                "Không tìm thấy thuật ngữ này. Bạn có thể xem danh sách bên dưới.",
                "This term was not found. See the list below.",
              )}
            </p>
          )}
          {visible.length ? (
            <ul className="wiki-terms-list">
              {visible.map(({ entity, translation }) => {
                const current = entity.id === termId
                const color = entity.display?.color ?? defaultEntityColor(entity)
                return (
                  <li key={entity.id} id={`term-${entity.id}`} ref={current ? (target as never) : undefined}>
                    <article className="wiki-term" aria-current={current ? "true" : undefined}>
                      <h2>
                        <Link
                          to={href(`/terms/${encodeURIComponent(entity.id)}`)}
                          style={color ? { color } : undefined}
                        >
                          {translation.name}
                        </Link>
                      </h2>
                      {translation.aliases.length > 0 && (
                        <p className="wiki-term-aliases">
                          {text("Còn gọi là", "Also called")} {translation.aliases.join(", ")}
                        </p>
                      )}
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
          ) : (
            <p role="status" className="wiki-terms-state">
              {terms.length
                ? text("Không có thuật ngữ phù hợp.", "No matching terms.")
                : text("Chưa có thuật ngữ được công bố.", "No terms have been published yet.")}
            </p>
          )}
        </>
      )}
    </div>
  )
}
