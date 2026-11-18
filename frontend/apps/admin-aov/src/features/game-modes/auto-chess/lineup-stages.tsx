import { useState } from "react"
import { Copy, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import type { GuideContent, GuideLineup } from "../game-mode-api"
import { type SectionProps, COST_COLOR } from "./guide-model"
import { Segmented, Thumb } from "./guide-fields"

const STAGE_LABEL = { EARLY: "Đầu trận", MID: "Giữa trận" } as const

/**
 * The boards a lineup passes through before its late game: pick the units for each stage, starting from the
 * lineup's own units, with a short note on how to play it.
 */
export function StageEditor({
  lineup,
  content,
  image,
  update,
}: {
  lineup: GuideLineup
  content: GuideContent
  image: SectionProps["image"]
  update: (next: GuideLineup) => void
}) {
  const [stage, setStage] = useState<"EARLY" | "MID">("EARLY")
  const stages = lineup.stages ?? []
  const current = stages.find((entry) => entry.stage === stage)
  const codes = current?.unitCodes ?? []
  const byCode = new Map(content.units.map((unit) => [unit.code, unit]))
  const write = (next: { unitCodes: string[]; note: string | null } | null) =>
    update({
      ...lineup,
      stages: [
        ...stages.filter((entry) => entry.stage !== stage),
        ...(next && (next.unitCodes.length || next.note) ? [{ stage, ...next }] : []),
      ].sort((a, b) => (a.stage === "EARLY" ? -1 : 1) - (b.stage === "EARLY" ? -1 : 1)),
    })
  const toggle = (code: string) =>
    write({
      unitCodes: codes.includes(code) ? codes.filter((entry) => entry !== code) : [...codes, code].slice(0, 11),
      note: current?.note ?? null,
    })
  const own = lineup.units.map((member) => member.unitCode)
  const others = content.units.filter((unit) => !own.includes(unit.code))
  const tile = (code: string) => {
    const unit = byCode.get(code)
    const on = codes.includes(code)
    return (
      <button
        key={code}
        type="button"
        aria-pressed={on}
        title={unit?.name ?? code}
        onClick={() => toggle(code)}
        className={`grid w-14 justify-items-center gap-0.5 rounded-md p-0.5 ${on ? "bg-primary/15 ring-2 ring-primary" : "opacity-75 hover:opacity-100"}`}
      >
        <Thumb src={image(unit?.portraitAssetId)} color={COST_COLOR[unit?.cost ?? 1]} />
        <span className="type-meta max-w-14 truncate">{unit?.name ?? code}</span>
      </button>
    )
  }
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Giai đoạn"
          value={stage}
          onChange={setStage}
          options={(["EARLY", "MID"] as const).map((value) => ({
            value,
            label: `${STAGE_LABEL[value]} · ${stages.find((entry) => entry.stage === value)?.unitCodes.length ?? 0}`,
          }))}
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!own.length}
          onClick={() => write({ unitCodes: own, note: current?.note ?? null })}
        >
          <Copy /> Chép từ đội hình chính
        </Button>
        {current && (
          <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => write(null)}>
            <Trash2 /> Bỏ {STAGE_LABEL[stage].toLowerCase()}
          </Button>
        )}
      </div>
      <div className="grid gap-1">
        <span className="type-label">Quân trong đội hình chính</span>
        <div className="flex flex-wrap gap-1">
          {own.length ? own.map(tile) : <span className="type-meta">Chưa có quân cờ nào.</span>}
        </div>
      </div>
      <details className="grid gap-1">
        <summary className="type-label cursor-pointer">Quân khác ({others.length})</summary>
        <div className="mt-1 flex max-h-56 flex-wrap gap-1 overflow-y-auto">
          {others.map((unit) => tile(unit.code))}
        </div>
      </details>
      <label className="grid gap-1">
        <span className="type-label">Ghi chú {STAGE_LABEL[stage].toLowerCase()}</span>
        <Input
          placeholder="vd. Giữ máu, lên cấp sớm"
          value={current?.note ?? ""}
          onChange={(event) => write({ unitCodes: codes, note: event.target.value || null })}
        />
      </label>
    </div>
  )
}
