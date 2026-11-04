import { releaseEnd } from "./release-window"
import { useState } from "react"
import { Link } from "react-router"
import { useQueryClient } from "@tanstack/react-query"
import { backendRequest } from "@/app/auth/session"
import { useSession } from "@/app/auth/auth-gate"
import { Button } from "@aov/ui/components/button"
import { errorMessage } from "@/lib/api/errors"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@aov/ui/components/sheet"
import { Badge } from "@aov/ui/components/badge"
import { MarketBadge } from "./market-badge"
import { useIsWide } from "@/hooks/use-media-query"
import { dateLabel, phaseLabels, type Market, type PublicationOverview } from "./publication-overview"
import { ScheduleForm } from "./shared-version-setup"
import { control } from "./fields"

export function PatchMarketSchedule({
  variantId,
  data,
  locale,
}: {
  variantId: string
  data: PublicationOverview
  locale: string
}) {
  const releases = data.releases.filter((r) => r.variantId === variantId)
  if (!releases.length) return <p className="type-meta py-3">Chưa có lịch phát hành cho patch này.</p>
  return (
    <ul aria-label="Lịch phát hành theo thị trường" className="divide-y border-y">
      {releases.map((r) => {
        const market = data.markets.find((m) => m.id === r.regionId)
        const start = r.effectiveOn ?? r.effectiveAt
        const end = releaseEnd(r, data)
        return (
          <li key={r.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-3">
            <div className="min-w-0 space-y-1">
              {market ? (
                <MarketBadge code={market.code} name={market.displayName} showName />
              ) : (
                <span className="type-meta">Chưa xác định thị trường</span>
              )}
              <p className="type-meta">
                {start ? `Từ ${dateLabel(start, locale)}` : "Chưa có ngày áp dụng"}
                {end && ` đến ${dateLabel(end, locale)}`}
              </p>
            </div>
            <div className="type-meta">
              {phaseLabels[r.phase] ?? r.phase}
              {r.phase === "AWAITING_CONFIRMATION" && <ConfirmRelease id={r.id} />}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
export function ConfirmRelease({ id }: { id: string }) {
  const cache = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const allowed = useSession().actor?.capabilities.includes("patch:publish")
  if (!allowed) return null
  return (
    <div className="mt-2">
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setError("")
          try {
            await backendRequest(`/admin/patch-releases/${id}/confirm`, { method: "POST" })
            await cache.invalidateQueries({ queryKey: ["publication-overview"] })
          } catch (cause) {
            setError(errorMessage(cause))
          } finally {
            setBusy(false)
          }
        }}
      >
        Xác nhận đang áp dụng
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
export function MarketSchedule({
  marketId,
  data,
  locale,
  onClose,
}: {
  marketId: string | null
  data: PublicationOverview
  locale: string
  onClose: () => void
}) {
  const wide = useIsWide()
  const market = data.markets.find((m) => m.id === marketId)
  return (
    <Sheet
      open={!!market}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent
        side={wide ? "right" : "bottom"}
        className={wide ? "w-[min(760px,94vw)] sm:max-w-none" : "max-h-[90dvh] rounded-t-2xl"}
      >
        <SheetHeader>
          <SheetTitle>{market && <MarketBadge code={market.code} name={market.displayName} showName />}</SheetTitle>
          <SheetDescription>Quản lý mùa và patch đang áp dụng riêng cho thị trường này.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 space-y-5 overflow-y-auto px-4 pb-6">
          {market?.available && (
            <MarketVersionEditor key={market.id} data={data} market={market} locale={locale} onOpenPatch={onClose} />
          )}
          <details open={!market?.available || undefined} className="border-t pt-3">
            <summary className="cursor-pointer type-section-title">Lịch sử mùa và patch</summary>
            <div className="mt-4 space-y-5">
              <section className="space-y-3">
                <h3 className="font-medium">Mùa xếp hạng</h3>
                {(data.seasonSchedules ?? [])
                  .filter((s) => s.regionId === marketId)
                  .map((s) => (
                    <div key={s.id} className="space-y-1 border-b py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span>{data.seasons.find((season) => season.id === s.seasonId)?.displayName}</span>
                        <Badge variant="outline">{s.phase === "CURRENT" ? "Đang diễn ra" : phaseLabels[s.phase]}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {dateLabel(s.startsOn ?? s.startsAt, locale)} – {dateLabel(s.endsOn ?? s.endsAt, locale)}
                      </p>
                    </div>
                  ))}
                {!(data.seasonSchedules ?? []).some((s) => s.regionId === marketId) && (
                  <p className="text-sm text-muted-foreground">Chưa khai báo mùa.</p>
                )}
              </section>
              <section className="space-y-3">
                <h3 className="font-medium">Các bản cập nhật</h3>
                {data.releases
                  .filter((r) => r.regionId === marketId)
                  .map((r) => {
                    const v = data.variants.find((v) => v.id === r.variantId)
                    return (
                      <div key={r.id} className="space-y-1 border-b py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span>{v?.patchCode}</span>
                          <Badge variant="outline">{phaseLabels[r.phase] ?? r.phase}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {dateLabel(r.effectiveOn ?? r.effectiveAt, locale)} →{" "}
                          {releaseEnd(r, data) ? dateLabel(releaseEnd(r, data), locale) : "Chưa có mốc kết thúc"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Gameplay: {data.rulesets.find((rule) => rule.id === v?.rulesetId)?.code}
                        </p>
                      </div>
                    )
                  })}
                {!data.releases.some((r) => r.regionId === marketId) && (
                  <p className="text-sm text-muted-foreground">Chưa có lịch patch.</p>
                )}
              </section>
              <p className="text-xs text-muted-foreground">
                Mốc kết thúc patch lấy từ lịch bản cập nhật tiếp theo đã khai báo. Ngày kết thúc mùa không tự kết thúc
                gameplay của patch.
              </p>
            </div>
          </details>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function MarketVersionEditor({
  market,
  data,
  locale,
  onOpenPatch,
}: {
  market: Market
  data: PublicationOverview
  locale: string
  onOpenPatch: () => void
}) {
  const capabilities = useSession().actor?.capabilities ?? []
  const activeRelease = data.releases.find((r) => r.id === market.currentReleaseId)
  const activePatch = data.variants.find((v) => v.id === activeRelease?.variantId)
  const activeSeason = data.seasons.find((s) => s.id === market.currentSeasonId)
  const [mode, setMode] = useState<"patch" | "season">("patch")
  const [seasonId, setSeasonId] = useState(market.currentSeasonId ?? "")
  const [variantId, setVariantId] = useState(activePatch?.id ?? "")
  const variants = data.variants
    .filter((v) => v.rulesetId === market.currentRulesetId)
    .sort((a, b) => b.rulesetOrdinal - a.rulesetOrdinal)
  const variant = variants.find((v) => v.id === variantId)
  const nextSeasonPatch =
    variants.find((v) => v.seasonId === seasonId && v.status === "PUBLISHED") ??
    variants.find((v) => v.seasonId === seasonId)
  const releases = data.releases.filter(
    (r) => r.regionId === market.id && r.variantId === variantId && r.status !== "CANCELLED",
  )
  return (
    <section className="space-y-4">
      <div className="border-b pb-3">
        <p className="type-label">Đang áp dụng</p>
        <p className="type-section-title">
          {activeSeason?.displayName ?? "Chưa xác định mùa"} · {activePatch?.patchCode ?? "Chưa xác nhận patch"}
        </p>
      </div>
      <div role="group" aria-label="Thiết lập cho thị trường" className="flex gap-2">
        {(["patch", "season"] as const).map((key) => (
          <Button
            key={key}
            type="button"
            variant={key === mode ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={key === mode}
            onClick={() => setMode(key)}
          >
            {key === "patch" ? "Chọn patch" : "Lịch mùa"}
          </Button>
        ))}
      </div>
      {mode === "season" ? (
        <>
          <label className="grid gap-1 type-label">
            Mùa xếp hạng
            <select className={control} value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
              <option value="">Chọn mùa</option>
              {data.seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName}
                </option>
              ))}
            </select>
          </label>
          <p className="type-meta">
            Thị trường lấy mùa của patch đang áp dụng. Nếu patch chưa xác định mùa, hệ thống dùng lịch mùa có đủ giờ bắt
            đầu và kết thúc.
          </p>
          {seasonId && seasonId !== market.currentSeasonId && nextSeasonPatch && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setVariantId(nextSeasonPatch.id)
                setMode("patch")
              }}
            >
              Chọn patch của mùa này
            </Button>
          )}
          {seasonId &&
            (capabilities.includes("patch:write") ? (
              <ScheduleForm
                key={seasonId}
                endpoint={`/admin/seasons/${seasonId}/schedules`}
                data={data}
                seasonId={seasonId}
                marketId={market.id}
              />
            ) : (
              <p className="type-meta">Cần quyền chỉnh sửa patch để lưu lịch mùa.</p>
            ))}
        </>
      ) : (
        <>
          <label className="grid gap-1 type-label">
            Patch cho thị trường
            <select className={control} value={variantId} onChange={(e) => setVariantId(e.target.value)}>
              <option value="">Chọn patch</option>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {data.seasons.find((s) => s.id === v.seasonId)?.displayName ?? "Chưa gắn mùa"} · {v.patchCode}
                  {v.status === "DRAFT" ? " · Nháp" : ""}
                </option>
              ))}
            </select>
          </label>
          {!variants.length && <p className="type-meta">Chưa có patch thuộc bộ quy tắc hiện tại của thị trường này.</p>}
          {variant &&
            (variant.status !== "PUBLISHED" ? (
              <p className="type-body">
                Xuất bản patch trước khi đặt lịch cho thị trường.{" "}
                <Link
                  className="font-medium underline"
                  to={`/game-configuration?season=${variant.seasonId ?? ""}&patch=${variant.id}`}
                  onClick={onOpenPatch}
                >
                  Mở patch {variant.patchCode}
                </Link>
              </p>
            ) : releases.length ? (
              releases.map((r) => (
                <div key={r.id} className="border-l-2 pl-3">
                  <p className="type-body">
                    {phaseLabels[r.phase] ?? r.phase} · {dateLabel(r.effectiveOn ?? r.effectiveAt, locale)}
                  </p>
                  {r.phase === "AWAITING_CONFIRMATION" && (
                    <>
                      <p className="type-meta">Xác nhận khi patch đã áp dụng trong game tại {market.displayName}.</p>
                      <ConfirmRelease id={r.id} />
                    </>
                  )}
                </div>
              ))
            ) : capabilities.includes("patch:publish") ? (
              <>
                <p className="type-meta">
                  Có giờ phát hành, patch tự áp dụng khi đến giờ. Nếu chỉ biết ngày, lưu lịch rồi xác nhận khi thị
                  trường đã cập nhật.
                </p>
                {variant.seasonId && variant.seasonId !== market.currentSeasonId && (
                  <p className="type-body">
                    Khi patch này có hiệu lực, mùa hiện tại của {market.displayName} sẽ chuyển sang{" "}
                    {data.seasons.find((s) => s.id === variant.seasonId)?.displayName}.
                  </p>
                )}
                <ScheduleForm
                  key={variant.id}
                  endpoint={`/admin/patch-variants/${variant.id}/releases`}
                  data={data}
                  seasonId={variant.seasonId}
                  marketId={market.id}
                  patch
                />
              </>
            ) : (
              <p className="type-meta">Cần quyền xuất bản patch để đặt lịch phát hành.</p>
            ))}
        </>
      )}
    </section>
  )
}
