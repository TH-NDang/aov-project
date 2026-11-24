import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query"
import type { LinkMention, LinkMentionCount, LinkMentionKind, PageSlice } from "@aov/community-contracts"
import { Link2, Loader2, Trophy, Undo2 } from "lucide-react"
import { Avatar, AvatarFallback } from "@aov/ui/components/avatar"
import { Button } from "@aov/ui/components/button"
import { confirmAction } from "@/components/confirm-dialog"
import { ThemedAvatarImage } from "@/components/themed-logo-img"
import { competitionKeys } from "@/features/competition/competition-api"
import { tournamentApi, tournamentError, tournamentKeys, type RecordKind } from "../api/tournament-api"
import { useLinkSuggestions } from "../api/use-link-suggestions"
import { mentionPlace, mentionsByTournament } from "../model/link-review-model"
import { LinkTakenError, runLinks, undoLinks, type LinkJob, type LinkRun } from "../model/link-review-runner"
import { mentionText } from "../model/link-suggestion-model"
import { PlayerPhoto } from "@/features/esports/components/primitives"
import { LinkReviewRow } from "./link-review-row"

/** How long a link can be taken back with one click. */
const UNDO_MS = 8000

const RECORDS: Record<LinkMentionKind, RecordKind> = {
  GAME_MVP: "games",
  SERIES_MVP: "series",
  SERIES_BROADCAST: "series",
  AWARD_PLAYER: "tournaments",
  AWARD_TEAM: "tournaments",
}

type Pages = InfiniteData<PageSlice<LinkMention>, number>
type Undoable = { id: number; text: string; run: LinkRun }

/** A row of the list: the same award can be written twice, so its place among equals tells the two apart. */
function rowKeys(mentions: readonly LinkMention[]) {
  const seen = new Map<string, number>()
  return new Map(
    mentions.map((mention) => {
      const key = [mention.recordId, mention.label, mention.text].join("|")
      const nth = seen.get(key) ?? 0
      seen.set(key, nth + 1)
      return [mention, `${key}|${nth}`]
    }),
  )
}

/**
 * The rows of one kind with the records they may be linked to. A link is written at once and can be taken back for a
 * few seconds; the rows whose record is beyond doubt can be linked together after a look at the list.
 */
export function LinkReviewList({
  mentions,
  kind,
  actorKey,
  canWrite,
}: {
  mentions: LinkMention[]
  kind: LinkMentionKind
  actorKey: string
  canWrite: boolean
}) {
  const client = useQueryClient()
  const suggestions = useLinkSuggestions(mentions, actorKey)
  const keys = rowKeys(mentions)
  const list = useRef<HTMLDivElement>(null)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const [busy, setBusy] = useState<ReadonlySet<LinkMention>>(new Set())
  const [undos, setUndos] = useState<Undoable[]>([])
  const [problem, setProblem] = useState("")
  const [step, setStep] = useState<{ done: number; total: number } | null>(null)

  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: tournamentKeys.linkReview(actorKey, kind) }),
      client.invalidateQueries({ queryKey: tournamentKeys.linkReviewFacets(actorKey) }),
      client.invalidateQueries({ queryKey: tournamentKeys.kind(RECORDS[kind]) }),
      client.invalidateQueries({ queryKey: competitionKeys.all }),
    ])
  /** Linked rows leave at once; the read that follows settles the pages behind them. */
  const drop = (linked: ReadonlySet<LinkMention>) => {
    client.setQueryData<Pages>(tournamentKeys.linkReview(actorKey, kind), (data) =>
      data
        ? {
            ...data,
            pages: data.pages.map((page) => ({ ...page, items: page.items.filter((item) => !linked.has(item)) })),
          }
        : data,
    )
    client.setQueryData<LinkMentionCount[]>(tournamentKeys.linkReviewFacets(actorKey), (rows) =>
      rows?.map((row) => (row.kind === kind ? { ...row, count: Math.max(0, row.count - linked.size) } : row)),
    )
  }
  const link = useMutation({
    // Rows may be lines of one record, so links wait for each other instead of racing for its version.
    mutationFn: (jobs: LinkJob[]) => {
      const run = queue.current.then(() =>
        runLinks(tournamentApi, jobs, (done) => jobs.length > 1 && setStep({ done, total: jobs.length })),
      )
      queue.current = run.catch(() => undefined)
      return run
    },
    meta: { silent: true },
    onSuccess: async (run) => {
      drop(new Set(run.linked.map(({ job }) => job.mention)))
      if (run.linked.length) setUndos((current) => [...current, { id: Date.now(), text: runText(run), run }])
      setProblem(run.failed.length ? failureText(run) : "")
      await refresh()
    },
    onSettled: (_run, _error, jobs) => {
      setStep(null)
      setBusy((current) => new Set([...current].filter((mention) => !jobs.some((job) => job.mention === mention))))
    },
  })
  const undo = useMutation({
    mutationFn: (entry: Undoable) => undoLinks(entry.run),
    meta: { silent: true },
    onMutate: (entry) => setUndos((current) => current.filter((other) => other.id !== entry.id)),
    onError: (error) =>
      setProblem(`Chưa hoàn tác được: ${error instanceof LinkTakenError ? error.message : tournamentError(error)}`),
    onSettled: refresh,
  })
  const start = (jobs: LinkJob[]) => {
    setBusy((current) => new Set([...current, ...jobs.map((job) => job.mention)]))
    link.mutate(jobs)
  }

  const rowsOf = () => [...(list.current?.querySelectorAll<HTMLElement>("[data-link-row]") ?? [])]
  const focusRow = (row?: HTMLElement) =>
    row
      ?.querySelector<HTMLElement>("button[data-link-main]:not(:disabled), [data-link-main] button, button, a")
      ?.focus()
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Events of an open picker reach here through its portal.
    if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return
    const current = (event.target as HTMLElement).closest<HTMLElement>("[data-link-row]")
    if (!current) return
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const rows = rowsOf()
      focusRow(rows[rows.indexOf(current) + (event.key === "ArrowDown" ? 1 : -1)])
      event.preventDefault()
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const buttons = [...current.querySelectorAll<HTMLElement>("button:not(:disabled), a")]
      buttons[buttons.indexOf(event.target as HTMLElement) + (event.key === "ArrowRight" ? 1 : -1)]?.focus()
      event.preventDefault()
    }
  }
  /** Linking moves on to the next row, so one hand on Enter goes down the list. */
  const linkRow = (job: LinkJob) => {
    const rows = rowsOf()
    const at = rows.findIndex((row) => row.contains(document.activeElement))
    if (at >= 0) focusRow(rows[at + 1] ?? rows[at - 1])
    start([job])
  }

  const certain = mentions.flatMap((mention): LinkJob[] => {
    const choices = busy.has(mention) ? null : suggestions.of(mention)?.certain
    return choices ? [{ mention, choices }] : []
  })
  const linkCertain = async () => {
    const confirmed = await confirmAction({
      title: `Liên kết ${certain.length} gợi ý chắc chắn?`,
      description: "Mỗi tên khớp đúng một hồ sơ. Ghi chú và tên trong văn bản giữ nguyên cách lưu của từng màn.",
      details: <CertainList jobs={certain} />,
      confirmLabel: `Liên kết ${certain.length} chỗ`,
      tone: "publish",
    })
    if (confirmed) start(certain)
  }

  return (
    <div className="space-y-4">
      {canWrite && certain.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" disabled={link.isPending} onClick={() => void linkCertain()}>
            {step ? <Loader2 className="animate-spin" aria-hidden /> : <Link2 aria-hidden />}
            {step ? `Đang liên kết ${step.done}/${step.total}` : `Liên kết ${certain.length} gợi ý chắc chắn`}
          </Button>
        </div>
      )}
      {problem && (
        <p className="type-body text-destructive" role="alert">
          {problem}
        </p>
      )}
      <div ref={list} className="space-y-4" onKeyDown={onKeyDown}>
        {mentionsByTournament(mentions).map((group, index) => (
          <section
            key={`${group.tournamentId}-${index}`}
            className="admin-panel @container overflow-hidden"
            aria-label={group.tournamentName}
          >
            <header className="flex items-center gap-3 border-b px-4 py-3">
              <TournamentLogo id={group.tournamentId} />
              <h2 className="type-section-title min-w-0 truncate">{group.tournamentName}</h2>
            </header>
            <ul className="divide-y">
              {group.mentions.map((mention) => (
                <LinkReviewRow
                  key={keys.get(mention)}
                  mention={mention}
                  suggestion={suggestions.of(mention)}
                  series={suggestions.series(mention)}
                  team={suggestions.team}
                  actorKey={actorKey}
                  busy={busy.has(mention)}
                  canWrite={canWrite}
                  onLink={(choices) => linkRow({ mention, choices })}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
      {undos.length > 0 && (
        <div className="fixed bottom-4 left-1/2 z-40 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 space-y-2">
          {undos.map((entry) => (
            <UndoLine
              key={entry.id}
              text={entry.text}
              onUndo={() => undo.mutate(entry)}
              onExpire={() => setUndos((current) => current.filter((other) => other.id !== entry.id))}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const choiceNames = (job: LinkJob) => job.choices.map((choice) => choice.name).join(", ")

const runText = ({ linked }: LinkRun) =>
  linked.length === 1
    ? `Đã liên kết ${mentionText(linked[0]!.job.mention.text)} → ${choiceNames(linked[0]!.job)}`
    : `Đã liên kết ${linked.length} chỗ`

function failureText({ failed }: LinkRun) {
  const { job, error } = failed[0]!
  const reason = error instanceof LinkTakenError ? error.message : tournamentError(error)
  return failed.length === 1
    ? `Chưa liên kết được “${mentionText(job.mention.text)}”: ${reason}`
    : `Chưa liên kết được ${failed.length} chỗ. ${reason}`
}

function UndoLine({ text, onUndo, onExpire }: { text: string; onUndo: () => void; onExpire: () => void }) {
  const expire = useRef(onExpire)
  expire.current = onExpire
  useEffect(() => {
    const timer = window.setTimeout(() => expire.current(), UNDO_MS)
    return () => window.clearTimeout(timer)
  }, [])
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-xl border bg-popover py-2 pr-2 pl-4 text-popover-foreground shadow-lg"
    >
      <span className="type-body min-w-0 truncate">{text}</span>
      <Button size="sm" variant="secondary" onClick={onUndo}>
        <Undo2 aria-hidden /> Hoàn tác
      </Button>
    </div>
  )
}

/** Every certain link before it is written: the name as written, the record, and where. */
function CertainList({ jobs }: { jobs: LinkJob[] }) {
  return (
    <ul className="max-h-72 divide-y overflow-y-auto">
      {jobs.map((job, index) => (
        <li key={index} className="flex items-center gap-2 py-1.5">
          {job.choices.map((choice) => (
            <PlayerPhoto key={choice.id} name={choice.name} url={choice.imageUrl ?? undefined} size={24} />
          ))}
          <span className="min-w-0">
            <span className="block">
              {mentionText(job.mention.text)} → <b>{choiceNames(job)}</b>
            </span>
            <span className="type-meta block truncate">
              {job.mention.tournamentName} · {mentionPlace(job.mention)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}

/** The tournament's logo, read the way the pickers read it, so it is shared with them. */
function TournamentLogo({ id }: { id: string }) {
  const tournament = useQuery({
    queryKey: tournamentKeys.pickerSelected("tournaments", id),
    queryFn: ({ signal }) => tournamentApi.read("tournaments", id, signal),
    staleTime: 60_000,
  })
  return (
    <Avatar className="size-8 shrink-0 rounded-lg border bg-background">
      <ThemedAvatarImage url={tournament.data?.content.logoUrl} darkUrl={tournament.data?.content.logoDarkUrl} />
      <AvatarFallback className="rounded-lg">
        <Trophy className="size-4" />
      </AvatarFallback>
    </Avatar>
  )
}
