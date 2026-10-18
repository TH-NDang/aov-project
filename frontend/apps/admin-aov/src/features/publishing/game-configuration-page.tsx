import { SharedPatchSetup, SeasonScheduleForm, PatchReleaseForm } from "./shared-version-setup"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronDown, RefreshCw, MoreHorizontal, Plus } from "lucide-react"
import { useSession } from "@/app/auth/auth-gate"
import { useIsWide } from "@/hooks/use-media-query"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@aov/ui/components/sheet"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@aov/ui/components/dropdown-menu"
import { MarketSchedule, PatchMarketSchedule } from "./market-schedule"
import { Button } from "@aov/ui/components/button"
import { Badge } from "@aov/ui/components/badge"
import { Page, PageHeader } from "@/components/page-header"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { createPublishingApi } from "./publishing-api"
import { SeasonSetup } from "./season-setup"
import { PatchSetup } from "./patch-setup"
import { PatchChangesTable } from "./patch-changes-table"
import { MarketBadge } from "./market-badge"
import {
  usePublicationOverview,
  useContentLocale,
  dateLabel,
  phaseLabels,
  type PublicationOverview,
  type Variant,
} from "./publication-overview"
const api = createPublishingApi(backendRequest)

export function GameConfigurationPage() {
  const overview = usePublicationOverview()
  const locale = useContentLocale()
  const [setup, setSetup] = useState<"ruleset" | "season" | "patch" | "assignment" | null>(null)
  const [marketId, setMarketId] = useState<string | null>(null)
  const wide = useIsWide()
  const capabilities = useSession().actor?.capabilities ?? []
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const rulesets = useQuery({ queryKey: ["publishing-rulesets"], queryFn: api.rulesets, enabled: !!setup })
  const regions = useQuery({ queryKey: ["publishing-regions"], queryFn: api.regions, enabled: !!setup })
  const data = overview.data
  return (
    <Page>
      <PageHeader
        title="Phiên bản và thị trường"
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" aria-label="Làm mới tổng quan" onClick={() => void overview.refetch()}>
              <RefreshCw className="size-4" />
            </Button>
          </div>
        }
      />
      <Sheet
        open={!!setup}
        onOpenChange={(open) => {
          if (!open) setSetup(null)
        }}
      >
        <SheetContent
          side={wide ? "right" : "bottom"}
          className={wide ? "w-[760px] sm:max-w-[760px]" : "max-h-[90dvh] rounded-t-2xl"}
        >
          <SheetHeader>
            <SheetTitle>
              {setup === "ruleset"
                ? "Tạo ruleset"
                : setup === "season"
                  ? "Tạo mùa"
                  : setup === "assignment"
                    ? "Liên kết thị trường với gameplay"
                    : "Tạo patch và lịch phát hành"}
            </SheetTitle>
            <SheetDescription>
              {setup === "season"
                ? "Tạo mùa dùng chung; thiết lập lịch thị trường sau."
                : "Dùng chung nội dung gameplay; khai báo lịch phát hành riêng cho mỗi thị trường."}
            </SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto px-4 pb-6">
            {setup === "season" ? (
              <SeasonSetup onDone={() => setSetup(null)} />
            ) : setup === "patch" ? (
              <SharedPatchSetup onDone={() => setSetup(null)} />
            ) : (
              setup && (
                <PatchSetup
                  key={setup}
                  mode={setup}
                  rulesets={rulesets.data ?? []}
                  regions={regions.data ?? []}
                  onRulesetCreated={() => setSetup(null)}
                />
              )
            )}
            {(rulesets.error || regions.error) && <p role="alert">{errorMessage(rulesets.error || regions.error)}</p>}
          </div>
        </SheetContent>
      </Sheet>
      {overview.isPending && <p role="status">Đang tải lịch phát hành…</p>}
      {overview.error && (
        <p role="alert" className="text-destructive">
          {errorMessage(overview.error)}
        </p>
      )}
      {data && (
        <>
          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
              <h2 className="font-semibold">Gameplay và thị trường</h2>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Tùy chọn phiên bản và thị trường">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {capabilities.includes("region:admin") && (
                    <DropdownMenuItem onSelect={() => setSetup("ruleset")}>
                      <Plus />
                      Tạo ruleset
                    </DropdownMenuItem>
                  )}
                  {capabilities.includes("patch:write") && (
                    <>
                      <DropdownMenuItem onSelect={() => setSetup("season")}>
                        <Plus />
                        Tạo mùa
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setSetup("patch")}>
                        <Plus />
                        Tạo patch
                      </DropdownMenuItem>
                    </>
                  )}
                  {capabilities.includes("region:admin") && (
                    <DropdownMenuItem onSelect={() => setSetup("assignment")}>
                      Liên kết thị trường với ruleset
                    </DropdownMenuItem>
                  )}
                  {!capabilities.includes("region:admin") && !capabilities.includes("patch:write") && (
                    <DropdownMenuItem disabled>Chỉ có quyền xem</DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {["Ruleset", "Thị trường", "Mùa hiện tại", "Patch hiện tại"].map((t) => (
                      <th key={t} className="px-4 py-3 text-left font-medium">
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[...data.rulesets, { id: "", code: "Chưa gán ruleset", description: null }].map((rule) => {
                    const markets = data.markets.filter((m) => (m.currentRulesetId ?? "") === rule.id)
                    if (!markets.length)
                      return rule.id ? (
                        <tr key={rule.id}>
                          <td className="p-4 font-medium">{rule.code}</td>
                          <td colSpan={3} className="p-4 text-muted-foreground">
                            Chưa có thị trường áp dụng hiện tại
                          </td>
                        </tr>
                      ) : null
                    return markets.map((m, index) => {
                      const season = data.seasons.find((s) => s.id === m.currentSeasonId)
                      const release = data.releases.find((r) => r.id === m.currentReleaseId)
                      const variant = data.variants.find((v) => v.id === release?.variantId)
                      return (
                        <tr key={m.id}>
                          {index === 0 && (
                            <td rowSpan={markets.length} className="border-r p-4 align-top font-medium">
                              {rule.code}
                            </td>
                          )}
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <MarketBadge code={m.code} name={m.displayName} onOpen={() => setMarketId(m.id)} />
                              {!m.available && <Badge variant="outline">Chưa hỗ trợ</Badge>}
                            </div>
                          </td>
                          <td className="p-4">{season?.displayName ?? "Chưa có mùa hiện tại"}</td>
                          <td className="p-4">{variant?.patchCode ?? "Chưa áp dụng"}</td>
                        </tr>
                      )
                    })
                  })}
                </tbody>
              </table>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="font-semibold">Mùa và bản cập nhật</h2>
            {!data.seasons.length && (
              <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
                Chưa có mùa. Chọn “Tạo mùa” trong menu dấu ba chấm của bảng.
              </p>
            )}
            {data.seasons.map((s) => {
              const variants = data.variants
                .filter((v) => v.seasonId === s.id)
                .sort((a, b) => a.rulesetOrdinal - b.rulesetOrdinal)
              const schedules = (data.seasonSchedules ?? []).filter((schedule) => schedule.seasonId === s.id)
              return (
                <details
                  key={s.id}
                  className="group rounded-xl border bg-card"
                  open={expanded[s.id] ?? schedules.some((schedule) => schedule.phase === "CURRENT")}
                  onToggle={(event) => {
                    const open = event.currentTarget.open
                    setExpanded((previous) => (previous[s.id] === open ? previous : { ...previous, [s.id]: open }))
                  }}
                >
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4">
                    <ChevronDown className="size-4" />
                    <span className="font-semibold">{s.displayName}</span>
                    <span className="text-xs text-muted-foreground">
                      #{s.ordinal} · {schedules.length} thị trường đã lên lịch
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">{variants.length} patch</span>
                  </summary>
                  <div className="space-y-3 border-t p-3">
                    <div className="space-y-2 p-3">
                      {schedules.map((schedule) => (
                        <p key={schedule.id} className="text-sm">
                          {data.markets.find((m) => m.id === schedule.regionId)?.displayName} ·{" "}
                          {dateLabel(schedule.startsOn ?? schedule.startsAt, locale)} –{" "}
                          {dateLabel(schedule.endsOn ?? schedule.endsAt, locale)} · {phaseLabels[schedule.phase]}
                        </p>
                      ))}
                    </div>
                    <SeasonScheduleForm seasonId={s.id} data={data} />
                    {variants.length ? (
                      variants.map((v) => (
                        <PatchDisclosure key={v.id} variant={v} data={data} locale={locale} phase={v.status} />
                      ))
                    ) : (
                      <p className="p-4 text-sm text-muted-foreground">Chưa có patch trong mùa này.</p>
                    )}
                  </div>
                </details>
              )
            })}
            {data.variants.some((v) => !v.seasonId) && (
              <details className="rounded-xl border bg-card">
                <summary className="cursor-pointer p-4 font-medium">Patch cũ chưa gắn mùa</summary>
                <div className="space-y-3 p-3">
                  {data.variants
                    .filter((v) => !v.seasonId)
                    .map((v) => (
                      <PatchDisclosure key={v.id} variant={v} data={data} locale={locale} phase={v.status} />
                    ))}
                </div>
              </details>
            )}
          </section>
          <MarketSchedule marketId={marketId} data={data} locale={locale} onClose={() => setMarketId(null)} />
        </>
      )}
    </Page>
  )
}
function PatchDisclosure({
  variant,
  data,
  locale,
  phase,
  time,
  source,
}: {
  variant: Variant
  data: PublicationOverview
  locale: string
  phase: string
  time?: string
  source?: string | null
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="overflow-hidden rounded-lg border">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full flex-wrap items-center gap-3 bg-muted/20 p-4 text-left"
      >
        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
        <span className="font-medium">{variant.patchCode}</span>
        <Badge variant={phase === "CURRENT" ? "default" : "outline"}>{phaseLabels[phase] ?? phase}</Badge>
        <span className="text-xs text-muted-foreground">
          {data.rulesets.find((r) => r.id === variant.rulesetId)?.code}
        </span>
        {time && <span className="ml-auto text-xs text-muted-foreground">{dateLabel(time, locale)}</span>}
      </button>
      {open && (
        <div className="border-t">
          {source && /^https?:\/\//.test(source) && (
            <a
              className="m-4 inline-block text-sm text-primary underline"
              href={source}
              target="_blank"
              rel="noreferrer"
            >
              Nguồn cập nhật
            </a>
          )}
          <PatchMarketSchedule variantId={variant.id} data={data} locale={locale} />
          <PatchReleaseForm variant={variant} data={data} />
          <PatchChangesTable variantId={variant.id} overview={data} locale={locale} />
        </div>
      )}
    </div>
  )
}
