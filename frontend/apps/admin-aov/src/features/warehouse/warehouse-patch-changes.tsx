import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { warehouseApi } from "./warehouse-api"
import { usePublicationOverview } from "../publishing/publication-overview"
import { Link, useSearchParams } from "react-router"
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table"
import { ExternalLink } from "lucide-react"
import { HeroAsset } from "../publishing/hero-content"
import { CatalogChangeBadges, useCatalogChanges, type CatalogChange, type CatalogBadgeKind } from "./catalog-changes"
import { errorMessage } from "@/lib/api/errors"
import type { WarehouseKind } from "./warehouse-types"
const features = tableFeatures({})
type Row = Omit<CatalogChange, "kinds"> & { kinds: CatalogBadgeKind[] }
const helper = createColumnHelper<typeof features, Row>()
export function WarehousePatchChanges({
  kind,
  rulesetId,
  variantId,
  locale,
}: {
  kind: WarehouseKind
  rulesetId: string
  variantId: string
  locale: string
}) {
  const query = useCatalogChanges(kind, rulesetId, locale)
  const [params] = useSearchParams()
  const showAll = params.get("show") === "all"
  const overview = usePublicationOverview()
  const reviewed = overview.data?.variants.find((v) => v.id === variantId)?.dataReviewState === "COMPLETE"
  const snapshot = useQuery({
    queryKey: ["warehouse", kind, rulesetId, locale, "snapshot", variantId],
    queryFn: ({ signal }) =>
      warehouseApi.list(kind, rulesetId, locale, signal, { patchVariantId: variantId, includeUnchanged: true }),
    enabled: showAll && !!rulesetId,
  })
  const data = useMemo<Row[]>(() => {
    const changes = (query.data ?? []).filter((c) => c.patchVariantId === variantId)
    if (!showAll) return changes
    const byOwner = new Map(changes.map((c) => [c.ownerId, c]))
    const rows: Row[] = (snapshot.data ?? []).map(
      (entry) =>
        byOwner.get(entry.id) ?? {
          id: entry.id,
          domain: kind,
          ownerId: entry.id,
          code: entry.code,
          name:
            entry.content.translations.find((t) => t.locale === locale)?.name ??
            entry.content.translations[0]?.name ??
            entry.code,
          iconAssetId: entry.content.iconAssetId,
          rulesetId,
          patchVariantId: variantId,
          fromRevisionId: null,
          toRevisionId: entry.revision.id,
          kinds: [reviewed ? "UNCHANGED" : "INHERITED"],
          summary: "—",
          actualLocale: locale,
          sourceUrl: null,
          confirmed: false,
          recordedAt: entry.revision.updatedAt,
        },
    )
    const ids = new Set(rows.map((r) => r.ownerId))
    const isChanged = (row: Row) => row.kinds.some((k) => k !== "UNCHANGED" && k !== "INHERITED")
    return [...rows, ...changes.filter((c) => !ids.has(c.ownerId))].sort(
      (a, b) => Number(isChanged(b)) - Number(isChanged(a)) || a.name.localeCompare(b.name, locale),
    )
  }, [query.data, variantId, showAll, snapshot.data, locale, reviewed, kind, rulesetId])
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("name", {
          header: "Mục",
          cell: ({ row }) => (
            <Link
              className="group flex min-w-40 items-center gap-2"
              to={`/${kind}?item=${row.original.ownerId}&patch=${variantId}${showAll ? "&show=all" : ""}`}
            >
              <HeroAsset
                id={row.original.iconAssetId}
                alt=""
                frameAspectRatio={1}
                className="size-9 shrink-0 rounded-full"
              />
              <span>
                <span className="block font-medium">{row.original.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{row.original.code}</span>
              </span>
              <ExternalLink className="ml-auto size-3.5 text-muted-foreground group-hover:text-primary" />
            </Link>
          ),
        }),
        helper.display({
          id: "kind",
          header: "Thay đổi",
          cell: ({ row }) => <CatalogChangeBadges kinds={row.original.kinds} />,
        }),
        helper.display({
          id: "summary",
          header: "Ghi nhận",
          cell: ({ row }) => (
            <div className="min-w-56 max-w-lg space-y-1">
              <p className="whitespace-pre-wrap">
                {row.original.summary ??
                  (row.original.kinds.includes("DATA_BASELINE")
                    ? "Dữ liệu nền; chưa xác định thời điểm được thêm vào game."
                    : "Snapshot cập nhật; chưa có đánh giá được xác nhận.")}
              </p>
              {row.original.sourceUrl && (
                <a
                  href={row.original.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary"
                >
                  Nguồn
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          ),
        }),
      ]),
    [kind, variantId, showAll],
  )
  const table = useTable({ features, columns, data, getRowId: (row) => row.id })
  if (query.isPending || (showAll && snapshot.isPending))
    return (
      <p role="status" className="p-4 text-sm">
        Đang tải lịch sử…
      </p>
    )
  if (query.error || (showAll && snapshot.error))
    return (
      <p role="alert" className="p-4 text-sm text-destructive">
        {errorMessage(query.error ?? snapshot.error)}
      </p>
    )
  if (!data.length)
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Chưa ghi nhận thay đổi trong nhóm này tại patch đã chọn. Dữ liệu đã có vẫn được kế thừa; không tạo bản sao cho
        mỗi patch.
      </p>
    )
  return (
    <div className="overflow-x-auto">
      {showAll && (
        <p className="px-3 py-2 text-xs text-muted-foreground">
          {data.length} mục tại mốc ·{" "}
          {data.filter((r) => !r.kinds.includes("UNCHANGED") && !r.kinds.includes("INHERITED")).length} mục có ghi nhận.
          Các mục còn lại kế thừa dữ liệu trước đó{reviewed ? "." : "; patch chưa hoàn tất rà soát."}
        </p>
      )}
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((h) => (
                <th key={h.id} className="px-3 py-2 text-left">
                  <table.FlexRender header={h} />
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-t">
              {row.getAllCells().map((cell) => (
                <td key={cell.id} className="px-3 py-3 align-top">
                  <table.FlexRender cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
