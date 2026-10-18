import { releaseEnd } from "./release-window"
import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { backendRequest } from "@/app/auth/session"
import { useSession } from "@/app/auth/auth-gate"
import { Button } from "@aov/ui/components/button"
import { errorMessage } from "@/lib/api/errors"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@aov/ui/components/sheet"
import { Badge } from "@aov/ui/components/badge"
import { useIsWide } from "@/hooks/use-media-query"
import { dateLabel, phaseLabels, type PublicationOverview } from "./publication-overview"

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
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <caption className="p-4 text-left font-medium">Lịch phát hành theo thị trường</caption>
        <thead className="bg-muted/30">
          <tr>
            {["Thị trường", "Từ", "Đến", "Trạng thái"].map((label) => (
              <th key={label} className="px-4 py-2 text-left font-medium">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {releases.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="px-4 py-3">{data.markets.find((m) => m.id === r.regionId)?.displayName}</td>
              <td className="px-4 py-3">{dateLabel(r.effectiveOn ?? r.effectiveAt, locale)}</td>
              <td className="px-4 py-3">
                {releaseEnd(r, data) ? dateLabel(releaseEnd(r, data), locale) : "Chưa có mốc kết thúc"}
              </td>
              <td className="px-4 py-3">
                {phaseLabels[r.phase] ?? r.phase}
                {r.phase === "AWAITING_CONFIRMATION" && <ConfirmRelease id={r.id} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!releases.length && <p className="px-4 pb-4 text-sm text-muted-foreground">Chưa có lịch phát hành.</p>}
    </div>
  )
}
function ConfirmRelease({ id }: { id: string }) {
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
        className={wide ? "w-[680px] sm:max-w-[680px]" : "max-h-[90dvh] rounded-t-2xl"}
      >
        <SheetHeader>
          <SheetTitle>{market?.displayName}</SheetTitle>
          <SheetDescription>
            Lịch mùa và patch tại thị trường này. Nội dung gameplay dùng chung với các thị trường cùng ruleset.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-6 overflow-y-auto px-4 pb-6">
          <section className="space-y-3">
            <h3 className="font-medium">Mùa xếp hạng</h3>
            {(data.seasonSchedules ?? [])
              .filter((s) => s.regionId === marketId)
              .map((s) => (
                <div key={s.id} className="space-y-2 rounded-lg border p-4">
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
                  <div key={r.id} className="space-y-2 rounded-lg border p-4">
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
      </SheetContent>
    </Sheet>
  )
}
