import { useState } from "react"
import { Link } from "react-router"
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { CommunityReport, PageClaim } from "@aov/community-contracts"
import { Button } from "@aov/ui/components/button"
import { Textarea } from "@aov/ui/components/textarea"
import { Page, PageHeader } from "@/components/page-header"
import { AccessGate } from "@/features/esports/pages/esports-shell"
import { pageApi, pageError, pageKeys } from "../api/page-api"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { nextPageOf } from "@aov/ui/lib/page-slice"

export function PageReview() {
  return (
    <AccessGate>
      {(access) =>
        access.canPublish ? (
          <Review actorKey={access.actorKey} />
        ) : (
          <Page>
            <p className="type-body">Bạn cần quyền duyệt nội dung để xử lý yêu cầu đại diện và báo cáo.</p>
          </Page>
        )
      }
    </AccessGate>
  )
}
function Review({ actorKey }: { actorKey: string }) {
  const [tab, setTab] = useState("claims")
  const claims = useInfiniteQuery({
    queryKey: pageKeys.claims(actorKey),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => pageApi.claims(pageParam),
    getNextPageParam: nextPageOf,
    enabled: tab === "claims",
  })
  const reports = useInfiniteQuery({
    queryKey: pageKeys.reports(actorKey),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => pageApi.reports(pageParam),
    getNextPageParam: nextPageOf,
    enabled: tab === "reports",
  })
  const active = tab === "claims" ? claims : reports
  const claimRows = claims.data?.pages.flatMap((page) => page.items) ?? []
  const reportRows = reports.data?.pages.flatMap((page) => page.items) ?? []
  return (
    <Page className="mx-auto w-full max-w-[1100px] gap-5">
      <PageHeader title="Yêu cầu & kiểm duyệt" />
      <div className="flex gap-2">
        <Button variant={tab === "claims" ? "secondary" : "ghost"} onClick={() => setTab("claims")}>
          Nhận quyền quản lý
        </Button>
        <Button variant={tab === "reports" ? "secondary" : "ghost"} onClick={() => setTab("reports")}>
          Báo cáo nội dung
        </Button>
      </div>
      {active.isPending ? (
        <p className="type-body">Đang tải…</p>
      ) : active.isLoadingError ? (
        <p role="alert" className="type-body">
          {pageError(active.error)}
        </p>
      ) : !(tab === "claims" ? claimRows : reportRows).length ? (
        <div className="rounded-xl border py-16 text-center">
          <h2 className="type-section-title">Không có yêu cầu chờ xử lý</h2>
          <p className="type-meta mt-2">Các yêu cầu mới sẽ xuất hiện tại đây.</p>
        </div>
      ) : tab === "claims" ? (
        claimRows.map((entry) => <ReviewCard key={entry.id} claim={entry} />)
      ) : (
        reportRows.map((entry) => <ReviewCard key={entry.id} report={entry} />)
      )}
      <InfiniteScroll query={active} label="Đang tải thêm yêu cầu" />
    </Page>
  )
}
function ReviewCard({ claim, report }: { claim?: PageClaim; report?: CommunityReport }) {
  const [resolution, setResolution] = useState("")
  const client = useQueryClient()
  const action = useMutation({
    mutationFn: (positive: boolean) =>
      claim
        ? pageApi.decide(claim, positive, resolution).then(() => {})
        : pageApi.resolve(report!.id, resolution, positive),
    onSuccess: () => client.invalidateQueries({ queryKey: pageKeys.all }),
    meta: { silent: true },
  })
  return (
    <article className="space-y-4 admin-section py-5">
      <div>
        <Link className="type-section-title hover:underline" to={`/pages/${claim?.pageId || report?.pageId}`}>
          {claim?.pageName || "Báo cáo nội dung"}
        </Link>
        {claim && <p className="type-meta mt-1">Người yêu cầu: {claim.name}</p>}
      </div>
      <p className="type-body whitespace-pre-wrap break-words rounded-lg bg-muted p-4">
        {claim?.evidence || report?.reason}
      </p>
      {report?.reportedContent && (
        <div className="space-y-2">
          <p className="type-label">Nội dung hiện tại được báo cáo</p>
          <blockquote className="type-body max-h-64 overflow-auto whitespace-pre-wrap break-words border-l-2 pl-4">
            {report.reportedContent}
          </blockquote>
        </div>
      )}
      <label className="grid gap-2">
        <span className="type-label">Kết quả kiểm tra / lý do xử lý *</span>
        <Textarea
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          maxLength={2000}
          placeholder="Ghi kênh đã đối chiếu và kết luận…"
        />
      </label>
      {action.isError && (
        <p role="alert" className="type-body text-destructive">
          {pageError(action.error)}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button disabled={!resolution.trim() || action.isPending} onClick={() => action.mutate(true)}>
          {claim ? "Xác minh và cấp quyền" : report?.postId ? "Ẩn nội dung được báo cáo" : "Ghi nhận đã xử lý góp ý"}
        </Button>
        <Button
          variant="outline"
          disabled={!resolution.trim() || action.isPending}
          onClick={() => action.mutate(false)}
        >
          {claim ? "Từ chối yêu cầu" : "Giữ nội dung, đóng báo cáo"}
        </Button>
      </div>
    </article>
  )
}
