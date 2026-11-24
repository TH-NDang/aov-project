import { useState } from "react"
import type { CompetitionStage, PlannedMatch } from "@aov/community-contracts"
import { Clock3, ListOrdered, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { NativeSelect } from "@/components/native-select"
import {
  ROUND_RULES,
  ROUND_RULE_LABELS,
  dateAndTime,
  numberedRounds,
  spreadTimes,
  type RoundRule,
} from "../model/schedule-model"
import type { Workspace } from "../workspace/parts"

const SHIFTS = [
  ["-1440", "Lùi 1 ngày"],
  ["-60", "Lùi 1 giờ"],
  ["-30", "Lùi 30 phút"],
  ["30", "Dời 30 phút"],
  ["60", "Dời 1 giờ"],
  ["1440", "Dời 1 ngày"],
  ["10080", "Dời 1 tuần"],
] as const

/** Tools that change many matches in one step; `scope` words what they act on. */
export function BulkTools({
  ws,
  stage,
  scope,
  targets,
  removable,
  onShift,
  onMatches,
  onRemove,
}: {
  ws: Workspace
  stage: CompetitionStage
  scope: string
  targets: PlannedMatch[]
  removable: number
  onShift: (minutes: number) => void
  onMatches: (matches: PlannedMatch[]) => void
  onRemove: () => void
}) {
  const [tool, setTool] = useState<"" | "spread" | "rounds">("")
  const firstTimed = targets.find((match) => match.scheduledAt)
  const [start, setStart] = useState(() => {
    const { date, time } = dateAndTime(firstTimed?.scheduledAt, ws.plan.timezone)
    return date ? `${date}T${time}` : ""
  })
  const [apart, setApart] = useState("180")
  const [perDay, setPerDay] = useState("2")
  const [daysApart, setDaysApart] = useState("1")
  const open = targets.filter((match) => !match.seriesId)
  const targetKeys = new Set(targets.map((match) => match.key))
  return (
    <div className="space-y-3 border-b bg-muted/30 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="type-label text-muted-foreground">Áp dụng cho {scope}</span>
        <NativeSelect
          aria-label="Dời giờ"
          value=""
          disabled={!targets.some((match) => match.scheduledAt)}
          onChange={(event) => event.target.value && onShift(Number(event.target.value))}
        >
          <option value="">Dời giờ…</option>
          {SHIFTS.map(([minutes, label]) => (
            <option key={minutes} value={minutes}>
              {label}
            </option>
          ))}
        </NativeSelect>
        <Button
          type="button"
          variant={tool === "spread" ? "secondary" : "outline"}
          aria-pressed={tool === "spread"}
          onClick={() => setTool(tool === "spread" ? "" : "spread")}
        >
          <Clock3 aria-hidden /> Xếp giờ lần lượt
        </Button>
        <Button
          type="button"
          variant={tool === "rounds" ? "secondary" : "outline"}
          aria-pressed={tool === "rounds"}
          onClick={() => setTool(tool === "rounds" ? "" : "rounds")}
        >
          <ListOrdered aria-hidden /> Đánh số vòng
        </Button>
        {open.length > 0 && (
          <NativeSelect
            aria-label="Đổi BO của các trận chưa mở"
            value=""
            onChange={(event) =>
              event.target.value &&
              onMatches(
                ws.plan.matches.map((match) =>
                  targetKeys.has(match.key) && !match.seriesId
                    ? { ...match, bestOf: Number(event.target.value) }
                    : match,
                ),
              )
            }
          >
            <option value="">Đổi BO…</option>
            {[1, 2, 3, 5, 7, 9].map((value) => (
              <option key={value} value={value}>
                BO{value}
              </option>
            ))}
          </NativeSelect>
        )}
        {ws.plan.stages.length > 1 && (
          <NativeSelect
            aria-label="Chuyển giai đoạn"
            value=""
            onChange={(event) =>
              event.target.value &&
              onMatches(
                ws.plan.matches.map((match) =>
                  targetKeys.has(match.key) ? { ...match, stageCode: event.target.value } : match,
                ),
              )
            }
          >
            <option value="">Chuyển giai đoạn…</option>
            {ws.plan.stages
              .filter((row) => row.code !== stage.code)
              .map((row) => (
                <option key={row.code} value={row.code}>
                  {row.name}
                </option>
              ))}
          </NativeSelect>
        )}
        {removable > 0 && (
          <Button type="button" variant="ghost" className="text-destructive" onClick={onRemove}>
            <Trash2 aria-hidden /> Bỏ {removable} trận chưa mở
          </Button>
        )}
      </div>
      {tool === "spread" && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5">
            <span className="type-label">Trận đầu</span>
            <Input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} />
          </label>
          <NumberField label="Cách nhau (phút)" value={apart} onChange={setApart} />
          <NumberField label="Trận mỗi ngày" value={perDay} onChange={setPerDay} />
          <NumberField label="Cách ngày" value={daysApart} onChange={setDaysApart} />
          <Button
            type="button"
            disabled={!start}
            onClick={() =>
              onMatches(
                spreadTimes(
                  ws.plan.matches,
                  targets.map((match) => match.key),
                  {
                    start,
                    minutesApart: Number(apart) || 0,
                    perDay: Number(perDay) || 1,
                    daysApart: Number(daysApart) || 1,
                  },
                  ws.plan.timezone,
                ),
              )
            }
          >
            Xếp giờ {targets.length} trận
          </Button>
        </div>
      )}
      {tool === "rounds" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="type-body">Cả giai đoạn {stage.name}:</span>
          {ROUND_RULES.map((rule: RoundRule) => (
            <Button
              key={rule}
              type="button"
              variant="outline"
              onClick={() =>
                onMatches(numberedRounds(ws.plan.matches, stage.code, rule, ws.plan.timezone, ws.resolved))
              }
            >
              {ROUND_RULE_LABELS[rule]}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid w-32 gap-1.5">
      <span className="type-label">{label}</span>
      <Input type="number" min={0} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}
