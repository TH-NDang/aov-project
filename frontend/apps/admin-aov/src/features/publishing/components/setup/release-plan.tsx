import { useMemo, useState, type FormEvent } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { CalendarClock } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { utcOffsetLabel } from "@aov/ui/lib/time-zone"
import { backendRequest } from "@/app/auth/session"
import { useSession } from "@/app/auth/auth-gate"
import { NativeSelect } from "@/components/native-select"
import { errorMessage } from "@/lib/api/errors"
import { publishingKeys } from "@/lib/api/publishing-api"
import { invalidateReferenceCatalog } from "../../../terminology/reference-api"
import { marketReleaseLabel, type PublicationOverview, type Variant } from "../../api/publication-overview"
import { marketSourceUrl } from "../../model/patch-changes/patch-source-model"
import {
  daysFromShared,
  draftFromReleases,
  localMoment,
  marketTimeZone,
  planProblem,
  planToRequest,
  type PlanMode,
  type PlanMoment,
  type PlanRow,
  type ReleasePlanDraft,
} from "../../model/setup/release-plan"
import { usePatchSources } from "../patch-changes/patch-sources"
import { MarketBadge } from "./market-badge"
import { ConfirmRelease } from "./market-schedule"

const MODES: { key: PlanMode; label: string }[] = [
  { key: "shared", label: "Giờ chung" },
  { key: "own", label: "Giờ riêng" },
  { key: "none", label: "Chưa có" },
]

const shownDay = (moment: PlanMoment) => moment.date.split("-").reverse().join("/")

/**
 * The release of one patch in every market at once (ADR-037): one moment the markets share, written on one market's
 * clock and shown on each market's own, and a moment of its own for the market that updates on another day.
 */
export function ReleasePlanEditor({ variant, data }: { variant: Variant; data: PublicationOverview }) {
  const cache = useQueryClient()
  const sources = usePatchSources(variant.id)
  const allowed = useSession().actor?.capabilities.includes("patch:publish")
  const releases = useMemo(
    () => data.releases.filter((release) => release.variantId === variant.id),
    [data.releases, variant.id],
  )
  const [draft, setDraft] = useState<ReleasePlanDraft>(() => draftFromReleases(data.markets, releases, variant.id))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const problem = planProblem(draft)

  if (!allowed) return <p className="type-meta">Cần quyền xuất bản patch để đặt lịch phát hành.</p>
  if (variant.status !== "PUBLISHED")
    return <p className="type-meta">Xuất bản patch trước khi đặt lịch phát hành cho các thị trường.</p>

  const setRow = (code: string, patch: Partial<PlanRow>) =>
    setDraft((current) => ({
      ...current,
      rows: current.rows.map((row) => (row.code === code ? { ...row, ...patch } : row)),
    }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (problem) return setError(problem)
    setBusy(true)
    setError("")
    try {
      const plan = planToRequest(draft, (code) => marketSourceUrl(sources.data ?? [], code), releases)
      await backendRequest(`/admin/patch-variants/${variant.id}/releases`, {
        method: "PUT",
        body: JSON.stringify({ releases: plan }),
      })
      await Promise.all([
        cache.invalidateQueries({ queryKey: publishingKeys.overview }),
        cache.invalidateQueries({ queryKey: publishingKeys.allAuthoringContexts }),
        invalidateReferenceCatalog(cache),
      ])
      toast.success("Đã lưu lịch phát hành.")
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={(event) => void submit(event)} noValidate>
      <fieldset className="space-y-3 rounded-xl border bg-muted/40 p-3">
        <legend className="type-label flex items-center gap-1.5 px-1">
          <CalendarClock aria-hidden className="size-4" /> Thời điểm chung
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_11rem]">
          <Input
            type="date"
            aria-label="Ngày phát hành chung"
            className="col-span-2 sm:col-span-1"
            value={draft.shared.date}
            onChange={(event) => setDraft({ ...draft, shared: { ...draft.shared, date: event.target.value } })}
          />
          <Input
            type="time"
            aria-label="Giờ phát hành chung"
            value={draft.shared.time}
            onChange={(event) => setDraft({ ...draft, shared: { ...draft.shared, time: event.target.value } })}
          />
          <NativeSelect
            aria-label="Giờ chung tính theo thị trường"
            className="w-full"
            value={draft.sharedZoneCode}
            onChange={(event) => setDraft({ ...draft, sharedZoneCode: event.target.value })}
          >
            {draft.rows.map((row) => (
              <option key={row.code} value={row.code}>
                Giờ {row.name} ({utcOffsetLabel(marketTimeZone(row.code))})
              </option>
            ))}
          </NativeSelect>
        </div>
        <p className="type-meta">Bỏ trống giờ khi bài chỉ ghi ngày. Mỗi thị trường hiện theo giờ địa phương.</p>
      </fieldset>

      <ul aria-label="Thị trường" className="grid gap-2 sm:grid-cols-2">
        {draft.rows.map((row) => (
          <PlanMarket
            key={row.code}
            row={row}
            draft={draft}
            data={data}
            releaseId={releases.find((release) => release.regionId === row.regionId)?.id}
            onChange={(patch) => setRow(row.code, patch)}
          />
        ))}
      </ul>

      {error && (
        <p role="alert" className="type-body text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Đang lưu…" : "Lưu lịch"}
        </Button>
        <p className="type-meta">Thị trường để “Chưa có” sẽ bỏ lịch đã ghi.</p>
      </div>
    </form>
  )
}

function PlanMarket({
  row,
  draft,
  data,
  releaseId,
  onChange,
}: {
  row: PlanRow
  draft: ReleasePlanDraft
  data: PublicationOverview
  releaseId: string | undefined
  onChange: (patch: Partial<PlanRow>) => void
}) {
  const market = data.markets.find((entry) => entry.id === row.regionId)
  const release = data.releases.find((entry) => entry.id === releaseId)
  const shown = localMoment(draft, row)
  const offset = daysFromShared(draft, row)
  return (
    <li
      className="grid gap-2 rounded-xl border p-3 data-[mode=none]:border-dashed data-[mode=none]:bg-transparent data-[mode=own]:border-(--aov-accent)"
      data-mode={row.mode}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <MarketBadge code={row.code} name={row.name} showName />
        {release && <span className="type-meta">{marketReleaseLabel(release, market)}</span>}
      </div>
      <div role="radiogroup" aria-label={`Lịch của ${row.name}`} className="grid grid-cols-3 gap-1">
        {MODES.map((mode) => (
          <Button
            key={mode.key}
            type="button"
            size="sm"
            role="radio"
            aria-checked={row.mode === mode.key}
            variant={row.mode === mode.key ? "secondary" : "ghost"}
            onClick={() =>
              onChange(
                mode.key === "own" && !row.own.date
                  ? { mode: mode.key, own: localMoment(draft, { ...row, mode: "shared" }) ?? row.own }
                  : { mode: mode.key },
              )
            }
          >
            {mode.label}
          </Button>
        ))}
      </div>
      {row.mode === "own" && (
        <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
          <Input
            type="date"
            aria-label={`Ngày tại ${row.name}`}
            value={row.own.date}
            onChange={(event) => onChange({ own: { ...row.own, date: event.target.value } })}
          />
          <Input
            type="time"
            aria-label={`Giờ tại ${row.name}`}
            value={row.own.time}
            onChange={(event) => onChange({ own: { ...row.own, time: event.target.value } })}
          />
        </div>
      )}
      <p className="type-body tabular-nums">
        {shown ? (
          <>
            {shownDay(shown)}
            {shown.time && ` · ${shown.time}`}
            <span className="type-meta"> {shown.time ? utcOffsetLabel(row.timeZone) : "· chỉ có ngày"}</span>
            {offset !== null && offset !== 0 && (
              <span className="type-meta ml-2 rounded-full border px-2 py-0.5">
                {offset < 0 ? `Sớm ${-offset} ngày` : `Trễ ${offset} ngày`}
              </span>
            )}
          </>
        ) : (
          <span className="type-meta">{row.mode === "none" ? "Chưa có thông tin phát hành" : "Chọn ngày"}</span>
        )}
      </p>
      {release && release.phase === "AWAITING_CONFIRMATION" && market?.available && <ConfirmRelease id={release.id} />}
    </li>
  )
}
