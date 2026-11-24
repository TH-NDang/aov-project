import { useRef, useState, type FormEvent } from "react"
import { useNavigate } from "react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { DocumentView, TournamentContent } from "@aov/community-contracts"
import { ArrowRight, Plus, RotateCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@aov/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@aov/ui/components/sheet"
import { useSession } from "@/app/auth/auth-gate"
import { confirmDiscard } from "@/components/confirm-dialog"
import { competitionApi } from "@/features/competition/competition-api"
import type { CopyPart } from "@/features/competition/model/copy-setup"
import { tournamentApi, tournamentError, tournamentKeys } from "../api/tournament-api"
import {
  DEFAULT_PARTS,
  changeField,
  createContent,
  createIssue,
  effectiveParts,
  newForm,
  withSource,
  type CreateKey,
} from "../model/create-tournament-model"
import { copySetup, missingParts, setupFinished, type PartOutcome } from "../model/setup-copy-runner"
import { CopySourceFields } from "./copy-source-fields"
import { CreateTournamentExtra, CreateTournamentFields } from "./create-tournament-fields"
import { RegistryLogo } from "./registry-logo"
import { SetupCopyReport } from "./setup-copy-report"

const path = (id: string) => `/tournaments/${id}`
const setupApi = { competition: competitionApi, tournament: tournamentApi }

/**
 * Creates a tournament and opens its workspace. It can start from an earlier one: its name, market and logos fill the
 * form and the chosen parts of its setup are copied once the new tournament exists. A copy that stops half way says
 * part by part what is there, and the new tournament can be opened all the same.
 */
export function CreateTournamentSheet({
  source: initialSource,
  defaults,
  onClose,
}: {
  /** The tournament to make a new season of. */
  source?: DocumentView<TournamentContent>
  /** Values to start from, such as a part's main event. */
  defaults?: Record<string, string>
  onClose: () => void
}) {
  const { actor } = useSession()
  const actorKey = `${actor?.issuer ?? ""}:${actor?.subject ?? ""}`
  const client = useQueryClient()
  const navigate = useNavigate()
  const [initial] = useState(() =>
    initialSource ? withSource(newForm(defaults), initialSource.content) : newForm(defaults),
  )
  const [form, setForm] = useState(initial)
  const [sourceId, setSourceId] = useState(initialSource?.id ?? "")
  const [parts, setParts] = useState<ReadonlySet<CopyPart>>(() => new Set(DEFAULT_PARTS))
  const [uploading, setUploading] = useState(false)
  const [issue, setIssue] = useState("")
  const [created, setCreated] = useState<DocumentView<TournamentContent> | null>(null)
  const [outcomes, setOutcomes] = useState<PartOutcome[]>([])
  const latestSource = useRef(sourceId)

  const refresh = () => client.invalidateQueries({ queryKey: tournamentKeys.all })
  const open = (id: string) => {
    onClose()
    void navigate(path(id))
  }
  const run = useMutation({
    meta: { silent: true },
    mutationFn: async (wanted: ReadonlySet<CopyPart>) => {
      const target = created ?? (await tournamentApi.create("tournaments", createContent(form.values)))
      setCreated(target)
      if (!sourceId || !wanted.size) return { target, left: [] as PartOutcome[] }
      const kept = outcomes.filter((row) => !wanted.has(row.part))
      const results = await copySetup({ targetId: target.id, sourceId, parts: wanted, api: setupApi }, (rows) =>
        setOutcomes([...kept, ...rows]),
      )
      return { target, left: results.filter((row) => row.state !== "done") }
    },
    onSuccess: ({ target, left }) => {
      void refresh()
      if (left.length) return
      toast.success(`Đã tạo ${target.content.name}.`)
      open(target.id)
    },
  })
  const busy = run.isPending || uploading
  const dirty = form !== initial || sourceId !== (initialSource?.id ?? "")

  async function chooseSource(id: string) {
    setSourceId(id)
    latestSource.current = id
    setIssue("")
    if (!id) return
    try {
      const source = await client.fetchQuery({
        queryKey: tournamentKeys.one("tournaments", actorKey, id),
        queryFn: ({ signal }) => tournamentApi.read("tournaments", id, signal),
      })
      if (latestSource.current === id) setForm((current) => withSource(current, source.content))
    } catch (error) {
      if (latestSource.current === id) setIssue(tournamentError(error))
    }
  }

  async function close() {
    if (busy) return
    if (dirty && !created) {
      const discard = await confirmDiscard({
        title: "Bỏ giải đang tạo?",
        description: "Giải chưa được lưu.",
      })
      if (!discard) return
    }
    onClose()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    event.stopPropagation()
    if (busy) return
    const problem = createIssue(form.values)
    setIssue(problem ?? "")
    if (!problem) run.mutate(sourceId ? effectiveParts(parts) : new Set())
  }
  const choosePart = (part: CopyPart, chosen: boolean) =>
    setParts((current) => new Set([...current].filter((other) => other !== part).concat(chosen ? [part] : [])))
  const change = (key: CreateKey, value: string) => setForm((current) => changeField(current, key, value))

  return (
    <Sheet open onOpenChange={(value) => !value && void close()}>
      <SheetContent
        className="tournament-registry-sheet"
        showCloseButton={!busy}
        onPointerDownOutside={(event) => busy && event.preventDefault()}
        onEscapeKeyDown={(event) => busy && event.preventDefault()}
      >
        <div className="flex items-center gap-3 pr-8">
          <RegistryLogo
            url={form.values.logoUrl}
            darkUrl={form.values.logoDarkUrl}
            name={form.values.name || "Giải đấu"}
          />
          <SheetTitle className="min-w-0 break-words">
            {created ? created.content.name : defaults?.parentTournamentId ? "Thêm phần của giải" : "Tạo giải đấu"}
          </SheetTitle>
        </div>
        <SheetDescription className="sr-only">
          {created ? "Tiến độ chép thiết lập" : "Tên, thị trường, lịch và thiết lập ban đầu của giải"}
        </SheetDescription>
        {created && outcomes.length > 0 ? (
          <div className="grid gap-4">
            <p className="type-body">
              {run.isPending
                ? "Giải đã được tạo. Đang chép thiết lập…"
                : setupFinished(outcomes)
                  ? "Giải đã được tạo cùng thiết lập đã chọn."
                  : "Giải đã được tạo, nhưng một phần thiết lập chưa chép được."}
            </p>
            <SetupCopyReport outcomes={outcomes} />
            {!run.isPending && (
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => open(created.id)}>
                  Mở giải
                  <ArrowRight aria-hidden="true" />
                </Button>
                {!setupFinished(outcomes) && (
                  <Button type="button" variant="outline" onClick={() => run.mutate(missingParts(outcomes))}>
                    <RotateCw aria-hidden="true" />
                    Chép lại phần còn thiếu
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : (
          <form className="tournament-registry-form" onSubmit={submit}>
            <fieldset disabled={busy}>
              <CreateTournamentFields form={form} onChange={change} />
              <CopySourceFields
                actorKey={actorKey}
                sourceId={sourceId}
                parts={parts}
                disabled={busy}
                onSource={(id) => void chooseSource(id)}
                onPart={choosePart}
              />
              <CreateTournamentExtra form={form} onChange={change} onBusyChange={setUploading} />
            </fieldset>
            {(issue || run.isError) && (
              <p className="tournament-error" role="alert">
                {issue || tournamentError(run.error)}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              <Plus aria-hidden="true" />
              {run.isPending ? "Đang tạo…" : sourceId ? "Tạo và chép thiết lập" : "Tạo và mở giải"}
            </Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}
