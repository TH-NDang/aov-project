import { useState, type FormEvent } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@aov/ui/components/dialog"
import { Input } from "@aov/ui/components/input"
import { Label } from "@aov/ui/components/label"
import { NativeSelect } from "@/components/native-select"
import { Segmented } from "@/components/segmented"
import { errorMessage } from "@/lib/api/errors"
import { patchWatchApi, patchWatchKeys, type PatchNoteSource } from "./patch-watch-api"
import {
  HOUR_OPTIONS,
  isTimeOfDay,
  SCHEDULE_CHOICES,
  scheduleBody,
  scheduleChanged,
  scheduleDraft,
  SOURCE_NAMES,
  type ScheduleDraft,
} from "./patch-watch-model"

/** Changes when one source is read: a time every day, every few hours, or not until it is turned back on. */
export function ScheduleDialog({
  source,
  zoneLabel,
  onClose,
}: {
  source: PatchNoteSource | null
  zoneLabel: string
  onClose: () => void
}) {
  return (
    <Dialog open={!!source} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        {source && (
          <ScheduleForm
            key={`${source.code}:${source.version}`}
            source={source}
            zoneLabel={zoneLabel}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ScheduleForm({
  source,
  zoneLabel,
  onClose,
}: {
  source: PatchNoteSource
  zoneLabel: string
  onClose: () => void
}) {
  const cache = useQueryClient()
  const [draft, setDraft] = useState<ScheduleDraft>(() => scheduleDraft(source))
  const save = useMutation({
    mutationFn: () => patchWatchApi.changeSchedule(source.code, scheduleBody(source, draft)),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: patchWatchKeys.overview })
      onClose()
    },
    meta: { silent: true, successMessage: "Đã lưu lịch." },
  })
  const timeValid = draft.choice !== "DAILY" || isTimeOfDay(draft.dailyAt)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (timeValid) save.mutate()
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Lịch đọc {SOURCE_NAMES[source.code]}</DialogTitle>
        <DialogDescription>Chỉ đọc trang danh sách, mỗi lần một trang.</DialogDescription>
      </DialogHeader>

      <Segmented
        label="Cách đọc"
        value={draft.choice}
        options={SCHEDULE_CHOICES}
        onChange={(choice) => setDraft((current) => ({ ...current, choice }))}
      />

      {draft.choice === "DAILY" && (
        <div className="grid gap-1.5">
          <Label htmlFor="pw-daily-at">Giờ đọc ({zoneLabel})</Label>
          <Input
            id="pw-daily-at"
            type="time"
            step={60}
            required
            className="w-36"
            value={draft.dailyAt}
            aria-invalid={!timeValid}
            onChange={(event) => setDraft((current) => ({ ...current, dailyAt: event.target.value }))}
          />
        </div>
      )}
      {draft.choice === "EVERY_HOURS" && (
        <div className="grid gap-1.5">
          <Label htmlFor="pw-every-hours">Cách nhau</Label>
          <NativeSelect
            id="pw-every-hours"
            className="w-36"
            value={draft.everyHours}
            onChange={(event) => setDraft((current) => ({ ...current, everyHours: Number(event.target.value) }))}
          >
            {HOUR_OPTIONS.map((hours) => (
              <option key={hours} value={hours}>
                {hours} giờ
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
      {draft.choice === "PAUSED" && (
        <p className="type-body text-muted-foreground">Không đọc nguồn này cho tới khi bật lại. Lịch cũ được giữ.</p>
      )}

      {save.error && (
        <p role="alert" className="type-body text-destructive">
          {errorMessage(save.error)}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Hủy
        </Button>
        <Button type="submit" disabled={!timeValid || save.isPending || !scheduleChanged(source, draft)}>
          {save.isPending && <Loader2 className="size-4 animate-spin" />} Lưu lịch
        </Button>
      </DialogFooter>
    </form>
  )
}
