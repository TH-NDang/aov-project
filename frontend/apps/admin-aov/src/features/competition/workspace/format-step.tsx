import { Fragment, useState } from "react"
import { aogStages, type CompetitionStage } from "@aov/community-contracts"
import { ArrowRight, GitBranch, ListOrdered, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { confirmAction } from "@/components/confirm-dialog"
import { FORMAT_NAMES, hostOf, isLeagueStage, stageProgress } from "./model"
import { Chip, Notice, Panel, type Workspace } from "./parts"
import { StageFields, TIE_BREAK_PRESETS } from "./plan-fields"

/** One card per stage in playing order; a stage opens for editing only when asked. */
export function FormatStep({ ws }: { ws: Workspace }) {
  const { plan } = ws
  const [selected, setSelected] = useState(plan.stages[0]?.code ?? "")
  const [editing, setEditing] = useState(false)
  const stage = plan.stages.find((entry) => entry.code === selected) ?? plan.stages[0]
  const hasMatches = (code: string) => plan.matches.some((match) => match.stageCode === code)
  const update = (value: CompetitionStage) =>
    ws.change(
      "stages",
      plan.stages.map((row) => (row.code === stage?.code ? value : row)),
    )
  const useTemplate = async () => {
    if (plan.stages.length) {
      const confirmed = await confirmAction({
        title: "Thay các giai đoạn bằng mẫu AOG?",
        description: `${plan.stages.map((entry) => entry.name).join(", ")} → Vòng bảng, Playoffs. Thay đổi được ghi khi bạn lưu bản nháp.`,
        confirmLabel: "Dùng mẫu",
      })
      if (!confirmed) return
    }
    const stages = aogStages(plan.sourceUrl)
    ws.change("stages", stages)
    setSelected(stages[0]!.code)
  }
  const add = () => {
    const code = `STAGE_${plan.stages.length + 1}`
    ws.change("stages", [
      ...plan.stages,
      { ...aogStages(plan.sourceUrl)[0]!, code, name: "Giai đoạn mới", format: "CUSTOM", legs: 1, advance: 0 },
    ])
    setSelected(code)
    setEditing(true)
  }
  const remove = async () => {
    if (!stage) return
    const confirmed = await confirmAction({
      title: `Bỏ giai đoạn ${stage.name}?`,
      description: "Giai đoạn chưa có trận nên chỉ thể thức của nó bị gỡ khi bạn lưu bản nháp.",
      confirmLabel: "Bỏ giai đoạn",
    })
    if (!confirmed) return
    ws.change(
      "stages",
      plan.stages.filter((row) => row.code !== stage.code),
    )
    setEditing(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="type-section-title">Các giai đoạn · {plan.stages.length}</h2>
        {ws.canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={plan.matches.length > 0}
              onClick={() => void useTemplate()}
            >
              Dùng mẫu AOG · 9 đội
            </Button>
            <Button type="button" variant="outline" onClick={add}>
              <Plus aria-hidden /> Thêm giai đoạn
            </Button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-stretch gap-3">
        {plan.stages.map((entry, index) => {
          const progress = stageProgress(entry.code, plan, ws.resolved)
          const league = isLeagueStage(entry)
          const active = entry.code === stage?.code
          return (
            <Fragment key={entry.code}>
              {index > 0 && <ArrowRight className="size-5 shrink-0 self-center text-muted-foreground" aria-hidden />}
              <button
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setSelected(entry.code)
                  setEditing(false)
                }}
                className={cn(
                  "admin-panel min-w-64 flex-1 p-4 text-left transition-colors hover:border-foreground/40",
                  active && "border-primary",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="type-label flex items-center gap-1.5 text-muted-foreground">
                    {league ? (
                      <ListOrdered className="size-4" aria-hidden />
                    ) : (
                      <GitBranch className="size-4" aria-hidden />
                    )}
                    Giai đoạn {index + 1}
                  </span>
                  <Chip
                    tone={
                      progress.total && progress.scored === progress.total ? "ok" : progress.total ? "warn" : "neutral"
                    }
                  >
                    {progress.total ? `${progress.scored}/${progress.total} trận` : "Chưa có lịch"}
                  </Chip>
                </span>
                <span className="type-section-title mt-1.5 block">{entry.name}</span>
                <span className="mt-2.5 flex flex-wrap gap-1.5">
                  <Chip>
                    {FORMAT_NAMES[entry.format] ?? entry.format}
                    {league && entry.legs > 1 ? ` ${entry.legs} lượt` : ""}
                  </Chip>
                  <Chip>BO{entry.bestOf}</Chip>
                  {league && entry.advance > 0 && <Chip tone="gold">{entry.advance} đội đi tiếp</Chip>}
                </span>
              </button>
            </Fragment>
          )
        })}
      </div>
      {!plan.stages.length && <Notice>Chưa có giai đoạn. Dùng mẫu AOG hoặc thêm từng giai đoạn.</Notice>}
      {stage && (
        <Panel
          title={stage.name}
          meta={FORMAT_NAMES[stage.format] ?? stage.format}
          action={
            ws.canEdit && (
              <div className="flex flex-wrap gap-2">
                {editing && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive"
                    disabled={hasMatches(stage.code)}
                    title={hasMatches(stage.code) ? "Giai đoạn đã có trận nên chưa bỏ được" : undefined}
                    onClick={() => void remove()}
                  >
                    <Trash2 aria-hidden /> Bỏ giai đoạn
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={() => setEditing(!editing)}>
                  <Pencil aria-hidden /> {editing ? "Xong" : "Sửa giai đoạn"}
                </Button>
              </div>
            )
          }
        >
          {editing && ws.canEdit ? (
            <div className="space-y-3 p-4">
              <StageFields stage={stage} disabled={!ws.canEdit} onChange={update} />
              <p className="type-meta">Thay đổi thể thức nằm trong bản nháp và được ghi khi bạn bấm Lưu bản nháp.</p>
            </div>
          ) : (
            <dl className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <Fact label="Cách đấu">
                {FORMAT_NAMES[stage.format] ?? stage.format}
                {isLeagueStage(stage) ? ` · ${stage.legs} lượt` : ""} · BO{stage.bestOf}
              </Fact>
              {isLeagueStage(stage) && (
                <>
                  <Fact label="Điểm">
                    Thắng {stage.winPoints} · Thua {stage.lossPoints}
                  </Fact>
                  <Fact label="Đi tiếp">{stage.advance ? `${stage.advance} đội` : "Không xét"}</Fact>
                  <Fact label="Khi bằng điểm">
                    {TIE_BREAK_PRESETS[stage.tieBreakers.join(",")] ?? stage.tieBreakers.join(" → ")}
                  </Fact>
                </>
              )}
              <Fact label="Nguồn điều lệ">
                {stage.sourceUrl ? (
                  <a className="underline" href={stage.sourceUrl} target="_blank" rel="noreferrer">
                    {hostOf(stage.sourceUrl)}
                  </a>
                ) : (
                  "Chưa có"
                )}
              </Fact>
              <Fact label="Phiên bản / quy tắc cấm chọn">{stage.patchNote || "Chưa ghi"}</Fact>
            </dl>
          )}
        </Panel>
      )}
      <Notice>
        Mẫu là điểm bắt đầu biên tập. Đối chiếu điểm số, tiêu chí phụ và nhánh đấu với điều lệ chính thức trước khi công
        bố.
      </Notice>
    </div>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="type-label text-muted-foreground">{label}</dt>
      <dd className="type-body mt-1">{children}</dd>
    </div>
  )
}
