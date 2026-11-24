import { useState } from "react"
import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import type { DocumentView, SeriesContent } from "@aov/community-contracts"
import { CalendarCog, Pencil } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { competitionApi, competitionKeys } from "@/features/competition/competition-api"
import { RegistryEditor } from "@/features/tournaments/components/registry-editor"
import { tournamentPath } from "./esports-shell"

export const schedulePath = (tournamentId: string, seriesId: string) =>
  `${tournamentPath(tournamentId)}?${new URLSearchParams({ step: "schedule", match: seriesId })}`

/** Whether the schedule of the tournament holds this match; undefined until its plan is read. */
export function useInSchedule(actorKey: string, tournamentId: string, seriesId: string) {
  const plan = useQuery({
    queryKey: competitionKeys.plan(actorKey, tournamentId),
    queryFn: () => competitionApi.read(tournamentId),
  })
  if (plan.isPending) return undefined
  // A tournament without a plan keeps its matches as records of their own.
  return !!plan.data?.content.plan.matches.some((match) => match.seriesId === seriesId)
}

/**
 * Where the teams, time and score of a match are edited: its line in the schedule. A match outside the plan has no
 * line there, so it keeps the form of its own record.
 */
export function EditMatchButton({ record, actorKey }: { record: DocumentView<SeriesContent>; actorKey: string }) {
  const [editing, setEditing] = useState(false)
  const { tournamentId } = record.content
  const scheduled = useInSchedule(actorKey, tournamentId, record.id)
  const label = (
    <>
      <CalendarCog aria-hidden />
      <span className="@xl:hidden">Lịch</span>
      <span className="hidden @xl:inline">Sửa trong lịch</span>
    </>
  )
  // Most matches are in the schedule, so the button already has that shape while the plan is read.
  if (scheduled === undefined)
    return (
      <Button size="sm" variant="secondary" disabled aria-label="Sửa trong lịch">
        {label}
      </Button>
    )
  if (scheduled)
    return (
      <Button asChild size="sm" variant="secondary">
        <Link
          to={schedulePath(tournamentId, record.id)}
          aria-label="Sửa trong lịch"
          title="Sửa đội, giờ và tỷ số trong lịch"
        >
          {label}
        </Link>
      </Button>
    )
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
        <Pencil aria-hidden /> Sửa trận
      </Button>
      {editing && (
        <RegistryEditor
          kind="series"
          entry={record}
          open
          onClose={() => setEditing(false)}
          tournamentId={tournamentId}
        />
      )}
    </>
  )
}
