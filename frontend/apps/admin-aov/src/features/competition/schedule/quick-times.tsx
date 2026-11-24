import { useState } from "react"
import type { CompetitionStage, PlannedMatch } from "@aov/community-contracts"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { timeZoneLabel } from "@aov/ui/lib/time-zone"
import { cn } from "@aov/ui/lib/utils"
import { confirmAction } from "@/components/confirm-dialog"
import { randomId } from "@/lib/random-id"
import { atDateAndTime, dateAndTime, shiftedTimes } from "../model/schedule-model"
import { extraMatch, matchLabel } from "../workspace/model"
import { Panel, type Workspace } from "../workspace/parts"
import { BestOfField, SlotSelect } from "../workspace/plan-fields"
import { BulkTools } from "./bulk-tools"

/**
 * The schedule of one stage as a table: rounds, times, pairings and order of many matches at once. Every change is one
 * step of the draft, so it can be undone, and is written when the draft is saved.
 */
export function QuickTimes({ ws, stage, shown }: { ws: Workspace; stage: CompetitionStage; shown: PlannedMatch[] }) {
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set())
  const keys = new Set(shown.map((match) => match.key))
  const chosen = shown.filter((match) => picked.has(match.key))
  // Without a selection the bulk tools act on every match on screen.
  const targets = chosen.length ? chosen : shown
  const targetKeys = new Set(targets.map((match) => match.key))
  const setMatches = (matches: PlannedMatch[]) => ws.change("matches", matches)
  const update = (key: string, patch: Partial<PlannedMatch>) =>
    setMatches(ws.plan.matches.map((match) => (match.key === key ? { ...match, ...patch } : match)))
  const toggle = (key: string) =>
    setPicked((current) => {
      const next = new Set(current)
      if (!next.delete(key)) next.add(key)
      return next
    })
  const move = (key: string, offset: -1 | 1) => {
    const at = shown.findIndex((match) => match.key === key)
    const other = shown[at + offset]
    if (!other) return
    const next = [...ws.plan.matches]
    const from = next.findIndex((match) => match.key === key)
    const to = next.findIndex((match) => match.key === other.key)
    ;[next[from], next[to]] = [next[to]!, next[from]!]
    setMatches(next)
  }
  const add = () => {
    const last = shown.at(-1)
    setMatches([
      ...ws.plan.matches,
      {
        ...extraMatch(stage, `M_${randomId().slice(0, 8)}`),
        round: last?.round ?? 1,
        bestOf: last?.bestOf ?? stage.bestOf,
      },
    ])
  }
  const removable = targets.filter((match) => !match.seriesId)
  const remove = async (matches: PlannedMatch[]) => {
    const confirmed = await confirmAction({
      title: matches.length === 1 ? `Bỏ ${matchLabel(matches[0]!)}?` : `Bỏ ${matches.length} trận chưa mở?`,
      description: "Trận chưa có loạt trận thật nên chỉ rời lịch khi bạn lưu bản nháp. Hoàn tác được trước khi lưu.",
      confirmLabel: "Bỏ trận",
    })
    if (!confirmed) return
    const gone = new Set(matches.map((match) => match.key))
    setMatches(ws.plan.matches.filter((match) => !gone.has(match.key)))
    setPicked(new Set())
  }

  return (
    <Panel
      title="Xếp lịch"
      meta={chosen.length ? `Đang chọn ${chosen.length}/${shown.length} trận` : `${shown.length} trận`}
      action={
        ws.canEdit && (
          <Button type="button" variant="outline" onClick={add}>
            <Plus aria-hidden /> Thêm trận
          </Button>
        )
      }
    >
      {ws.canEdit && shown.length > 0 && (
        <BulkTools
          ws={ws}
          stage={stage}
          scope={chosen.length ? `${chosen.length} trận đã chọn` : `cả ${shown.length} trận`}
          targets={targets}
          removable={removable.length}
          onShift={(minutes) => setMatches(shiftedTimes(ws.plan.matches, targetKeys, minutes))}
          onMatches={setMatches}
          onRemove={() => void remove(removable)}
        />
      )}
      <div className="overflow-x-auto overflow-y-hidden">
        <table className="w-full min-w-[1120px]">
          <thead>
            <tr className="type-label border-b text-left text-muted-foreground">
              <th className="w-10 py-2 pl-4 font-[inherit]">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  aria-label="Chọn tất cả trận đang hiện"
                  checked={shown.length > 0 && shown.every((match) => picked.has(match.key))}
                  onChange={(event) => setPicked(event.target.checked ? new Set(keys) : new Set())}
                />
              </th>
              <th className="w-20 px-2 py-2 font-[inherit]">Vòng</th>
              <th className="w-36 px-2 py-2 font-[inherit]">Ngày</th>
              <th className="w-28 px-2 py-2 font-[inherit]" title={timeZoneLabel(ws.plan.timezone)}>
                Giờ
              </th>
              <th className="px-2 py-2 font-[inherit]">Đội A</th>
              <th className="px-2 py-2 font-[inherit]">Đội B</th>
              <th className="w-24 px-2 py-2 font-[inherit]">BO</th>
              <th className="px-2 py-2 font-[inherit]">Tên trận</th>
              <th className="w-28 py-2 pr-4 font-[inherit]">
                <span className="sr-only">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((match, index) => {
              const { date, time } = dateAndTime(match.scheduledAt, ws.plan.timezone)
              const name = matchLabel(match)
              const before = ws.baseline.matches.find((row) => row.key === match.key)
              const touched = JSON.stringify(before) !== JSON.stringify(match)
              const previous = ws.plan.matches.slice(
                0,
                ws.plan.matches.findIndex((row) => row.key === match.key),
              )
              return (
                <tr key={match.key} className={cn("border-b last:border-b-0", touched && "bg-(--aov-accent-soft)")}>
                  <td className="py-1.5 pl-4">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      aria-label={`Chọn ${name}`}
                      checked={picked.has(match.key)}
                      onChange={() => toggle(match.key)}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      aria-label={`Vòng của ${name}`}
                      type="number"
                      min={1}
                      disabled={!ws.canEdit}
                      value={match.round}
                      onChange={(event) => update(match.key, { round: Math.max(1, Number(event.target.value)) })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      aria-label={`Ngày đấu của ${name}`}
                      type="date"
                      disabled={!ws.canEdit}
                      value={date}
                      onChange={(event) =>
                        update(match.key, { scheduledAt: atDateAndTime(event.target.value, time, ws.plan.timezone) })
                      }
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      aria-label={`Giờ đấu của ${name}`}
                      type="time"
                      disabled={!ws.canEdit || !date}
                      value={time}
                      onChange={(event) =>
                        update(match.key, { scheduledAt: atDateAndTime(date, event.target.value, ws.plan.timezone) })
                      }
                    />
                  </td>
                  {(["a", "b"] as const).map((side) => (
                    <td key={side} className="max-w-52 px-2 py-1.5">
                      <SlotSelect
                        label={`Đội ${side.toUpperCase()} của ${name}`}
                        value={match[side]}
                        teams={ws.teams}
                        entrants={ws.plan.entrants}
                        previous={previous}
                        disabled={!ws.canEdit || !!match.seriesId}
                        onChange={(slot) => update(match.key, { [side]: slot })}
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1.5">
                    <BestOfField
                      bare
                      label={`BO của ${name}`}
                      disabled={!ws.canEdit || !!match.seriesId}
                      value={match.bestOf}
                      onChange={(bestOf) => update(match.key, { bestOf })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      aria-label={`Tên của ${name}`}
                      disabled={!ws.canEdit}
                      placeholder={name}
                      value={match.label ?? ""}
                      onChange={(event) => update(match.key, { label: event.target.value || null })}
                    />
                  </td>
                  <td className="py-1.5 pr-4">
                    {ws.canEdit && (
                      <span className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={`Đưa ${name} lên`}
                          disabled={index === 0}
                          onClick={() => move(match.key, -1)}
                        >
                          <ArrowUp aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={`Đưa ${name} xuống`}
                          disabled={index === shown.length - 1}
                          onClick={() => move(match.key, 1)}
                        >
                          <ArrowDown aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={`Bỏ ${name}`}
                          title={match.seriesId ? "Trận đã mở nhập kết quả nên không bỏ khỏi lịch được" : "Bỏ trận"}
                          disabled={!!match.seriesId}
                          onClick={() => void remove([match])}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {!shown.length && <p className="type-body px-4 py-6 text-muted-foreground">Chưa có trận nào ở đây.</p>}
    </Panel>
  )
}
