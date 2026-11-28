import type {
  BracketOptions,
  CompetitionPlan,
  CompetitionRevision,
  CompetitionView,
  CompetitionSummary,
  ContentVerification,
  ContentVerificationSummary,
  PlannedMatch,
  PageSlice,
} from "@aov/community-contracts"
import { communityRequest } from "@/app/auth/session"
import { tournamentKeys } from "@/features/tournaments/api/tournament-api"
const plans = [...tournamentKeys.all, "plans"] as const
/** Under the tournament keys, so a write to a tournament record refreshes the plans built on it too. */
export const competitionKeys = {
  all: plans,
  plan: (actorKey: string, tournamentId: string) => [...plans, actorKey, tournamentId] as const,
  summaries: (actorKey: string) => [...plans, actorKey, "summaries"] as const,
  ofOrganization: (actorKey: string, kind: "ORGANIZATION" | "CIRCUIT" | undefined, organizationId: string) =>
    [...plans, actorKey, kind, organizationId] as const,
  revisions: (actorKey: string, tournamentId: string) => [...plans, actorKey, tournamentId, "revisions"] as const,
  /** The owner's own checks of one competition's parts; only Admin reads them. */
  verifications: (actorKey: string, tournamentId: string) =>
    [...plans, actorKey, tournamentId, "verifications"] as const,
  verificationSummaries: (actorKey: string) => [...plans, actorKey, "verification-summaries"] as const,
  /** What readers see of one competition, read again whenever it is published anew. */
  published: (tournamentId: string, publishedAt: string | null | undefined) =>
    [...plans, "published", tournamentId, publishedAt] as const,
}

/** A plan as the tournament list needs it: its size, its circuit and whether readers see it. */
export type PlanIndexEntry = {
  id: string
  entrants: number
  matches: number
  publishedAt?: string | null
  circuit?: string | null
  circuitPageId?: string | null
}

export const competitionApi = {
  inCircuit: (circuitPageId: string, page = 0) =>
    communityRequest<PageSlice<CompetitionSummary>>(
      `/admin/competitions?${new URLSearchParams({ circuitPageId, page: String(page), size: "12" })}`,
    ),
  organizedBy: (organizationId: string, page = 0) =>
    communityRequest<PageSlice<CompetitionSummary>>(
      `/admin/competitions?${new URLSearchParams({ organizerPageId: organizationId, page: String(page), size: "12" })}`,
    ),
  /** Every plan in short, in one answer: the list of all tournaments needs no plan document. */
  summaries: () => communityRequest<PlanIndexEntry[]>("/admin/competitions/index"),
  read: (id: string) => communityRequest<CompetitionView>(`/admin/competitions/${id}`),
  /** The published copy, as the public site serves it. */
  readPublished: (id: string) => communityRequest<CompetitionView>(`/competitions/${id}`),
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
  preview: (content: CompetitionPlan, stageCode: string, options: BracketOptions) =>
    communityRequest<PlannedMatch[]>("/admin/competitions/preview", {
      method: "POST",
      body: JSON.stringify({ content, stageCode, ...options }),
    }),
  revisions: (id: string, page = 0) =>
    communityRequest<PageSlice<CompetitionRevision>>(`/admin/competitions/${id}/revisions?page=${page}&size=20`),
  revision: (id: string, revisionId: string) =>
    communityRequest<CompetitionPlan>(`/admin/competitions/${id}/revisions/${revisionId}`),
  /** Every check of the competition, newest first. */
  verifications: (id: string) => communityRequest<ContentVerification[]>(`/admin/competitions/${id}/verifications`),
  verificationSummaries: () => communityRequest<ContentVerificationSummary[]>("/admin/competitions/verifications"),
  /** Records that this version of the part was checked by hand, or refreshes that check. */
  verify: (id: string, body: { part: string; contentToken: string; label?: string; note?: string }) =>
    communityRequest<ContentVerification>(`/admin/competitions/${id}/verifications`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  unverify: (id: string, verificationId: string) =>
    communityRequest<void>(`/admin/competitions/${id}/verifications/${verificationId}/remove`, { method: "POST" }),
}
