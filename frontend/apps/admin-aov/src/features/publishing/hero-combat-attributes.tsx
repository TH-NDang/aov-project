import { useState } from "react"
import { ChartNoAxesColumn, ChevronDown } from "lucide-react"
import { HeroStatAnalysisPanel } from "./hero-stat-analysis-panel"
import {
  combatAttributeRows,
  formatStat,
  observedAttributes,
  overviewAttackStats,
  type StatDefault,
} from "./combat-attributes"
import type { Role, Skills, Stats } from "./types"

export function HeroCombatAttributes({
  stats,
  skills,
  roles = [],
  defaults,
  heroId,
  variantId,
  patchCode,
  referenceError,
}: {
  stats: Stats | null
  skills: Skills | null
  roles?: Role[]
  defaults?: StatDefault[]
  heroId?: string
  variantId?: string
  patchCode?: string
  referenceError?: boolean
}) {
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const snapshot = observedAttributes(skills)
  const observation = patchCode && snapshot?.patchCode !== patchCode ? undefined : snapshot
  const rows = combatAttributeRows(stats, observation, defaults ?? [])
  const summary = ["HP", ...overviewAttackStats(roles, skills), "MOVEMENT_SPEED", "ATTACK_RANGE_TYPE"]
    .map((key) => rows.find((r) => r.key === key && r.value !== "—"))
    .filter((r) => !!r)
  const sameSource = summary.every((r) => r.kind === summary[0]?.kind)
  return (
    <div className="space-y-3">
      {!!summary.length && (
        <div>
          <dl
            className="grid grid-cols-2 gap-2 @min-[560px]/overview:grid-cols-[repeat(auto-fit,minmax(6rem,1fr))]"
            aria-label="Thuộc tính nổi bật theo vai trò"
          >
            {summary.map((r) => (
              <div key={r.key} className="min-w-0 rounded-lg bg-muted/40 px-3 py-2">
                <dt className="type-meta">{r.label}</dt>
                <dd className="type-section-title tabular-nums">{r.value}</dd>
                {!sameSource && <dd className="type-meta">{r.kind}</dd>}
              </div>
            ))}
          </dl>
          {sameSource && (
            <p className="type-meta mt-1.5">
              {summary[0].kind}
              {summary[0].kind === "Ghi nhận từ ảnh" && observation?.level == null && " · Chưa xác định cấp tướng"}
            </p>
          )}
        </div>
      )}
      {heroId && rows.length > 0 && (
        <details
          className="group/analysis rounded-lg border"
          onToggle={(event) => setAnalysisOpen(event.currentTarget.open)}
        >
          <summary className="type-body flex cursor-pointer list-none items-center gap-2 px-3 py-2">
            <ChartNoAxesColumn aria-hidden className="size-4 text-muted-foreground" />
            Phân tích thuộc tính
            <ChevronDown aria-hidden className="ml-auto size-4 transition-transform group-open/analysis:rotate-180" />
          </summary>
          {analysisOpen &&
            (variantId && patchCode ? (
              <HeroStatAnalysisPanel
                key={heroId + variantId}
                rows={rows}
                heroId={heroId}
                variantId={variantId}
                patchCode={patchCode}
                roles={roles}
                level={observation?.level ?? null}
                defaultsReady={defaults !== undefined}
                referenceError={referenceError}
              />
            ) : (
              <p className="type-meta border-t p-3">Cần xác định patch của phiên bản để đối chiếu thuộc tính.</p>
            ))}
        </details>
      )}
      {rows.length ? (
        <details className="group/stats rounded-lg border" open={summary.length ? undefined : true}>
          <summary className="type-body flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2">
            Xem toàn bộ thuộc tính <ChevronDown className="size-4 transition-transform group-open/stats:rotate-180" />
          </summary>
          <div className="space-y-4 border-t p-3">
            {observation && (
              <p className="type-meta break-words">
                Ghi nhận từ ảnh{observation.patchCode && ` · ${observation.patchCode}`} ·{" "}
                {observation.level == null ? "Chưa xác định cấp tướng" : `Cấp ${observation.level}`}
                {observation.image && <span className="block">{observation.image}</span>}
              </p>
            )}
            {(["Cơ bản", "Tấn công", "Khác"] as const).map((group) => {
              const entries = rows.filter((row) => row.group === group)
              return (
                entries.length > 0 && (
                  <section key={group}>
                    <h4 className="type-label mb-1">{group}</h4>
                    <dl className="divide-y">
                      {entries.map((row) => (
                        <div
                          key={row.key}
                          className="grid grid-cols-[minmax(0,1fr)_minmax(6rem,auto)] items-start gap-2 py-2"
                        >
                          <dt className="type-body break-words">{row.label}</dt>
                          <dd className="min-w-0 text-right">
                            <span className="type-body tabular-nums">{row.value}</span>
                            {(row.kind !== "Ghi nhận từ ảnh" || row.reference) && (
                              <span className="type-meta block">{row.kind}</span>
                            )}
                            {row.growth != null && (
                              <span className="type-meta block">
                                {row.growth > 0 ? "+" : ""}
                                {row.growth} / cấp
                              </span>
                            )}
                            {row.kind === "Giá trị riêng" && row.observed && row.observed !== row.value && (
                              <span className="type-meta block">Ảnh ghi {row.observed}</span>
                            )}
                            {row.reference && (
                              <a
                                className="type-meta block underline underline-offset-2"
                                href={row.reference.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {row.matchesDefault
                                  ? "Khớp mặc định"
                                  : `Mặc định ${formatStat(row.reference.baseValue, row.reference.unit)}`}{" "}
                                · {row.reference.patchCode}
                              </a>
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                )
              )
            })}
            {rows.some((r) => r.key === "CRITICAL_DAMAGE") && (
              <p className="type-meta border-t pt-2">
                Tỉ lệ chí mạng là xác suất đòn đánh gây chí mạng. Sát thương chí mạng là hệ số khi đòn đánh đó xảy ra
                (200% = ×2, 175% = ×1,75).
              </p>
            )}
          </div>
        </details>
      ) : (
        <p className="type-meta">Chưa ghi nhận thuộc tính cho phiên bản này.</p>
      )}
      {snapshot && !observation && (
        <p className="type-meta">Ảnh thuộc patch {snapshot.patchCode ?? "chưa xác định"}.</p>
      )}
      {referenceError && (
        <p role="status" className="type-meta">
          Chưa tải được mặc định của patch.
        </p>
      )}
    </div>
  )
}
