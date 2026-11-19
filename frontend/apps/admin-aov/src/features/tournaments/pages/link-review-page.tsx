import { Link, useSearchParams } from "react-router"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import type { LinkMention, LinkMentionKind } from "@aov/community-contracts"
import { ArrowRight, Trophy } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@aov/ui/components/avatar"
import { Button } from "@aov/ui/components/button"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { Tabs, TabsTrigger } from "@aov/ui/components/tabs"
import { nextPageOf } from "@aov/ui/lib/page-slice"
import { PageHeader } from "@/components/page-header"
import { ScrollableTabsList } from "@/components/scrollable-tabs-list"
import { AccessGate, EsportsPage, matchPath, tournamentPath } from "@/features/esports/pages/esports-shell"
import { formatNumber } from "@/lib/text"
import { tournamentApi, tournamentError, tournamentKeys } from "../api/tournament-api"
import {
  LINK_MENTION_ACTIONS,
  LINK_MENTION_KINDS,
  LINK_MENTION_LABELS,
  mentionPlace,
  mentionTarget,
  mentionsByTournament,
} from "../model/link-review-model"

/**
 * Names still written as text where a record could be linked: MVPs, casters, award recipients and their teams. Each
 * row opens the place where it is linked; a row leaves the list once it is.
 */
export function LinkReviewPage() {
  return (
    <AccessGate>
      {(access) => (
        <EsportsPage>
          <PageHeader title="Liên kết cần xem" />
          <LinkReview actorKey={access.actorKey} />
        </EsportsPage>
      )}
    </AccessGate>
  )
}

const kindOf = (value: string | null): LinkMentionKind =>
  LINK_MENTION_KINDS.find((kind) => kind === value) ?? LINK_MENTION_KINDS[0]

const targetPath = (mention: LinkMention) => {
  const target = mentionTarget(mention)
  return target.screen === "match"
    ? `${matchPath(target.tournamentId, target.seriesId)}?${target.search}`
    : `${tournamentPath(target.tournamentId)}?${target.search}`
}

function LinkReview({ actorKey }: { actorKey: string }) {
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
  const mentions = rows.data?.pages.flatMap((page) => page.items) ?? []
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
      ) : !mentions.length ? (
        <p className="type-body text-muted-foreground">Không còn chỗ nào cần liên kết.</p>
      ) : (
        <div className="space-y-4">
          {mentionsByTournament(mentions).map((group, index) => (
            <section
              key={`${group.tournamentId}-${index}`}
              className="admin-panel overflow-hidden"
              aria-label={group.tournamentName}
            >
              <header className="flex items-center gap-3 border-b px-4 py-3">
                <TournamentLogo id={group.tournamentId} />
                <h2 className="type-section-title min-w-0 truncate">{group.tournamentName}</h2>
              </header>
              <ul className="divide-y">
                {group.mentions.map((mention, at) => (
                  <li
                    key={`${mention.recordId}-${at}`}
                    className="grid items-center gap-x-4 gap-y-1 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                  >
                    <span className="type-body min-w-0 truncate">{mentionPlace(mention)}</span>
                    <span className="type-body min-w-0 truncate" title={mention.text}>
                      “{mention.text}”
                    </span>
                    <Button asChild variant="outline" size="sm" className="justify-self-start sm:justify-self-end">
                      <Link to={targetPath(mention)}>
                        {LINK_MENTION_ACTIONS[mention.kind]} <ArrowRight aria-hidden />
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <InfiniteScroll query={rows} label="Đang tải thêm" />
        </div>
      )}
    </div>
  )
}

/** The tournament's logo, read the way the pickers read it, so it is shared with them. */
function TournamentLogo({ id }: { id: string }) {
  const tournament = useQuery({
    queryKey: tournamentKeys.pickerSelected("tournaments", id),
    queryFn: ({ signal }) => tournamentApi.read("tournaments", id, signal),
    staleTime: 60_000,
  })
  return (
    <Avatar className="size-8 shrink-0 rounded-lg border bg-background">
      <AvatarImage src={tournament.data?.content.logoUrl || undefined} alt="" className="object-contain" />
      <AvatarFallback className="rounded-lg">
        <Trophy className="size-4" />
      </AvatarFallback>
    </Avatar>
  )
}
