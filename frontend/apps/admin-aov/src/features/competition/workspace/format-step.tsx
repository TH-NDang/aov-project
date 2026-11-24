import { Fragment, useState, type ReactNode } from "react"
import type { CompetitionStage } from "@aov/community-contracts"
import { ArrowRight, CalendarDays, CopyPlus, LayoutTemplate, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@aov/ui/components/dropdown-menu"
import { confirmAction } from "@/components/confirm-dialog"
import { TeamLogo } from "@/features/esports/components/primitives"
import { stageDays, stagesByDate } from "../model/schedule-model"
import {
  STAGE_TEMPLATES,
  STAGE_TEMPLATE_LABELS,
  duplicatedStage,
  freeStageCode,
  movedStage,
  templateStages,
  type StageTemplate,
} from "../model/stage-templates"
import { FORMAT_NAMES, hostOf, isLeagueStage } from "./model"
import { Chip, Notice, Panel, type Workspace } from "./parts"
import { StageFields, TIE_BREAK_PRESETS } from "./plan-fields"
import { StageCard } from "./stage-card"
import { StageRulesView } from "./stage-rules-view"
import { StageTeams } from "./stage-teams"

/** One card per stage in playing order; a stage opens for editing only when asked. */
export function FormatStep({ ws }: { ws: Workspace }) {
  const { plan, focus } = ws
  const region = (ws.entry.content.tournament.region || "VN").toUpperCase()
  const [selected, setSelected] = useState(focus.stage ?? plan.stages[0]?.code ?? "")
  const [editing, setEditing] = useState(focus.open === "stage")
  const stage = plan.stages.find((entry) => entry.code === selected) ?? plan.stages[0]
  const hasMatches = (code: string) => plan.matches.some((match) => match.stageCode === code)
  const setStages = (stages: CompetitionStage[]) => ws.change("stages", stages)
  const update = (value: CompetitionStage) =>
    setStages(plan.stages.map((row) => (row.code === stage?.code ? value : row)))
  const open = (code: string, edit = false) => {
    setSelected(code)
    setEditing(edit)
  }
  const applyTemplate = async (template: StageTemplate) => {
    const stages = templateStages(template, plan.sourceUrl)
    if (plan.stages.length) {
      const confirmed = await confirmAction({
        title: "Thay các giai đoạn bằng mẫu?",
        description: `${plan.stages.map((entry) => entry.name).join(", ")} → ${stages.map((entry) => entry.name).join(", ")}. Hoàn tác được trước khi lưu.`,
        confirmLabel: "Dùng mẫu",
      })
      if (!confirmed) return
    }
    setStages(stages)
    open(stages[0]!.code)
  }
  const add = () => {
    const code = freeStageCode(plan)
    setStages([...plan.stages, { ...templateStages("KNOCKOUT", plan.sourceUrl)[0]!, code, name: "Giai đoạn mới" }])
    open(code, true)
  }
  const duplicate = () => {
    if (!stage) return
    const copy = duplicatedStage(plan, stage)
    const at = plan.stages.findIndex((row) => row.code === stage.code)
    setStages([...plan.stages.slice(0, at + 1), copy, ...plan.stages.slice(at + 1)])
    open(copy.code, true)
  }
  const remove = async () => {
    if (!stage) return
    const confirmed = await confirmAction({
      title: `Bỏ giai đoạn ${stage.name}?`,
      description: "Giai đoạn chưa có trận nên chỉ thể thức của nó bị gỡ khi bạn lưu bản nháp.",
      confirmLabel: "Bỏ giai đoạn",
    })
    if (!confirmed) return
    ws.changeAll({
      stages: plan.stages.filter((row) => row.code !== stage.code),
      venues: plan.venues.map((venue) => (venue.stageCode === stage.code ? { ...venue, stageCode: "" } : venue)),
    })
    setEditing(false)
  }
  const dated = stagesByDate(plan)
  const outOfOrder = dated.some((row, index) => row.code !== plan.stages[index]?.code)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="type-section-title">Các giai đoạn · {plan.stages.length}</h2>
        {ws.canEdit && (
          <div className="flex flex-wrap gap-2">
            {outOfOrder && (
              <Button
                type="button"
                variant="outline"
                title={dated.map((row) => row.name).join(" → ")}
                onClick={() => setStages(dated)}
              >
                <CalendarDays aria-hidden /> Xếp theo ngày đấu
              </Button>
            )}
            {!plan.matches.length && (
              <>
                <Button type="button" variant="outline" onClick={() => ws.openCopy(["stages"])}>
                  <CopyPlus aria-hidden /> Chép từ giải khác
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline">
                      <LayoutTemplate aria-hidden /> Dùng mẫu
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {STAGE_TEMPLATES.map((template) => (
                      <DropdownMenuItem key={template} onSelect={() => void applyTemplate(template)}>
                        {STAGE_TEMPLATE_LABELS[template]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
            <Button type="button" variant="outline" onClick={add}>
              <Plus aria-hidden /> Thêm giai đoạn
            </Button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-stretch gap-3">
        {plan.stages.map((entry, index) => (
          <Fragment key={entry.code}>
            {index > 0 && <ArrowRight className="size-5 shrink-0 self-center text-muted-foreground" aria-hidden />}
            <StageCard
              ws={ws}
              stage={entry}
              index={index}
              active={entry.code === stage?.code}
              onOpen={() => open(entry.code)}
              onMove={
                ws.canEdit && plan.stages.length > 1
                  ? (offset) => setStages(movedStage(plan.stages, entry.code, offset))
                  : undefined
              }
            />
          </Fragment>
        ))}
      </div>
      {!plan.stages.length && <Notice>Chưa có giai đoạn.</Notice>}
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
                <Button type="button" variant="ghost" onClick={duplicate}>
                  <CopyPlus aria-hidden /> Nhân đôi
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditing(!editing)}>
                  <Pencil aria-hidden /> {editing ? "Xong" : "Sửa giai đoạn"}
                </Button>
              </div>
            )
          }
        >
          {editing && ws.canEdit ? (
            <div className="space-y-5 p-4">
              <StageFields
                stage={stage}
                region={region}
                days={stageDays(plan, stage.code)}
                others={plan.stages.filter((row) => row.code !== stage.code)}
                disabled={!ws.canEdit}
                onChange={update}
              />
              <StageTeams ws={ws} stage={stage} onChange={(teamIds) => update({ ...stage, teamIds })} />
            </div>
          ) : (
            <>
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
                {!!stage.teamIds?.length && (
                  <div className="sm:col-span-2 lg:col-span-4">
                    <Fact label={`Đội của giai đoạn · ${stage.teamIds.length}`}>
                      <span className="flex flex-wrap gap-2">
                        {stage.teamIds.map((id) => (
                          <Chip key={id} className="h-8 gap-2">
                            <TeamLogo team={ws.team(id)} size={20} /> {ws.team(id).name}
                          </Chip>
                        ))}
                      </span>
                    </Fact>
                  </div>
                )}
              </dl>
              <StageRulesView stage={stage} region={region} />
            </>
          )}
        </Panel>
      )}
    </div>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="type-label text-muted-foreground">{label}</dt>
      <dd className="type-body mt-1">{children}</dd>
    </div>
  )
}
