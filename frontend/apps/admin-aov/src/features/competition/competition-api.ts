import type {
  CompetitionPlan,
  CompetitionView,
  CompetitionSummary,
  PlannedMatch,
  PageSlice,
} from "@aov/community-contracts"
import { communityRequest } from "@/app/auth/session"
import { tournamentKeys } from "@/features/tournaments/tournament-api"
export const competitionKeys = [...tournamentKeys.all, "plans"] as const
export const competitionApi = {
  inCircuit: (circuitPageId: string, page = 0) =>
    communityRequest<PageSlice<CompetitionSummary>>(
      `/admin/competitions?${new URLSearchParams({ circuitPageId, page: String(page), size: "12" })}`,
    ),
  organizedBy: (organizationId: string, page = 0) =>
    communityRequest<PageSlice<CompetitionSummary>>(
      `/admin/competitions?${new URLSearchParams({ organizerPageId: organizationId, page: String(page), size: "12" })}`,
    ),
  summaries: async () => {
    const rows: { id: string; entrants: number; matches: number; publishedAt?: string | null }[] = []
    for (let page = 0; page < 100; page++) {
      const result = await communityRequest<PageSlice<(typeof rows)[number]>>(
        `/admin/competitions?page=${page}&size=100`,
      )
      rows.push(...result.items)
      if (!result.items.length || rows.length >= result.totalElements) return rows
    }
    throw new Error("Danh sách quá lớn. Hãy thu hẹp phạm vi.")
  },
  read: (id: string) => communityRequest<CompetitionView>(`/admin/competitions/${id}`),
  save: (entry: CompetitionView, content: CompetitionPlan) =>
    communityRequest<CompetitionView>(`/admin/competitions/${entry.id}`, {
      method: "PUT",
      body: JSON.stringify({ version: entry.version, content }),
    }),
  action: (entry: CompetitionView, action: "publish" | "withdraw" | "materialize") =>
    communityRequest<CompetitionView>(`/admin/competitions/${entry.id}/${action}`, {
      method: "POST",
      body: JSON.stringify({ version: entry.version }),
    }),
  preview: (content: CompetitionPlan, stageCode: string, opponent: number) =>
    communityRequest<PlannedMatch[]>("/admin/competitions/preview", {
      method: "POST",
      body: JSON.stringify({ content, stageCode, opponent }),
    }),
}
