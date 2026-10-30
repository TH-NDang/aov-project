import { useEffect, useMemo, useState } from "react"
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query"
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table"
import { ArrowUpRight, ImageIcon, LayoutGrid, List, Plus, RefreshCw } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Badge } from "@aov/ui/components/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@aov/ui/components/sheet"
import { Page, PageHeader } from "@/components/page-header"
import { InfiniteScroll } from "@/components/infinite-scroll"
import { useIsWide } from "@/hooks/use-media-query"
import { useSession } from "@/app/auth/auth-gate"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { AssetPicker } from "../publishing/asset-picker"
import { upgradeHeroImage } from "../publishing/publishing-api"
import { control } from "../publishing/fields"
import type { Asset, PageSlice } from "../publishing/types"
import { invalidateMediaAsset } from "./media-cache"
import { MediaSourceEditor } from "./media-source-editor"
import { MediaSourceFields } from "./media-source-fields"
import { MediaSourceStatus } from "./media-source-status"
import { MediaBulkSourceEditor } from "./media-bulk-source-editor"
import type { MediaSourceTarget } from "./bulk-media-sources"
import { creditHttpUrl, currentMediaSources, needsMediaCredit, type MediaSourceInput } from "@aov/ui/lib/media-credit"
import { Link, useSearchParams } from "react-router"

const types: Record<string, string> = {
  USER_AVATAR: "Avatar người dùng",
  HERO_HEAD: "Đại diện tướng",
  HERO_PORTRAIT: "Chân dung tướng",
  HERO_SPLASH: "Ảnh nền tướng",
  HERO_SKILL_ICON: "Icon kỹ năng",
  HERO_SKIN_ART: "Trang phục",
  SKIN_BADGE: "Icon bậc / nhãn trang phục",
  ITEM_ICON: "Trang bị",
  ARCANA_ICON: "Ngọc",
  SPELL_ICON: "Phụ trợ",
  ENCHANTMENT_ICON: "Phù hiệu",
  PATCH_ART: "Ảnh bản cập nhật",
  OTHER: "Khác",
}
const states: Record<string, string> = {
  ACTIVE: "Hoạt động",
  DEPRECATED: "Ngừng sử dụng",
  BLOCKED: "Bị khóa",
  READY: "Sẵn sàng",
  CURRENT: "Đang sử dụng",
  DRAFT: "Bản nháp",
  HISTORICAL: "Lịch sử",
}
type Row = Asset & { createdAt: string; updatedAt: string }
interface Version {
  id: string
  versionNo: number
  state: string
  mimeType: string
  width: number
  height: number
  sizeBytes: number
  sha256: string
  url: string
  current: boolean
  createdAt: string
}
interface Details extends Omit<Row, "currentUrl"> {
  versions: Version[]
  provenance: {
    id: string
    versionId: string | null
    label: string
    url: string | null
    note: string | null
    ownerName?: string | null
    contactUrl?: string | null
  }[]
}
interface Usage {
  counts: { current: number; draft: number; historical: number }
  items: { ownerDomain: string; ownerType: string; ownerId: string; propertyRole: string; scope: string }[]
}
const features = tableFeatures({})
const helper = createColumnHelper<typeof features, Row>()
const empty: Row[] = []
const date = (value: string) => new Date(value).toLocaleString("vi-VN")
const safeUrl = (url: string | null) => (url && /^https?:\/\//i.test(url) ? url : undefined)
const canSelect = (row: Row) => row.state === "ACTIVE" && !!row.currentVersionId
const sourceTarget = (row: Row): MediaSourceTarget => ({
  assetId: row.id,
  versionId: row.currentVersionId!,
  previewUrl: row.currentUrl,
  label: `${row.sources?.[0]?.label || types[row.semanticType] || row.semanticType} · ${row.id.slice(0, 8)}`,
})

export function ImageManagementPage() {
  const [upgradeSource, setUpgradeSource] = useState<MediaSourceInput>({
    type: "OTHER",
    label: "Ảnh do biên tập viên cung cấp",
  })
  const [type, setType] = useState("")
  const [needsCredit, setNeedsCredit] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [marked, setMarked] = useState<Map<string, MediaSourceTarget>>(() => new Map())
  const [bulkTargets, setBulkTargets] = useState<MediaSourceTarget[] | null>(null)
  const [upload, setUpload] = useState(false)
  const [uploadType, setUploadType] = useState("HERO_HEAD")
  const [upgrading, setUpgrading] = useState(false)
  const [upgradeError, setUpgradeError] = useState("")
  const wide = useIsWide()
  const [params, setParams] = useSearchParams()
  const grid = params.get("view") === "grid"
  const writable = useSession().actor?.capabilities.includes("media:write")
  const cache = useQueryClient()
  const assets = useInfiniteQuery({
    queryKey: ["managed-images", "infinite", type, needsCredit],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      backendRequest<PageSlice<Row>>(
        `/admin/media/assets?page=${pageParam}&size=20${type ? `&semanticType=${type}` : ""}${needsCredit ? "&needsCredit=true" : ""}`,
        { signal },
      ),
    getNextPageParam: (page) =>
      page.items.length && (page.page + 1) * page.size < page.totalElements ? page.page + 1 : undefined,
  })
  const rows = useMemo(() => {
    if (!assets.data) return empty
    const unique = new Map<string, Row>()
    for (const page of assets.data.pages) for (const row of page.items) unique.set(row.id, row)
    return [...unique.values()]
  }, [assets.data])
  const total = assets.data?.pages[0]?.totalElements ?? 0
  const selectable = useMemo(() => rows.filter(canSelect), [rows])
  const allMarked = selectable.length > 0 && selectable.every((row) => marked.has(row.id))
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
  const details = useQuery({
    queryKey: ["managed-image", selected],
    enabled: !!selected,
    queryFn: () => backendRequest<Details>(`/admin/media/assets/${selected}`),
  })
  const usages = useQuery({
    queryKey: ["managed-image-usages", selected],
    enabled: !!selected,
    queryFn: () => backendRequest<Usage>(`/admin/media/assets/${selected}/usages`),
  })
  const columns = useMemo(
    () =>
      helper.columns([
        helper.display({
          id: "preview",
          header: "Ảnh",
          cell: ({ row }) => (
            <button
              aria-label={`Xem ảnh ${row.original.id}`}
              onClick={() => setSelected(row.original.id)}
              className="flex size-12 items-center justify-center overflow-hidden rounded-md border bg-muted"
            >
              {row.original.currentUrl ? (
                <img src={row.original.currentUrl} alt="" className="size-full object-contain" loading="lazy" />
              ) : (
                <ImageIcon className="size-5 text-muted-foreground" />
              )}
            </button>
          ),
        }),
        helper.accessor("id", {
          header: "Mã ảnh",
          cell: ({ row }) => (
            <button
              className="group flex items-center gap-2 font-mono text-xs hover:text-primary"
              onClick={() => setSelected(row.original.id)}
              aria-label={`Chi tiết ảnh ${row.original.id}`}
            >
              <span>{row.original.id.slice(0, 8)}</span>
              <ArrowUpRight className="size-4 opacity-60 group-hover:opacity-100" />
            </button>
          ),
        }),
        helper.accessor("semanticType", {
          header: "Loại ảnh",
          cell: ({ getValue }) => types[getValue()] ?? getValue(),
        }),
        helper.accessor("state", {
          header: "Trạng thái",
          cell: ({ row, getValue }) =>
            row.original.currentVersionId ? (
              <Badge variant="secondary">{states[getValue()] ?? getValue()}</Badge>
            ) : (
              <Badge variant="outline">Chưa hoàn tất upload</Badge>
            ),
        }),
        helper.display({
          id: "source",
          header: "Nguồn ảnh",
          cell: ({ row }) => (
            <button
              type="button"
              className="text-left"
              onClick={() => setSelected(row.original.id)}
              aria-label={`Nguồn và credit ảnh ${row.original.id}`}
            >
              <MediaSourceStatus sources={row.original.sources} versionId={row.original.currentVersionId} />
            </button>
          ),
        }),
        helper.accessor("updatedAt", {
          header: "Cập nhật",
          cell: ({ row, getValue }) => (
            <span title={`Tạo lúc ${date(row.original.createdAt)}`}>{date(getValue())}</span>
          ),
        }),
      ]),
    [],
  )
  const table = useTable({ features, columns, data: rows, getRowId: (row) => row.id })
  const current = details.data?.versions.find((version) => version.current)
  const currentSources = currentMediaSources(details.data?.provenance ?? [], details.data?.currentVersionId)
  async function upgrade(file: File) {
    if (!selected) return
    setUpgrading(true)
    setUpgradeError("")
    try {
      if (
        !upgradeSource.label.trim() ||
        (upgradeSource.url && !creditHttpUrl(upgradeSource.url)) ||
        (upgradeSource.contactUrl && !creditHttpUrl(upgradeSource.contactUrl))
      )
        throw new Error("Điền tên nguồn và URL HTTP(S) hợp lệ.")
      await upgradeHeroImage(backendRequest, selected, file, fetch, upgradeSource)
      await invalidateMediaAsset(cache, selected)
    } catch (cause) {
      setUpgradeError(errorMessage(cause))
    } finally {
      setUpgrading(false)
    }
  }
  return (
    <Page>
      <PageHeader
        title="Quản lý ảnh"
        actions={
          <div className="flex gap-2">
            {writable && (
              <Button variant="outline" asChild>
                <Link to="/media-contact-requests">Liên hệ về ảnh</Link>
              </Button>
            )}
            <Button
              variant="outline"
              aria-label="Làm mới danh sách ảnh"
              onClick={() => void assets.refetch()}
              disabled={assets.isFetching}
            >
              <RefreshCw className="size-4" />
            </Button>
            {writable && (
              <Button onClick={() => setUpload(true)}>
                <Plus className="size-4" />
                Thêm ảnh
              </Button>
            )}
          </div>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          Loại ảnh
          <select
            className={control}
            value={type}
            onChange={(e) => {
              setType(e.target.value)
              setMarked(new Map())
            }}
          >
            <option value="">Tất cả</option>
            {Object.entries(types).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={needsCredit}
            onChange={(event) => {
              setNeedsCredit(event.target.checked)
              setMarked(new Map())
            }}
            className="size-4 accent-primary"
          />
          Chỉ ảnh thiếu nguồn hoặc credit
        </label>
        <span className="ml-auto text-sm text-muted-foreground" role="status">
          {assets.isPending ? "Đang tải ảnh…" : `Đã tải ${rows.length} / ${total} ảnh`}
        </span>
        <div className="inline-flex rounded-lg border p-0.5" role="group" aria-label="Kiểu xem ảnh">
          {(
            [
              [false, List, "Bảng"],
              [true, LayoutGrid, "Lưới"],
            ] as const
          ).map(([isGrid, Icon, label]) => (
            <Button
              key={label}
              type="button"
              size="sm"
              variant={grid === isGrid ? "secondary" : "ghost"}
              aria-pressed={grid === isGrid}
              className="h-7 gap-1.5 px-2"
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
              <Icon className="size-4" />
              {label}
            </Button>
          ))}
        </div>
      </div>
      {writable && marked.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/95 p-3 shadow-sm">
          <div className="text-sm">
            <p className="font-medium" role="status">
              Đã chọn {marked.size} ảnh
            </p>
            <p className="text-xs text-muted-foreground">
              Chọn tất cả chỉ áp dụng cho ảnh đã tải. Đổi bộ lọc sẽ bỏ lựa chọn.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!marked.size} onClick={() => setMarked(new Map())}>
              Bỏ chọn
            </Button>
            <Button disabled={!marked.size} onClick={() => setBulkTargets([...marked.values()])}>
              Bổ sung nguồn / credit hàng loạt
            </Button>
          </div>
        </div>
      )}
      {assets.error && (
        <div className="flex flex-wrap items-center gap-3">
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
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6" aria-label="Lưới ảnh">
          {rows.map((row) => (
            <li
              key={row.id}
              className={`group relative overflow-hidden rounded-xl border bg-card ${marked.has(row.id) ? "ring-2 ring-primary" : ""}`}
            >
              <button
                type="button"
                className="block w-full text-left"
                aria-label={`Xem ảnh ${row.id}`}
                onClick={() => setSelected(row.id)}
              >
                <span className="flex aspect-square items-center justify-center bg-muted/40 p-2">
                  {row.currentUrl ? (
                    <img src={row.currentUrl} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
                  ) : (
                    <ImageIcon className="size-6 text-muted-foreground" />
                  )}
                </span>
                <span className="block space-y-1 p-2">
                  <span className="block truncate text-xs font-medium">
                    {types[row.semanticType] ?? row.semanticType}
                  </span>
                  <MediaSourceStatus sources={row.sources} versionId={row.currentVersionId} />
                </span>
              </button>
              {writable && canSelect(row) && (
                <input
                  type="checkbox"
                  className="absolute top-2 left-2 size-4 accent-primary"
                  aria-label={`Chọn ảnh ${row.id} trong lưới`}
                  checked={marked.has(row.id)}
                  onChange={() => toggleRow(row)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      <div className={`overflow-x-auto rounded-xl border bg-card ${grid ? "hidden" : ""}`}>
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-muted/50">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {writable && (
                  <th className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
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
                  <th key={header.id} className="px-4 py-3 font-medium">
                    <table.FlexRender header={header} />
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className={`border-t hover:bg-muted/30 ${marked.has(row.id) ? "bg-muted/40" : ""}`}>
                {writable && (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      aria-label={`Chọn ảnh ${row.original.id}`}
                      checked={marked.has(row.original.id)}
                      disabled={!canSelect(row.original)}
                      title={canSelect(row.original) ? undefined : "Ảnh chưa hoàn tất upload hoặc không còn hoạt động."}
                      onChange={() => toggleRow(row.original)}
                    />
                  </td>
                )}
                {row.getAllCells().map((cell) => (
                  <td key={cell.id} className="whitespace-nowrap px-4 py-3">
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {assets.isPending ? (
          <p role="status" className="p-8 text-center">
            Đang tải ảnh…
          </p>
        ) : (
          !assets.error &&
          !rows.length && (
            <p className="p-8 text-center text-muted-foreground">
              {needsCredit ? "Không có ảnh thiếu nguồn hoặc credit trong bộ lọc này." : "Chưa có ảnh thuộc loại này."}
            </p>
          )
        )}
      </div>
      <InfiniteScroll
        key={`${type}:${needsCredit}`}
        query={assets}
        enabled={!selected && !upload && !bulkTargets}
        label="Đang tải thêm ảnh…"
      />
      {!assets.isPending && !assets.isError && !assets.hasNextPage && rows.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">Đã tải hết {total} ảnh.</p>
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
      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !upgrading) {
            setSelected(null)
            setUpgradeError("")
          }
        }}
      >
        <SheetContent
          side={wide ? "right" : "bottom"}
          className={wide ? "w-[640px] sm:max-w-[640px]" : "max-h-[90dvh] rounded-t-2xl"}
        >
          <SheetHeader>
            <SheetTitle>Chi tiết ảnh</SheetTitle>
            <SheetDescription className="break-all">{selected}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-6">
            {details.isPending && <p role="status">Đang tải chi tiết…</p>}
            {details.error && <p role="alert">{errorMessage(details.error)}</p>}
            {details.data && (
              <>
                {current ? (
                  <img
                    src={current.url}
                    alt={types[details.data.semanticType] ?? "Ảnh đã chọn"}
                    className="max-h-80 w-full rounded-lg bg-muted object-contain"
                  />
                ) : (
                  <p className="rounded-lg bg-muted p-6 text-center">Ảnh chưa có phiên bản đang sử dụng.</p>
                )}
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  {[
                    ["Loại ảnh", types[details.data.semanticType] ?? details.data.semanticType],
                    ["Trạng thái", states[details.data.state] ?? details.data.state],
                    ["Ngày tạo", date(details.data.createdAt)],
                    ["Cập nhật", date(details.data.updatedAt)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="mt-1 font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
                <section className="space-y-2">
                  <h3 className="font-semibold">Phiên bản ({details.data.versions.length})</h3>
                  {writable && (
                    <MediaSourceFields value={upgradeSource} onChange={setUpgradeSource} disabled={upgrading} />
                  )}
                  {writable && details.data.state === "ACTIVE" && (
                    <label className="grid gap-2 rounded-lg bg-muted/30 p-3 text-sm">
                      Nâng chất lượng ảnh
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={upgrading}
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (file) void upgrade(file)
                          event.target.value = ""
                        }}
                      />
                      <span className="text-xs text-muted-foreground">
                        Dùng bản rõ hơn của cùng hình minh họa. Hình khác cần tạo ảnh mới.
                      </span>
                    </label>
                  )}
                  {upgrading && (
                    <p role="status" className="text-sm">
                      Đang tải phiên bản mới, hãy giữ trang mở…
                    </p>
                  )}
                  {upgradeError && (
                    <p role="alert" className="text-sm text-destructive">
                      {upgradeError}
                    </p>
                  )}
                  {details.data.versions.map((version) => (
                    <div key={version.id} className="space-y-2 rounded-lg border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span>Phiên bản {version.versionNo}</span>
                        <Badge variant="secondary">
                          {version.current ? "Đang sử dụng" : (states[version.state] ?? version.state)}
                        </Badge>
                      </div>
                      <p>
                        {version.width} × {version.height} · {(version.sizeBytes / 1024).toFixed(1)} KB ·{" "}
                        {version.mimeType}
                      </p>
                      <p className="text-muted-foreground">{date(version.createdAt)}</p>
                      {safeUrl(version.url) && (
                        <a
                          href={safeUrl(version.url)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline"
                        >
                          Mở ảnh gốc
                        </a>
                      )}
                    </div>
                  ))}
                </section>
                <section className="space-y-2">
                  <h3 className="font-semibold">Nguồn ảnh</h3>
                  <MediaSourceStatus sources={currentSources} versionId={details.data.currentVersionId} />
                  {details.data.currentVersionId && needsMediaCredit(currentSources) && (
                    <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                      Nguồn hoặc chủ sở hữu / credit của phiên bản đang dùng chưa đầy đủ. Thông tin đã biết được giữ lại
                      để đối chiếu; bạn có thể bổ sung bên dưới sau khi xác minh.
                    </p>
                  )}
                  {details.data.currentVersionId && (
                    <MediaSourceEditor
                      key={details.data.currentVersionId}
                      assetId={details.data.id}
                      versionId={details.data.currentVersionId}
                    />
                  )}
                  {!currentSources.length && <p className="text-sm text-muted-foreground">Chưa có thông tin nguồn.</p>}
                  {currentSources.map((source) => (
                    <div key={source.id} className="break-words rounded-lg border p-3 text-sm">
                      <p>{source.label}</p>
                      <p className="text-muted-foreground">
                        Chủ sở hữu / credit: {source.ownerName || "Chưa xác nhận"}
                      </p>
                      {source.note && <p className="mt-1 text-muted-foreground">{source.note}</p>}
                      {safeUrl(source.url) && (
                        <a
                          href={safeUrl(source.url)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline"
                        >
                          Xem nguồn
                        </a>
                      )}
                    </div>
                  ))}
                </section>
              </>
            )}
            <section className="space-y-2">
              <h3 className="font-semibold">Nơi sử dụng</h3>
              {usages.isPending && <p role="status">Đang kiểm tra…</p>}
              {usages.error && <p role="alert">{errorMessage(usages.error)}</p>}
              {usages.data && (
                <>
                  <p className="text-sm text-muted-foreground">
                    {usages.data.counts.current} hiện tại · {usages.data.counts.draft} bản nháp ·{" "}
                    {usages.data.counts.historical} lịch sử
                  </p>
                  {!usages.data.items.length && <p className="text-sm">Chưa có nơi tham chiếu ảnh này.</p>}
                  {usages.data.items.map((usage, index) => (
                    <div key={index} className="break-all rounded-lg border p-3 text-sm">
                      <p>
                        {usage.ownerDomain} · {usage.propertyRole} · {states[usage.scope] ?? usage.scope}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {usage.ownerType} · {usage.ownerId}
                      </p>
                    </div>
                  ))}
                </>
              )}
            </section>
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={upload} onOpenChange={setUpload}>
        <SheetContent
          side={wide ? "right" : "bottom"}
          className={wide ? "w-[520px] sm:max-w-[520px]" : "max-h-[90dvh] rounded-t-2xl"}
        >
          <SheetHeader>
            <SheetTitle>Thêm ảnh</SheetTitle>
            <SheetDescription>Chọn loại ảnh rồi tải file hoặc dùng link ảnh.</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-6">
            <label className="grid gap-2 text-sm">
              Loại ảnh
              <select className={control} value={uploadType} onChange={(event) => setUploadType(event.target.value)}>
                {Object.entries(types).map(([key, label]) => (
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
