import { useState, type FormEvent, type ReactNode } from "react"
import { Link } from "react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { PlannedMatch, ResultVerification } from "@aov/community-contracts"
import { CalendarClock, ExternalLink, Pencil, PlayCircle, Swords, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { LocalTime } from "@aov/ui/components/local-time"
import { timeZoneLabel } from "@aov/ui/lib/time-zone"
import { confirmAction } from "@/components/confirm-dialog"
import { Field } from "@/features/community/components/profile-form-primitives"
import { youtubeVideoId } from "@/features/esports/model/vod"
import { matchPath } from "@/features/esports/pages/esports-shell"
import { tournamentApi, tournamentError, tournamentKeys } from "@/features/tournaments/api/tournament-api"
import { RESULT_VERIFICATIONS } from "@/features/tournaments/components/tournament-metadata"
import {
  hasScore,
  hostOf,
  isWebLink,
  matchLabel,
  matchTitleLabel,
  resultProblem,
  slotText,
  zonedInputInstant,
  zonedInputTime,
} from "./model"
import { BestOfField, SlotEditor, selectClass } from "./plan-fields"
import type { Workspace } from "./parts"

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="type-label text-muted-foreground">{label}</dt>
      <dd className="type-body mt-1 truncate">{children}</dd>
    </div>
  )
}

/**
 * Everything about one planned match. It opens read-only: the score form and the schedule fields appear only after the
 * editor asks for them, and replacing or clearing a score that is already there is confirmed with both values shown.
 */
export function MatchPanel({ ws, match }: { ws: Workspace; match: PlannedMatch }) {
  const [mode, setMode] = useState<"view" | "result" | "video" | "plan">("view")
  const resolved = ws.resolved.get(match.key)
  const record = ws.series.find((row) => row.id === match.seriesId)
  const result = record?.content.result
  const nameOf = (which: "a" | "b") => {
    const id = which === "a" ? resolved?.teamAId : resolved?.teamBId
    return id ? ws.team(id).name : slotText(match[which], ws.plan, ws.teams)
  }
  const video = youtubeVideoId(record?.content.sourceUrl)
  const ready = !!resolved?.teamAId && !!resolved?.teamBId

  if (mode === "result" && record)
    return <ResultForm ws={ws} match={match} onDone={() => setMode("view")} names={[nameOf("a"), nameOf("b")]} />
  if (mode === "video" && record) return <VideoForm ws={ws} match={match} onDone={() => setMode("view")} />
  if (mode === "plan") return <PlanForm ws={ws} match={match} onDone={() => setMode("view")} />

  return (
    <div className="space-y-4 bg-muted/40 px-4 py-4">
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        <Fact label="Giờ đấu">
          <LocalTime value={match.scheduledAt} sourceTimeZone={ws.plan.timezone} fallback="Chưa có giờ" />
        </Fact>
        <Fact label="Nguồn kết quả">
          {result?.sourceUrl ? (
            <a className="underline" href={result.sourceUrl} target="_blank" rel="noreferrer">
              {hostOf(result.sourceUrl)}
            </a>
          ) : (
            "Chưa có"
          )}
        </Fact>
        <Fact label="Mức xác minh">{result ? RESULT_VERIFICATIONS[result.verification] : "Chưa có"}</Fact>
        <Fact label="Video của trận">
          {video ? (
            <a
              className="inline-flex items-center gap-1.5 underline"
              href={record!.content.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              <PlayCircle className="size-4" aria-hidden /> YouTube <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : record?.content.sourceUrl ? (
            <a className="underline" href={record.content.sourceUrl} target="_blank" rel="noreferrer">
              Chưa có video · {hostOf(record.content.sourceUrl)}
            </a>
          ) : (
            "Chưa gắn video"
          )}
        </Fact>
      </dl>
      {resolved && !resolved.consistent && (
        <p className="type-body text-destructive" role="alert">
          Kết quả không còn khớp suất thi đấu. Kiểm tra hai đội và BO của trận trước khi công bố.
        </p>
      )}
      {!record && (
        <p className="type-meta">
          {ready
            ? "Hai đội đã xác định nhưng trận chưa mở nhập kết quả."
            : "Trận chờ đội từ các trận trước nên chưa nhập được kết quả."}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {record && ws.canEdit && (
          <Button type="button" variant="outline" onClick={() => setMode("result")}>
            <Pencil aria-hidden /> {hasScore(resolved) ? "Sửa tỷ số" : "Nhập tỷ số"}
          </Button>
        )}
        {!record && ready && ws.canEdit && (
          <Button type="button" variant="outline" onClick={() => ws.run("materialize")}>
            Mở nhập kết quả
          </Button>
        )}
        {record && ws.canEdit && (
          <Button type="button" variant="ghost" onClick={() => setMode("video")}>
            <PlayCircle aria-hidden /> {video ? "Đổi video" : "Gắn video"}
          </Button>
        )}
        {ws.canEdit && (
          <Button type="button" variant="ghost" onClick={() => setMode("plan")}>
            <CalendarClock aria-hidden /> Sửa lịch
          </Button>
        )}
        {record && (
          <Button asChild className="ml-auto">
            <Link to={`${matchPath(ws.entry.id, record.id)}?edit=1`}>
              <Swords aria-hidden /> Ghi ván đấu
            </Link>
          </Button>
        )}
      </div>
    </div>
  )
}

/** The match's video link on its own, so a video can be attached before or after the score is known. */
function VideoForm({ ws, match, onDone }: { ws: Workspace; match: PlannedMatch; onDone: () => void }) {
  const client = useQueryClient()
  const record = ws.series.find((row) => row.id === match.seriesId)!
  const current = record.content.sourceUrl ?? ""
  const [url, setUrl] = useState(current)
  const [problem, setProblem] = useState("")
  const save = useMutation({
    mutationFn: () => tournamentApi.save("series", record, { ...record.content, sourceUrl: url.trim() || undefined }),
    meta: { silent: true, successMessage: "Đã lưu link video." },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: tournamentKeys.all })
      onDone()
    },
  })
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const next = url.trim()
    const invalid = next && !isWebLink(next) ? "Link cần bắt đầu bằng https:// hoặc http://." : ""
    setProblem(invalid)
    if (invalid || next === current) return invalid ? undefined : onDone()
    if (youtubeVideoId(current)) {
      const confirmed = await confirmAction({
        title: next ? "Đổi video của trận?" : "Gỡ video của trận?",
        description: `${current} → ${next || "không có video"}. Mốc thời gian đã ghi ở các ván dùng video riêng của từng ván và không tự đổi theo.`,
        confirmLabel: next ? "Đổi video" : "Gỡ video",
      })
      if (!confirmed) return
    }
    save.mutate()
  }
  return (
    <form className="space-y-4 bg-muted/40 px-4 py-4" onSubmit={submit} aria-label="Video của trận">
      <Field
        label="Link video của trận (YouTube) hoặc trang nguồn"
        type="url"
        autoFocus
        placeholder="https://www.youtube.com/watch?v=…"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
      />
      {youtubeVideoId(url) && (
        <p className="type-meta">
          Nhận ra video YouTube. Ưu tiên bản phát của kênh chính thức để mốc thời gian không lệch.
        </p>
      )}
      {(problem || save.error) && (
        <p className="type-body text-destructive" role="alert">
          {problem || tournamentError(save.error)}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={save.isPending}>
          Lưu video
        </Button>
        <Button type="button" variant="ghost" disabled={save.isPending} onClick={onDone}>
          Hủy
        </Button>
      </div>
    </form>
  )
}

function ResultForm({
  ws,
  match,
  names,
  onDone,
}: {
  ws: Workspace
  match: PlannedMatch
  names: [string, string]
  onDone: () => void
}) {
  const client = useQueryClient()
  const record = ws.series.find((row) => row.id === match.seriesId)!
  const current = record.content.result
  const [scoreA, setScoreA] = useState(current ? String(current.scoreA) : "")
  const [scoreB, setScoreB] = useState(current ? String(current.scoreB) : "")
  const [source, setSource] = useState(current?.sourceUrl || ws.plan.sourceUrl || "")
  const [verification, setVerification] = useState<ResultVerification>(current?.verification ?? "UNVERIFIED")
  const [problem, setProblem] = useState("")
  const number = (value: string) => (value.trim() === "" ? null : Number(value))

  const save = useMutation({
    mutationFn: (clear: boolean) =>
      tournamentApi.save("series", record, {
        ...record.content,
        result: clear
          ? null
          : {
              scoreA: number(scoreA)!,
              scoreB: number(scoreB)!,
              sourceUrl: source.trim(),
              verification,
              verifiedOn: current?.verifiedOn ?? null,
            },
      }),
    meta: { silent: true, successMessage: "Đã lưu tỷ số." },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: tournamentKeys.all })
      onDone()
    },
  })

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const a = number(scoreA)
    const b = number(scoreB)
    const invalid = resultProblem(match.bestOf, a, b, source)
    setProblem(invalid ?? "")
    if (invalid) return
    if (current && (current.scoreA !== a || current.scoreB !== b)) {
      const confirmed = await confirmAction({
        title: "Đổi tỷ số đã nhập?",
        description: `${names[0]} ${current.scoreA} : ${current.scoreB} ${names[1]} → ${a} : ${b}. Bảng xếp hạng và nhánh đấu trong bản nháp đổi theo; trang công khai chỉ đổi sau khi công bố lại.`,
        confirmLabel: "Đổi tỷ số",
      })
      if (!confirmed) return
    }
    save.mutate(false)
  }
  const clear = async () => {
    if (!current) return
    const confirmed = await confirmAction({
      title: "Xóa tỷ số của trận này?",
      description: `${names[0]} ${current.scoreA} : ${current.scoreB} ${names[1]} sẽ trở về chưa có kết quả. Các ván đã ghi không bị xóa.`,
      confirmLabel: "Xóa tỷ số",
    })
    if (confirmed) save.mutate(true)
  }

  return (
    <form
      className="space-y-4 bg-muted/40 px-4 py-4"
      onSubmit={submit}
      aria-label={`Tỷ số ${names[0]} gặp ${names[1]}`}
    >
      <div className="grid gap-4 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid gap-2">
          <span className="type-label">Tỷ số · BO{match.bestOf}</span>
          <div className="flex items-center gap-2">
            <Input
              aria-label={`Số ván thắng của ${names[0]}`}
              className="w-16 text-center"
              inputMode="numeric"
              autoFocus
              value={scoreA}
              onChange={(event) => setScoreA(event.target.value.replace(/\D/g, ""))}
            />
            <span aria-hidden>:</span>
            <Input
              aria-label={`Số ván thắng của ${names[1]}`}
              className="w-16 text-center"
              inputMode="numeric"
              value={scoreB}
              onChange={(event) => setScoreB(event.target.value.replace(/\D/g, ""))}
            />
          </div>
          <span className="type-meta">
            {names[0]} : {names[1]}
          </span>
        </div>
        <Field label="Nguồn kết quả" type="url" value={source} onChange={(event) => setSource(event.target.value)} />
        <label className="grid gap-2">
          <span className="type-label">Mức xác minh</span>
          <select
            className={selectClass}
            value={verification}
            onChange={(event) => setVerification(event.target.value as ResultVerification)}
          >
            {Object.entries(RESULT_VERIFICATIONS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {(problem || save.error) && (
        <p className="type-body text-destructive" role="alert">
          {problem || tournamentError(save.error)}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={save.isPending}>
          Lưu tỷ số
        </Button>
        <Button type="button" variant="ghost" disabled={save.isPending} onClick={onDone}>
          Hủy
        </Button>
        {current && (
          <Button
            type="button"
            variant="ghost"
            className="ml-auto text-destructive"
            disabled={save.isPending}
            onClick={clear}
          >
            <Trash2 aria-hidden /> Xóa tỷ số
          </Button>
        )}
      </div>
      <p className="type-meta">Chỉ ghi khi bấm Lưu tỷ số. Trang công khai chỉ đổi sau khi công bố.</p>
    </form>
  )
}

/** Schedule fields of the plan. They change the draft plan only, which the save-draft button writes. */
function PlanForm({ ws, match, onDone }: { ws: Workspace; match: PlannedMatch; onDone: () => void }) {
  const index = ws.plan.matches.findIndex((row) => row.key === match.key)
  const update = (patch: Partial<PlannedMatch>) =>
    ws.change(
      "matches",
      ws.plan.matches.map((row) => (row.key === match.key ? { ...row, ...patch } : row)),
    )
  const remove = async () => {
    const confirmed = await confirmAction({
      title: "Bỏ trận nháp này?",
      description: `${matchLabel(match)} chưa có loạt trận thật nên sẽ bị gỡ khỏi lịch khi bạn lưu bản nháp.`,
      confirmLabel: "Bỏ trận",
    })
    if (!confirmed) return
    ws.change(
      "matches",
      ws.plan.matches.filter((row) => row.key !== match.key),
    )
  }
  return (
    <div className="space-y-4 bg-muted/40 px-4 py-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Field
          label="Tên trận"
          value={match.label ?? ""}
          placeholder={matchTitleLabel(match) ?? undefined}
          onChange={(event) => update({ label: event.target.value || null })}
        />
        <label className="grid gap-2">
          <span className="type-label">Giai đoạn</span>
          <select
            className={selectClass}
            value={match.stageCode}
            onChange={(event) => update({ stageCode: event.target.value })}
          >
            {ws.plan.stages.map((stage) => (
              <option key={stage.code} value={stage.code}>
                {stage.name}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="Vòng đấu"
          type="number"
          min={1}
          value={match.round}
          onChange={(event) => update({ round: Math.max(1, Number(event.target.value)) })}
        />
        <BestOfField
          label="BO của trận"
          disabled={!!match.seriesId}
          value={match.bestOf}
          onChange={(bestOf) => update({ bestOf })}
        />
        <SlotEditor
          label="Đội A"
          value={match.a}
          teams={ws.teams}
          entrants={ws.plan.entrants}
          previous={ws.plan.matches.slice(0, index)}
          disabled={!!match.seriesId}
          onChange={(a) => update({ a })}
        />
        <SlotEditor
          label="Đội B"
          value={match.b}
          teams={ws.teams}
          entrants={ws.plan.entrants}
          previous={ws.plan.matches.slice(0, index)}
          disabled={!!match.seriesId}
          onChange={(b) => update({ b })}
        />
        <Field
          label={`Giờ đấu (${timeZoneLabel(ws.plan.timezone)})`}
          type="datetime-local"
          value={zonedInputTime(match.scheduledAt, ws.plan.timezone)}
          onChange={(event) => update({ scheduledAt: zonedInputInstant(event.target.value, ws.plan.timezone) })}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Xong
        </Button>
        {!match.seriesId && (
          <Button type="button" variant="ghost" className="text-destructive" onClick={remove}>
            <Trash2 aria-hidden /> Bỏ trận nháp
          </Button>
        )}
        <span className="type-meta">Thay đổi lịch nằm trong bản nháp và được ghi khi bạn bấm Lưu bản nháp.</span>
      </div>
    </div>
  )
}
