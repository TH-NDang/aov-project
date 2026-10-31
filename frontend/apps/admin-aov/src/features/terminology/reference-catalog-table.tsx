import { Link } from "react-router"
import {
  ArrowUpRight,
  BookOpenText,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Gem,
  Globe2,
  Hexagon,
  Languages,
  Layers3,
  Search,
  Shield,
  Sparkles,
  Swords,
  UserRound,
  Users,
  X,
  Zap,
} from "lucide-react"
import { useId, useMemo, useState, type ReactNode } from "react"
import { SearchField } from "@/components/search-field"
import { Button } from "@aov/ui/components/button"
import {
  resolveEntityRoute,
  foldEntitySearch,
  entityKindLabels,
  defaultEntityColor,
  type EntityReference,
} from "@aov/ui/lib/entity-rich-text"
import { EntityReferenceIcon, type EntityIconResolver } from "@aov/ui/components/entity-rich-text"
import { referenceInputPlainText } from "@aov/ui/lib/reference-input-dom"
import { Skeleton } from "@aov/ui/components/skeleton"

const kinds = entityKindLabels
const fold = foldEntitySearch
const kindIcons = {
  hero: Swords,
  skill: Sparkles,
  item: Shield,
  enchantment: Hexagon,
  arcana: Gem,
  spell: Zap,
  team: Users,
  player: UserRound,
  country: Globe2,
  term: BookOpenText,
}

function AliasChips({ aliases }: { aliases: string[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {aliases.slice(0, 3).map((alias) => (
        <span
          key={alias}
          className="max-w-full truncate rounded-md bg-muted/60 px-1.5 py-0.5 text-xs font-normal text-foreground/75"
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
  loading = false,
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
}) {
  const [search, setSearch] = useState("")
  const [kind, setKind] = useState("all")
  const [missingTranslation, setMissingTranslation] = useState(false)
  const [page, setPage] = useState(0)
  const [expandedKinds, setExpandedKinds] = useState(false)
  const kindsId = useId()
  const termsOnly = variant ? variant === "terms" : entities.every((entity) => entity.kind === "term")
  const kindCounts = useMemo(() => {
    const counts = new Map<EntityReference["kind"], number>()
    for (const entity of entities) counts.set(entity.kind, (counts.get(entity.kind) ?? 0) + 1)
    return counts
  }, [entities])
  const availableKinds = Object.keys(kinds).filter((key) =>
    kindCounts.has(key as EntityReference["kind"]),
  ) as EntityReference["kind"][]
  const kindOptions = ["all", ...availableKinds] as const
  const compactKinds = new Set<string>(kindOptions.slice(0, 4))
  if (!compactKinds.has(kind) && availableKinds.some((key) => key === kind)) {
    compactKinds.delete(kindOptions[3]!)
    compactKinds.add(kind)
  }
  const matching = useMemo(
    () =>
      entities.filter(
        (entity) =>
          (kind === "all" || entity.kind === kind) &&
          fold([entity.id, ...entity.translations.flatMap((text) => [text.name, ...text.aliases])].join(" ")).includes(
            fold(search.trim()),
          ),
      ),
    [entities, kind, search],
  )
  const missing = matching.filter(
    (entity) => !entity.translations.some((text) => text.locale.toLowerCase() === locale.toLowerCase()),
  )
  const rows = missingTranslation ? missing : matching
  const currentPage = Math.min(page, Math.max(0, Math.ceil(rows.length / 25) - 1))
  const filtered = !!search || kind !== "all" || missingTranslation
  function resetFilters() {
    setSearch("")
    setKind("all")
    setMissingTranslation(false)
    setPage(0)
  }

  return (
    <section
      aria-label="Danh mục thuật ngữ và đối tượng liên quan"
      className="@container/catalog min-w-0 space-y-3"
      aria-busy={loading}
    >
      <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
        <div className="flex min-w-0 items-center gap-2">
          <SearchField
            className="min-w-0 flex-1"
            label="Tìm danh mục"
            placeholder={termsOnly ? "Tìm thuật ngữ…" : "Tìm tham chiếu…"}
            shortcut
            value={search}
            onChange={(value) => {
              setSearch(value)
              setPage(0)
            }}
          />
          {actions}
        </div>
        {!termsOnly && availableKinds.length > 1 && (
          <div className="space-y-2 border-t pt-3">
            <div
              id={kindsId}
              role="group"
              aria-label="Lọc loại tham chiếu"
              className="grid max-w-full grid-cols-2 items-center gap-1.5 @xl/catalog:flex @xl/catalog:flex-wrap"
            >
              {kindOptions.map((key) => {
                const Icon = key === "all" ? Layers3 : kindIcons[key]
                const label = key === "all" ? "Tất cả" : kinds[key]
                return (
                  <Button
                    key={key}
                    size="sm"
                    variant="ghost"
                    className={`h-8 min-w-0 justify-start gap-1.5 rounded-lg border px-2 text-xs @xl/catalog:px-2.5 ${!expandedKinds && !compactKinds.has(key) ? "hidden @xl/catalog:inline-flex" : ""} ${kind === key ? "border-foreground/15 bg-background font-semibold text-foreground shadow-xs" : "border-transparent text-foreground/75 hover:bg-background/70"}`}
                    aria-label={label}
                    title={label}
                    aria-pressed={kind === key}
                    onClick={() => {
                      setKind(key)
                      setPage(0)
                    }}
                  >
                    <Icon aria-hidden className="size-3.5" />
                    <span className="min-w-0 truncate">{label}</span>
                    <span
                      aria-hidden
                      className="ml-auto text-[11px] text-muted-foreground tabular-nums @xl/catalog:ml-0.5"
                    >
                      {key === "all" ? entities.length : kindCounts.get(key)}
                    </span>
                  </Button>
                )
              })}
            </div>
            {kindOptions.length > 4 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 w-full gap-1.5 text-xs text-muted-foreground @xl/catalog:hidden"
                aria-expanded={expandedKinds}
                aria-controls={kindsId}
                onClick={() => setExpandedKinds((value) => !value)}
              >
                {expandedKinds ? (
                  <ChevronUp aria-hidden className="size-3.5" />
                ) : (
                  <ChevronDown aria-hidden className="size-3.5" />
                )}
                {expandedKinds ? "Thu gọn" : `Xem thêm ${kindOptions.length - 4} nhóm`}
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
        <p role="status" className="text-sm text-muted-foreground tabular-nums">
          {loading ? (
            "Đang tải danh mục…"
          ) : (
            <>
              <strong className="font-semibold text-foreground">{rows.length}</strong>{" "}
              {termsOnly ? "thuật ngữ" : "tham chiếu"}
              {rows.length !== entities.length ? ` / ${entities.length}` : ""}
            </>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {(missingTranslation || missing.length > 0) && (
            <Button
              size="sm"
              variant="ghost"
              className={`h-8 gap-1.5 rounded-lg border px-2.5 text-xs ${missingTranslation ? "border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200" : "border-border bg-background text-foreground/80"}`}
              aria-label="Thiếu bản dịch"
              aria-pressed={missingTranslation}
              onClick={() => {
                setMissingTranslation((value) => !value)
                setPage(0)
              }}
            >
              <Languages className="size-3.5" />
              Thiếu bản dịch
              <span aria-hidden className="tabular-nums">
                {missing.length}
              </span>
            </Button>
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
        className="overflow-hidden rounded-xl border bg-card outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <table className="block w-full text-left text-sm @xl/catalog:table @xl/catalog:table-fixed">
          <colgroup className="hidden @xl/catalog:table-column-group">
            <col className={termsOnly ? "w-[35%]" : "w-[38%]"} />
            <col />
            <col className="w-24" />
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
              rows.slice(currentPage * 25, currentPage * 25 + 25).map((entity) => {
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
                          <EntityReferenceIcon
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
                            <span className="inline-flex rounded bg-muted px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground">
                              Chọn bằng @
                            </span>
                          )}
                        </span>
                        <span className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground/70 transition-colors group-hover:bg-muted group-hover:text-foreground">
                          <ChevronRight aria-hidden className="size-3.5" />
                        </span>
                      </button>
                      {!available && (
                        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">Thiếu dữ liệu gốc</p>
                      )}
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
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="mr-1 text-[11px] text-muted-foreground @xl/catalog:hidden">Bản dịch</span>
                        {entity.translations.map((copy) => (
                          <span
                            key={copy.locale}
                            className={`rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${copy.locale.toLowerCase() === locale.toLowerCase() ? "border-border bg-muted/60 text-foreground" : "border-transparent text-muted-foreground"}`}
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
        {!loading && !rows.length && (
          <div className="flex min-h-48 flex-col items-center justify-center gap-2 p-6 text-center">
            <Search className="mb-1 size-6 text-muted-foreground/60" />
            <p className="text-sm font-medium">
              {entities.length ? "Không có mục phù hợp" : termsOnly ? "Chưa có thuật ngữ" : "Chưa có tham chiếu"}
            </p>
            {filtered && (
              <Button size="sm" variant="outline" className="mt-2" onClick={resetFilters}>
                Bỏ bộ lọc
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
      {rows.length > 25 && (
        <div className="flex items-center justify-between gap-2 px-0.5">
          <span className="text-xs text-muted-foreground tabular-nums">
            Trang {currentPage + 1} / {Math.ceil(rows.length / 25)}
          </span>
          <div className="flex gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft aria-hidden className="size-4" /> Trước
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={(currentPage + 1) * 25 >= rows.length}
              onClick={() => setPage(currentPage + 1)}
            >
              Sau <ChevronRight aria-hidden className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
