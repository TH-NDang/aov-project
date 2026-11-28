import { Link } from "react-router"
import { ArrowUpRight, ChevronRight, Languages, Search, X } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { SearchField } from "@/components/search-field"
import { Button } from "@aov/ui/components/button"
import {
  resolveEntityRoute,
  managedCommunityReference,
  foldEntitySearch,
  entityKindLabels,
  defaultEntityColor,
  type EntityReference,
} from "@aov/ui/lib/entity-rich-text"
import { EntityReferenceArtwork, type EntityIconResolver } from "@aov/ui/components/entity-rich-text"
import { referenceInputPlainText } from "@aov/ui/lib/reference-input-dom"
import { Skeleton } from "@aov/ui/components/skeleton"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { useRevealedRows } from "@aov/ui/hooks/use-revealed-rows"
import { useDebounced } from "@/features/community/directory/directory-api"
import { formatNumber } from "@/lib/text"
import { AliasChips } from "./alias-chips"
import {
  catalogLanguageCode,
  catalogLanguageGaps,
  catalogLanguageName,
  catalogLanguages,
  catalogLanguageWord,
  hasCatalogLanguage,
} from "./catalog-languages"
import { CatalogKindFilter, type CatalogKind } from "./catalog-kind-filter"
import { isRecordKind, recordKinds } from "./record-catalog-api"
import { RecordCatalogRows } from "./record-catalog-rows"
import { useRecordCounts } from "./use-record-catalog"

const kinds = entityKindLabels
const noLanguages: string[] = []
const fold = foldEntitySearch

export function ReferenceCatalogTable({
  entities,
  locale,
  fallbackLocale,
  selected,
  onSelect,
  customKeys,
  availableKeys,
  resolveIcon,
  actions,
  variant,
  renderAliasAction,
  loading = false,
  searchSlot,
  languages = noLanguages,
  onLocaleChange,
}: {
  entities: EntityReference[]
  locale: string
  fallbackLocale: string
  selected: string
  onSelect: (key: string) => void
  customKeys: Set<string>
  availableKeys: Set<string>
  resolveIcon?: EntityIconResolver
  actions?: ReactNode
  variant?: "terms" | "references"
  renderAliasAction?: (entity: EntityReference) => ReactNode
  loading?: boolean
  /** The page header's search slot; without it the search stays in the toolbar. */
  searchSlot?: HTMLElement | null
  /** Languages in the order the catalog lists them; a language no entry is named in stays out. */
  languages?: string[]
  /** Reads the catalog in another language, so a missing name can be written there. */
  onLocaleChange?: (locale: string) => void
}) {
  const [search, setSearch] = useState("")
  const [kind, setKind] = useState<CatalogKind>("all")
  const [missingTranslation, setMissingTranslation] = useState(false)
  const termsOnly = variant ? variant === "terms" : entities.every((entity) => entity.kind === "term")
  const searchField = (
    <SearchField
      placement={searchSlot ? "header" : "inline"}
      label="Tìm danh mục"
      placeholder={termsOnly ? "Tìm thuật ngữ…" : "Tìm tham chiếu…"}
      shortcut
      value={search}
      onChange={(value) => {
        setSearch(value)
      }}
    />
  )
  const wanted = fold(search.trim())
  const settledSearch = useDebounced(search.trim())
  // Entries of the catalog itself are in memory; records kept by other screens are read from them page by page.
  const own = useMemo(
    () => (termsOnly ? entities : entities.filter(({ kind }) => !isRecordKind(kind))),
    [entities, termsOnly],
  )
  const found = useMemo(
    () =>
      own.filter((entity) =>
        fold([entity.id, ...entity.translations.flatMap((text) => [text.name, ...text.aliases])].join(" ")).includes(
          wanted,
        ),
      ),
    [own, wanted],
  )
  const ownKinds = useMemo(() => new Set(own.map((entity) => entity.kind)), [own])
  const recordCounts = useRecordCounts(settledSearch, !termsOnly)
  const counts = new Map<CatalogKind, number | undefined>(recordCounts)
  for (const key of ownKinds) counts.set(key, 0)
  for (const entity of found) counts.set(entity.kind, counts.get(entity.kind)! + 1)
  const numbers = [...counts.values()]
  counts.set("all", numbers.includes(undefined) ? undefined : numbers.reduce((sum: number, count) => sum + count!, 0))
  const availableKinds = (Object.keys(kinds) as EntityReference["kind"][]).filter(
    (key) => ownKinds.has(key) || (!termsOnly && isRecordKind(key)),
  )
  const matching = kind === "all" ? found : found.filter((entity) => entity.kind === kind)
  const missing = matching.filter((entity) => !hasCatalogLanguage(entity, locale))
  const rows = missingTranslation ? missing : matching
  const kept = useMemo(() => catalogLanguages(own, languages, locale), [own, languages, locale])
  const isLocale = (code: string) => code.toLowerCase() === locale.toLowerCase()
  // One toggle per language with gaps; the one being filtered stays even once its gaps are filled.
  const gaps = catalogLanguageGaps(matching, kept).filter(
    ({ code, count }) => count > 0 || (missingTranslation && isLocale(code)),
  )
  function showMissing(code: string) {
    if (missingTranslation && isLocale(code)) {
      setMissingTranslation(false)
      return
    }
    if (!isLocale(code)) onLocaleChange?.(code)
    setMissingTranslation(true)
  }
  const revealed = useRevealedRows(rows, JSON.stringify([search, kind, missingTranslation]))
  const filtered = !!search || kind !== "all" || missingTranslation
  // Their names have one language, so the filter for missing translations is about the catalog's own entries.
  const requested =
    termsOnly || missingTranslation ? [] : kind === "all" ? recordKinds : isRecordKind(kind) ? [kind] : []
  const total = termsOnly || missingTranslation ? rows.length : counts.get(kind)
  function resetFilters() {
    setSearch("")
    setKind("all")
    setMissingTranslation(false)
  }

  return (
    <section
      aria-label="Danh mục thuật ngữ và đối tượng liên quan"
      className="@container/catalog min-w-0 space-y-3"
      aria-busy={loading}
    >
      <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
        <div className="flex min-w-0 items-center gap-2">
          {searchSlot ? createPortal(searchField, searchSlot) : <div className="min-w-0 flex-1">{searchField}</div>}
          {actions}
        </div>
        {!termsOnly && <CatalogKindFilter kinds={availableKinds} counts={counts} value={kind} onChange={setKind} />}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
        <p role="status" className="text-sm text-muted-foreground tabular-nums">
          {loading ? (
            "Đang tải danh mục…"
          ) : (
            <>
              <strong className="font-semibold text-foreground">
                {total === undefined ? "…" : formatNumber(total)}
              </strong>{" "}
              {termsOnly ? "thuật ngữ" : "tham chiếu"}
              {termsOnly && rows.length !== entities.length ? ` / ${entities.length}` : ""}
            </>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {gaps.length > 0 && (
            <div role="group" aria-label="Lọc mục thiếu tên theo ngôn ngữ" className="flex items-center gap-1">
              <span className="flex items-center gap-1 pr-0.5 text-xs text-muted-foreground">
                <Languages aria-hidden className="size-3.5" />
                Thiếu tên
              </span>
              {gaps
                .filter(({ code }) => onLocaleChange || isLocale(code))
                .map(({ code, count }) => {
                  const active = missingTranslation && isLocale(code)
                  return (
                    <Button
                      key={code}
                      size="sm"
                      variant="ghost"
                      className={`h-8 gap-1 rounded-lg border px-2 text-xs ${active ? "border-(--aov-warning)/50 bg-(--aov-warning-soft) text-(--aov-warning)" : "border-border bg-background text-foreground/80"}`}
                      aria-label={`Thiếu ${catalogLanguageWord(code)}`}
                      aria-pressed={active}
                      title={`${formatNumber(count)} mục chưa có tên ${catalogLanguageWord(code)}`}
                      onClick={() => showMissing(code)}
                    >
                      <span className="font-semibold">{catalogLanguageCode(code)}</span>
                      <span aria-hidden className="tabular-nums">
                        {formatNumber(count)}
                      </span>
                    </Button>
                  )
                })}
            </div>
          )}
          {filtered && (
            <Button size="sm" variant="ghost" className="h-8 gap-1 px-2 text-xs" onClick={resetFilters}>
              <X className="size-4" />
              Bỏ lọc
            </Button>
          )}
        </div>
      </div>
      <div
        role="region"
        aria-label={termsOnly ? "Bảng thuật ngữ" : "Bảng tham chiếu"}
        tabIndex={0}
        className="overflow-hidden admin-panel outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <table className="block w-full text-left text-sm @xl/catalog:table @xl/catalog:table-fixed">
          <colgroup className="hidden @xl/catalog:table-column-group">
            <col className={termsOnly ? "w-[35%]" : "w-[38%]"} />
            <col />
            <col className="w-40" />
            {!termsOnly && <col className="w-12" />}
          </colgroup>
          <caption className="sr-only">
            Danh mục, định nghĩa, bản dịch và tên gọi khác. Chọn tên hoặc một dòng để chỉnh sửa.
          </caption>
          <thead className="sr-only border-b bg-muted/30 @xl/catalog:not-sr-only">
            <tr>
              {[
                termsOnly ? "Thuật ngữ" : "Tên tham chiếu",
                termsOnly ? "Định nghĩa" : "Tên gọi khác",
                "Bản dịch",
                ...(!termsOnly ? ["Dữ liệu gốc"] : []),
              ].map((heading) => (
                <th key={heading} scope="col" className="px-3 py-2.5 text-xs font-medium text-muted-foreground">
                  <span className={heading === "Dữ liệu gốc" ? "sr-only" : undefined}>{heading}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="block @xl/catalog:table-row-group">
            {!loading &&
              revealed.rows.map((entity) => {
                const key = `${entity.kind}:${entity.id}`
                const text =
                  entity.translations.find((text) => text.locale === locale) ??
                  entity.translations.find((text) => text.locale === fallbackLocale) ??
                  entity.translations[0]
                const available = availableKeys.has(key)
                const translated = text?.locale.toLowerCase() === locale.toLowerCase()
                const writable = !!onLocaleChange && !managedCommunityReference(entity.kind)
                const manual =
                  entity.autoMatch === false || (!["hero", "term"].includes(entity.kind) && entity.autoMatch !== true)
                const route = available ? resolveEntityRoute(entity, "admin", locale) : undefined
                const color = /^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(entity.display?.color ?? "")
                  ? entity.display!.color
                  : defaultEntityColor(entity)
                return (
                  <tr
                    key={key}
                    aria-selected={selected === key}
                    className={`group/entry block cursor-pointer border-b border-border/60 p-3 transition-colors last:border-b-0 hover:bg-muted/35 focus-within:bg-muted/35 @xl/catalog:table-row @xl/catalog:align-middle @xl/catalog:p-0 ${selected === key ? "bg-primary/5" : ""}`}
                    onClick={(event) => {
                      if (!(event.target as Element).closest("button, a")) onSelect(key)
                    }}
                  >
                    <td className="block @xl/catalog:table-cell @xl/catalog:px-3 @xl/catalog:py-3">
                      <button
                        type="button"
                        className="group flex min-h-8 w-full cursor-pointer items-center gap-2.5 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                        onClick={() => onSelect(key)}
                        aria-label={`Chỉnh sửa ${text?.name || kinds[entity.kind]}`}
                      >
                        {termsOnly ? (
                          <span
                            role="img"
                            aria-label={color ? `Màu tham chiếu ${text?.name || entity.id}` : "Màu mặc định"}
                            title={entity.display?.color || "Màu mặc định của thuật ngữ"}
                            className="size-2.5 shrink-0 rounded-full bg-muted-foreground/40 ring-1 ring-inset ring-black/10"
                            style={color ? { backgroundColor: color } : undefined}
                          />
                        ) : (
                          <EntityReferenceArtwork
                            entity={entity}
                            resolveIcon={resolveIcon}
                            className="size-9 shrink-0 overflow-hidden rounded-lg ring-1 ring-foreground/10"
                          />
                        )}
                        <span className="min-w-0 flex-1 space-y-1">
                          <span className="block break-words font-semibold leading-5 group-hover:underline group-hover:underline-offset-4">
                            {text?.name || entity.id}
                          </span>
                          {!termsOnly && (
                            <span className="block text-xs text-muted-foreground">{kinds[entity.kind]}</span>
                          )}
                          {termsOnly && !!text?.aliases.length && <AliasChips aliases={text.aliases} />}
                          {termsOnly && manual && (
                            <span className="inline-flex rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                              Chọn bằng @
                            </span>
                          )}
                        </span>
                        <span className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground/70 transition-colors group-hover:bg-muted group-hover:text-foreground">
                          <ChevronRight aria-hidden className="size-3.5" />
                        </span>
                      </button>
                      {!available && <p className="mt-2 text-xs text-(--aov-warning)">Thiếu dữ liệu gốc</p>}
                      {entity.kind !== "term" && customKeys.has(key) && (
                        <p className="mt-2 text-xs text-muted-foreground">Có tùy chỉnh</p>
                      )}
                    </td>
                    <td className="mt-2 block @xl/catalog:mt-0 @xl/catalog:table-cell @xl/catalog:px-3 @xl/catalog:py-3">
                      {termsOnly ? (
                        <p
                          className={`line-clamp-2 break-words text-sm leading-5 ${text?.description ? "text-foreground/80" : "text-muted-foreground"}`}
                        >
                          {text?.description ? referenceInputPlainText(text.description) : "Chưa có định nghĩa."}
                        </p>
                      ) : text?.aliases.length ? (
                        <AliasChips aliases={text.aliases} />
                      ) : (
                        <span className="hidden text-xs text-muted-foreground @xl/catalog:inline">—</span>
                      )}
                      {!termsOnly && renderAliasAction?.(entity)}
                    </td>
                    <td className="mt-2 inline-block @xl/catalog:mt-0 @xl/catalog:table-cell @xl/catalog:px-3 @xl/catalog:py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="mr-1 text-xs text-muted-foreground @xl/catalog:hidden">Bản dịch</span>
                        {kept.map((code) => {
                          const language = catalogLanguageWord(code)
                          const mark = catalogLanguageCode(code)
                          if (hasCatalogLanguage(entity, code))
                            return (
                              <span
                                key={code}
                                title={catalogLanguageName(code)}
                                className={`min-w-7 rounded-md border px-1 py-0.5 text-center text-xs font-medium ${isLocale(code) ? "border-border bg-muted/60 text-foreground" : "border-transparent text-muted-foreground"}`}
                              >
                                {mark}
                              </span>
                            )
                          const label = `Chưa có tên ${language}`
                          return writable ? (
                            <button
                              key={code}
                              type="button"
                              title={`${label}. Chọn để thêm.`}
                              aria-label={`Thêm tên ${language} cho ${text?.name || entity.id}`}
                              className="min-w-7 cursor-pointer rounded-md border border-dashed border-(--aov-warning)/60 px-1 py-0.5 text-center text-xs font-medium text-(--aov-warning) hover:bg-(--aov-warning-soft) focus-visible:outline-2 focus-visible:outline-ring"
                              onClick={() => {
                                onLocaleChange?.(code)
                                onSelect(key)
                              }}
                            >
                              {mark}
                            </button>
                          ) : (
                            <span
                              key={code}
                              title={label}
                              className="min-w-7 rounded-md border border-dashed border-(--aov-warning)/60 px-1 py-0.5 text-center text-xs font-medium text-(--aov-warning)"
                            >
                              <span aria-hidden>{mark}</span>
                              <span className="sr-only">{label}</span>
                            </span>
                          )
                        })}
                      </div>
                      {!translated && (
                        <span className="mt-1.5 block text-xs text-(--aov-warning)">
                          {text ? `Đang dùng ${text.locale}` : "Chưa có bản dịch"}
                        </span>
                      )}
                    </td>
                    {!termsOnly && (
                      <td className="mt-2 inline-block pl-3 align-bottom @xl/catalog:mt-0 @xl/catalog:table-cell @xl/catalog:px-2 @xl/catalog:py-3">
                        {route ? (
                          <Link
                            to={route}
                            aria-label={`Mở danh mục gốc của ${text?.name || entity.id}`}
                            title="Mở danh mục gốc"
                            className="inline-flex size-8 items-center justify-center rounded-lg border border-transparent text-muted-foreground hover:border-border hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                          >
                            <ArrowUpRight aria-hidden className="size-4" />
                          </Link>
                        ) : (
                          <span
                            className="px-2 text-xs text-muted-foreground"
                            title={
                              entity.kind === "country"
                                ? "Danh mục quốc gia dùng chung"
                                : "Chưa có đường dẫn dữ liệu gốc"
                            }
                          >
                            —
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            {!loading && !revealed.loader.hasNextPage && <RecordCatalogRows kinds={requested} search={settledSearch} />}
          </tbody>
        </table>
        {loading && (
          <div role="status" aria-label="Đang tải danh mục" className="space-y-5 p-4">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="flex items-center gap-4">
                <Skeleton className="size-9 rounded-lg" />
                <Skeleton className="h-3 w-1/4" />
                <Skeleton className="ml-auto h-3 w-1/3" />
              </div>
            ))}
          </div>
        )}
        {!loading && total === 0 && (
          <div className="flex min-h-48 flex-col items-center justify-center gap-2 p-6 text-center">
            <Search className="mb-1 size-6 text-muted-foreground/60" />
            <p className="text-sm font-medium">
              {entities.length ? "Không có mục phù hợp" : termsOnly ? "Chưa có thuật ngữ" : "Chưa có tham chiếu"}
            </p>
            {filtered && (
              <Button size="sm" variant="outline" className="mt-2" onClick={resetFilters}>
                Xóa bộ lọc
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              {entities.length
                ? "Thử tìm tên khác hoặc bỏ bớt bộ lọc."
                : termsOnly
                  ? "Tạo thuật ngữ đầu tiên để dùng trong mô tả."
                  : "Danh mục sẽ xuất hiện khi có dữ liệu game."}
            </p>
          </div>
        )}
      </div>
      <InfiniteScroll query={revealed.loader} label="Đang tải thêm danh mục" />
    </section>
  )
}
