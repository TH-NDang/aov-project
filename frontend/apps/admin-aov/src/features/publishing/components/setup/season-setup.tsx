import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@aov/ui/components/button"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import type { Region } from "@/lib/hero-types"
import type { components } from "../../generated/hero-api"
import { z } from "zod"
import { useDraftForm } from "@/app/drafts/use-draft-form"
import { DraftStatus } from "@/app/drafts/draft-status"
import { publishingKeys } from "@/lib/api/publishing-api"
import { NativeSelect } from "@/components/native-select"
import { Input } from "@aov/ui/components/input"
type Season = components["schemas"]["Season"]
const seasonDraftSchema = z.object({
  code: z.string(),
  displayName: z.string(),
  year: z.string(),
  number: z.string(),
  beforeSeasonId: z.string(),
})
export function SeasonSetup({ onDone }: { onDone?: () => void }) {
  const cache = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const { form, draft } = useDraftForm({
    form: "season:create",
    initialValue: { code: "", displayName: "", year: "", number: "", beforeSeasonId: "" },
    schema: seasonDraftSchema,
  })
  const seasons = useQuery({
    queryKey: publishingKeys.allRankedSeasons,
    queryFn: () => backendRequest<Season[]>("/admin/seasons"),
  })
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        const data = form.getValues()
        setBusy(true)
        setError("")
        try {
          await backendRequest("/admin/seasons", {
            method: "POST",
            body: JSON.stringify({
              code: data.code,
              displayName: data.displayName,
              seasonYear: data.year ? Number(data.year) : null,
              seasonNumber: data.number ? Number(data.number) : null,
              beforeSeasonId: data.beforeSeasonId || null,
            }),
          })
          await draft.discard()
          await Promise.all([
            cache.invalidateQueries({ queryKey: publishingKeys.allRankedSeasons }),
            cache.invalidateQueries({ queryKey: publishingKeys.overview }),
            cache.invalidateQueries({ queryKey: publishingKeys.allAuthoringSeasons }),
          ])
          onDone?.()
        } catch (cause) {
          setError(errorMessage(cause))
        } finally {
          setBusy(false)
        }
      }}
    >
      <DraftStatus draft={draft} disabled={busy} />
      <p className="text-sm text-muted-foreground">
        Mùa dùng chung giữa các thị trường. Lịch bắt đầu và kết thúc được thiết lập riêng sau khi tạo.
      </p>
      <fieldset disabled={busy || !draft.ready || draft.invalid} className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          Mã mùa
          <Input
            {...form.register("code")}
            placeholder="2026-s4"
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            required
            maxLength={64}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Tên hiển thị
          <Input {...form.register("displayName")} placeholder="S4 2026" required maxLength={120} />
        </label>
        <label className="grid gap-1 text-sm">
          Năm (tùy chọn)
          <Input {...form.register("year")} type="number" min={2000} max={9999} />
        </label>
        <label className="grid gap-1 text-sm">
          Số mùa (tùy chọn)
          <Input {...form.register("number")} type="number" min={1} />
        </label>
        <label className="grid gap-1 text-sm sm:col-span-2">
          Vị trí
          <NativeSelect
            {...form.register("beforeSeasonId")}
            className="w-full"
            disabled={seasons.isPending || seasons.isError}
          >
            <option value="">{seasons.data?.length ? "Sau tất cả mùa hiện có" : "Mùa đầu tiên"}</option>
            {seasons.data?.map((s) => (
              <option key={s.id} value={s.id}>
                Chèn trước {s.displayName}
              </option>
            ))}
          </NativeSelect>
        </label>
        <Button disabled={seasons.isPending || seasons.isError}>Tạo mùa</Button>
      </fieldset>
      {(error || seasons.error) && (
        <p role="alert" className="text-destructive">
          {error || errorMessage(seasons.error)}
        </p>
      )}
    </form>
  )
}

export function ReleaseSeasonFields({ regions }: { regions: Region[] }) {
  const [region, setRegion] = useState("")
  const seasons = useQuery({
    queryKey: publishingKeys.rankedSeasons(region),
    queryFn: () => backendRequest<Season[]>("/admin/seasons"),
    enabled: !!region,
  })
  return (
    <>
      <label className="grid gap-1 text-sm">
        Thị trường
        <NativeSelect
          className="w-full"
          name="regionId"
          required
          value={region}
          onChange={(e) => setRegion(e.target.value)}
        >
          <option value="">Chọn thị trường</option>
          {regions
            .filter((r) => r.available)
            .map((r) => (
              <option key={r.id} value={r.id}>
                {r.displayName}
              </option>
            ))}
        </NativeSelect>
      </label>
      <label className="grid gap-1 text-sm">
        Mùa xếp hạng (tùy chọn)
        <NativeSelect
          key={region}
          className="w-full"
          name="seasonId"
          defaultValue=""
          disabled={!region || seasons.isPending}
        >
          <option value="">Không gắn mùa</option>
          {seasons.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.displayName}
            </option>
          ))}
        </NativeSelect>
      </label>
      {seasons.error && <p role="alert">{errorMessage(seasons.error)}</p>}
    </>
  )
}
