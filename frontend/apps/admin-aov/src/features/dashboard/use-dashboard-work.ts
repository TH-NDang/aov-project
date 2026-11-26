import type { ComponentType } from "react"
import { useQuery } from "@tanstack/react-query"
import { CalendarClock, CircleCheck, FilePen, Flag, Link2, ScrollText, ShieldAlert, Trophy } from "lucide-react"
import { backendRequest } from "@/app/auth/session"
import { createPublishingApi, publishingKeys } from "@/lib/api/publishing-api"
import { pageApi, pageKeys } from "@/features/community/api/page-api"
import { competitionApi, competitionKeys } from "@/features/competition/competition-api"
import { useTournamentAccess } from "@/features/esports/data/use-esports-data"
import { tournamentApi, tournamentKeys } from "@/features/tournaments/api/tournament-api"
import { readinessRows, readinessSummary } from "../publishing/model/publish-readiness"
import { usePublicationOverview } from "../publishing/api/publication-overview"
import { marketsAwaitingPatch } from "./dashboard-model"

const publishing = createPublishingApi(backendRequest)

export interface WorkRow {
  key: string
  title: string
  description: string
  count: number
  icon: ComponentType<{ className?: string }>
  to: string
  /** Work that can be finished now reads differently from work that waits on missing data. */
  tone: "ready" | "attention" | "neutral"
}

export interface WorkArea {
  rows: WorkRow[]
  pending: boolean
  failed: boolean
}

/**
 * The hero work waiting in the Wiki, judged with the rules of the publish button: drafts that can go public, drafts
 * still missing data (with the most common gap), heroes never published, and patch schedules to confirm.
 */
export function useHeroWork(canRead: boolean, locale: string): WorkArea & { published: number; total: number } {
  const overview = usePublicationOverview()
  const readiness = useQuery({
    queryKey: publishingKeys.publishReadiness,
    queryFn: ({ signal }) => publishing.publishReadiness(signal),
    enabled: canRead,
    staleTime: 30_000,
  })
  if (!canRead) return { rows: [], pending: false, failed: false, published: 0, total: 0 }
  if (!readiness.data || !overview.data)
    return {
      rows: [],
      pending: readiness.isPending || overview.isPending,
      failed: readiness.isError || overview.isError,
      published: 0,
      total: 0,
    }

  const rows = readinessRows(readiness.data, overview.data, locale)
  const summary = readinessSummary(rows)
  const topGap = summary.blockers[0]
  const awaiting = marketsAwaitingPatch(overview.data, overview.data.asOf)
  const work: WorkRow[] = [
    {
      key: "ready",
      title: "Bản nháp tướng sẵn sàng xuất bản",
      description: "Đủ dữ liệu, chỉ cần xem lại và bấm Xuất bản",
      count: summary.ready,
      icon: CircleCheck,
      to: "/hero/publish-readiness?draft=ready",
      tone: "ready",
    },
    {
      key: "blocked",
      title: "Bản nháp tướng còn thiếu dữ liệu",
      description: topGap
        ? `Hay gặp nhất: ${topGap.message} (${topGap.count})`
        : "Còn mục phải điền trước khi xuất bản",
      count: summary.blocked,
      icon: ShieldAlert,
      to: "/hero/publish-readiness?draft=blocked",
      tone: "attention",
    },
    {
      key: "unpublished",
      title: "Tướng chưa có bản công khai",
      description: "Người đọc Wiki chưa thấy những tướng này",
      count: summary.unpublished,
      icon: FilePen,
      to: "/hero/publish-readiness?published=false",
      tone: "neutral",
    },
    {
      key: "releases",
      title: "Thị trường có patch mới chờ xác nhận",
      description: "Patch mới đã đến ngày áp dụng; xác nhận để Wiki chuyển sang patch đó",
      count: awaiting,
      icon: CalendarClock,
      to: "/game-configuration?tab=markets",
      tone: "attention",
    },
  ]
  return {
    rows: work.filter((row) => row.count > 0),
    pending: false,
    failed: false,
    published: rows.filter((row) => row.published).length,
    total: rows.length,
  }
}

/** Esports work waiting in the community service: names to link, requests to answer and tournaments not yet public. */
export function useEsportsWork(): WorkArea {
  const access = useTournamentAccess()
  const enabled = access.canRead
  const links = useQuery({
    queryKey: tournamentKeys.linkReviewFacets(access.actorKey),
    queryFn: ({ signal }) => tournamentApi.linkReviewFacets(signal),
    enabled,
    staleTime: 60_000,
  })
  const claims = useQuery({
    queryKey: pageKeys.claimsCount(access.actorKey),
    queryFn: () => pageApi.claims(0),
    enabled,
    staleTime: 60_000,
  })
  const reports = useQuery({
    queryKey: pageKeys.reportsCount(access.actorKey),
    queryFn: () => pageApi.reports(0),
    enabled,
    staleTime: 60_000,
  })
  const plans = useQuery({
    queryKey: competitionKeys.summaries(access.actorKey),
    queryFn: competitionApi.summaries,
    enabled,
    staleTime: 60_000,
  })
  if (!enabled) return { rows: [], pending: access.me.isPending, failed: false }

  const requests = (claims.data?.totalElements ?? 0) + (reports.data?.totalElements ?? 0)
  const drafts = plans.data?.filter((plan) => !plan.publishedAt) ?? []
  const work: WorkRow[] = [
    {
      key: "requests",
      title: "Yêu cầu và báo cáo cần trả lời",
      description: "Đại diện trang và báo cáo từ cộng đồng",
      count: requests,
      icon: Flag,
      to: "/page-requests",
      tone: "attention",
    },
    {
      key: "links",
      title: "Tên cần liên kết",
      description: "MVP, bình luận viên và người nhận giải còn ghi bằng chữ",
      count: links.data?.reduce((sum, facet) => sum + facet.count, 0) ?? 0,
      icon: Link2,
      to: "/link-review",
      tone: "neutral",
    },
    {
      key: "plans",
      title: "Giải đấu chưa công khai",
      description: drafts.some((plan) => plan.matches > 0)
        ? `${drafts.filter((plan) => plan.matches > 0).length} giải đã có trận được ghi`
        : "Chưa có trận nào được ghi",
      count: drafts.length,
      icon: Trophy,
      to: "/tournaments",
      tone: "neutral",
    },
  ]
  return {
    rows: work.filter((row) => row.count > 0),
    pending: links.isPending || claims.isPending || reports.isPending || plans.isPending,
    failed: links.isError || claims.isError || reports.isError || plans.isError,
  }
}

/** The two checks of the item warehouse that block publishing, kept from the first dashboard. */
export function itemWork(stats: {
  incomplete: { id: string }[]
  unverified: number
  firstUnverified?: { id: string }
}) {
  const rows: WorkRow[] = [
    {
      key: "items-incomplete",
      title: "Trang bị chưa hoàn thiện",
      description: "Còn thiếu dữ liệu bắt buộc để xuất bản",
      count: stats.incomplete.length,
      icon: ShieldAlert,
      to: stats.incomplete[0] ? `/items?item=${stats.incomplete[0].id}` : "/items",
      tone: "attention",
    },
    {
      key: "items-recipes",
      title: "Công thức chưa xác nhận",
      description: "Chưa đủ dữ liệu để chốt nguyên liệu",
      count: stats.unverified,
      icon: ScrollText,
      to: stats.firstUnverified ? `/items?item=${stats.firstUnverified.id}` : "/items",
      tone: "neutral",
    },
  ]
  return rows.filter((row) => row.count > 0)
}
