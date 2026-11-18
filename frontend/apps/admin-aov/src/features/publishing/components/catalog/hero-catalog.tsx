import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useInfiniteQuery } from "@tanstack/react-query"
import { createColumnHelper, useTable } from "@tanstack/react-table"
import { ArrowDownWideNarrow, ListChecks, BookOpen, ChevronRight, Clock3, FilePenLine, Info } from "lucide-react"
import { SearchField } from "@/components/search-field"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { Link, useSearchParams } from "react-router"
import { Button } from "@aov/ui/components/button"
import { Badge } from "@aov/ui/components/badge"
import { cn } from "@aov/ui/lib/utils"
import { errorMessage } from "@/lib/api/errors"
import { type HeroCatalogQuery, publishingKeys } from "../../api/publishing-api"
import { heroFormNote } from "../../model/hero-forms-model"
import { type HeroGameplayChange } from "../../api/types"
import { heroCatalogRows, appliedMarkets } from "../../model/catalog/catalog-data"
import type { CatalogFilter } from "./catalog-context"
import { type PublicationOverview } from "../../api/publication-overview"
import { dateLabel } from "@/lib/schedule-date"
import { ChangeKindBadges } from "../patch-changes/hero-change-badges"
import { MarketBadge } from "../setup/market-badge"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { nextPageOf } from "@aov/ui/lib/page-slice"
import { closeHeroLocation, heroLocationId, openHeroLocation, patchHeroLocation } from "../../model/hero-location"
import { useHeroEntries } from "../patch-changes/patch-notes-sheet"
import { showAllCatalogEntries } from "../../model/catalog/catalog-scope"
import { useHeroScopeChanges } from "../../api/use-hero-scope-changes"
import { HeroCatalogFilters, heroCatalogFacets } from "./hero-catalog-filters"
import {
  api,
  features,
  type CatalogRow,
  HeroTableRow,
  HeroGameplayChanges,
  LastEdited,
  HeroHead,
  HeroText,
  HeroTranslations,
} from "./hero-catalog-cells"
import { HeroQuickView } from "./hero-quick-view"

const helper = createColumnHelper<typeof features, CatalogRow>()
const defaultFilter: CatalogFilter = { seasonId: "", variantId: "" }

export function HeroCatalog({
  ruleset,
  locale,
  overview,
  filter = defaultFilter,
  searchSlot,
}: {
  /** The page header's search slot; without it the search stays in the list toolbar. */
  searchSlot?: HTMLElement | null
  ruleset: string
  locale: string
  overview?: PublicationOverview
  filter?: CatalogFilter
}) {
  const [params, setParams] = useSearchParams()
  const q = (params.get("q") ?? "").trim().slice(0, 100)
  const sort = params.get("sort") === "edited-desc" ? "edited-desc" : "code"
  const [search, setSearch] = useState(q)
  const searchRef = useRef<HTMLInputElement>(null)
  const showAll = showAllCatalogEntries(params)
  const reviewedVariants =
    overview?.variants.filter(
      (v) => (!filter.seasonId || v.seasonId === filter.seasonId) && (!filter.variantId || v.id === filter.variantId),
    ) ?? []
  const reviewed = reviewedVariants.length > 0 && reviewedVariants.every((v) => v.dataReviewState === "COMPLETE")
  const scoped = !!(filter.seasonId || filter.variantId)
  const scopeChanges = useHeroScopeChanges(overview, filter, locale, scoped && showAll)
  useEffect(() => setSearch(q), [q])
  useEffect(() => {
    if (search.trim() === q) return
    const timer = window.setTimeout(() => {
      setParams((current) => patchHeroLocation(current, { q: search.trim() }), {
        replace: true,
        preventScrollReset: true,
      })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [search, q, setParams])
  const selectedId = heroLocationId(params.get("hero"))
  // Keep column renderers stable while navigation still reads the latest URL.
  const updateParams = useRef(setParams)
  useLayoutEffect(() => {
    updateParams.current = setParams
  }, [setParams])
  /** `exact` opens the revision given even on a hero that holds forms, such as its open draft. */
  const openHero = useCallback((hero: CatalogRow, exact = false) => {
    // A hero that holds forms opens on its default form, whose page edits the shared part too.
    const form = !exact && hero.formIds?.length ? hero.formIds[0] : undefined
    updateParams.current(
      (current) => {
        const next = openHeroLocation(current, form ?? hero.id, form ? undefined : hero.selectedRevision?.id)
        return !hero.selectedRevision && current.get("patch")
          ? patchHeroLocation(next, { view: "patch", atPatch: current.get("patch") })
          : next
      },
      {
        preventScrollReset: true,
      },
    )
  }, [])
  const openGameplayChange = useCallback((hero: CatalogRow, change: HeroGameplayChange) => {
    updateParams.current(
      (current) =>
        change.toHeroRevisionId
          ? patchHeroLocation(openHeroLocation(current, hero.id, change.toHeroRevisionId), {
              view: "history",
              compare: change.fromHeroRevisionId ?? "",
            })
          : patchHeroLocation(openHeroLocation(current, hero.id, hero.selectedRevision?.id), {
              view: "patch",
              atPatch: change.patchVariantId,
            }),
      { preventScrollReset: true },
    )
  }, [])
  const query: HeroCatalogQuery = {
    ...heroCatalogFacets(params),
    q,
    includeUnchanged: "false",
    sort,
    locale,
    seasonId: showAll ? "" : filter.seasonId,
    patchVariantId: showAll ? "" : filter.variantId,
    rulesetId: ruleset,
  }
  const heroes = useInfiniteQuery({
    queryKey: publishingKeys.heroCatalog(query),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => api.heroes(pageParam, query, signal),
    getNextPageParam: nextPageOf,
  })
  const data = useMemo(
    () =>
      heroCatalogRows(
        heroes.data?.pages.flatMap((page) =>
          page.items.map((hero) =>
            scoped && showAll ? { ...hero, gameplayChanges: scopeChanges.byHero[hero.id] ?? [] } : hero,
          ),
        ) ?? [],
        overview,
        {
          seasonId: filter.seasonId,
          variantId: filter.variantId,
        },
        ruleset,
        showAll,
      ),
    [heroes.data, overview, filter.seasonId, filter.variantId, ruleset, showAll, scoped, scopeChanges.byHero],
  )
  // Names and heads come from the reference catalog at once; each row's revision fills in when it loads.
  const entries = useHeroEntries(locale)
  const entryById = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries])
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("code", {
          header: () => <span className="flex items-center gap-2">Tướng</span>,
          cell: ({ row }) => (
            <button
              type="button"
              className="group/hero-action flex min-h-11 w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-md py-1 text-left hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              onClick={() => openHero(row.original)}
              aria-label={`Xem tướng ${row.original.code}`}
              title={`Mở chi tiết ${row.original.code}`}
            >
              <HeroHead hero={row.original} fallbackAssetId={entryById.get(row.original.id)?.iconAssetId} />
              <div className="min-w-0 flex-1">
                <HeroText hero={row.original} locale={locale} fallbackName={entryById.get(row.original.id)?.name} />
                <span
                  className="mt-0.5 block truncate text-xs leading-4 text-muted-foreground"
                  title={row.original.code}
                >
                  {row.original.code}
                  {heroFormNote(row.original) && ` · ${heroFormNote(row.original)}`}
                </span>
              </div>
              <ChevronRight
                aria-hidden="true"
                className="size-3.5 shrink-0 text-muted-foreground/60 group-hover/hero-action:text-foreground group-focus-visible/hero-action:text-foreground"
              />
            </button>
          ),
        }),
        helper.display({
          id: "changes",
          header: () => (
            <span
              className="inline-flex items-center gap-1"
              title={scoped ? "Thay đổi tại patch đang chọn" : "Đánh giá patch gần nhất"}
            >
              {scoped ? "Thay đổi tại patch" : "Đánh giá patch"}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-5" aria-label="Xem chú giải loại thay đổi">
                    <Info className="size-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] space-y-3">
                  <h3 className="font-semibold">Loại thay đổi gameplay</h3>
                  <ChangeKindBadges kinds={["BUFF", "NERF", "ADJUSTMENT", "REWORK", "FIX", "OTHER"]} maxVisible={6} />
                  <p className="text-xs leading-5 text-muted-foreground">
                    Mỗi tướng có một đánh giá tổng thể trong mỗi patch. Nhãn tăng, giảm hoặc điều chỉnh của từng kỹ
                    năng/chỉ số nằm trong phần chi tiết.
                  </p>
                </PopoverContent>
              </Popover>
            </span>
          ),
          cell: ({ row }) =>
            scoped && showAll && (scopeChanges.pending || scopeChanges.error) ? (
              <span className="type-meta">{scopeChanges.error ? "Chưa tải được thay đổi" : "Đang tải thay đổi…"}</span>
            ) : scoped && showAll && !row.original.changes.length ? (
              <span className="type-meta">
                {reviewed && row.original.selectedRevision?.effectiveFromPatchVariantId
                  ? "Không thay đổi"
                  : "Chưa ghi nhận thay đổi"}
              </span>
            ) : (
              <HeroGameplayChanges
                hero={row.original}
                overview={overview}
                locale={locale}
                showPatchLabel={!filter.variantId}
                onOpen={openGameplayChange}
              />
            ),
        }),
        helper.display({
          id: "revision",
          header: "Trạng thái",
          cell: ({ row }) => {
            const r = row.original.selectedRevision
            const draft = row.original.workingDraft
            const draftPatch = overview?.variants.find((variant) => variant.id === draft?.effectiveFromPatchVariantId)
            const draftContext =
              draftPatch?.patchCode ?? (draft?.effectiveFromPatchVariantId ? "Đã gắn patch" : "Chưa gắn patch")
            const draftAction = draft && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-auto max-w-full justify-start px-1.5 py-0.5 text-xs"
                aria-label={`Mở bản nháp ${row.original.code} · ${draftContext}`}
                title={draftContext}
                onClick={() => openHero({ ...row.original, selectedRevision: draft }, true)}
              >
                <FilePenLine aria-hidden className="size-3.5 shrink-0" />
                <span className="truncate">{draft.id === r?.id ? "Mở bản nháp" : `Mở nháp · ${draftContext}`}</span>
              </Button>
            )
            const v = overview?.variants.find((v) => v.id === r?.effectiveFromPatchVariantId)
            const patchLabel = v?.patchCode ?? (r?.state === "PUBLISHED" ? "Chưa rõ patch" : "Chưa gắn patch")
            const markets = r && overview ? appliedMarkets(row.original.revisions, r, overview) : []
            const rulesetCode =
              (overview?.rulesets.length ?? 0) > 1
                ? overview?.rulesets.find((rule) => rule.id === r?.rulesetId)?.code
                : undefined
            return r ? (
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-1">
                  {r.state === "DRAFT" && draftAction ? (
                    draftAction
                  ) : (
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium",
                        r.state === "DRAFT"
                          ? "border-(--aov-warning)/20 bg-(--aov-warning-soft) text-(--aov-warning)"
                          : "border-(--aov-success)/20 bg-(--aov-success-soft) text-(--aov-success)",
                      )}
                    >
                      <span aria-hidden className="size-1.5 rounded-full bg-current" />
                      {r.state === "DRAFT" ? "Bản nháp" : "Đã xuất bản"}
                    </Badge>
                  )}
                  {markets.map(({ market, release, variant }) => (
                    <MarketBadge
                      key={market.id}
                      code={market.code}
                      name={market.displayName}
                      detail={`Đang áp dụng ${variant.patchCode} · ${dateLabel(release.effectiveOn ?? release.effectiveAt, locale)}`}
                    />
                  ))}
                </div>
                <p className="flex min-w-0 items-center gap-1.5 text-xs leading-4 text-muted-foreground">
                  <span className="truncate" title={patchLabel}>
                    {patchLabel}
                  </span>
                  <span className="shrink-0 tabular-nums" aria-label={`Phiên bản ${r.revisionNo}`}>
                    #{r.revisionNo}
                  </span>
                  {rulesetCode && (
                    <span className="min-w-0 truncate" title={rulesetCode}>
                      {rulesetCode}
                    </span>
                  )}
                </p>
                {draft && draft.id !== r.id && draftAction}
              </div>
            ) : (
              <div className="grid justify-items-start gap-1">
                <span className="type-meta">{scoped ? "Chưa có dữ liệu tại patch" : "Chưa có phiên bản"}</span>
                {draftAction}
              </div>
            )
          },
        }),
        helper.display({
          id: "translations",
          header: "Bản dịch",
          cell: ({ row }) => <HeroTranslations hero={row.original} />,
        }),
        helper.display({
          id: "edited",
          header: () => (
            <span
              className="flex items-center justify-end gap-1.5 whitespace-nowrap"
              title="Lần sửa hồ sơ tướng gần nhất, khác với ngày phát hành patch."
            >
              <Clock3 className="size-3" />
              Sửa gần nhất
            </span>
          ),
          cell: ({ row }) => <LastEdited value={row.original.lastEditedAt} locale={locale} />,
        }),
      ]),
    [
      overview,
      locale,
      openHero,
      openGameplayChange,
      scoped,
      showAll,
      scopeChanges.pending,
      scopeChanges.error,
      entryById,
      reviewed,
      filter.variantId,
    ],
  )
  const table = useTable({ features, columns, data, getRowId: (row) => row.rowKey })
  const searchBox = (
    <SearchField
      placement={searchSlot ? "header" : "inline"}
      inputRef={searchRef}
      label="Tìm tướng"
      placeholder="Tìm tên hoặc mã tướng…"
      shortcut
      value={search}
      onChange={setSearch}
    />
  )
  return (
    <section className="@container/hero-list admin-panel min-w-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border/60 px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <h2 className="type-section-title">Danh sách tướng</h2>
          <span className="type-meta tabular-nums">
            <span className="sr-only">Đã tải </span>
            {heroes.data?.pages.reduce((n, p) => n + p.items.length, 0) ?? 0} /{" "}
            {heroes.data?.pages[0]?.totalElements ?? 0} tướng{scoped && !showAll ? " có thay đổi" : ""}
          </span>
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-2">
          {searchSlot ? createPortal(searchBox, searchSlot) : <div className="min-w-40 flex-1">{searchBox}</div>}
          <HeroCatalogFilters />
          <Button asChild variant="outline" size="sm">
            <Link to="/hero/publish-readiness">
              <ListChecks className="size-4" /> Sẵn sàng xuất bản
            </Link>
          </Button>
          <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowDownWideNarrow aria-hidden className="size-3.5" />
            <span className="sr-only">Sắp xếp</span>
            <select
              aria-label="Sắp xếp tướng"
              className="h-8 max-w-full rounded-lg border border-border/70 bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={sort}
              onChange={(event) =>
                setParams(
                  (current) =>
                    patchHeroLocation(current, { sort: event.target.value === "code" ? "" : event.target.value }),
                  {
                    replace: true,
                    preventScrollReset: true,
                  },
                )
              }
            >
              <option value="code">Mã tướng (A–Z)</option>
              <option value="edited-desc">Chỉnh sửa gần nhất</option>
            </select>
          </label>
        </div>
      </div>

      <div
        className="overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        role="region"
        aria-label="Danh sách tướng theo patch"
        tabIndex={0}
      >
        <table className="block w-full text-sm @min-[44rem]/hero-list:table @min-[44rem]/hero-list:table-fixed">
          <caption className="sr-only">
            Danh sách tướng, thay đổi gameplay, phiên bản, thị trường, bản dịch, chỉnh sửa gần nhất và trạng thái. Chọn
            tên tướng để mở chi tiết.
          </caption>
          <colgroup className="hidden @min-[44rem]/hero-list:table-column-group">
            <col className="w-[24%]" />
            <col className="w-[23%]" />
            <col className="w-[23%]" />
            <col className="w-[14%]" />
            <col className="w-[16%]" />
          </colgroup>
          <thead className="sr-only bg-muted @min-[44rem]/hero-list:not-sr-only @min-[44rem]/hero-list:table-header-group">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th
                    key={header.id}
                    scope="col"
                    className={cn(
                      "h-10 px-3 py-2 text-left text-xs font-semibold text-muted-foreground",
                      header.column.id === "edited" && "text-right",
                    )}
                  >
                    <table.FlexRender header={header} />
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="block divide-y divide-border/60 @min-[44rem]/hero-list:table-row-group">
            {table.getRowModel().rows.map((row) => (
              <HeroTableRow
                key={row.id}
                active={row.original.id === selectedId}
                cells={row.getAllCells()}
                renderCell={table.FlexRender}
              />
            ))}
          </tbody>
        </table>
      </div>
      {!data.length && !heroes.isPending && !heroes.isError && (
        <div className="grid justify-items-center gap-2 p-12 text-center text-muted-foreground">
          <BookOpen className="size-8" />
          <p>
            {scoped && !showAll
              ? "Chưa ghi nhận thay đổi gameplay phù hợp với bộ lọc."
              : q || query.role || query.position || query.hasWarnings
                ? "Không tìm thấy tướng phù hợp với tìm kiếm và bộ lọc."
                : "Chưa có tướng trong kho."}
          </p>
          {scoped && !showAll && (
            <>
              <p className="max-w-md text-xs">Bản nhập dữ liệu và bản sửa nội dung không tính là thay đổi gameplay.</p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("")
                  setParams((current) => patchHeroLocation(current, { show: "all", q: "" }), {
                    preventScrollReset: true,
                  })
                }}
              >
                Xem toàn bộ tướng
              </Button>
            </>
          )}
        </div>
      )}
      <div className="flex justify-center px-3 py-3" aria-live="polite">
        {heroes.isError && !heroes.isFetching ? (
          <div role="alert" className="text-center">
            <p className="text-sm text-destructive">{errorMessage(heroes.error)}</p>
            <Button
              variant="ghost"
              onClick={() => (heroes.isFetchNextPageError ? void heroes.fetchNextPage() : void heroes.refetch())}
            >
              Thử lại
            </Button>
          </div>
        ) : heroes.hasNextPage ? (
          <InfiniteScroll query={heroes} label="Đang tải thêm tướng…" />
        ) : heroes.isFetching ? (
          <span role="status" className="text-xs text-muted-foreground">
            Đang tải tướng…
          </span>
        ) : data.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            {q || scoped || ruleset ? "Đã tải tất cả kết quả" : "Đã tải tất cả tướng"}
          </span>
        ) : null}
      </div>
      <HeroQuickView
        heroId={selectedId}
        hero={data.find((hero) => hero.id === selectedId) ?? null}
        ruleset={ruleset}
        onClose={() => setParams((current) => closeHeroLocation(current), { replace: true, preventScrollReset: true })}
      />
    </section>
  )
}
