import { ExternalLink, Settings2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { LocalTime } from "@aov/ui/components/local-time"
import type { PatchNoteSource } from "./patch-watch-api"
import { CHANNEL_LABELS, failureText, REGION_CODES, scheduleText, SOURCE_NAMES, timeOfDay } from "./patch-watch-model"
import "./source-card.css"

const SHORT: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "short" }

/** When one source is read and how its last read went, with the button that changes its schedule. */
export function SourceCard({
  source,
  zoneLabel,
  canWrite,
  onEdit,
}: {
  source: PatchNoteSource
  /** The zone of the daily time, as the card names it. */
  zoneLabel: string
  canWrite: boolean
  onEdit: () => void
}) {
  const failure = failureText(source)
  const health = !source.readable || source.paused ? "off" : failure ? "failing" : "ok"
  const name = SOURCE_NAMES[source.code]

  return (
    <li className="pw-source" data-health={health}>
      <div className="pw-source-head">
        <span className="pw-source-region">{REGION_CODES[source.region]}</span>
        <div className="min-w-0 flex-1">
          <p className="type-label truncate">{name}</p>
          <p className="type-meta truncate">{source.channels.map((channel) => CHANNEL_LABELS[channel]).join(" · ")}</p>
        </div>
        <Button asChild size="icon-sm" variant="ghost">
          <a href={source.pageUrl} target="_blank" rel="noreferrer" aria-label={`Mở trang ${name}`} title="Trang nguồn">
            <ExternalLink className="size-4" />
          </a>
        </Button>
        {canWrite && (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={`Đổi lịch ${name}`}
            title="Đổi lịch"
            onClick={onEdit}
          >
            <Settings2 className="size-4" />
          </Button>
        )}
      </div>

      <div className="pw-source-dial">
        {source.paused ? (
          <>
            <span className="pw-source-big">Tạm dừng</span>
            <span className="type-meta">
              trước đó {scheduleText({ ...source, paused: false }).toLocaleLowerCase("vi")}
            </span>
          </>
        ) : source.mode === "DAILY" ? (
          <>
            <span className="pw-source-big">{timeOfDay(source.dailyAt)}</span>
            <span className="type-meta">mỗi ngày, {zoneLabel}</span>
          </>
        ) : (
          <>
            <span className="pw-source-big">{source.everyHours} giờ</span>
            <span className="type-meta">một lần</span>
          </>
        )}
      </div>

      <div className="type-meta grid gap-0.5">
        {!source.readable ? (
          <p>Chỉ đọc được trên máy chủ.</p>
        ) : (
          <>
            {failure && <p className="pw-source-failure">{failure}</p>}
            {source.nextCheckAt && (
              <p>
                {failure ? "Thử lại" : "Lần tới"} <LocalTime value={source.nextCheckAt} format={SHORT} />
              </p>
            )}
            {failure && source.lastSuccessAt && (
              <p>
                Đọc được <LocalTime value={source.lastSuccessAt} format={SHORT} />
              </p>
            )}
            {!failure && !source.lastSuccessAt && <p>Chưa đọc lần nào.</p>}
          </>
        )}
      </div>
    </li>
  )
}
