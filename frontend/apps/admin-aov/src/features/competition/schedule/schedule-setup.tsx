import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import type { CompetitionStage, PlannedMatch } from "@aov/community-contracts"
import { GitBranch, Settings2, Wand2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { confirmAction } from "@/components/confirm-dialog"
import { NativeSelect } from "@/components/native-select"
import { tournamentError } from "@/features/tournaments/api/tournament-api"
import { competitionApi } from "../competition-api"
import { inferredLinks, linkedMatches } from "../model/schedule-model"
import { isLeagueStage, matchLabel, slotText } from "../workspace/model"
import { Panel, type Workspace } from "../workspace/parts"
import { sideName } from "./match-groups"

const GENERATED = new Set(["ROUND_ROBIN", "SINGLE_ELIMINATION", "DOUBLE_ELIMINATION"])
const DOUBLE_SIZES = [4, 6, 8, 16, 32]

/** Tools that build the schedule of a stage. They sit behind a button because results are entered far more often. */
export function ScheduleSetup({ ws, stage }: { ws: Workspace; stage: CompetitionStage }) {
  const playing = ws.plan.entrants.filter(
    (entry) => entry.status !== "WITHDRAWN" && (!stage.teamIds?.length || stage.teamIds.includes(entry.teamId)),
  ).length
  const sizes = DOUBLE_SIZES.filter((size) => size <= playing)
  const [seeds, setSeeds] = useState(0)
  const [thirdPlace, setThirdPlace] = useState(false)
  const [opponent, setOpponent] = useState(3)
  const [preview, setPreview] = useState<PlannedMatch[] | null>(null)
  const double = stage.format === "DOUBLE_ELIMINATION"
  const single = stage.format === "SINGLE_ELIMINATION"
  const teams = seeds || (double ? (sizes.includes(6) ? 6 : (sizes.at(-1) ?? 0)) : playing)
  const generate = useMutation({
    mutationFn: () =>
      competitionApi.preview(ws.plan, stage.code, {
        opponent,
        ...(single || double ? { teams } : {}),
        ...(single ? { thirdPlace } : {}),
      }),
    onSuccess: setPreview,
    meta: { silent: true },
  })
  const matches = ws.plan.matches.filter((match) => match.stageCode === stage.code)
  const linked = matches.some((match) => match.seriesId)
  const waiting = ws.plan.matches.filter((match) => {
    const row = ws.resolved.get(match.key)
    return !match.seriesId && !!row?.teamAId && !!row?.teamBId
  }).length

  return (
    <Panel title={`Thiết lập lịch · ${stage.name}`} icon={Settings2}>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          {GENERATED.has(stage.format) && !linked && (
            <>
              {double && (
                <label className="grid gap-2">
                  <span className="type-label">Số hạt giống</span>
                  <NativeSelect value={teams} onChange={(event) => setSeeds(Number(event.target.value))}>
                    {sizes.map((size) => (
                      <option key={size} value={size}>
                        {size === 6 ? "6 · mẫu AOG" : size}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
              )}
              {single && (
                <label className="grid gap-2">
                  <span className="type-label">Số hạt giống</span>
                  <NativeSelect value={teams} onChange={(event) => setSeeds(Number(event.target.value))}>
                    {Array.from({ length: Math.max(0, playing - 1) }, (_, index) => index + 2).map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
              )}
              {double && teams === 6 && (
                <label className="grid gap-2">
                  <span className="type-label">Đối thủ do hạt giống 1 chọn</span>
                  <NativeSelect value={opponent} onChange={(event) => setOpponent(Number(event.target.value))}>
                    <option value={3}>Hạt giống 3</option>
                    <option value={4}>Hạt giống 4</option>
                  </NativeSelect>
                </label>
              )}
              {single && teams > 3 && (
                <label className="type-body flex h-9 items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={thirdPlace}
                    onChange={(event) => setThirdPlace(event.target.checked)}
                  />
                  Tranh hạng ba
                </label>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={generate.isPending || (double && !sizes.length) || playing < 2}
                onClick={() => generate.mutate()}
              >
                <Wand2 aria-hidden /> Tạo lịch {stage.name}
              </Button>
            </>
          )}
          {!isLeagueStage(stage) && <LinkBracket ws={ws} stage={stage} />}
          <Button type="button" disabled={ws.busy || !waiting} onClick={() => ws.run("materialize")}>
            Mở nhập kết quả cho {waiting} cặp đã xác định
          </Button>
        </div>
        {double && !linked && !sizes.length && (
          <p className="type-meta">Nhánh thắng/thua cần ít nhất bốn đội tham dự giai đoạn.</p>
        )}
        {generate.error && (
          <p className="type-body text-destructive" role="alert">
            {tournamentError(generate.error)}
          </p>
        )}
        {preview && (
          <div className="space-y-3 rounded-lg border p-3">
            <p className="type-label">
              Xem trước · {preview.length} trận
              {matches.length ? ` · thay ${matches.length} trận nháp của giai đoạn` : ""}
            </p>
            <ol className="grid max-h-72 gap-x-6 gap-y-1 overflow-auto sm:grid-cols-2">
              {preview.map((match) => (
                <li className="type-body" key={match.key}>
                  <span className="text-muted-foreground">{matchLabel(match)}</span> ·{" "}
                  {slotText(match.a, { ...ws.plan, matches: preview }, ws.teams)} –{" "}
                  {slotText(match.b, { ...ws.plan, matches: preview }, ws.teams)}
                </li>
              ))}
            </ol>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => {
                  ws.change("matches", [
                    ...ws.plan.matches.filter((match) => match.stageCode !== stage.code),
                    ...preview,
                  ])
                  setPreview(null)
                }}
              >
                Dùng lịch này
              </Button>
              <Button type="button" variant="outline" onClick={() => setPreview(null)}>
                Hủy
              </Button>
            </div>
          </div>
        )}
      </div>
    </Panel>
  )
}

/** Joins the matches of an imported bracket by who played next; the pairings stay as they are. */
export function LinkBracket({ ws, stage }: { ws: Workspace; stage: CompetitionStage }) {
  const links = inferredLinks(ws.plan, stage.code, ws.resolved)
  if (!links.length || !ws.canEdit) return null
  const apply = async () => {
    const name = (key: string) => {
      const match = ws.plan.matches.find((row) => row.key === key)!
      return `${sideName(ws, match, "a")} gặp ${sideName(ws, match, "b")}`
    }
    const confirmed = await confirmAction({
      title: `Nối ${links.length} suất của ${stage.name}?`,
      description:
        "Suất được đọc từ kết quả: đội thắng hoặc thua trận trước đi tới trận nào. Cặp đấu và tỷ số giữ nguyên. Hoàn tác được trước khi lưu.",
      details: (
        <ul className="type-body max-h-60 space-y-1 overflow-y-auto">
          {links.map((link) => (
            <li key={`${link.key}-${link.side}`}>
              {link.slot.type === "WINNER" ? "Thắng" : "Thua"} {name(link.from.key)} → {name(link.key)}
            </li>
          ))}
        </ul>
      ),
      confirmLabel: "Nối nhánh",
      tone: "publish",
    })
    if (confirmed) ws.change("matches", linkedMatches(ws.plan.matches, stage.code, links))
  }
  return (
    <Button type="button" variant="outline" onClick={() => void apply()}>
      <GitBranch aria-hidden /> Nối nhánh theo kết quả · {links.length} suất
    </Button>
  )
}
