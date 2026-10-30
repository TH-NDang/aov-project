import { Link } from "react-router"
import { ArrowUpRight, ChevronRight, Languages, Search, X } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"
import { SearchField } from "@/components/search-field"
import { Button } from "@aov/ui/components/button"
import {
  resolveEntityRoute,
  foldEntitySearch,
  entityKindLabels,
  type EntityReference,
} from "@aov/ui/lib/entity-rich-text"
import { EntityReferenceIcon, type EntityIconResolver } from "@aov/ui/components/entity-rich-text"
import { referenceInputPlainText } from "@aov/ui/lib/reference-input-dom"

const kinds = entityKindLabels
const fold = foldEntitySearch

function AliasChips({ aliases }: { aliases: string[] }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {aliases.slice(0, 3).map((alias) => (
        <span
          key={alias}
          className="max-w-full truncate rounded-md bg-muted/70 px-1.5 py-0.5 text-xs font-normal text-muted-foreground"
          title={alias}
        >
          {alias}
        </span>
      ))}
      {aliases.length > 3 && (
        <span className="text-xs text-muted-foreground" title={aliases.slice(3).join(", ")}>
          +{aliases.length - 3}
        </span>
      )}
    </span>
  )
}

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
}) {
  const [search, setSearch] = useState("")
  const [kind, setKind] = useState("all")
  const [missingTranslation, setMissingTranslation] = useState(false)
  const [page, setPage] = useState(0)
  const termsOnly = variant ? variant === "terms" : entities.every((entity) => entity.kind === "term")
  const availableKinds = [...new Set(entities.map((entity) => entity.kind))]
  const rows = useMemo(
    () =>
      entities.filter(
        (entity) =>
          (kind === "all" || entity.kind === kind) &&
          (!missingTranslation ||
            !entity.translations.some((text) => text.locale.toLowerCase() === locale.toLowerCase())) &&
          fold([entity.id, ...entity.translations.flatMap((text) => [text.name, ...text.aliases])].join(" ")).includes(
            fold(search.trim()),
          ),
      ),
    [entities, kind, missingTranslation, locale, search],
  )
  const currentPage = Math.min(page, Math.max(0, Math.ceil(rows.length / 25) - 1))
  const hasMissingTranslations = entities.some(
    (entity) => !entity.translations.some((text) => text.locale.toLowerCase() === locale.toLowerCase()),
  )

  return (
    <section
      aria-label="Danh mục thuật ngữ và đối tượng liên quan"
      className="@container/catalog min-w-0 overflow-hidden rounded-xl border bg-card"
    >
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <SearchField
            className="flex-1 basis-56 sm:max-w-96"
            label="Tìm danh mục"
            placeholder={termsOnly ? "Tìm thuật ngữ, tên gọi khác…" : "Tìm tên hoặc tên gọi khác…"}
            shortcut
            value={search}
            onChange={(value) => {
              setSearch(value)
              setPage(0)
            }}
          />
          {actions}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {!termsOnly && availableKinds.length > 1 && (
              <div
                role="group"
                aria-label="Lọc loại tham chiếu"
                className="flex max-w-full flex-wrap items-center gap-1"
              >
                {[["all", "Tất cả"], ...availableKinds.map((key) => [key, kinds[key]])].map(([key, label]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={kind === key ? "secondary" : "ghost"}
                    className="h-8 rounded-lg px-2.5 text-xs"
                    aria-pressed={kind === key}
                    onClick={() => {
                      setKind(key!)
                      setPage(0)
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            )}
            {(missingTranslation || hasMissingTranslations) && (
              <Button
                size="sm"
                variant={missingTranslation ? "secondary" : "outline"}
                aria-pressed={missingTranslation}
                onClick={() => {
                  setMissingTranslation((value) => !value)
                  setPage(0)
                }}
              >
                <Languages className="size-3.5" />
                Thiếu bản dịch
              </Button>
            )}
            {(search || kind !== "all" || missingTranslation) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSearch("")
                  setKind("all")
                  setMissingTranslation(false)
                  setPage(0)
                }}
              >
                <X className="size-4" />
                Bỏ lọc
              </Button>
            )}
          </div>
          <p role="status" className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {rows.length} mục{rows.length !== entities.length ? ` / ${entities.length}` : ""}
          </p>
        </div>
      </div>
      <div
        role="region"
        aria-label={termsOnly ? "Bảng thuật ngữ" : "Bảng tham chiếu"}
        tabIndex={0}
        className="relative isolate overflow-x-hidden border-t outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring @3xl/catalog:max-h-[65dvh] @3xl/catalog:overflow-auto"
      >
        <table className="block w-full text-left text-sm @3xl/catalog:table">
          <caption className="sr-only">
            Danh mục, định nghĩa, bản dịch và tên gọi khác. Chọn tên hoặc một dòng để chỉnh sửa.
          </caption>
          <thead className="sr-only bg-muted @3xl/catalog:not-sr-only @3xl/catalog:sticky @3xl/catalog:top-0 @3xl/catalog:z-20">
            <tr>
              {[
                termsOnly ? "Thuật ngữ" : "Tên tham chiếu",
                termsOnly ? "Định nghĩa" : "Tên gọi khác",
                "Bản dịch",
                ...(!termsOnly ? ["Dữ liệu gốc"] : []),
              ].map((heading, index) => (
                <th
                  key={heading}
                  scope="col"
                  className={`px-4 py-2.5 text-xs font-medium text-muted-foreground ${index === 0 ? "w-[30%]" : ""}`}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="block @3xl/catalog:table-row-group">
            {rows.slice(currentPage * 25, currentPage * 25 + 25).map((entity) => {
              const key = `${entity.kind}:${entity.id}`
              const text =
                entity.translations.find((text) => text.locale === locale) ??
                entity.translations.find((text) => text.locale === fallbackLocale) ??
                entity.translations[0]
              const available = availableKeys.has(key)
              const translated = text?.locale.toLowerCase() === locale.toLowerCase()
              const manual =
                entity.autoMatch === false || (!["hero", "term"].includes(entity.kind) && entity.autoMatch !== true)
              const route = available ? resolveEntityRoute(entity, "admin", locale) : undefined
              return (
                <tr
                  key={key}
                  aria-selected={selected === key}
                  className={`group/entry block cursor-pointer border-b p-4 last:border-b-0 hover:bg-muted/25 @3xl/catalog:table-row @3xl/catalog:align-top @3xl/catalog:p-0 ${selected === key ? "bg-accent/50" : ""}`}
                  onClick={(event) => {
                    if (!(event.target as Element).closest("button, a")) onSelect(key)
                  }}
                >
                  <td className="block @3xl/catalog:table-cell @3xl/catalog:px-4 @3xl/catalog:py-4">
                    <button
                      type="button"
                      className="group flex min-h-8 w-full cursor-pointer items-start gap-3 rounded-lg text-left hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                      onClick={() => onSelect(key)}
                      aria-label={`Chỉnh sửa ${text?.name || kinds[entity.kind]}`}
                    >
                      {!termsOnly && (
                        <EntityReferenceIcon
                          entity={entity}
                          resolveIcon={resolveIcon}
                          className="mt-0.5 size-9 overflow-hidden rounded-lg ring-1 ring-foreground/5"
                        />
                      )}
                      <span className="min-w-0 flex-1 space-y-2">
                        <span className="block break-words font-semibold leading-5">{text?.name || entity.id}</span>
                        {!termsOnly && (
                          <span className="block text-xs text-muted-foreground">{kinds[entity.kind]}</span>
                        )}
                        {termsOnly && !!text?.aliases.length && <AliasChips aliases={text.aliases} />}
                        {termsOnly && manual && (
                          <span className="inline-flex rounded bg-muted px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground">
                            Chọn bằng @
                          </span>
                        )}
                      </span>
                      <span className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors group-hover:bg-muted group-hover:text-primary">
                        <ChevronRight className="size-4" />
                      </span>
                    </button>
                    {!available && <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">Thiếu dữ liệu gốc</p>}
                    {entity.kind !== "term" && customKeys.has(key) && (
                      <p className="mt-2 text-xs text-muted-foreground">Có tùy chỉnh</p>
                    )}
                  </td>
                  <td className="mt-2 block @3xl/catalog:mt-0 @3xl/catalog:table-cell @3xl/catalog:px-4 @3xl/catalog:py-4">
                    {termsOnly ? (
                      <p
                        className={`line-clamp-2 break-words text-sm leading-6 ${text?.description ? "text-foreground/80" : "text-muted-foreground"}`}
                      >
                        {text?.description ? referenceInputPlainText(text.description) : "Chưa có định nghĩa."}
                      </p>
                    ) : text?.aliases.length ? (
                      <AliasChips aliases={text.aliases} />
                    ) : (
                      <span className="hidden text-xs text-muted-foreground @3xl/catalog:inline">—</span>
                    )}
                    {!termsOnly && renderAliasAction?.(entity)}
                  </td>
                  <td className="mt-3 block @3xl/catalog:mt-0 @3xl/catalog:table-cell @3xl/catalog:px-4 @3xl/catalog:py-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 text-[11px] text-muted-foreground @3xl/catalog:hidden">Bản dịch</span>
                      {entity.translations.map((copy) => (
                        <span
                          key={copy.locale}
                          className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${copy.locale.toLowerCase() === locale.toLowerCase() ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                        >
                          {copy.locale}
                        </span>
                      ))}
                    </div>
                    {!translated && (
                      <span className="mt-1.5 block text-xs text-amber-600 dark:text-amber-400">
                        {text ? `Đang dùng ${text.locale}` : "Chưa có bản dịch"}
                      </span>
                    )}
                  </td>
                  {!termsOnly && (
                    <td className="mt-3 block @3xl/catalog:mt-0 @3xl/catalog:table-cell @3xl/catalog:px-4 @3xl/catalog:py-4">
                      {route ? (
                        <Link
                          to={route}
                          className="inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-lg py-1.5 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          Mở danh mục gốc
                          <ArrowUpRight className="size-3.5" />
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">Chưa có dữ liệu nguồn</span>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
        {!rows.length && (
          <div className="flex min-h-48 flex-col items-center justify-center gap-2 p-6 text-center">
            <Search className="mb-1 size-6 text-muted-foreground/60" />
            <p className="text-sm font-medium">
              {entities.length ? "Không có mục phù hợp" : termsOnly ? "Chưa có thuật ngữ" : "Chưa có tham chiếu"}
            </p>
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
      {rows.length > 25 && (
        <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
          <span className="text-xs text-muted-foreground">
            Trang {currentPage + 1} / {Math.ceil(rows.length / 25)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            Trước
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={(currentPage + 1) * 25 >= rows.length}
            onClick={() => setPage(currentPage + 1)}
          >
            Sau
          </Button>
        </div>
      )}
    </section>
  )
}
