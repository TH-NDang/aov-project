import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@aov/ui/components/button"
import { backendRequest } from "@/app/auth/session"
import { cn } from "@aov/ui/lib/utils"
import { analyzeStat, type statDistribution } from "../../model/assessment/hero-stat-analysis"
import {
  ATTRIBUTE_SOURCE_LABELS,
  formatStat,
  normalizedUnit,
  type AttributeRow,
  type StatSample,
} from "../../model/assessment/combat-attributes"
import { ROLES, type Role } from "@/lib/hero-types"
import { publishingKeys } from "@/lib/api/publishing-api"

function defaultStatus(row: AttributeRow, ready: boolean, error?: boolean) {
  if (!row.reference) {
    if (error) return "Chưa tải được mặc định"
    return ready ? "Chưa có mặc định được xác nhận" : "Đang tải mặc định…"
  }
  if (row.kind === "PATCH_DEFAULT") return "Dùng mặc định"
  if (row.matchesDefault) return "Khớp mặc định"
  if (typeof row.reading?.value === "number" && normalizedUnit(row.key, row.reading.unit) === row.reference.unit)
    return "Khác mặc định"
  return "Có mặc định đối chiếu"
}

function Distribution({ result, unit }: { result: ReturnType<typeof statDistribution>; unit: string }) {
  if (!result.total) return <p className="type-meta">Chưa có tướng khác có số liệu đối chiếu phù hợp.</p>
  return (
    <p className="type-body">
      <strong>
        {result.matches}/{result.total}
      </strong>{" "}
      tướng có cùng giá trị.
      {result.median !== undefined && result.max !== undefined && (
        <>
          {" "}
          Trung vị <strong>{formatStat(result.median, unit)}</strong>. Khoảng ghi nhận {formatStat(result.min, unit)} –{" "}
          {formatStat(result.max, unit)}.
        </>
      )}
      {result.total < 5 && <> Cần ít nhất 5 tướng để xếp mức.</>}
    </p>
  )
}

export function HeroStatAnalysisPanel({
  rows,
  variantId,
  patchCode,
  heroId,
  roles,
  level,
  defaultsReady,
  referenceError,
}: {
  rows: AttributeRow[]
  variantId: string
  patchCode: string
  heroId: string
  roles: Role[]
  level: number | null
  defaultsReady: boolean
  referenceError?: boolean
}) {
  const [sameRole, setSameRole] = useState(false)
  const query = useQuery({
    queryKey: publishingKeys.statSamples(variantId),
    queryFn: ({ signal }) =>
      backendRequest<StatSample[]>(`/admin/patch-variants/${variantId}/hero-stat-samples`, { signal }),
    staleTime: 60000,
  })
  const peers = (query.data ?? []).filter(
    (peer) => peer.heroId !== heroId && (!sameRole || peer.roles.some((role) => roles.includes(role as Role))),
  )
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Nhóm đối chiếu">
        <Button
          type="button"
          size="sm"
          variant={!sameRole ? "secondary" : "ghost"}
          aria-pressed={!sameRole}
          onClick={() => setSameRole(false)}
        >
          Tất cả vai trò
        </Button>
        <Button
          type="button"
          size="sm"
          variant={sameRole ? "secondary" : "ghost"}
          aria-pressed={sameRole}
          disabled={!roles.length}
          onClick={() => setSameRole(true)}
        >
          Cùng vai trò
        </Button>
      </div>
      {query.isPending ? (
        <p role="status" className="type-meta">
          Đang tải mẫu của patch…
        </p>
      ) : query.error ? (
        <div role="alert" className="type-body">
          Chưa tải được nhóm đối chiếu.{" "}
          <Button type="button" size="sm" variant="outline" onClick={() => void query.refetch()}>
            Thử lại
          </Button>
        </div>
      ) : (
        <p className="type-meta">
          Patch {patchCode} · {peers.length} tướng khác
          {sameRole ? ` có chung ít nhất một vai trò (${roles.map((r) => ROLES[r]).join(", ")})` : ""} ·{" "}
          {peers.filter((p) => p.draft).length} bản nháp. Mỗi tướng được tính một lần.
        </p>
      )}
      <div className="divide-y">
        {rows.map((row) => {
          const analysis = query.data && !query.isError ? analyzeStat(row, peers, patchCode, level) : undefined
          const score = analysis?.primary ?? analysis?.secondary
          const rule = row.reference
          const defaultText = defaultStatus(row, defaultsReady, referenceError)
          return (
            <details key={row.key} className="py-1">
              <summary className="type-body cursor-pointer rounded px-1 py-1.5">
                <span className="font-medium">{row.label}</span> · <span className="tabular-nums">{row.value}</span>
                <span className="ml-2 inline-flex flex-wrap items-center gap-1">
                  {rule && <span className="type-label rounded bg-secondary px-1.5 py-0.5">{defaultText}</span>}
                  {score && (
                    <span
                      className={cn(
                        "type-label rounded border px-1.5 py-0.5",
                        score.standing === "HIGH" || score.standing === "LOW"
                          ? "border-primary/40 text-primary"
                          : "text-muted-foreground",
                      )}
                    >
                      {score.label} · {score.total} mẫu
                    </span>
                  )}
                </span>
              </summary>
              <div className="space-y-1.5 pb-2 pl-4">
                <p className="type-meta">
                  {defaultText}
                  {rule && (
                    <>
                      {" "}
                      ·{" "}
                      <a href={rule.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                        {formatStat(rule.baseValue, rule.unit)} từ patch {rule.patchCode}
                      </a>
                    </>
                  )}
                </p>
                {row.reading ? (
                  <p className="type-meta">
                    {ATTRIBUTE_SOURCE_LABELS[row.kind]}
                    {row.kind === "CAPTURED" && (level === null ? " · Chưa xác định cấp tướng" : ` · Cấp ${level}`)}
                  </p>
                ) : (
                  <p className="type-meta">Chưa có số liệu riêng của tướng để xếp mức.</p>
                )}
                {row.reading && analysis?.primary && <Distribution result={analysis.primary} unit={row.reading.unit} />}
                {analysis?.secondary && (
                  <div className="space-y-0.5">
                    <p className="type-label">Tỷ lệ đi kèm · {analysis.secondary.label}</p>
                    <Distribution result={analysis.secondary} unit="PERCENT" />
                  </div>
                )}
              </div>
            </details>
          )
        })}
      </div>
      <details className="type-meta rounded bg-muted/40 px-3 py-2">
        <summary className="cursor-pointer">Cách đọc mức đánh giá</summary>
        <p className="mt-2">
          Chỉ số cơ bản được so với chỉ số cơ bản cùng đơn vị. Số từ ảnh được so với ảnh cùng patch và cùng cấp ghi
          nhận. Khi ảnh thiếu cấp, nhóm đối chiếu chỉ gồm ảnh cũng thiếu cấp. Tài nguyên được so theo loại.
        </p>
        <p className="mt-2">
          Từ 5 mẫu, mức thấp và cao tương ứng với 25% dưới và 25% trên, các giá trị bằng nhau cùng hạng. Hơn nửa nhóm có
          cùng giá trị được ghi là phổ biến, cả nhóm giống nhau là đồng mức. Mặc định của patch cần có nguồn xác nhận.
        </p>
      </details>
    </div>
  )
}
