import { useMemo } from "react"
import { useSearchParams } from "react-router"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import type { LinkMentionKind } from "@aov/community-contracts"
import { Button } from "@aov/ui/components/button"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { Tabs, TabsTrigger } from "@aov/ui/components/tabs"
import { nextPageOf } from "@aov/ui/lib/page-slice"
import { PageHeader } from "@/components/page-header"
import { ScrollableTabsList } from "@/components/scrollable-tabs-list"
import { AccessGate, EsportsPage } from "@/features/esports/pages/esports-shell"
import { formatNumber } from "@/lib/text"
import { tournamentApi, tournamentError, tournamentKeys } from "../api/tournament-api"
import { LinkReviewList } from "../components/link-review-list"
import { LINK_MENTION_KINDS, LINK_MENTION_LABELS } from "../model/link-review-model"

/**
 * Names still written as text where a record could be linked: MVPs, casters, award recipients and their teams. A row
 * is linked in place and leaves the list, or opens the place where its name is written.
 */
export function LinkReviewPage() {
  return (
    <AccessGate>
      {(access) => (
        <EsportsPage>
          <PageHeader title="Liên kết cần xem" />
          <LinkReview actorKey={access.actorKey} canWrite={access.canWrite} />
        </EsportsPage>
      )}
    </AccessGate>
  )
}

const kindOf = (value: string | null): LinkMentionKind =>
  LINK_MENTION_KINDS.find((kind) => kind === value) ?? LINK_MENTION_KINDS[0]

function LinkReview({ actorKey, canWrite }: { actorKey: string; canWrite: boolean }) {
  const [params, setParams] = useSearchParams()
  const kind = kindOf(params.get("kind"))
  const facets = useQuery({
    queryKey: tournamentKeys.linkReviewFacets(actorKey),
    queryFn: ({ signal }) => tournamentApi.linkReviewFacets(signal),
  })
  const rows = useInfiniteQuery({
    queryKey: tournamentKeys.linkReview(actorKey, kind),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => tournamentApi.linkReview(kind, pageParam, signal),
    getNextPageParam: nextPageOf,
  })
  const mentions = useMemo(() => rows.data?.pages.flatMap((page) => page.items) ?? [], [rows.data])
  const count = (value: LinkMentionKind) => facets.data?.find((row) => row.kind === value)?.count

  return (
    <div className="space-y-4">
      <Tabs value={kind} onValueChange={(value) => setParams({ kind: value }, { replace: true })}>
        <ScrollableTabsList activeValue={kind} aria-label="Loại liên kết">
          {LINK_MENTION_KINDS.map((value) => (
            <TabsTrigger key={value} value={value} className="h-9 gap-2 rounded-lg px-3 text-sm">
              {LINK_MENTION_LABELS[value]}
              {count(value) != null && <span className="type-meta tabular-nums">{formatNumber(count(value)!)}</span>}
            </TabsTrigger>
          ))}
        </ScrollableTabsList>
      </Tabs>
      {rows.isPending ? (
        <p className="type-body" role="status">
          Đang tải…
        </p>
      ) : rows.isLoadingError ? (
        <div className="space-y-2" role="alert">
          <p className="type-body text-destructive">{tournamentError(rows.error)}</p>
          <Button variant="outline" onClick={() => void rows.refetch()}>
            Thử lại
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {!mentions.length && <p className="type-body text-muted-foreground">Không còn chỗ nào cần liên kết.</p>}
          {/* Stays after the last row is linked, so that link can still be taken back. */}
          <LinkReviewList key={kind} mentions={mentions} kind={kind} actorKey={actorKey} canWrite={canWrite} />
          <InfiniteScroll query={rows} label="Đang tải thêm" />
        </div>
      )}
    </div>
  )
}
