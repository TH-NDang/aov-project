import { useState, type ComponentType, type ReactNode } from "react"
import { useMutation } from "@tanstack/react-query"
import type { CompetitionStage, PlannedMatch } from "@aov/community-contracts"
import { Check, ClipboardPen, GitBranch, Wand2, Wrench, X } from "lucide-react"
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

/**
 * Tools that build the schedule of a stage. They sit behind a button because results are entered far more often. Each
 * tool says in a line what it does and, when it has nothing to do, says so instead of a dead button, so an open panel
 * explains itself. `onClose` is absent while the stage has no match yet: then the tools are all there is to show.
 */
export function ScheduleSetup({
  ws,
  stage,
  onClose,
}: {
  ws: Workspace
  stage: CompetitionStage
  onClose?: () => void
}) {
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
  // A league has no bracket to join, and a stage without matches nothing to join yet.
  const linker = isLeagueStage(stage) || !matches.length ? null : bracketLinker(ws, stage)
  // Opening matches for results works on the whole event, so the count is the event's too.
  const waiting = ws.plan.matches.filter((match) => {
    const row = ws.resolved.get(match.key)
    return !match.seriesId && !!row?.teamAId && !!row?.teamBId
  }).length
  const tooFew = double ? !sizes.length : playing < 2

  return (
    <Panel
      title={`Công cụ lịch · ${stage.name}`}
      icon={Wrench}
      action={
        onClose && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Đóng công cụ lịch"
            title="Đóng"
            onClick={onClose}
          >
            <X aria-hidden />
          </Button>
        )
      }
    >
      <ul className="divide-y">
        {GENERATED.has(stage.format) && (
          <Tool
            icon={Wand2}
            title="Tạo lịch tự động"
            text="Sinh cặp đấu theo thể thức, thay các trận nháp."
            done={linked ? "Đã có trận thật, không tạo lại." : undefined}
            below={
              <>
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
              </>
            }
          >
            {double && (
              <label className="grid gap-1.5">
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
              <label className="grid gap-1.5">
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
              <label className="grid gap-1.5">
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
              disabled={generate.isPending || tooFew}
              onClick={() => generate.mutate()}
            >
              Xem trước
            </Button>
          </Tool>
        )}
        {linker && (
          <Tool
            icon={GitBranch}
            title="Nối nhánh theo kết quả"
            text="Đọc tỷ số để đưa đội thắng, thua vào trận sau."
            done={linker.count ? undefined : "Không còn suất nào để nối."}
          >
            <Button type="button" variant="outline" onClick={() => void linker.apply()}>
              Nối {linker.count} suất
            </Button>
          </Tool>
        )}
        <Tool
          icon={ClipboardPen}
          title="Mở nhập kết quả"
          text="Tạo trận cho các cặp đã đủ hai đội, tính cả giải."
          done={waiting ? undefined : "Mọi cặp đã đủ đội đều đã mở."}
        >
          <Button type="button" disabled={ws.busy} onClick={() => ws.run("materialize")}>
            Mở {waiting} cặp
          </Button>
        </Tool>
      </ul>
    </Panel>
  )
}

/**
 * One tool of the panel: what it is and does on the left, its controls on the right (below on a phone). `done` stands
 * in for the controls when the tool has nothing to do; `below` takes the full width under the row.
 */
function Tool({
  icon: Icon,
  title,
  text,
  done,
  below,
  children,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  text: string
  done?: string
  below?: ReactNode
  children: ReactNode
}) {
  return (
    <li className="space-y-3 px-4 py-3.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-(--aov-radius-control) bg-muted text-muted-foreground">
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="type-label">{title}</p>
            <p className="type-meta">{text}</p>
          </div>
        </div>
        {done ? (
          <p className="type-meta flex items-center gap-1.5 sm:shrink-0">
            <Check className="size-4 text-(--aov-success)" aria-hidden /> {done}
          </p>
        ) : (
          <div className="flex flex-wrap items-end gap-2 sm:shrink-0 sm:justify-end [&>button]:max-sm:flex-1">
            {children}
          </div>
        )}
      </div>
      {below}
    </li>
  )
}

/**
 * Joins the matches of an imported bracket by who played next; the pairings stay as they are. Null when the editor may
 * not change the plan; `count` is how many slots would be joined, and `apply` asks first.
 */
export function bracketLinker(ws: Workspace, stage: CompetitionStage) {
  if (!ws.canEdit) return null
  const links = inferredLinks(ws.plan, stage.code, ws.resolved)
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
  return { count: links.length, apply }
}

/** The bracket joining offered on its own, beside a note that the stage's matches are not joined yet. */
export function LinkBracket({ ws, stage }: { ws: Workspace; stage: CompetitionStage }) {
  const linker = bracketLinker(ws, stage)
  if (!linker?.count) return null
  return (
    <Button type="button" variant="outline" onClick={() => void linker.apply()}>
      <GitBranch aria-hidden /> Nối nhánh theo kết quả · {linker.count} suất
    </Button>
  )
}
