import { Link, Navigate, useLocation, useParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Page } from "@/components/page-header"
import { backendRequest } from "@/app/auth/session"
import { errorMessage, isApiError } from "@/lib/api/errors"

import { createPublishingApi, publishingKeys } from "@/lib/api/publishing-api"

import { PublishingWorkspace } from "@/features/publishing/components/workspace/publishing-workspace"

const api = createPublishingApi(backendRequest)

export function PublishingPage({ translationMode = false }: { translationMode?: boolean }) {
  const { heroId = "" } = useParams()
  // Shares the workspace's revisions query; the backend rejects a hero code in the id slot, e.g. /hero/airi.
  const revisions = useQuery({
    queryKey: publishingKeys.revisions(heroId),
    queryFn: () => api.revisions(heroId),
    enabled: !!heroId,
  })
  if (
    isApiError(revisions.error, "INVALID_REQUEST") &&
    revisions.error.problem.errors?.some((field) => field.path === "heroId")
  )
    return <HeroCodeRedirect code={heroId} />
  return <PublishingWorkspace key={`${heroId}:${translationMode}`} heroId={heroId} translationMode={translationMode} />
}

/** Opens `/hero/{code}` links, e.g. `/hero/airi`, by swapping the code for the hero's id. */
function HeroCodeRedirect({ code }: { code: string }) {
  const location = useLocation()
  const lookup = useQuery({
    queryKey: publishingKeys.heroByCode(code.toLowerCase()),
    queryFn: ({ signal }) => api.heroes(0, { q: code }, signal),
  })
  const match = lookup.data?.items.find((row) => row.code.toLowerCase() === code.toLowerCase())
  if (match)
    return (
      <Navigate
        replace
        to={`${location.pathname.replace(/^\/hero\/[^/]+/, `/hero/${match.id}`)}${location.search}${location.hash}`}
      />
    )
  return (
    <Page>
      {lookup.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Đang tìm tướng “{code}”…
        </p>
      ) : (
        <div role="alert" className="space-y-3 rounded-xl border border-dashed p-8 text-center">
          <p className="font-medium">
            {lookup.isError ? errorMessage(lookup.error) : `Không tìm thấy tướng có mã “${code}”.`}
          </p>
          <Button variant="outline" asChild>
            <Link to="/hero">
              <ArrowLeft className="size-4" />
              Về danh sách tướng
            </Link>
          </Button>
        </div>
      )}
    </Page>
  )
}
