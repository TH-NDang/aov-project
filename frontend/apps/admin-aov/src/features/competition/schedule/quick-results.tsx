import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { ResultVerification } from "@aov/community-contracts"
import { Check, CircleAlert, Save, Swords } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { LocalTime } from "@aov/ui/components/local-time"
import { cn } from "@aov/ui/lib/utils"
import { confirmAction } from "@/components/confirm-dialog"
import { NativeSelect } from "@/components/native-select"
import { Field } from "@/features/community/components/profile-form-primitives"
import { TeamLogo } from "@/features/esports/components/primitives"
import { tournamentApi, tournamentError, tournamentKeys } from "@/features/tournaments/api/tournament-api"
import { RESULT_VERIFICATIONS } from "@/features/tournaments/components/tournament-metadata"
import {
  decidesSeries,
  pastedLinks,
  pastedScores,
  quickResultChanged,
  quickResultOf,
  quickResultProblem,
  scoreFromGames,
  type MatchFacts,
  type QuickResult,
} from "../model/schedule-model"
import { Panel, type Workspace } from "../workspace/parts"
import { sideName } from "./match-groups"

type Row = MatchFacts & { series: NonNullable<MatchFacts["series"]> }
type Cell = "scoreA" | "scoreB" | "video"

/**
 * Scores and videos of many matches in one table. A typed digit moves on to the next score, Enter to the next match,
 * and pasted lines fill the rows below. Nothing is written before saving, which lists the scores it would replace.
 */
export function QuickResults({
  ws,
  rows: facts,
  waiting,
  onDirtyChange,
}: {
  ws: Workspace
  rows: MatchFacts[]
  /** Matches with both teams known that have no series yet, so they take no result. */
  waiting: number
  onDirtyChange: (dirty: boolean) => void
}) {
  const client = useQueryClient()
  const table = useRef<HTMLDivElement>(null)
  const rows = facts.filter((row): row is Row => !!row.series)
  const [lines, setLines] = useState<Record<string, QuickResult>>({})
  const [source, setSource] = useState(ws.plan.sourceUrl)
  const [verification, setVerification] = useState<ResultVerification>("UNVERIFIED")
  const [problems, setProblems] = useState<Record<string, string>>({})
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const before = (row: Row) => quickResultOf(row.series.content)
  const line = (row: Row) => lines[row.match.key] ?? before(row)
  const changed = rows.filter((row) => quickResultChanged(line(row), before(row)))
  const dirty = changed.length > 0
  useEffect(() => {
    onDirtyChange(dirty)
    return () => onDirtyChange(false)
  }, [dirty, onDirtyChange])

  const set = (row: Row, patch: Partial<QuickResult>) => {
    setLines((current) => ({ ...current, [row.match.key]: { ...(current[row.match.key] ?? before(row)), ...patch } }))
    setProblems(({ [row.match.key]: _, ...rest }) => rest)
  }
  const focusCell = (index: number, cell: Cell) => {
    const target = table.current?.querySelector<HTMLInputElement>(`[data-cell="${index}:${cell}"]`)
    target?.focus()
    target?.select()
  }
  const onKey = (event: KeyboardEvent<HTMLInputElement>, index: number, cell: Cell) => {
    const move = event.key === "Enter" || event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0
    if (!move) return
    event.preventDefault()
    focusCell(index + move, event.key === "Enter" && cell === "scoreB" ? "scoreA" : cell)
  }
  const onPaste = (event: ClipboardEvent<HTMLInputElement>, index: number, cell: Cell) => {
    const text = event.clipboardData.getData("text")
    if (cell === "video" ? !text.includes("\n") : !/\d\s*[-:–—\s]\s*\d/.test(text) && !text.includes("\n")) return
    event.preventDefault()
    if (cell === "video") {
      pastedLinks(text).forEach((video, at) => video && rows[index + at] && set(rows[index + at]!, { video }))
      return
    }
    pastedScores(text).forEach(
      (score, at) => score && rows[index + at] && set(rows[index + at]!, { scoreA: score.a, scoreB: score.b }),
    )
  }
  // Scores the recorded games already decide, for matches nobody has entered a score for.
  const fromGames = rows.flatMap((row) => {
    if (row.series.content.result || lines[row.match.key]?.scoreA) return []
    const score = scoreFromGames(row.series.content, row.games)
    return score && decidesSeries(row.match.bestOf, score) ? [{ row, score }] : []
  })

  const save = useMutation({
    mutationFn: async (batch: Row[]) => {
      const failed: Record<string, string> = {}
      const saved: string[] = []
      for (const [at, row] of batch.entries()) {
        setProgress({ done: at, total: batch.length })
        const next = line(row)
        const was = before(row)
        const content = row.series.content
        const scored = next.scoreA !== was.scoreA || next.scoreB !== was.scoreB
        try {
          await tournamentApi.save("series", row.series, {
            ...content,
            sourceUrl: next.video.trim() || undefined,
            result: scored
              ? {
                  scoreA: Number(next.scoreA),
                  scoreB: Number(next.scoreB),
                  sourceUrl: source.trim(),
                  verification,
                  verifiedOn: content.result?.verifiedOn ?? null,
                }
              : content.result,
          })
          saved.push(row.match.key)
        } catch (error) {
          failed[row.match.key] = tournamentError(error)
        }
      }
      return { failed, saved }
    },
    meta: { silent: true },
    onSuccess: async ({ failed, saved }) => {
      setProblems(failed)
      setLines((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !saved.includes(key))))
      await client.invalidateQueries({ queryKey: tournamentKeys.all })
    },
    onSettled: () => setProgress(null),
  })

  const submit = async () => {
    const found: Record<string, string> = {}
    for (const row of changed) {
      const problem = quickResultProblem(row.match.bestOf, line(row), before(row), source)
      if (problem) found[row.match.key] = problem
    }
    setProblems(found)
    const first = rows.findIndex((row) => found[row.match.key])
    if (first >= 0) return focusCell(first, "scoreA")
    const replaced = changed.filter((row) => {
      const was = before(row)
      const next = line(row)
      return row.series.content.result && (was.scoreA !== next.scoreA || was.scoreB !== next.scoreB)
    })
    const videos = changed.filter((row) => before(row).video && before(row).video !== line(row).video.trim())
    if (replaced.length || videos.length) {
      const confirmed = await confirmAction({
        title: "Ghi đè dữ liệu đã nhập?",
        description: `${replaced.length} tỷ số và ${videos.length} video đã có sẽ đổi. Trang công khai chỉ đổi sau khi công bố lại.`,
        details: (
          <ul className="type-body max-h-60 space-y-1 overflow-y-auto">
            {replaced.map((row) => (
              <li key={row.match.key}>
                {sideName(ws, row.match, "a")} gặp {sideName(ws, row.match, "b")}: {before(row).scoreA} :{" "}
                {before(row).scoreB} → {line(row).scoreA} : {line(row).scoreB}
              </li>
            ))}
            {videos.map((row) => (
              <li key={`${row.match.key}-video`} className="truncate">
                Video {sideName(ws, row.match, "a")} gặp {sideName(ws, row.match, "b")}: {before(row).video} →{" "}
                {line(row).video.trim() || "không có"}
              </li>
            ))}
          </ul>
        ),
        confirmLabel: "Ghi đè",
      })
      if (!confirmed) return
    }
    save.mutate(changed)
  }

  const failures = Object.keys(problems).length
  return (
    <Panel
      title="Nhập kết quả"
      meta={`${rows.length} trận`}
      action={
        <div className="flex flex-wrap items-center gap-2">
          {waiting > 0 && ws.canEdit && (
            <Button type="button" variant="outline" disabled={ws.busy} onClick={() => ws.run("materialize")}>
              Mở nhập kết quả cho {waiting} cặp
            </Button>
          )}
          {fromGames.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                fromGames.forEach(({ row, score }) => set(row, { scoreA: String(score.a), scoreB: String(score.b) }))
              }
            >
              <Swords aria-hidden /> Điền {fromGames.length} tỷ số theo ván đã ghi
            </Button>
          )}
          <Button type="button" disabled={!dirty || save.isPending} onClick={() => void submit()}>
            <Save aria-hidden />
            {progress ? `Đang lưu ${progress.done + 1}/${progress.total}…` : `Lưu ${changed.length || ""} trận`}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 border-b p-4 md:grid-cols-[minmax(0,1fr)_240px]">
        <Field
          label="Nguồn của các tỷ số mới"
          type="url"
          value={source}
          onChange={(event) => setSource(event.target.value)}
        />
        <label className="grid gap-2">
          <span className="type-label">Mức xác minh</span>
          <NativeSelect
            className="w-full"
            value={verification}
            onChange={(event) => setVerification(event.target.value as ResultVerification)}
          >
            {Object.entries(RESULT_VERIFICATIONS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </label>
      </div>
      {failures > 0 && (
        <p className="type-body border-b px-4 py-3 text-destructive" role="alert">
          {failures} trận chưa lưu được. Lý do ở từng dòng.
        </p>
      )}
      <div ref={table} className="@container">
        {rows.map((row, index) => {
          const value = line(row)
          const touched = quickResultChanged(value, before(row))
          const problem = problems[row.match.key]
          const names = [sideName(ws, row.match, "a"), sideName(ws, row.match, "b")] as const
          const score = (cell: "scoreA" | "scoreB", name: string) => (
            <Input
              data-cell={`${index}:${cell}`}
              aria-label={`Số ván thắng của ${name}`}
              aria-invalid={!!problem || undefined}
              className="w-12 bg-background px-0 text-center tabular-nums"
              inputMode="numeric"
              maxLength={2}
              disabled={save.isPending || !ws.canEdit}
              value={value[cell]}
              onFocus={(event) => event.target.select()}
              onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, "")
                set(row, { [cell]: digits })
                if (digits.length === 1)
                  focusCell(cell === "scoreA" ? index : index + 1, cell === "scoreA" ? "scoreB" : "scoreA")
              }}
              onKeyDown={(event) => onKey(event, index, cell)}
              onPaste={(event) => onPaste(event, index, cell)}
            />
          )
          return (
            <div
              key={row.match.key}
              className={cn("border-b px-4 py-2 last:border-b-0", touched && "bg-(--aov-accent-soft)")}
            >
              <div className="grid items-center gap-x-3 gap-y-2 @4xl:grid-cols-[92px_minmax(0,1fr)_auto_minmax(0,1fr)_minmax(0,1.1fr)_20px]">
                <span className="type-meta">
                  <LocalTime
                    value={row.match.scheduledAt}
                    sourceTimeZone={ws.plan.timezone}
                    format={{ day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }}
                    fallback="Chưa có giờ"
                  />
                </span>
                <span className="flex min-w-0 items-center gap-2 @4xl:flex-row-reverse @4xl:text-right">
                  <TeamLogo team={ws.team(row.series.content.teamAId)} size={24} />
                  <span className="type-body truncate">{names[0]}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  {score("scoreA", names[0])}
                  <span aria-hidden>:</span>
                  {score("scoreB", names[1])}
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  <TeamLogo team={ws.team(row.series.content.teamBId)} size={24} />
                  <span className="type-body truncate">{names[1]}</span>
                </span>
                <Input
                  data-cell={`${index}:video`}
                  aria-label={`Video ${names[0]} gặp ${names[1]}`}
                  className="bg-background"
                  type="url"
                  placeholder="Link video"
                  disabled={save.isPending || !ws.canEdit}
                  value={value.video}
                  onChange={(event) => set(row, { video: event.target.value })}
                  onKeyDown={(event) => onKey(event, index, "video")}
                  onPaste={(event) => onPaste(event, index, "video")}
                />
                {problem ? (
                  <CircleAlert className="size-4 text-destructive" aria-hidden />
                ) : row.series.content.result && !touched ? (
                  <Check className="size-4 text-(--aov-success)" role="img" aria-label="Đã có tỷ số" />
                ) : (
                  <span />
                )}
              </div>
              {problem && <p className="type-meta mt-1 text-destructive">{problem}</p>}
            </div>
          )
        })}
        {!rows.length && (
          <p className="type-body px-4 py-6 text-muted-foreground">Không có trận nào nhận được kết quả ở đây.</p>
        )}
      </div>
    </Panel>
  )
}
