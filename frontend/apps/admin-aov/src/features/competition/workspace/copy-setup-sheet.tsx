import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { CompetitionPlan, DocumentView, TournamentContent } from "@aov/community-contracts"
import { CopyPlus } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import { confirmAction } from "@/components/confirm-dialog"
import { RecordPicker } from "@/features/tournaments/components/record-picker"
import { tournamentApi, tournamentError, tournamentKeys } from "@/features/tournaments/api/tournament-api"
import { competitionApi, competitionKeys } from "../competition-api"
import {
  COPY_PARTS,
  COPY_PART_LABELS,
  copiedRoster,
  planWithCopy,
  rosterBatches,
  rosterContents,
  tournamentWithCopy,
  type CopyPart,
} from "../model/copy-setup"
import type { Workspace } from "./parts"

/**
 * Takes over the setup of another tournament, such as last season's. Teams, stages and facts go into the draft as one
 * undoable step; rosters and people are records of their own and are written at once, after a confirmation.
 */
export function CopySetupSheet({
  ws,
  record,
  initialParts,
  onPlan,
  onClose,
}: {
  ws: Workspace
  record?: DocumentView<TournamentContent>
  initialParts?: CopyPart[]
  onPlan: (plan: CompetitionPlan) => void
  onClose: () => void
}) {
  const client = useQueryClient()
  const [sourceId, setSourceId] = useState("")
  const [parts, setParts] = useState<ReadonlySet<CopyPart>>(() => new Set(initialParts ?? COPY_PARTS))
  const source = useQuery({
    queryKey: competitionKeys.plan(ws.access.actorKey, sourceId),
    queryFn: () => competitionApi.read(sourceId),
    enabled: !!sourceId,
  })
  const rosters = useQuery({
    queryKey: tournamentKeys.inTournament("roster-memberships", ws.access.actorKey, sourceId),
    queryFn: ({ signal }) => tournamentApi.list("roster-memberships", signal, { tournamentId: sourceId }),
    enabled: !!sourceId,
  })
  const hasMatches = ws.plan.matches.length > 0
  const plan = source.data && planWithCopy(ws.plan, source.data.content.plan, parts)
  const teamIds = new Set(plan?.entrants.map((entry) => entry.teamId))
  const lines =
    parts.has("rosters") && rosters.data
      ? copiedRoster(rosterContents(rosters.data), ws.entry.id, rosterContents(ws.rosters), teamIds)
      : []
  const counts: Record<CopyPart, string> | null = source.data
    ? {
        info: source.data.content.plan.organizer || "",
        entrants: `${source.data.content.plan.entrants.length} đội`,
        rosters: rosters.data ? `${rosters.data.length} dòng` : "…",
        stages: `${source.data.content.plan.stages.length} giai đoạn`,
        staff: `${source.data.content.tournament.staff?.length ?? 0} người`,
        broadcast: `${source.data.content.tournament.broadcast?.length ?? 0} người`,
      }
    : null

  const copy = useMutation({
    mutationFn: async () => {
      if (!source.data || !plan) return
      if (parts.has("staff") || parts.has("broadcast")) {
        const current = record ?? (await tournamentApi.read("tournaments", ws.entry.id))
        await tournamentApi.save(
          "tournaments",
          current,
          tournamentWithCopy(current.content, source.data.content.tournament, parts, teamIds),
        )
      }
      for (const batch of rosterBatches(lines)) await tournamentApi.rosterBatch(batch)
    },
    meta: { silent: true, successMessage: "Đã chép thiết lập. Lưu bản nháp để ghi đội và giai đoạn." },
    onSuccess: () => {
      if (plan && source.data) {
        for (const entry of plan.entrants) {
          const team = source.data.content.teams[entry.teamId]
          if (team) ws.rememberTeam(entry.teamId, team.name, team)
        }
        onPlan(plan)
      }
      onClose()
      void client.invalidateQueries({ queryKey: tournamentKeys.all })
    },
  })
  const submit = async () => {
    const written = [
      ...(lines.length ? [`thêm ${lines.length} dòng đội hình`] : []),
      ...(parts.has("staff") ? ["thêm ban huấn luyện"] : []),
      ...(parts.has("broadcast")
        ? [
            `ê-kíp phát sóng: ${record?.content.broadcast?.length ?? 0} → ${source.data?.content.tournament.broadcast?.length ?? 0} người`,
          ]
        : []),
    ]
    const replaced = parts.has("stages") && ws.plan.stages.length > 0
    if (written.length || replaced) {
      const confirmed = await confirmAction({
        title: `Chép thiết lập từ ${source.data?.content.tournament.name ?? "giải đã chọn"}?`,
        description: [
          ...(replaced
            ? [
                `Giai đoạn trong bản nháp: ${ws.plan.stages.map((stage) => stage.name).join(", ")} → ${plan!.stages.map((stage) => stage.name).join(", ")}.`,
              ]
            : []),
          ...(written.length ? [`Ghi ngay: ${written.join("; ")}.`] : []),
        ].join(" "),
        confirmLabel: "Chép thiết lập",
        tone: "publish",
      })
      if (!confirmed) return
    }
    copy.mutate()
  }

  return (
    <Sheet open onOpenChange={(open) => !open && !copy.isPending && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b p-6 pr-12">
          <SheetTitle className="type-section-title">Chép thiết lập từ giải khác</SheetTitle>
          <SheetDescription className="sr-only">Chọn giải và phần cần chép.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
          <RecordPicker
            kind="tournaments"
            label="Giải để chép"
            value={sourceId}
            exclude={[ws.entry.id]}
            onChange={setSourceId}
          />
          <fieldset className="space-y-1" disabled={!source.data || copy.isPending}>
            <legend className="type-label mb-2">Phần cần chép</legend>
            {COPY_PARTS.map((part) => {
              const locked = part === "stages" && hasMatches
              return (
                <label key={part} className="flex min-h-11 items-center gap-3 rounded-md px-2 hover:bg-muted/60">
                  <input
                    type="checkbox"
                    className="size-4 shrink-0 accent-primary"
                    checked={parts.has(part) && !locked}
                    disabled={locked}
                    onChange={(event) =>
                      setParts((current) => {
                        const next = new Set(current)
                        if (event.target.checked) next.add(part)
                        else next.delete(part)
                        return next
                      })
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="type-body block">{COPY_PART_LABELS[part]}</span>
                    {locked && <span className="type-meta block">Giải đã có lịch nên không thay giai đoạn.</span>}
                  </span>
                  {counts && <span className="type-meta shrink-0">{counts[part]}</span>}
                </label>
              )
            })}
          </fieldset>
          {(source.error || copy.error) && (
            <p className="type-body text-destructive" role="alert">
              {tournamentError(source.error ?? copy.error)}
            </p>
          )}
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t bg-background p-4">
          <Button type="button" variant="outline" disabled={copy.isPending} onClick={onClose}>
            Hủy
          </Button>
          <Button
            type="button"
            disabled={!source.data || rosters.isPending || copy.isPending || !parts.size}
            onClick={() => void submit()}
          >
            <CopyPlus aria-hidden /> {copy.isPending ? "Đang chép…" : "Chép thiết lập"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
