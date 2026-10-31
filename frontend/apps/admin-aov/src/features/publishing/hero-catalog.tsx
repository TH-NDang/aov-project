import { CatalogChangeBadges } from "../warehouse/catalog-changes"
import { lazy, memo, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { createColumnHelper, tableFeatures, useTable, type Cell, type ReactTable } from "@tanstack/react-table"
import {
  ArrowDownWideNarrow,
  ArrowUpRight,
  UserRound,
  BookOpen,
  Languages,
  Plus,
  ChevronDown,
  ChevronRight,
  ChevronsRight,
  Clock3,
  Info,
} from "lucide-react"
import { useSession } from "@/app/auth/auth-gate"
import { SearchField } from "@/components/search-field"
import { InfiniteScroll } from "@/components/infinite-scroll"
import { usePageCloseGuard } from "@/app/layout/page-tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@aov/ui/components/tooltip"
import { Link, useSearchParams } from "react-router"
import { Button } from "@aov/ui/components/button"
import { Badge } from "@aov/ui/components/badge"
import { cn } from "@aov/ui/lib/utils"
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@aov/ui/components/sheet"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { createPublishingApi, heroPreviewKey, heroCatalogKey, type HeroCatalogQuery } from "./publishing-api"
import { type HeroGameplayChange, type HeroRow } from "./types"
import { heroCatalogRows, appliedMarkets, translationCoverage, type HeroCatalogRow } from "./catalog-data"
import type { CatalogFilter } from "./catalog-context"
import { dateLabel, useContentTimeZone, type PublicationOverview } from "./publication-overview"
import { ChangeKindBadges, HeroChangeSummary } from "./hero-change-badges"
import { MarketBadge } from "./market-badge"
import { languageOptions } from "../users/profile-preference-picker"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import {
  closeHeroLocation,
  heroLocationId,
  heroPageLocation,
  openHeroLocation,
  patchHeroLocation,
} from "./hero-location"
import { HeroNavigationGuard } from "./hero-navigation-guard"
import { HeroQuickViewBody } from "./hero-quick-view-body"
import { useHeroEntries } from "./patch-notes-sheet"
const HeroWorkspace = lazy(() =>
  import("./publishing-page").then((module) => ({ default: module.PublishingWorkspace })),
)
const api = createPublishingApi(backendRequest)
const features = tableFeatures({})
type CatalogRow = HeroCatalogRow
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
  const showAll = params.get("show") === "all"
  const timeZone = useContentTimeZone()
  const reviewedVariants =
    overview?.variants.filter(
      (v) => (!filter.seasonId || v.seasonId === filter.seasonId) && (!filter.variantId || v.id === filter.variantId),
    ) ?? []
  const reviewed = reviewedVariants.length > 0 && reviewedVariants.every((v) => v.dataReviewState === "COMPLETE")
  const scoped = !!(filter.seasonId || filter.variantId)
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
  const openHero = useCallback((hero: CatalogRow) => {
    updateParams.current((current) => openHeroLocation(current, hero.id, hero.selectedRevision?.id), {
      preventScrollReset: true,
    })
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
    q,
    includeUnchanged: showAll ? "true" : "false",
    sort,
    locale,
    seasonId: filter.seasonId,
    patchVariantId: filter.variantId,
    rulesetId: ruleset,
  }
  const heroes = useInfiniteQuery({
    queryKey: heroCatalogKey(query),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => api.heroes(pageParam, query, signal),
    getNextPageParam: (last) => ((last.page + 1) * last.size < last.totalElements ? last.page + 1 : undefined),
  })
  const data = useMemo(
    () =>
      heroCatalogRows(
        heroes.data?.pages.flatMap((page) => page.items) ?? [],
        overview,
        {
          seasonId: filter.seasonId,
          variantId: filter.variantId,
        },
        ruleset,
        showAll,
      ),
    [heroes.data, overview, filter.seasonId, filter.variantId, ruleset, showAll],
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
              className="group/hero-action -mx-1.5 flex w-[calc(100%+0.75rem)] min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-background/60 p-1.5 text-left transition-colors hover:border-ring/50 hover:bg-accent hover:shadow-xs focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              onClick={() => openHero(row.original)}
              aria-label={`Xem tướng ${row.original.code}`}
              title={`Mở chi tiết ${row.original.code}`}
            >
              <HeroHead hero={row.original} fallbackAssetId={entryById.get(row.original.id)?.iconAssetId} />
              <div className="min-w-0 flex-1">
                <HeroText hero={row.original} locale={locale} fallbackName={entryById.get(row.original.id)?.name} />
                <span
                  className="mt-0.5 block truncate text-[11px] leading-4 text-muted-foreground"
                  title={row.original.code}
                >
                  {row.original.code}
                </span>
              </div>
              <ChevronRight
                aria-hidden="true"
                className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover/hero-action:text-foreground group-focus-visible/hero-action:text-foreground"
              />
            </button>
          ),
        }),
        helper.display({
          id: "changes",
          header: () => (
            <span
              className="inline-flex items-center gap-1"
              title={scoped ? "Đánh giá trong phạm vi" : "Đánh giá patch gần nhất"}
            >
              {scoped ? "Đánh giá phạm vi" : "Đánh giá patch"}
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
                    Đánh giá tổng thể được chọn riêng cho mỗi patch. Từng kỹ năng/chỉ số vẫn có nhãn tăng, giảm hoặc
                    điều chỉnh độc lập.
                  </p>
                </PopoverContent>
              </Popover>
            </span>
          ),
          cell: ({ row }) =>
            scoped && showAll && !row.original.changes.length ? (
              <CatalogChangeBadges
                kinds={[
                  row.original.selectedRevision?.cause === "DATA_BASELINE" &&
                  overview?.variants.some(
                    (v) =>
                      v.id === row.original.selectedRevision?.effectiveFromPatchVariantId &&
                      (!filter.variantId || v.id === filter.variantId) &&
                      (!filter.seasonId || v.seasonId === filter.seasonId),
                  )
                    ? "DATA_BASELINE"
                    : reviewed
                      ? "UNCHANGED"
                      : "INHERITED",
                ]}
              />
            ) : (
              <HeroGameplayChanges
                hero={row.original}
                overview={overview}
                locale={locale}
                onOpen={openGameplayChange}
              />
            ),
        }),
        helper.display({
          id: "revision",
          header: "Trạng thái",
          cell: ({ row }) => {
            const r = row.original.selectedRevision
            const v = overview?.variants.find((v) => v.id === r?.effectiveFromPatchVariantId)
            const markets = r && overview ? appliedMarkets(row.original.revisions, r, overview) : []
            const rulesetCode =
              (overview?.rulesets.length ?? 0) > 1
                ? overview?.rulesets.find((rule) => rule.id === r?.rulesetId)?.code
                : undefined
            return r ? (
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-1">
                  <Badge
                    variant="outline"
                    className={cn(
                      "gap-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                      r.state === "DRAFT"
                        ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        : "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                    )}
                  >
                    <span aria-hidden className="size-1.5 rounded-full bg-current" />
                    {r.state === "DRAFT" ? "Bản nháp" : "Đã xuất bản"}
                  </Badge>
                  {markets.map(({ market, release, variant }) => (
                    <MarketBadge
                      key={market.id}
                      code={market.code}
                      name={market.displayName}
                      detail={`Đang áp dụng ${variant.patchCode} · ${dateLabel(release.effectiveOn ?? release.effectiveAt, locale)}`}
                    />
                  ))}
                </div>
                <p className="flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-muted-foreground">
                  <span className="truncate" title={v?.patchCode ?? "Chưa gắn patch"}>
                    {v?.patchCode ?? "Chưa gắn patch"}
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
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Chưa có phiên bản</span>
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
              className="flex items-center justify-end gap-1.5"
              title="Lần sửa hồ sơ tướng gần nhất, khác với ngày phát hành patch."
            >
              <Clock3 className="size-3" />
              Sửa gần nhất
            </span>
          ),
          cell: ({ row }) => <LastEdited value={row.original.lastEditedAt} locale={locale} timeZone={timeZone} />,
        }),
      ]),
    [
      ruleset,
      overview,
      locale,
      openHero,
      openGameplayChange,
      scoped,
      showAll,
      entryById,
      timeZone,
      reviewed,
      filter.seasonId,
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
    <section className="min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <h2 className="text-sm font-semibold">Danh sách tướng</h2>
          <span className="rounded-md bg-muted/70 px-2 py-1 text-[11px] text-muted-foreground tabular-nums">
            <span className="sr-only">Đã tải </span>
            {heroes.data?.pages.reduce((n, p) => n + p.items.length, 0) ?? 0} /{" "}
            {heroes.data?.pages[0]?.totalElements ?? 0} tướng{scoped ? " có thay đổi" : ""}
          </span>
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3">
          {searchSlot ? createPortal(searchBox, searchSlot) : <div className="min-w-40 flex-1">{searchBox}</div>}
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
      <p className="border-b px-4 py-2 text-xs text-muted-foreground sm:hidden">
        Chạm vào ô tướng để xem chi tiết · vuốt ngang để xem thêm cột.
      </p>
      <div
        className="overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        role="region"
        aria-label="Bảng tướng · cuộn ngang để xem các cột"
        tabIndex={0}
      >
        <table className="w-full min-w-[720px] table-fixed text-sm">
          <caption className="sr-only">
            Danh sách tướng, thay đổi gameplay, phiên bản, thị trường, bản dịch, chỉnh sửa gần nhất và trạng thái. Chọn
            tên tướng để mở chi tiết.
          </caption>
          <colgroup>
            <col className="w-[24%]" />
            <col className="w-[23%]" />
            <col className="w-[23%]" />
            <col className="w-[14%]" />
            <col className="w-[16%]" />
          </colgroup>
          <thead className="border-b border-border/60 bg-muted/60">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th
                    key={header.id}
                    scope="col"
                    className={cn(
                      "h-10 px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground",
                      header.column.id === "code" && "sticky left-0 z-10 bg-muted",
                      header.column.id === "edited" && "text-right",
                    )}
                  >
                    <table.FlexRender header={header} />
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border/50">
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
            {scoped
              ? "Chưa ghi nhận thay đổi gameplay phù hợp với bộ lọc."
              : q
                ? "Không tìm thấy tướng theo tên hoặc mã này."
                : "Chưa có tướng trong kho."}
          </p>
          {scoped && (
            <>
              <p className="max-w-md text-xs">
                Mốc dữ liệu ban đầu và chỉnh sửa nội dung không được tính là thay đổi gameplay.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("")
                  setParams((current) => patchHeroLocation(current, { season: "", patch: "", q: "" }), {
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

const HeroTableRow = memo(function HeroTableRow({
  active,
  cells,
  renderCell: RenderCell,
}: {
  active: boolean
  cells: Cell<typeof features, CatalogRow, unknown>[]
  renderCell: ReactTable<typeof features, CatalogRow>["FlexRender"]
}) {
  return (
    <tr data-active={active} className="group/hero-row h-16 data-[active=true]:bg-accent">
      {cells.map((cell) => (
        <td
          key={cell.id}
          className={cn(
            "px-3 py-2 align-middle",
            cell.column.id === "code" &&
              "sticky left-0 z-10 border-r border-border/40 bg-card group-data-[active=true]/hero-row:bg-accent",
            cell.column.id === "edited" && "text-right",
          )}
        >
          <RenderCell cell={cell} />
        </td>
      ))}
    </tr>
  )
})

function HeroGameplayChanges({
  hero,
  overview,
  locale,
  onOpen,
}: {
  hero: CatalogRow
  overview?: PublicationOverview
  locale: string
  onOpen: (hero: CatalogRow, change: HeroGameplayChange) => void
}) {
  const [open, setOpen] = useState(false)
  const patchName = (change: HeroGameplayChange) =>
    overview?.variants.find((variant) => variant.id === change.patchVariantId)?.patchCode ?? "Patch đã ghi nhận"
  if (!hero.changes.length)
    return (
      <span className="text-xs text-muted-foreground" title="Chưa có lịch sử gameplay đã biên tập cho tướng này.">
        Chưa ghi lịch sử
      </span>
    )
  if (hero.changes.length === 1) {
    const change = hero.changes[0]
    return (
      <HeroChangeSummary
        kinds={change.overallKind ? [change.overallKind] : []}
        summary={change.summary ?? "Chưa đánh giá tổng thể tướng. Mở chi tiết để xem từng kỹ năng/chỉ số."}
        patchLabel={patchName(change)}
        actualLocale={change.actualLocale}
        locale={locale}
        onOpen={() => onOpen(hero, change)}
      />
    )
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex max-w-full cursor-pointer items-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-2 py-1 text-left transition-colors hover:border-ring/50 hover:bg-accent hover:shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=open]:border-ring/50 data-[state=open]:bg-accent"
          aria-label={`Xem thay đổi gameplay của ${hero.code} tại ${hero.changes.length} patch`}
        >
          <span className="flex min-w-0 flex-col items-start gap-1">
            <ChangeKindBadges
              emptyLabel="Chưa đánh giá tổng thể"
              kinds={hero.changes.flatMap((change) => (change.overallKind ? [change.overallKind] : []))}
              compact
              maxVisible={6}
            />
            <span className="text-xs text-muted-foreground">{hero.changes.length} patch</span>
          </span>
          <ChevronDown aria-hidden className="size-3 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96 max-w-[calc(100vw-2rem)] p-0">
        <div className="border-b p-4">
          <h3 className="font-semibold">Thay đổi gameplay trong phạm vi</h3>
          <p className="mt-1 text-xs text-muted-foreground">Xếp từ patch mới đến cũ.</p>
        </div>
        <ol className="max-h-[60dvh] divide-y overflow-y-auto">
          {hero.changes.map((change) => (
            <li key={change.id} className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{patchName(change)}</span>
                <ChangeKindBadges
                  emptyLabel="Chưa đánh giá tổng thể"
                  kinds={change.overallKind ? [change.overallKind] : []}
                  compact
                  maxVisible={6}
                />
              </div>
              <p className="whitespace-pre-wrap break-words text-sm leading-6">
                {change.summary || "Đã ghi nhận thay đổi gameplay."}
              </p>
              {change.actualLocale && change.actualLocale !== locale && (
                <p className="text-xs text-muted-foreground">Ngôn ngữ dự phòng: {change.actualLocale}</p>
              )}
              <Button
                variant="outline"
                size="sm"
                aria-label={`Xem thay đổi tại ${patchName(change)}`}
                onClick={() => {
                  setOpen(false)
                  onOpen(hero, change)
                }}
              >
                <ArrowUpRight className="size-4" />
                Xem bản đối chiếu
              </Button>
            </li>
          ))}
        </ol>
      </PopoverContent>
    </Popover>
  )
}

function LastEdited({ value, locale, timeZone }: { value?: string | null; locale: string; timeZone?: string }) {
  if (!value || Number.isNaN(Date.parse(value)))
    return <span className="text-xs text-muted-foreground">Chưa ghi nhận</span>
  let label = value
  let date = value
  let time = ""
  try {
    const timestamp = new Date(value)
    label = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone }).format(timestamp)
    date = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric", timeZone }).format(
      timestamp,
    )
    time = new Intl.DateTimeFormat(locale, { timeStyle: "short", timeZone }).format(timestamp)
  } catch {
    // Preserve the stored timestamp if a browser cannot format the configured locale or time zone.
  }
  return (
    <time
      className="inline-flex max-w-full flex-col gap-0.5 text-right text-[11px] tabular-nums"
      dateTime={value}
      aria-label={label}
      title={timeZone ? `${label} · ${timeZone}` : label}
    >
      <span className="font-medium">{date}</span>
      {time && <span className="text-[10px] text-muted-foreground">{time}</span>}
    </time>
  )
}

function HeroQuickView({
  heroId,
  hero,
  ruleset,
  onClose,
}: {
  heroId: string
  hero: HeroRow | null
  ruleset: string
  onClose: () => void
}) {
  const [params, setParams] = useSearchParams()
  const restored = useQuery({
    queryKey: ["publishing-revisions", heroId],
    queryFn: () => api.revisions(heroId),
    enabled: !!heroId,
  })
  const revisions = (restored.data ?? hero?.revisions ?? []).filter((r) => !ruleset || r.rulesetId === ruleset)
  const requestedRevision = heroLocationId(params.get("revision"))
  const revision = requestedRevision
    ? revisions.find((r) => r.id === requestedRevision)
    : (revisions.find((r) => r.state === "DRAFT") ?? revisions.find((r) => r.state === "PUBLISHED"))
  const revisionId = requestedRevision || revision?.id || ""
  useEffect(() => {
    if (heroId && !requestedRevision && revision?.id) {
      setParams((current) => patchHeroLocation(current, { revision: revision.id }), {
        replace: true,
        preventScrollReset: true,
      })
    }
  }, [heroId, requestedRevision, revision?.id, setParams])
  const [unsafe, setUnsafe] = useState(false)
  const [saving, setSaving] = useState(false)
  const canLeave = () => !saving && (!unsafe || window.confirm("Bạn có thay đổi chưa lưu. Đóng trang tướng này?"))
  usePageCloseGuard(() => !heroId || canLeave())
  return (
    <>
      <HeroNavigationGuard unsafe={!!heroId && (unsafe || saving)} busy={saving} />
      <Sheet
        open={!!heroId}
        onOpenChange={(open) => {
          if (!open && canLeave()) {
            setUnsafe(false)
            onClose()
          }
        }}
      >
        <SheetContent
          side="right"
          showCloseButton={false}
          className="h-dvh w-[min(960px,calc(100vw-44px))] gap-0 overflow-visible ease-out data-[state=open]:duration-200 data-[state=closed]:duration-150 motion-reduce:animate-none sm:max-w-[min(960px,calc(100vw-44px))]"
        >
          <SheetClose asChild>
            <Button
              variant="outline"
              size="icon"
              className="absolute top-1/2 -left-[43px] z-10 h-[68px] w-11 -translate-y-1/2 cursor-pointer touch-manipulation rounded-l-xl rounded-r-none border-border bg-background text-muted-foreground shadow-md hover:text-foreground"
              aria-label="Đóng trang tướng"
              title="Đóng trang tướng"
              disabled={saving}
            >
              <ChevronsRight aria-hidden className="size-5" />
            </Button>
          </SheetClose>
          <SheetHeader className="h-11 shrink-0 justify-center gap-0 border-b px-4 py-0">
            <div className="flex items-center justify-between gap-3">
              <SheetTitle className="min-w-0 truncate text-[11px] font-medium text-muted-foreground">
                {hero?.code ? `Tướng / ${hero.code}` : "Chi tiết tướng"}
              </SheetTitle>
              <div className="flex shrink-0 items-center gap-1">
                {heroId && (
                  <Button asChild variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs">
                    <Link
                      aria-label="Mở trang tướng đầy đủ"
                      to={heroPageLocation(heroId, params, revisionId)}
                      onClick={(event) => {
                        if (!canLeave()) event.preventDefault()
                        else {
                          setUnsafe(false)
                        }
                      }}
                    >
                      <ArrowUpRight className="size-3.5" />
                      <span className="hidden sm:inline">Mở toàn trang</span>
                    </Link>
                  </Button>
                )}
              </div>
            </div>
            <SheetDescription className="sr-only">
              {revision ? `Phiên bản #${revision.revisionNo}` : "Chi tiết tướng"}
            </SheetDescription>
          </SheetHeader>
          <HeroQuickViewBody>
            {heroId && (
              <Suspense
                fallback={
                  <p role="status" className="p-6">
                    Đang tải trang tướng…
                  </p>
                }
              >
                <HeroWorkspace
                  key={heroId}
                  heroId={heroId}
                  revisionId={revisionId}
                  onUnsavedChange={(unsafe, busy) => {
                    setUnsafe(unsafe)
                    setSaving(!!busy)
                  }}
                />
              </Suspense>
            )}
          </HeroQuickViewBody>
        </SheetContent>
      </Sheet>
    </>
  )
}

function useHeroPreview(hero: CatalogRow) {
  const r = hero.selectedRevision
  return useQuery({
    queryKey: heroPreviewKey(hero.id, r?.id ?? ""),
    queryFn: () => api.read(hero.id, r!.id),
    enabled: !!r,
    staleTime: 30000,
  })
}
function HeroHead({ hero, fallbackAssetId }: { hero: CatalogRow; fallbackAssetId?: string | null }) {
  const preview = useHeroPreview(hero)
  const assetId = preview.data?.content.MEDIA_BINDINGS?.bindings.HEAD ?? fallbackAssetId
  const [failed, setFailed] = useState(false)
  const asset = useQuery({
    queryKey: ["publishing-asset", assetId],
    enabled: !!assetId,
    staleTime: 60000,
    queryFn: () => api.asset(assetId!),
  })
  const url = asset.data?.currentUrl
  useEffect(() => setFailed(false), [url])
  return (
    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted ring-1 ring-border/60">
      {url && !failed ? (
        <img src={url} alt="" className="size-full object-cover" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <UserRound aria-label="Chưa có ảnh head" className="size-5 text-muted-foreground" />
      )}
    </span>
  )
}
function HeroText({ hero, locale, fallbackName }: { hero: CatalogRow; locale: string; fallbackName?: string }) {
  const query = useHeroPreview(hero)
  const translations = query.data?.content.PROFILE?.translations
  const text =
    translations?.find((t) => t.locale === locale) ??
    translations?.find((t) => t.locale === "vi-VN") ??
    translations?.[0]
  if (!hero.selectedRevision) return "—"
  if (query.error)
    return (
      <span className="text-xs text-destructive" title={errorMessage(query.error)}>
        {hero.code} · Chưa tải được tên
      </span>
    )
  return (
    <div>
      <p
        className="truncate text-[13px] leading-[18px] font-semibold underline-offset-4 group-hover/hero-action:underline group-focus-visible/hero-action:underline"
        title={text?.name ?? fallbackName}
      >
        {text?.name ?? fallbackName ?? (query.isPending ? "Đang tải…" : hero.code)}
      </p>
      {text && text.locale !== locale && <span className="text-xs text-muted-foreground">Dự phòng: {text.locale}</span>}
    </div>
  )
}
function HeroTranslations({ hero }: { hero: CatalogRow }) {
  const query = useHeroPreview(hero)
  const canWrite = useSession().actor?.capabilities.includes("hero:write")
  if (!hero.selectedRevision) return "—"
  if (!query.data)
    return <span className="text-xs text-muted-foreground">{query.error ? "Chưa tải được" : "Đang tải…"}</span>
  const content = query.data.content
  const locales = [
    ...new Set([
      ...languageOptions.map((option) => option.value),
      ...(content.PROFILE?.translations.map((text) => text.locale) ?? []),
      ...(content.SKILLS?.skills.flatMap((skill) => skill.translations.map((text) => text.locale)) ?? []),
      ...(content.SKINS?.skins.flatMap((skin) => skin.translations.map((text) => text.locale)) ?? []),
    ]),
  ]
  const coverage = translationCoverage(content, locales)
  const complete = coverage.filter((c) => c.complete).length
  const partial = coverage.filter((c) => !c.complete && c.completed > 0).length
  const present = complete + partial
  const detail = `${present} ngôn ngữ có nội dung · ${complete} đầy đủ · ${partial} đang dịch`
  const target = coverage.find((item) => !item.completed)?.locale ?? "en-US"
  return (
    <TooltipProvider>
      <div className="flex items-center gap-0.5">
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="flex h-7 cursor-pointer items-center gap-1 rounded-md border border-border/60 bg-background/60 px-1.5 text-xs tabular-nums transition-colors hover:border-ring/50 hover:bg-accent hover:shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=open]:border-ring/50 data-[state=open]:bg-accent"
              aria-label={`Bản dịch ${hero.code}: ${detail}`}
              title={detail}
            >
              <Languages className="size-3.5 text-muted-foreground" />
              <span className="font-semibold">{present}</span>
              <ChevronDown aria-hidden className="size-3 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <h3 className="font-medium">Tiến độ bản dịch</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Đếm các trường có trong bản dữ liệu này. Đủ nội dung chưa có nghĩa đã duyệt hoặc kiểm chứng nguồn.
            </p>
            <div className="mt-3 max-h-80 space-y-3 overflow-y-auto">
              {coverage.map((c) => (
                <Link
                  key={c.locale}
                  className="block rounded-lg p-2 text-sm hover:bg-muted hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
                  to={`/hero/${hero.id}/translations?revision=${hero.selectedRevision!.id}&locale=${encodeURIComponent(c.locale)}`}
                >
                  <span className="flex justify-between gap-2">
                    <span>{languageOptions.find((o) => o.value === c.locale)?.label ?? c.locale}</span>
                    <span>
                      {c.completed}/{c.total}
                    </span>
                  </span>
                  <progress
                    className="mt-1 h-1.5 w-full accent-primary"
                    max={c.total}
                    value={c.completed}
                    aria-label={`Tiến độ ${c.locale}`}
                  />
                  <span className="text-xs text-muted-foreground">
                    {c.complete ? "Đủ nội dung" : c.completed ? "Đang dịch" : "Chưa dịch"}
                  </span>
                </Link>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        {canWrite && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                variant="outline"
                size="icon"
                className="size-6 cursor-pointer border-border/60 text-muted-foreground hover:border-ring/50 hover:text-foreground"
              >
                <Link
                  to={`/hero/${hero.id}/translations?revision=${hero.selectedRevision!.id}&locale=${encodeURIComponent(target)}`}
                  aria-label={`Thêm bản dịch ${hero.code}`}
                  title="Thêm bản dịch"
                >
                  <Plus className="size-3.5" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Thêm bản dịch</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}
