import { useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  CompetitionPlan,
  ContentVerification,
  DocumentView,
  RosterMembershipContent,
  SeriesContent,
  TournamentContent,
} from "@aov/community-contracts"
import type { Access } from "@/features/esports/pages/esports-shell"
import { competitionApi, competitionKeys } from "../competition-api"
import { checkParts, checkTotals, partChecks, type PartCheck } from "../model/content-checks"

/** The owner's checks of the workspace's parts, as every step reads them. */
export type ContentChecks = {
  /** False until the checks and everything a token is taken from were read. */
  ready: boolean
  parts: PartCheck[]
  of: (part: string) => PartCheck | undefined
  totals: ReturnType<typeof checkTotals>
  /** Why marking is off now, if it is: no right to, or a draft that is not saved. */
  blocked?: string
  /** The part whose check is being written. */
  saving?: string
  mark: (part: PartCheck) => void
  /** Takes back every check of the part, of this version and older ones. */
  unmark: (part: PartCheck) => void
}

export function useContentChecks({
  tournamentId,
  access,
  tournament,
  plan,
  rosters,
  series,
  dirty,
  teamName,
}: {
  tournamentId: string
  access: Access
  /** The tournament record; absent while it loads. */
  tournament?: TournamentContent
  /** The plan as last saved. */
  plan: CompetitionPlan
  /** Absent while they load, like the series. */
  rosters?: DocumentView<RosterMembershipContent>[]
  series?: DocumentView<SeriesContent>[]
  dirty: boolean
  teamName: (teamId: string) => string
}): ContentChecks {
  const client = useQueryClient()
  const key = competitionKeys.verifications(access.actorKey, tournamentId)
  const marks = useQuery({ queryKey: key, queryFn: () => competitionApi.verifications(tournamentId) })
  const loaded = !!tournament && !!rosters && !!series
  const parts = useMemo(
    () =>
      tournament && rosters && series
        ? checkParts({ tournament, plan, rosters: rosters.map((row) => row.content), series, teamName })
        : [],
    [tournament, plan, rosters, series, teamName],
  )
  const checked = useMemo(() => partChecks(parts, marks.data ?? []), [parts, marks.data])
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: key }),
      client.invalidateQueries({ queryKey: competitionKeys.verificationSummaries(access.actorKey) }),
    ])
  const write = useMutation({
    mutationFn: async ({ part, undo }: { part: PartCheck; undo: boolean }) => {
      if (undo) {
        for (const mark of part.marks) await competitionApi.unverify(tournamentId, mark.id)
        return
      }
      const saved = await competitionApi.verify(tournamentId, {
        part: part.part,
        contentToken: part.token,
        label: part.label,
      })
      client.setQueryData<ContentVerification[]>(key, (list = []) => [
        saved,
        ...list.filter((mark) => mark.id !== saved.id),
      ])
    },
    onSettled: refresh,
  })

  return {
    ready: marks.isSuccess && loaded,
    parts: checked,
    of: (part) => checked.find((row) => row.part === part),
    totals: checkTotals(checked),
    blocked: !access.canPublish
      ? "Chỉ người có quyền công bố mới đánh dấu được"
      : dirty
        ? "Lưu bản nháp trước khi đánh dấu"
        : undefined,
    saving: write.isPending ? write.variables?.part.part : undefined,
    mark: (part) => write.mutate({ part, undo: false }),
    unmark: (part) => write.mutate({ part, undo: true }),
  }
}
