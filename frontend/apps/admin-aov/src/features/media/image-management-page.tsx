import { LocalTime } from "@aov/ui/components/local-time"
import { currentTimeZone, formatInZone } from "@aov/ui/lib/time-zone"
import { useEffect, useMemo, useState } from "react"
import { useInfiniteQuery, useQueries, useQuery } from "@tanstack/react-query"
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table"
import {
  ArrowUpRight,
  CheckCheck,
  CircleAlert,
  Copyright,
  Eye,
  ImageIcon,
  LayoutGrid,
  List,
  Mail,
  Plus,
  RefreshCw,
  X,
} from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { DropdownMenuItem, DropdownMenuSeparator } from "@aov/ui/components/dropdown-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@aov/ui/components/sheet"
import { Page, PageHeader } from "@/components/page-header"
import { PageActionsMenu } from "@/components/page-actions-menu"
import { FilterTab, FilterTabs } from "@/components/filter-tabs"
import { InfiniteScroll } from "@/components/infinite-scroll"
import { useIsWide } from "@/hooks/use-media-query"
import { useSession } from "@/app/auth/auth-gate"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { AssetPicker } from "../publishing/asset-picker"
import { control } from "../publishing/fields"
import { FileTabs } from "../files/file-tabs"
import type { Asset, PageSlice } from "../publishing/types"
import {
  LibraryImage,
  LibraryOwner,
  LibrarySource,
  LibraryStateBadge,
  LibraryUsage,
} from "./image-library-presentation"
import {
  usageStateHints,
  usageStateLabels,
  usageStates,
  type MediaUsageState,
  type MediaUsageSummary,
  type MediaUsageTotals,
} from "./media-usage"
import { MediaBulkSourceEditor } from "./media-bulk-source-editor"
import { IMAGE_TYPE_LABELS } from "@/lib/image-types"
import { ImageDetailSheet, imageStates } from "./image-detail-sheet"
import { creditSummary, needsNoCredit, ownerCandidate, sourceGap, sourceGapLabels } from "./media-source-gaps"
import { MediaOwnerBulkEditor, type OwnerTarget } from "./media-owner-bulk-editor"
import { MediaOwnersSheet } from "./media-owners-sheet"
import type { MediaSourceTarget } from "./bulk-media-sources"
import { Link, useSearchParams } from "react-router"

const types = IMAGE_TYPE_LABELS
const states = imageStates
type Row = Asset & { createdAt: string; updatedAt: string; usage?: MediaUsageSummary | null }
const features = tableFeatures({})
const helper = createColumnHelper<typeof features, Row>()
const empty: Row[] = []
/** Columns that narrow screens drop; phones show the owner under the image name instead. */
const narrowHidden: Record<string, string> = {
  owner: "hidden sm:table-cell",
  source: "hidden md:table-cell",
  usage: "hidden md:table-cell",
  updatedAt: "hidden sm:table-cell",
}
const canSelect = (row: Row) => row.state === "ACTIVE" && !!row.currentVersionId
const sourceTarget = (row: Row): MediaSourceTarget => ({
  assetId: row.id,
  versionId: row.currentVersionId!,
  previewUrl: row.currentUrl,
  label: `${row.sources?.[0]?.label || types[row.semanticType] || row.semanticType} · ${row.id.slice(0, 8)}`,
})

export function ImageManagementPage() {
  const [type, setType] = useState("")
  const [needsCredit, setNeedsCredit] = useState(false)
  const [usage, setUsage] = useState<MediaUsageState | "">("")
  const [marked, setMarked] = useState<Map<string, MediaSourceTarget>>(() => new Map())
  const [bulkTargets, setBulkTargets] = useState<MediaSourceTarget[] | null>(null)
  const [ownerTargets, setOwnerTargets] = useState<OwnerTarget[] | null>(null)
  const [upload, setUpload] = useState(false)
  const [ownersOpen, setOwnersOpen] = useState(false)
  const [uploadType, setUploadType] = useState("HERO_HEAD")
  const wide = useIsWide()
  const [params, setParams] = useSearchParams()
  // The open image lives in the URL (?asset=…), so other pages can link straight to an image's sources.
  const selected = params.get("asset")
  const setSelected = (id: string | null) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (id) next.set("asset", id)
        else next.delete("asset")
        return next
      },
      { preventScrollReset: true },
    )
  const grid = params.get("view") === "grid"
  const writable = useSession().actor?.capabilities.includes("media:write")
  const assets = useInfiniteQuery({
    queryKey: ["managed-images", "infinite", type, needsCredit, usage],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      backendRequest<PageSlice<Row>>(
        `/admin/media/assets?page=${pageParam}&size=20${type ? `&semanticType=${type}` : ""}${needsCredit ? "&needsCredit=true" : ""}${usage ? `&usage=${usage}` : ""}`,
        { signal },
      ),
    getNextPageParam: (page) =>
      page.items.length && (page.page + 1) * page.size < page.totalElements ? page.page + 1 : undefined,
  })
  // The rows appear at once and where each image is used follows, because that answer asks every module.
  const usageById = useQueries({
    queries: usage
      ? []
      : (assets.data?.pages ?? []).map((_, page) => ({
          queryKey: ["managed-images", "usage-page", type, needsCredit, page],
          staleTime: 30_000,
          queryFn: ({ signal }: { signal: AbortSignal }) =>
            backendRequest<PageSlice<Row>>(
              `/admin/media/assets?page=${page}&size=20&withUsage=true${type ? `&semanticType=${type}` : ""}${needsCredit ? "&needsCredit=true" : ""}`,
              { signal },
            ),
        })),
    combine: (pages) => new Map(pages.flatMap((page) => page.data?.items.map((row) => [row.id, row.usage]) ?? [])),
  })
  const rows = useMemo(() => {
    if (!assets.data) return empty
    const unique = new Map<string, Row>()
    for (const page of assets.data.pages)
      for (const row of page.items) unique.set(row.id, { ...row, usage: row.usage ?? usageById.get(row.id) })
    return [...unique.values()]
  }, [assets.data, usageById])
  const total = assets.data?.pages[0]?.totalElements ?? 0
  // One-row count of images that still need a source or owner, for the reminder above the filters.
  const missing = useQuery({
    queryKey: ["managed-images", "missing-count", type],
    queryFn: ({ signal }) =>
      backendRequest<PageSlice<Row>>(
        `/admin/media/assets?page=0&size=1&needsCredit=true${type ? `&semanticType=${type}` : ""}`,
        { signal },
      ),
    enabled: !needsCredit,
    staleTime: 30_000,
  })
  const missingCount = needsCredit ? (assets.data ? total : undefined) : missing.data?.totalElements
  const usageTotals = useQuery({
    queryKey: ["managed-images", "usage-totals", type, needsCredit],
    queryFn: ({ signal }) =>
      backendRequest<MediaUsageTotals>(
        `/admin/media/usage-totals?needsCredit=${needsCredit}${type ? `&semanticType=${type}` : ""}`,
        { signal },
      ),
    staleTime: 30_000,
  })
  function showUsage(next: MediaUsageState | "") {
    setUsage(next)
    setMarked(new Map())
  }
  function showMissing(next: boolean) {
    if (next === needsCredit) return
    setNeedsCredit(next)
    setMarked(new Map())
  }
  const selectable = useMemo(() => rows.filter(canSelect), [rows])
  const allMarked = selectable.length > 0 && selectable.every((row) => marked.has(row.id))
  // Selected images that already name where they came from and only lack an owner.
  const markedOwnerTargets = rows.flatMap((row): OwnerTarget[] => {
    const target = marked.get(row.id)
    const source = sourceGap(row.sources ?? []) === "missing-owner" ? ownerCandidate(row.sources ?? []) : undefined
    return target && source ? [{ target, source }] : []
  })
  const someMarked = selectable.some((row) => marked.has(row.id))
  useEffect(() => {
    setMarked((current) => {
      const next = new Map(current)
      for (const row of rows) {
        const target = next.get(row.id)
        if (target && (!canSelect(row) || row.currentVersionId !== target.versionId)) next.delete(row.id)
      }
      return next.size === current.size ? current : next
    })
  }, [rows])
  function toggleRow(row: Row) {
    if (!canSelect(row)) return
    setMarked((current) => {
      const next = new Map(current)
      if (next.has(row.id)) next.delete(row.id)
      else next.set(row.id, sourceTarget(row))
      return next
    })
  }
  function toggleLoaded() {
    setMarked((current) => {
      const next = new Map(current)
      for (const row of selectable) {
        if (allMarked) next.delete(row.id)
        else if (!next.has(row.id)) next.set(row.id, sourceTarget(row))
      }
      return next
    })
  }
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("id", {
          header: "Ảnh",
          cell: ({ row }) => (
            <div className="flex min-w-0 items-center gap-3">
              <button
                aria-label={`Xem ảnh ${row.original.id}`}
                onClick={() => setSelected(row.original.id)}
                className="group/preview relative shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <LibraryImage url={row.original.currentUrl} className="size-11" />
                <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 text-white opacity-0 transition-opacity group-hover/preview:opacity-100 group-focus-visible/preview:opacity-100">
                  <Eye aria-hidden className="size-4" />
                </span>
              </button>
              <div className="min-w-0 space-y-1">
                <button
                  className="group flex max-w-full items-center gap-1 rounded text-sm font-medium outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setSelected(row.original.id)}
                  aria-label={`Chi tiết ảnh ${row.original.id}`}
                  title={row.original.id}
                >
                  <span className="truncate">{types[row.original.semanticType] ?? row.original.semanticType}</span>
                  <ArrowUpRight
                    aria-hidden
                    className="size-3 shrink-0 text-muted-foreground group-hover:text-primary"
                  />
                </button>
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    {row.original.id.slice(0, 8)}
                  </span>
                  <LibraryStateBadge
                    state={row.original.state}
                    label={states[row.original.state] ?? row.original.state}
                    ready={!!row.original.currentVersionId}
                  />
                </span>
                {/* Phones drop the owner column; the owner stays visible here. */}
                <span className="block sm:hidden">
                  <LibraryOwner
                    sources={row.original.sources}
                    versionId={row.original.currentVersionId}
                    userImage={needsNoCredit(row.original.semanticType)}
                  />
                </span>
                {/* The usage column is hidden on narrow screens, and it is why many people open this list. */}
                <LibraryUsage usage={row.original.usage} className="md:hidden" />
              </div>
            </div>
          ),
        }),
        helper.display({
          id: "owner",
          header: "Chủ sở hữu",
          cell: ({ row }) => (
            <button
              type="button"
              className="block w-full min-w-0 rounded text-left outline-none transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setSelected(row.original.id)}
              aria-label={`Nguồn và ghi công ảnh ${row.original.id}`}
            >
              <LibraryOwner
                sources={row.original.sources}
                versionId={row.original.currentVersionId}
                userImage={needsNoCredit(row.original.semanticType)}
              />
              {/* The source column is hidden on narrow screens, so the source moves under the owner. */}
              {row.original.currentVersionId && (
                <LibrarySource sources={row.original.sources} className="mt-0.5 md:hidden" />
              )}
            </button>
          ),
        }),
        helper.display({
          id: "source",
          header: "Nguồn",
          cell: ({ row }) =>
            row.original.currentVersionId && !needsNoCredit(row.original.semanticType) ? (
              <LibrarySource sources={row.original.sources} className="text-sm" />
            ) : null,
        }),
        helper.display({
          id: "usage",
          header: "Nơi dùng",
          cell: ({ row }) => (
            <button
              type="button"
              className="block w-full min-w-0 rounded text-left outline-none transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setSelected(row.original.id)}
              aria-label={`Nơi dùng ảnh ${row.original.id}`}
            >
              <LibraryUsage usage={row.original.usage} />
            </button>
          ),
        }),
        helper.accessor("updatedAt", {
          header: "Cập nhật",
          cell: ({ row, getValue }) => (
            <span title={`Tạo lúc ${formatInZone(row.original.createdAt, currentTimeZone())}`}>
              <LocalTime
                value={getValue()}
                className="block whitespace-nowrap text-xs tabular-nums"
                label={(zone) => (
                  <>
                    {formatInZone(getValue(), zone, { day: "numeric", month: "numeric", year: "numeric" })}
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {formatInZone(getValue(), zone, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </>
                )}
              />
            </span>
          ),
        }),
      ]),
    [],
  )
  const table = useTable({ features, columns, data: rows, getRowId: (row) => row.id })
  return (
    <Page>
      <PageHeader
        title="Quản lý tệp"
        actions={
          <PageActionsMenu label="Thêm ảnh và tùy chọn thư viện">
            {writable && (
              <>
                <DropdownMenuItem onSelect={() => setUpload(true)}>
                  <Plus />
                  Thêm ảnh
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/media-contact-requests">
                    <Mail />
                    Góp ý Wiki &amp; liên hệ về ảnh
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onSelect={() => setOwnersOpen(true)}>
              <Copyright />
              Chủ sở hữu ảnh
            </DropdownMenuItem>
            <DropdownMenuItem disabled={assets.isFetching} onSelect={() => void assets.refetch()}>
              <RefreshCw aria-hidden className={assets.isFetching ? "motion-safe:animate-spin" : undefined} />
              Làm mới danh sách ảnh
            </DropdownMenuItem>
          </PageActionsMenu>
        }
      >
        <FileTabs current="images" />
      </PageHeader>
      <div className="flex flex-wrap items-center gap-2" role="region" aria-label="Bộ lọc thư viện ảnh">
        {/* One control for the credit filter; its count replaces a separate reminder. */}
        <FilterTabs label="Lọc theo nguồn">
          <FilterTab active={!needsCredit} onClick={() => showMissing(false)}>
            Tất cả ảnh
          </FilterTab>
          <FilterTab
            active={needsCredit}
            onClick={() => showMissing(true)}
            className={missingCount ? "text-amber-700 dark:text-amber-400" : undefined}
          >
            <CircleAlert aria-hidden />
            Thiếu nguồn / chủ sở hữu
            {missingCount !== undefined && (
              <span
                className={`rounded-full px-1.5 text-xs tabular-nums ${missingCount ? "bg-amber-500/15" : "bg-muted text-muted-foreground"}`}
              >
                {missingCount.toLocaleString("vi-VN")}
              </span>
            )}
          </FilterTab>
        </FilterTabs>
        {/* The rest moves below the source filter as one group, so the view switch never ends up alone. */}
        <div className="flex min-w-0 flex-auto flex-wrap items-center gap-2 sm:flex-nowrap">
          <label className="flex min-w-40 flex-1 items-center sm:min-w-0 sm:flex-none">
            <span className="sr-only">Loại ảnh</span>
            <select
              aria-label="Loại ảnh"
              className="h-10 w-full min-w-0 rounded-xl border bg-background px-3 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20 sm:w-48"
              value={type}
              onChange={(e) => {
                setType(e.target.value)
                setMarked(new Map())
              }}
            >
              <option value="">Tất cả loại ảnh</option>
              {Object.entries(types).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-40 flex-1 items-center sm:min-w-0 sm:flex-none">
            <span className="sr-only">Nơi dùng</span>
            <select
              aria-label="Nơi dùng"
              className="h-10 w-full min-w-0 rounded-xl border bg-background px-3 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20 sm:w-52"
              value={usage}
              onChange={(event) => showUsage(event.target.value as MediaUsageState | "")}
            >
              <option value="">Mọi nơi dùng</option>
              {usageStates.map((state) => (
                <option key={state} value={state}>
                  {usageStateLabels[state]}
                  {usageTotals.data ? ` (${usageTotals.data.states[state].toLocaleString("vi-VN")})` : ""}
                </option>
              ))}
            </select>
          </label>
          {(type || needsCredit || usage) && (
            <Button
              size="sm"
              variant="ghost"
              className="h-10 gap-1 px-2"
              onClick={() => {
                setType("")
                setNeedsCredit(false)
                setUsage("")
                setMarked(new Map())
              }}
            >
              <X aria-hidden className="size-3.5" />
              Xóa bộ lọc
            </Button>
          )}
          {/* Phones keep the view switch beside the type filter and move the count to a short line below. */}
          <span
            className="order-last w-full text-xs text-muted-foreground tabular-nums sm:order-none sm:ml-auto sm:w-auto sm:text-sm"
            role="status"
          >
            {assets.isPending ? "Đang tải ảnh…" : `Đã tải ${rows.length} / ${total} ảnh`}
          </span>
          <FilterTabs label="Kiểu xem ảnh" className="ml-auto sm:ml-0">
            {(
              [
                [false, List, "Bảng"],
                [true, LayoutGrid, "Lưới"],
              ] as const
            ).map(([isGrid, Icon, label]) => (
              <FilterTab
                key={label}
                active={grid === isGrid}
                onClick={() =>
                  setParams(
                    (current) => {
                      const next = new URLSearchParams(current)
                      if (isGrid) next.set("view", "grid")
                      else next.delete("view")
                      return next
                    },
                    { replace: true, preventScrollReset: true },
                  )
                }
              >
                <Icon aria-hidden />
                <span className="sr-only sm:not-sr-only">{label}</span>
              </FilterTab>
            ))}
          </FilterTabs>
        </div>
      </div>
      {(usage || usageTotals.data?.competitionChecked === false) && (
        <p role="note" className="type-meta">
          {usage && usageStateHints[usage]}
          {usage && usageTotals.data?.competitionChecked === false && " "}
          {usageTotals.data?.competitionChecked === false &&
            "Chưa tính giải đấu và trang cộng đồng vì chưa đọc được dữ liệu của chúng, nên ảnh chỉ dùng ở đó có thể bị xếp vào nhóm chưa dùng."}
        </p>
      )}
      {assets.error && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm">
          <p role="alert" className="text-destructive">
            {assets.isFetchNextPageError ? "Chưa tải thêm được ảnh. " : ""}
            {errorMessage(assets.error)}
          </p>
          <Button
            variant="outline"
            disabled={assets.isFetching}
            onClick={() => void (assets.isFetchNextPageError ? assets.fetchNextPage() : assets.refetch())}
          >
            Thử tải lại
          </Button>
        </div>
      )}
      {grid && (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,160px),1fr))] gap-3" aria-label="Lưới ảnh">
          {rows.map((row) => (
            <li
              key={row.id}
              className={`group relative min-w-0 overflow-hidden rounded-xl border bg-card transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-sm ${marked.has(row.id) ? "border-primary ring-1 ring-primary" : ""}`}
            >
              <button
                type="button"
                className="block w-full rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                aria-label={`Xem ảnh ${row.id}`}
                onClick={() => setSelected(row.id)}
              >
                <span className="relative block border-b bg-muted/20 p-4">
                  <LibraryImage
                    url={row.currentUrl}
                    className="aspect-[4/3] w-full rounded-none border-0 bg-transparent"
                  />
                  <span className="absolute right-2 bottom-2 flex size-7 items-center justify-center rounded-md bg-background/90 text-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <Eye aria-hidden className="size-3.5" />
                  </span>
                </span>
                <span
                  className="block space-y-1 p-3"
                  title={row.currentVersionId ? creditSummary(row.sources ?? []) : undefined}
                >
                  <span className="flex min-w-0 items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium">{types[row.semanticType] ?? row.semanticType}</span>
                    <LibraryStateBadge
                      state={row.state}
                      label={states[row.state] ?? row.state}
                      ready={!!row.currentVersionId}
                    />
                  </span>
                  <span className="block font-mono text-xs text-muted-foreground">{row.id.slice(0, 8)}</span>
                  <LibraryUsage usage={row.usage} />
                  {/* Only a gap is worth a line; complete credits show on hover and in the details. */}
                  {row.currentVersionId &&
                    !needsNoCredit(row.semanticType) &&
                    sourceGap(row.sources ?? []) !== "none" && (
                      <span className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                        <CircleAlert aria-hidden className="size-3.5 shrink-0" />
                        <span className="truncate">{sourceGapLabels[sourceGap(row.sources ?? [])]}</span>
                      </span>
                    )}
                </span>
              </button>
              {writable && canSelect(row) && (
                <input
                  type="checkbox"
                  className="absolute top-2 left-2 size-4 cursor-pointer accent-primary"
                  aria-label={`Chọn ảnh ${row.id} trong lưới`}
                  checked={marked.has(row.id)}
                  onChange={() => toggleRow(row)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {!grid && (
        <div className="overflow-x-auto admin-panel">
          <table className="w-full table-fixed text-left text-sm" aria-label="Danh sách ảnh">
            <colgroup>
              {writable && <col className="w-10" />}
              <col className="sm:w-[55%] md:w-[30%]" />
              <col className="hidden sm:table-column md:w-[20%]" />
              <col className="hidden md:table-column" />
              <col className="hidden md:table-column md:w-[17%]" />
              <col className="hidden w-28 sm:table-column" />
            </colgroup>
            <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {writable && (
                    <th scope="col" className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        className="size-3.5 cursor-pointer accent-primary"
                        aria-label="Chọn tất cả ảnh đã tải"
                        checked={allMarked}
                        disabled={!selectable.length}
                        onChange={toggleLoaded}
                        ref={(node) => {
                          if (node) node.indeterminate = someMarked && !allMarked
                        }}
                      />
                    </th>
                  )}
                  {group.headers.map((header) => (
                    <th
                      scope="col"
                      key={header.id}
                      className={`px-3 py-2.5 font-medium ${narrowHidden[header.id] ?? ""}`}
                    >
                      <table.FlexRender header={header} />
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-border/60 transition-colors last:border-b-0 hover:bg-muted/35 focus-within:bg-muted/35 ${marked.has(row.id) ? "bg-primary/5" : ""}`}
                >
                  {writable && (
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        className="size-3.5 cursor-pointer accent-primary disabled:cursor-not-allowed"
                        aria-label={`Chọn ảnh ${row.original.id}`}
                        checked={marked.has(row.original.id)}
                        disabled={!canSelect(row.original)}
                        title={canSelect(row.original) ? undefined : "Ảnh chưa tải lên xong hoặc không còn hoạt động."}
                        onChange={() => toggleRow(row.original)}
                      />
                    </td>
                  )}
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id} className={`px-3 py-2.5 ${narrowHidden[cell.column.id] ?? ""}`}>
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {assets.isPending && (
        <div role="status" className="space-y-3 rounded-xl border p-4">
          <span className="sr-only">Đang tải ảnh…</span>
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} aria-hidden className="flex items-center gap-3 motion-safe:animate-pulse">
              <span className="size-11 rounded-lg bg-muted" />
              <span className="h-3 w-24 rounded bg-muted" />
              <span className="ml-auto h-3 w-32 rounded bg-muted" />
            </div>
          ))}
        </div>
      )}
      {!assets.isPending && !assets.error && !rows.length && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-muted/10 px-5 py-12 text-center">
          <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
            <ImageIcon aria-hidden className="size-5 text-muted-foreground" />
          </span>
          <h2 className="type-section-title">{needsCredit ? "Không có ảnh cần bổ sung" : "Chưa có ảnh"}</h2>
          <p className="text-xs text-muted-foreground">
            {needsCredit ? "Không có ảnh thiếu nguồn hoặc ghi công trong bộ lọc này." : "Chưa có ảnh thuộc loại này."}
          </p>
          {(type || needsCredit || usage) && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => {
                setType("")
                setNeedsCredit(false)
                setUsage("")
                setMarked(new Map())
              }}
            >
              Xem tất cả ảnh
            </Button>
          )}
        </div>
      )}
      <InfiniteScroll
        key={`${type}:${needsCredit}:${usage}`}
        query={assets}
        enabled={!selected && !upload && !bulkTargets && !ownerTargets}
        label="Đang tải thêm ảnh…"
      />
      {!assets.isPending && !assets.isError && !assets.hasNextPage && rows.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">Đã tải hết {total} ảnh.</p>
      )}
      {/* Floats at the bottom while scrolling, so the actions stay in reach on long lists and phones. */}
      {writable && marked.size > 0 && (
        <div
          role="region"
          aria-label="Ảnh đã chọn"
          className="sticky bottom-3 z-30 mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-2 rounded-xl border bg-popover px-3 py-2 text-sm shadow-lg animate-in fade-in slide-in-from-bottom-2"
        >
          <span
            className="flex items-center gap-2 font-medium tabular-nums"
            role="status"
            title="Chọn tất cả chỉ áp dụng cho ảnh đã tải. Đổi bộ lọc sẽ bỏ lựa chọn."
          >
            <CheckCheck aria-hidden className="size-4 text-primary" />
            Đã chọn {marked.size} ảnh
          </span>
          <Button size="sm" variant="ghost" disabled={!marked.size} onClick={() => setMarked(new Map())}>
            Bỏ chọn
          </Button>
          {markedOwnerTargets.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setOwnerTargets(markedOwnerTargets)}>
              Bổ sung chủ sở hữu ({markedOwnerTargets.length})
            </Button>
          )}
          <Button size="sm" disabled={!marked.size} onClick={() => setBulkTargets([...marked.values()])}>
            Bổ sung nguồn / ghi công hàng loạt
          </Button>
        </div>
      )}
      {ownersOpen && <MediaOwnersSheet writable={!!writable} onClose={() => setOwnersOpen(false)} />}
      {writable && ownerTargets && (
        <MediaOwnerBulkEditor
          items={ownerTargets}
          onClose={() => setOwnerTargets(null)}
          onSettled={(results) =>
            setMarked((current) => {
              const next = new Map(current)
              for (const result of results) if (result.state === "success") next.delete(result.target.assetId)
              return next
            })
          }
        />
      )}
      {writable && bulkTargets && (
        <MediaBulkSourceEditor
          targets={bulkTargets}
          onClose={() => setBulkTargets(null)}
          onSettled={(results) =>
            setMarked((current) => {
              const next = new Map(current)
              for (const result of results) {
                if (result.state === "success" || result.state === "changed") next.delete(result.target.assetId)
              }
              return next
            })
          }
        />
      )}
      <ImageDetailSheet
        key={selected}
        assetId={selected}
        writable={!!writable}
        wide={wide}
        onClose={() => setSelected(null)}
        onDeleted={(id) =>
          setMarked((current) => {
            const next = new Map(current)
            next.delete(id)
            return next
          })
        }
      />
      <Sheet open={upload} onOpenChange={setUpload}>
        <SheetContent
          side={wide ? "right" : "bottom"}
          className={wide ? "w-[min(480px,94vw)] sm:max-w-none" : "max-h-[90dvh] rounded-t-2xl"}
        >
          <SheetHeader>
            <SheetTitle>Thêm ảnh</SheetTitle>
            <SheetDescription>Chọn loại ảnh rồi tải tệp hoặc dùng liên kết ảnh.</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-6">
            <label className="grid gap-2 text-sm">
              Loại ảnh
              <select className={control} value={uploadType} onChange={(event) => setUploadType(event.target.value)}>
                {/* Avatars are uploaded by their users from the profile, without an owner. */}
                {Object.entries(types)
                  .filter(([key]) => !needsNoCredit(key))
                  .map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
              </select>
            </label>
            <AssetPicker
              key={uploadType}
              semanticType={uploadType}
              value={null}
              onChange={(id) => {
                setUpload(false)
                setSelected(id)
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </Page>
  )
}
