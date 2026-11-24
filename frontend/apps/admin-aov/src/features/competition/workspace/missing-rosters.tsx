import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { RosterMembershipContent } from "@aov/community-contracts"
import { CopyPlus } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { confirmAction } from "@/components/confirm-dialog"
import { tournamentApi, tournamentError, tournamentKeys } from "@/features/tournaments/api/tournament-api"
import { copiedRoster, rosterBatches, rosterContents } from "../model/copy-setup"
import type { Workspace } from "./parts"

type Proposal = { teamId: string; from: string; lines: RosterMembershipContent[] }

/** The most recent roster of a team elsewhere, as lines of this tournament; null when the team has none. */
async function latestRoster(teamId: string, tournamentId: string): Promise<Proposal | null> {
  const rows = rosterContents(await tournamentApi.list("roster-memberships", undefined, { teamId }))
  const played = new Set(rows.map((row) => row.tournamentId))
  // The server lists a team's own tournaments before the others, the most recent first.
  const page = await tournamentApi.searchTournaments({ teamId })
  const latest = page.items.find((row) => played.has(row.id) && row.id !== tournamentId)
  if (!latest) return null
  const lines = copiedRoster(
    rows.filter((row) => row.tournamentId === latest.id),
    tournamentId,
    [],
  )
  return lines.length ? { teamId, from: latest.content.name, lines } : null
}

/** Fills the teams that have no roster yet from their latest tournament, all of them in one confirmed write. */
export function FillMissingRosters({ ws, teamIds }: { ws: Workspace; teamIds: string[] }) {
  const client = useQueryClient()
  const propose = useMutation({
    mutationFn: async () => {
      const found: Proposal[] = []
      for (const teamId of teamIds) {
        const proposal = await latestRoster(teamId, ws.entry.id)
        if (proposal) found.push(proposal)
      }
      return found
    },
    meta: { silent: true },
  })
  const fill = useMutation({
    mutationFn: async (proposals: Proposal[]) => {
      for (const batch of rosterBatches(proposals.flatMap((proposal) => proposal.lines)))
        await tournamentApi.rosterBatch(batch)
    },
    meta: { silent: true, successMessage: "Đã chép đội hình." },
    onSuccess: () => client.invalidateQueries({ queryKey: tournamentKeys.all }),
  })
  const start = async () => {
    const proposals = await propose.mutateAsync().catch(() => null)
    if (!proposals?.length) return
    const confirmed = await confirmAction({
      title: `Chép đội hình cho ${proposals.length} đội?`,
      description:
        "Lấy đội hình ở giải gần nhất của từng đội, không lấy người đã rời. Nguồn và ghi chú cũ không được chép.",
      details: (
        <ul className="type-body max-h-60 space-y-1 overflow-y-auto">
          {proposals.map((proposal) => (
            <li key={proposal.teamId}>
              {ws.team(proposal.teamId).name}: {proposal.lines.length} người từ {proposal.from}
            </li>
          ))}
        </ul>
      ),
      confirmLabel: "Chép đội hình",
      tone: "publish",
    })
    if (confirmed) fill.mutate(proposals)
  }
  const busy = propose.isPending || fill.isPending
  return (
    <>
      <Button type="button" variant="outline" disabled={busy} onClick={() => void start()}>
        <CopyPlus aria-hidden />
        {propose.isPending ? "Đang tìm…" : fill.isPending ? "Đang chép…" : "Chép từ giải gần nhất"}
      </Button>
      {propose.data && !propose.data.length && (
        <span className="type-meta" role="status">
          Các đội này chưa có đội hình ở giải nào khác.
        </span>
      )}
      {(propose.error || fill.error) && (
        <span className="type-body text-destructive" role="alert">
          {tournamentError(propose.error ?? fill.error)}
        </span>
      )}
    </>
  )
}
