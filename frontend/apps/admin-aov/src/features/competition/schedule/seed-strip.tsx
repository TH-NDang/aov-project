import { useState } from "react"
import type { PlannedMatch } from "@aov/community-contracts"
import { Pencil } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { confirmAction } from "@/components/confirm-dialog"
import { NativeSelect } from "@/components/native-select"
import { TeamLogo } from "@/features/esports/components/primitives"
import { seedsFromTables } from "../model/schedule-model"
import { Chip, Panel, type Workspace } from "../workspace/parts"

/** The playoff seeds over the bracket. On a phone they keep one line that scrolls sideways, under short actions. */
export function SeedStrip({ ws, matches }: { ws: Workspace; matches: PlannedMatch[] }) {
  const compact = usePageLayout() === "compact"
  const [editing, setEditing] = useState(false)
  const count = Math.max(
    0,
    ...matches.flatMap((match) => [match.a, match.b].map((slot) => (slot.type === "SEED" ? (slot.seed ?? 0) : 0))),
  )
  const seeds = Array.from({ length: count }, (_, index) => index + 1)
  const source = seedsFromTables(ws.plan.stages, ws.entry.content.standings, matches[0]?.stageCode ?? "", count)
  const fill = async () => {
    if (!source) return
    const next = source
    const describe = (values: Record<number, string>) =>
      seeds.map((seed) => (values[seed] ? ws.team(values[seed]).shortName : "–")).join(", ")
    if (Object.keys(ws.plan.playoffSeeds).length && describe(ws.plan.playoffSeeds) !== describe(next)) {
      const confirmed = await confirmAction({
        title: "Thay hạt giống hiện tại?",
        description: `${describe(ws.plan.playoffSeeds)} → ${describe(next)}. Nhánh đấu trong bản nháp đổi theo khi bạn lưu.`,
        confirmLabel: "Thay hạt giống",
      })
      if (!confirmed) return
    }
    ws.change("playoffSeeds", next)
  }
  const chips = seeds.map((seed) => {
    const id = ws.plan.playoffSeeds[seed]
    return (
      <Chip key={seed} className="h-8 shrink-0 gap-2">
        <span className="text-primary">{seed}</span>
        {id ? (
          <>
            <TeamLogo team={ws.team(id)} size={20} />
            <span className="text-foreground">{ws.team(id).shortName}</span>
          </>
        ) : (
          "Chưa xác định"
        )}
      </Chip>
    )
  })
  const actions = ws.canEdit && (
    <div className="flex shrink-0 items-center gap-2">
      {source && (
        <Button
          type="button"
          variant="ghost"
          size={compact ? "sm" : "default"}
          title="Lấy hạt giống từ bảng xếp hạng"
          onClick={fill}
        >
          {compact ? "Lấy từ BXH" : "Lấy từ bảng xếp hạng"}
        </Button>
      )}
      <Button type="button" variant="outline" size={compact ? "sm" : "default"} onClick={() => setEditing(!editing)}>
        <Pencil aria-hidden /> {editing ? "Xong" : compact ? "Sửa" : "Sửa hạt giống"}
      </Button>
    </div>
  )
  return (
    <Panel label="Hạt giống">
      {compact ? (
        <div className="space-y-2 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="type-label text-muted-foreground">Hạt giống</span>
            {actions}
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [&::-webkit-scrollbar]:hidden">{chips}</div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="type-label mr-1 text-muted-foreground">Hạt giống</span>
            {chips}
          </div>
          {actions}
        </div>
      )}
      {editing && ws.canEdit && (
        <div className="grid gap-3 border-t px-4 py-4 sm:grid-cols-3">
          {seeds.map((seed) => (
            <label key={seed} className="grid gap-2">
              <span className="type-label">Hạt giống {seed}</span>
              <NativeSelect
                className="w-full"
                value={ws.plan.playoffSeeds[seed] || ""}
                onChange={(event) => {
                  const values = { ...ws.plan.playoffSeeds }
                  if (event.target.value) values[seed] = event.target.value
                  else delete values[seed]
                  ws.change("playoffSeeds", values)
                }}
              >
                <option value="">Chưa xác định</option>
                {ws.plan.entrants
                  .filter((entry) => entry.status !== "WITHDRAWN")
                  .map((entry) => (
                    <option key={entry.teamId} value={entry.teamId}>
                      {ws.team(entry.teamId).name}
                    </option>
                  ))}
              </NativeSelect>
            </label>
          ))}
        </div>
      )}
    </Panel>
  )
}
