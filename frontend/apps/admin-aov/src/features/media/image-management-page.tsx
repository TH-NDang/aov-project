import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table"
import { ArrowUpRight, ImageIcon, Plus, RefreshCw } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Badge } from "@aov/ui/components/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@aov/ui/components/sheet"
import { Page, PageHeader } from "@/components/page-header"
import { useIsWide } from "@/hooks/use-media-query"
import { useSession } from "@/app/auth/auth-gate"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { AssetPicker } from "../publishing/asset-picker"
import { upgradeHeroImage } from "../publishing/publishing-api"
import { control } from "../publishing/fields"
import type { Asset, PageSlice } from "../publishing/types"

const types: Record<string, string> = {
  USER_AVATAR: "Avatar người dùng",
  HERO_HEAD: "Đại diện tướng",
  HERO_PORTRAIT: "Chân dung tướng",
  HERO_SPLASH: "Ảnh nền tướng",
  HERO_SKILL_ICON: "Icon kỹ năng",
  HERO_SKIN_ART: "Trang phục",
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
  provenance: { id: string; label: string; url: string | null; note: string | null }[]
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

export function ImageManagementPage() {
  const [type, setType] = useState("")
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [upload, setUpload] = useState(false)
  const [uploadType, setUploadType] = useState("HERO_HEAD")
  const [upgrading, setUpgrading] = useState(false)
  const [upgradeError, setUpgradeError] = useState("")
  const wide = useIsWide()
  const writable = useSession().actor?.capabilities.includes("media:write")
  const cache = useQueryClient()
  const assets = useQuery({
    queryKey: ["managed-images", type, page],
    queryFn: () =>
      backendRequest<PageSlice<Row>>(`/admin/media/assets?page=${page}&size=20${type ? `&semanticType=${type}` : ""}`),
  })
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
          cell: ({ getValue }) => <Badge variant="secondary">{states[getValue()] ?? getValue()}</Badge>,
        }),
        helper.display({
          id: "ready",
          header: "Nội dung",
          cell: ({ row }) => (row.original.currentVersionId ? "Đã có ảnh" : "Chưa hoàn tất upload"),
        }),
        helper.accessor("createdAt", { header: "Ngày tạo", cell: ({ getValue }) => date(getValue()) }),
        helper.accessor("updatedAt", { header: "Cập nhật", cell: ({ getValue }) => date(getValue()) }),
      ]),
    [],
  )
  const table = useTable({ features, columns, data: assets.data?.items ?? empty, getRowId: (row) => row.id })
  const current = details.data?.versions.find((version) => version.current)
  async function upgrade(file: File) {
    if (!selected) return
    setUpgrading(true)
    setUpgradeError("")
    try {
      await upgradeHeroImage(backendRequest, selected, file)
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["managed-image", selected] }),
        cache.invalidateQueries({ queryKey: ["managed-images"] }),
        cache.invalidateQueries({ queryKey: ["publishing-assets"] }),
      ])
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
              setPage(0)
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
        <span className="text-sm text-muted-foreground">{assets.data?.totalElements ?? 0} ảnh</span>
      </div>
      {assets.error && (
        <p role="alert" className="text-destructive">
          {errorMessage(assets.error)}
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="bg-muted/50">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
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
              <tr key={row.id} className="border-t hover:bg-muted/30">
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
          !assets.data?.items.length && (
            <p className="p-8 text-center text-muted-foreground">Chưa có ảnh thuộc loại này.</p>
          )
        )}
      </div>
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" disabled={!page || assets.isFetching} onClick={() => setPage(page - 1)}>
          Trước
        </Button>
        <span className="text-sm">Trang {page + 1}</span>
        <Button
          variant="outline"
          disabled={!assets.data || (page + 1) * 20 >= assets.data.totalElements || assets.isFetching}
          onClick={() => setPage(page + 1)}
        >
          Sau
        </Button>
      </div>
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
                  {!details.data.provenance.length && (
                    <p className="text-sm text-muted-foreground">Chưa có thông tin nguồn.</p>
                  )}
                  {details.data.provenance.map((source) => (
                    <div key={source.id} className="break-words rounded-lg border p-3 text-sm">
                      <p>{source.label}</p>
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
                void cache.invalidateQueries({ queryKey: ["managed-images"] })
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </Page>
  )
}
