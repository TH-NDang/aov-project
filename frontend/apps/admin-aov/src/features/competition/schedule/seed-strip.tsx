import { useState } from "react"
import type { PlannedMatch } from "@aov/community-contracts"
import { Pencil } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { confirmAction } from "@/components/confirm-dialog"
import { NativeSelect } from "@/components/native-select"
import { TeamLogo } from "@/features/esports/components/primitives"
import { seedsFromTables } from "../model/schedule-model"
import { Chip, Panel, type Workspace } from "../workspace/parts"

export function SeedStrip({ ws, matches }: { ws: Workspace; matches: PlannedMatch[] }) {
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
  return (
    <Panel label="Hạt giống">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="type-label mr-1 text-muted-foreground">Hạt giống</span>
          {seeds.map((seed) => {
            const id = ws.plan.playoffSeeds[seed]
            return (
              <Chip key={seed} className="h-8 gap-2">
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
          })}
        </div>
        {ws.canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            {source && (
              <Button type="button" variant="ghost" onClick={fill}>
                Lấy từ bảng xếp hạng
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => setEditing(!editing)}>
              <Pencil aria-hidden /> {editing ? "Xong" : "Sửa hạt giống"}
            </Button>
          </div>
        )}
      </div>
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
