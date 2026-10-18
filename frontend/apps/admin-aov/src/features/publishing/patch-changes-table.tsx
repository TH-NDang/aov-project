import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table"
import { ArrowUpRight, Pin } from "lucide-react"
import { Link } from "react-router"
import { Button } from "@aov/ui/components/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@aov/ui/components/sheet"
import { backendRequest } from "@/app/auth/session"
import { useIsWide } from "@/hooks/use-media-query"
import { errorMessage } from "@/lib/api/errors"
import { MarketBadge } from "./market-badge"
import { dateLabel, phaseLabels, type PublicationOverview } from "./publication-overview"
interface Change {
  id: string
  type: string
  changeKind: string
  [key: string]: unknown
}
interface ChangeSet {
  id: string
  heroId: string
  heroCode: string
  toHeroRevisionId: string
  summary?: string
  actualLocale?: string
  changes: Change[]
}
const empty: ChangeSet[] = []
const features = tableFeatures({})
const helper = createColumnHelper<typeof features, ChangeSet>()
const kinds: Record<string, string> = {
  BUFF: "Tăng sức mạnh",
  NERF: "Giảm sức mạnh",
  ADJUST: "Điều chỉnh",
  ADJUSTMENT: "Điều chỉnh",
  REWORK: "Làm lại",
  FIX: "Sửa lỗi",
  BUG_FIX: "Sửa lỗi",
  ADD: "Bổ sung",
  REMOVE: "Loại bỏ",
  OTHER: "Khác",
}
const fields: Record<string, string> = {
  statKey: "Chỉ số",
  skillKey: "Kỹ năng",
  fieldKey: "Trường",
  oldValue: "Trước",
  newValue: "Sau",
  description: "Nội dung",
  roleCode: "Vai trò",
  added: "Bổ sung",
  mechanicKey: "Cơ chế",
  mediaRole: "Loại ảnh",
  oldAssetId: "Ảnh trước",
  newAssetId: "Ảnh sau",
  unit: "Đơn vị",
}
export function PatchChangesTable({
  variantId,
  overview,
  locale,
}: {
  variantId: string
  overview: PublicationOverview
  locale: string
}) {
  const [selected, setSelected] = useState<ChangeSet | null>(null)
  const wide = useIsWide()
  const query = useQuery({
    queryKey: ["patch-changes", variantId, locale],
    queryFn: () =>
      backendRequest<ChangeSet[]>(
        `/admin/patch-variants/${variantId}/hero-changes?locale=${encodeURIComponent(locale)}`,
      ),
  })
  const markets = overview.releases.filter((r) => r.variantId === variantId && r.status === "SCHEDULED")
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("heroCode", {
          header: () => (
            <span className="flex items-center gap-2">
              <Pin className="size-3.5" />
              Mã
            </span>
          ),
          cell: ({ row }) => (
            <div className="group flex items-center justify-between gap-3">
              <span className="font-medium">{row.original.heroCode}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                aria-label={`Xem thay đổi ${row.original.heroCode}`}
                onClick={() => setSelected(row.original)}
              >
                <ArrowUpRight className="size-4" />
              </Button>
            </div>
          ),
        }),
        helper.display({ id: "domain", header: "Loại", cell: () => "Tướng" }),
        helper.display({
          id: "kind",
          header: "Thay đổi",
          cell: ({ row }) =>
            [...new Set(row.original.changes.map((c) => kinds[c.changeKind] ?? c.changeKind))].join(", "),
        }),
        helper.display({
          id: "summary",
          header: "Nội dung",
          cell: ({ row }) => (
            <div>
              <p className="max-w-lg whitespace-pre-wrap">
                {row.original.summary || `${row.original.changes.length} mục thay đổi`}
              </p>
              {row.original.actualLocale && row.original.actualLocale !== locale && (
                <span className="text-xs text-muted-foreground">Ngôn ngữ dự phòng: {row.original.actualLocale}</span>
              )}
            </div>
          ),
        }),
        helper.display({
          id: "markets",
          header: "Thị trường",
          cell: () => (
            <div className="flex flex-wrap gap-1">
              {markets.map((r) => {
                const m = overview.markets.find((m) => m.id === r.regionId)!
                return (
                  <MarketBadge
                    key={r.id}
                    code={m.code}
                    name={m.displayName}
                    detail={`${phaseLabels[r.phase]} · ${dateLabel(r.effectiveOn ?? r.effectiveAt, locale)}`}
                  />
                )
              })}
            </div>
          ),
        }),
      ]),
    [overview, variantId, locale],
  )
  const table = useTable({ features, columns, data: query.data ?? empty, getRowId: (row) => row.id })
  return (
    <div className="space-y-3">
      {query.isPending ? (
        <p role="status" className="p-4 text-sm">
          Đang tải thay đổi…
        </p>
      ) : query.error ? (
        <div role="alert" className="p-4 text-sm text-destructive">
          {errorMessage(query.error)}{" "}
          <Button variant="ghost" onClick={() => void query.refetch()}>
            Thử lại
          </Button>
        </div>
      ) : !query.data?.length ? (
        <p className="p-4 text-sm text-muted-foreground">
          Chưa ghi nhận thay đổi gameplay. Dữ liệu nền được import không tự tạo lịch sử thay đổi.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted">
              <tr>
                {table.getHeaderGroups()[0]?.headers.map((h) => (
                  <th
                    key={h.id}
                    className={`px-4 py-3 text-left ${h.column.id === "heroCode" ? "sticky left-0 z-10 min-w-40 bg-muted" : ""}`}
                  >
                    <table.FlexRender header={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-t">
                  {row.getAllCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={`px-4 py-3 ${cell.column.id === "heroCode" ? "sticky left-0 z-10 border-r bg-card" : ""}`}
                    >
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      >
        <SheetContent
          side={wide ? "right" : "bottom"}
          className={wide ? "w-[560px] sm:max-w-[560px]" : "max-h-[85dvh] rounded-t-2xl"}
        >
          <SheetHeader>
            <SheetTitle>{selected?.heroCode}</SheetTitle>
            <SheetDescription>{selected?.summary || "Chi tiết thay đổi gameplay đã ghi nhận"}</SheetDescription>
          </SheetHeader>
          <div className="space-y-3 overflow-y-auto px-4 pb-6">
            {selected?.changes.map((c) => (
              <div key={c.id} className="space-y-2 rounded-lg border p-4">
                <h3 className="font-medium">{kinds[c.changeKind] ?? c.changeKind}</h3>
                <dl className="space-y-2 text-sm">
                  {Object.entries(fields)
                    .filter(([key]) => c[key] !== undefined && c[key] !== null)
                    .map(([key, label]) => (
                      <div key={key}>
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="whitespace-pre-wrap break-words">{String(c[key])}</dd>
                      </div>
                    ))}
                </dl>
              </div>
            ))}
            {selected && (
              <Button asChild>
                <Link to={`/publishing/${selected.heroId}?revision=${selected.toHeroRevisionId}`}>
                  Mở bản tướng <ArrowUpRight className="size-4" />
                </Link>
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
