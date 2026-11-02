import { useState } from "react"
import { Link } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { CommunityReport, PageClaim } from "@aov/community-contracts"
import { Button } from "@aov/ui/components/button"
import { Textarea } from "@aov/ui/components/textarea"
import { Page, PageHeader } from "@/components/page-header"
import { AccessGate } from "@/features/esports/pages/esports-shell"
import { pageApi, pageError, pageKeys } from "./page-api"

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
  const [page, setPage] = useState(0)
  const claims = useQuery({
    queryKey: [...pageKeys, actorKey, "claims", page],
    queryFn: () => pageApi.claims(page),
    enabled: tab === "claims",
  })
  const reports = useQuery({
    queryKey: [...pageKeys, actorKey, "reports", page],
    queryFn: () => pageApi.reports(page),
    enabled: tab === "reports",
  })
  const active = tab === "claims" ? claims : reports
  return (
    <Page className="mx-auto w-full max-w-[1100px] gap-5">
      <PageHeader
        title="Yêu cầu & kiểm duyệt"
        description="Xác minh người đại diện, xử lý phản hồi và bảo vệ nội dung cộng đồng."
      />
      <div className="flex gap-2">
        <Button
          variant={tab === "claims" ? "secondary" : "ghost"}
          onClick={() => {
            setTab("claims")
            setPage(0)
          }}
        >
          Nhận quyền quản lý
        </Button>
        <Button
          variant={tab === "reports" ? "secondary" : "ghost"}
          onClick={() => {
            setTab("reports")
            setPage(0)
          }}
        >
          Báo cáo nội dung
        </Button>
      </div>
      {active.isPending ? (
        <p className="type-body">Đang tải…</p>
      ) : active.isError ? (
        <p role="alert" className="type-body">
          {pageError(active.error)}
        </p>
      ) : !active.data?.items.length ? (
        <div className="rounded-xl border py-16 text-center">
          <h2 className="type-section-title">Không có yêu cầu chờ xử lý</h2>
          <p className="type-meta mt-2">Các yêu cầu mới sẽ xuất hiện tại đây.</p>
        </div>
      ) : tab === "claims" ? (
        claims.data?.items.map((entry) => <ReviewCard key={entry.id} claim={entry} />)
      ) : (
        reports.data?.items.map((entry) => <ReviewCard key={entry.id} report={entry} />)
      )}
      <div className="flex justify-end gap-3">
        <Button variant="outline" disabled={!page} onClick={() => setPage(page - 1)}>
          Trước
        </Button>
        <Button
          variant="outline"
          disabled={!active.data || (page + 1) * 30 >= active.data.totalElements}
          onClick={() => setPage(page + 1)}
        >
          Tiếp
        </Button>
      </div>
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
    onSuccess: () => client.invalidateQueries({ queryKey: pageKeys }),
  })
  return (
    <article className="space-y-4 rounded-xl border bg-card p-5">
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
