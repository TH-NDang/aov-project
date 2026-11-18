import { releaseEnd } from "../../model/setup/release-window"
import { useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { backendRequest } from "@/app/auth/session"
import { useSession } from "@/app/auth/auth-gate"
import { Button } from "@aov/ui/components/button"
import { ActionStrip } from "@/components/action-strip"
import { errorMessage } from "@/lib/api/errors"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@aov/ui/components/sheet"
import { Badge } from "@aov/ui/components/badge"
import { LocalTime } from "@aov/ui/components/local-time"
import { MarketBadge } from "./market-badge"
import { useIsWide } from "@/hooks/use-media-query"
import {
  marketReleaseLabel,
  phaseLabels,
  type Market,
  type PublicationOverview,
  type Season,
  type Variant,
} from "../../api/publication-overview"
import { invalidateReferenceCatalog } from "../../../terminology/reference-api"
import { ScheduleForm } from "./shared-version-setup"
import { control } from "../fields"
import { publishingKeys } from "../../api/publishing-api"

export type MarketMode = "season" | "patch"

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
  if (!releases.length)
    return (
      <p className="type-meta py-3">
        Chưa có lịch phát hành cho patch này. Wiki chỉ hiện patch và thay đổi của nó ở thị trường đã có ngày phát hành.
      </p>
    )
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
                {start ? (
                  <>
                    Từ <LocalTime value={start} locale={locale} />
                  </>
                ) : (
                  "Chưa có ngày áp dụng"
                )}
                {end && (
                  <>
                    {" "}
                    đến <LocalTime value={end} locale={locale} />
                  </>
                )}
              </p>
            </div>
            <div className="type-meta">{marketReleaseLabel(r, market)}</div>
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
            await cache.invalidateQueries({ queryKey: publishingKeys.overview })
            await Promise.all([
              cache.invalidateQueries({ queryKey: publishingKeys.allAuthoringContexts }),
              invalidateReferenceCatalog(cache),
            ])
            toast.success("Đã xác nhận patch đang áp dụng.")
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
  initialMode = "patch",
  suggestedSeason,
  suggestedPatch,
  data,
  locale,
  onClose,
}: {
  marketId: string | null
  initialMode?: MarketMode
  suggestedSeason?: Season
  suggestedPatch?: Variant
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
          <SheetDescription>
            {market?.available
              ? "Quản lý lịch mùa và patch của thị trường."
              : "Thị trường chưa mở trên Wiki. Bạn có thể ghi lịch mùa và ngày phát hành patch tại đây."}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 space-y-5 overflow-y-auto px-4 pb-6">
          {market && (
            <MarketVersionEditor
              key={`${market.id}-${initialMode}`}
              data={data}
              market={market}
              locale={locale}
              initialMode={initialMode}
              suggestedSeason={suggestedSeason}
              suggestedPatch={suggestedPatch}
              onOpenPatch={onClose}
            />
          )}
          <details className="border-t pt-3">
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
                        <LocalTime value={s.startsOn ?? s.startsAt} locale={locale} fallback="—" /> –{" "}
                        <LocalTime value={s.endsOn ?? s.endsAt} locale={locale} fallback="—" />
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
                          <Badge variant="outline">{marketReleaseLabel(r, market)}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          <LocalTime value={r.effectiveOn ?? r.effectiveAt} locale={locale} fallback="—" /> →{" "}
                          {releaseEnd(r, data) ? (
                            <LocalTime value={releaseEnd(r, data)} locale={locale} />
                          ) : (
                            "Chưa có mốc kết thúc"
                          )}
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
  suggestedSeason,
  suggestedPatch,
  initialMode = "patch",
}: {
  market: Market
  data: PublicationOverview
  locale: string
  onOpenPatch: () => void
  suggestedSeason?: Season
  suggestedPatch?: Variant
  initialMode?: MarketMode
}) {
  const capabilities = useSession().actor?.capabilities ?? []
  const activeRelease = data.releases.find((r) => r.id === market.currentReleaseId)
  const activePatch = data.variants.find((v) => v.id === activeRelease?.variantId)
  const activeSeason = data.seasons.find((s) => s.id === market.currentSeasonId)
  const dateOnly = !market.available || !market.currentRulesetId
  const [mode, setMode] = useState<MarketMode>(initialMode)
  const [seasonId, setSeasonId] = useState(suggestedSeason?.id ?? market.currentSeasonId ?? "")
  const scopeSeason = suggestedSeason && !suggestedPatch ? data.seasons.find((s) => s.id === seasonId) : undefined
  const [selection, setVariantId] = useState(
    suggestedPatch && (!market.currentRulesetId || suggestedPatch.rulesetId === market.currentRulesetId)
      ? suggestedPatch.id
      : (activePatch?.id ?? ""),
  )
  const variants = data.variants
    .filter((v) => !market.currentRulesetId || v.rulesetId === market.currentRulesetId)
    .filter((v) => !scopeSeason || v.seasonId === scopeSeason.id)
    .sort((a, b) => b.rulesetOrdinal - a.rulesetOrdinal)
  const variantId = variants.length === 1 ? variants[0].id : selection
  const variant = variants.find((v) => v.id === variantId)
  const patchLabel = (v: Variant) => {
    if (market.currentRulesetId || data.rulesets.length < 2) return v.patchCode
    return [v.patchCode, data.rulesets.find((r) => r.id === v.rulesetId)?.code].filter(Boolean).join(" · ")
  }
  const nextSeasonPatch =
    variants.find((v) => v.seasonId === seasonId && v.status === "PUBLISHED") ??
    variants.find((v) => v.seasonId === seasonId)
  const releases = data.releases.filter((r) => r.regionId === market.id && r.variantId === variantId)
  return (
    <section className="space-y-4">
      {market.available && (
        <div className="border-b pb-3">
          <p className="type-label">Đang áp dụng tại {market.displayName}</p>
          <p className="type-section-title">
            {activeSeason?.displayName ?? "Chưa xác định mùa"} · {activePatch?.patchCode ?? "Chưa xác nhận patch"}
          </p>
        </div>
      )}
      <ActionStrip aria-label="Thiết lập cho thị trường">
        {(["patch", "season"] as const).map((key) => (
          <Button
            key={key}
            type="button"
            variant={key === mode ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={key === mode}
            onClick={() => setMode(key)}
          >
            {key === "patch" ? (dateOnly ? "Lịch patch" : "Patch áp dụng") : "Lịch mùa"}
          </Button>
        ))}
      </ActionStrip>
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
          {market.available && (
            <p className="type-meta">
              Thị trường lấy mùa của patch đang áp dụng. Nếu patch chưa xác định mùa, hệ thống dùng lịch mùa có đủ giờ
              bắt đầu và kết thúc.
            </p>
          )}
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
          {suggestedPatch && market.currentRulesetId && market.currentRulesetId !== suggestedPatch.rulesetId && (
            <p className="type-meta">
              Patch {suggestedPatch.patchCode} dùng bộ quy tắc khác với {market.displayName}.
            </p>
          )}
          {variants.length > 1 && variants.length <= 6 && (
            <fieldset className="min-w-0">
              <legend className="type-label mb-2">
                {scopeSeason ? `Patch trong ${scopeSeason.displayName}` : "Patch cho thị trường"}
              </legend>
              <ActionStrip aria-label="Chọn patch">
                {variants.map((v) => (
                  <Button
                    key={v.id}
                    type="button"
                    size="sm"
                    variant={v.id === variantId ? "secondary" : "outline"}
                    aria-pressed={v.id === variantId}
                    onClick={() => setVariantId(v.id)}
                  >
                    {patchLabel(v)}
                    {v.status === "DRAFT" && <span className="type-meta">Nháp</span>}
                  </Button>
                ))}
              </ActionStrip>
            </fieldset>
          )}
          {variants.length === 1 && (
            <p className="type-body">
              Patch đã chọn · <strong>{variant && patchLabel(variant)}</strong>
            </p>
          )}
          {variants.length > 6 && (
            <label className="grid gap-1 type-label">
              {scopeSeason ? `Patch trong ${scopeSeason.displayName}` : "Patch cho thị trường"}
              <select className={control} value={variantId} onChange={(e) => setVariantId(e.target.value)}>
                <option value="">Chọn patch</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {data.seasons.find((s) => s.id === v.seasonId)?.displayName ?? "Chưa gắn mùa"} · {patchLabel(v)}
                    {v.status === "DRAFT" ? " · Nháp" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!variants.length && (
            <p className="type-meta">
              {scopeSeason
                ? `Chưa có patch phù hợp trong ${scopeSeason.displayName}.`
                : "Chưa có patch phù hợp với thị trường này."}
            </p>
          )}
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
                    {marketReleaseLabel(r, market)} ·{" "}
                    <LocalTime value={r.effectiveOn ?? r.effectiveAt} locale={locale} fallback="—" />
                  </p>
                  {!dateOnly && r.phase === "AWAITING_CONFIRMATION" && (
                    <>
                      <p className="type-meta">Xác nhận khi patch đã áp dụng trong game tại {market.displayName}.</p>
                      <ConfirmRelease id={r.id} />
                    </>
                  )}
                </div>
              ))
            ) : capabilities.includes("patch:publish") && dateOnly ? (
              <>
                {market.available && (
                  <p className="type-meta">
                    Bạn có thể ghi ngày phát hành trước khi liên kết thị trường với bộ quy tắc của patch.
                  </p>
                )}
                <ScheduleForm
                  key={variant.id}
                  endpoint={`/admin/patch-variants/${variant.id}/releases`}
                  variantId={variant.id}
                  data={data}
                  seasonId={variant.seasonId}
                  marketId={market.id}
                  patch
                  dateOnly
                />
              </>
            ) : capabilities.includes("patch:publish") ? (
              <>
                {!activePatch || variant.rulesetOrdinal > activePatch.rulesetOrdinal ? (
                  <ApplyPatchNow key={variant.id} market={market} variant={variant} />
                ) : (
                  <p className="type-meta">
                    Patch này cũ hơn patch đang áp dụng. Bạn có thể bổ sung ngày phát hành vào lịch sử thị trường.
                  </p>
                )}
                {(!activePatch || variant.rulesetOrdinal > activePatch.rulesetOrdinal) &&
                  variant.seasonId &&
                  variant.seasonId !== market.currentSeasonId && (
                    <p className="type-body">
                      Khi patch này có hiệu lực, mùa hiện tại của {market.displayName} sẽ chuyển sang{" "}
                      {data.seasons.find((s) => s.id === variant.seasonId)?.displayName}.
                    </p>
                  )}
                <details className="border-t pt-3">
                  <summary className="cursor-pointer type-label">Ghi ngày phát hành hoặc đặt lịch</summary>
                  <p className="type-meta my-3">
                    Có giờ phát hành: tự áp dụng khi đến giờ. Chỉ có ngày: cần xác nhận khi thị trường đã cập nhật.
                  </p>
                  <ScheduleForm
                    key={variant.id}
                    endpoint={`/admin/patch-variants/${variant.id}/releases`}
                    variantId={variant.id}
                    data={data}
                    seasonId={variant.seasonId}
                    marketId={market.id}
                    patch
                  />
                </details>
              </>
            ) : (
              <p className="type-meta">Cần quyền xuất bản patch để đặt lịch phát hành.</p>
            ))}
        </>
      )}
    </section>
  )
}

function ApplyPatchNow({ market, variant }: { market: Market; variant: Variant }) {
  const cache = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  return (
    <div className="space-y-2">
      <p className="type-body">
        Nếu {market.displayName} đã cập nhật trong game, bạn có thể ghi nhận patch từ thời điểm này.
      </p>
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setError("")
          try {
            await backendRequest(`/admin/patch-variants/${variant.id}/releases`, {
              method: "POST",
              body: JSON.stringify({
                regionId: market.id,
                seasonId: variant.seasonId,
                effectiveAt: new Date().toISOString(),
              }),
            })
            await Promise.all([
              cache.invalidateQueries({ queryKey: publishingKeys.overview }),
              cache.invalidateQueries({ queryKey: publishingKeys.allAuthoringContexts }),
              invalidateReferenceCatalog(cache),
            ])
            toast.success(`Đã áp dụng ${variant.patchCode} cho ${market.displayName}.`)
          } catch (cause) {
            setError(errorMessage(cause))
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? "Đang áp dụng…" : `Đặt ${variant.patchCode} làm patch hiện tại`}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
