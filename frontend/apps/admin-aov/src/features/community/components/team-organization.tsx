import { Link } from "react-router"
import { useInfiniteQuery } from "@tanstack/react-query"
import { Building2, Users } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@aov/ui/components/avatar"
import { Button } from "@aov/ui/components/button"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { nextPageOf } from "@aov/ui/lib/page-slice"
import { OrganizationPicker } from "@/features/competition/organization-picker"
import { pageApi, pageError, pageKeys } from "../api/page-api"
import { Section } from "./profile-form-primitives"
import { ProfileTypeIcon } from "./profile-icons"

/** The organization that owns a team. Publishing the team needs that organization published first. */
export function TeamOwnerSection({
  value,
  actorKey,
  canWrite,
  onChange,
}: {
  value?: string | null
  actorKey: string
  canWrite: boolean
  onChange: (organizationId: string | null) => void
}) {
  return (
    <Section title="Tổ chức chủ quản" icon={Building2}>
      <OrganizationPicker
        label="Tổ chức chủ quản"
        value={value}
        actorKey={actorKey}
        canWrite={canWrite}
        onSelect={(organization) => onChange(organization?.id ?? null)}
      />
    </Section>
  )
}

/** The team pages that name this organization as their owner, read-only; each is changed on its own page. */
export function OwnedTeamsSection({ organizationId, actorKey }: { organizationId: string; actorKey: string }) {
  const query = useInfiniteQuery({
    queryKey: pageKeys.ownedTeams(actorKey, organizationId),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => pageApi.ownedTeams(organizationId, pageParam),
    getNextPageParam: nextPageOf,
  })
  const teams = query.data?.pages.flatMap((page) => page.items) ?? []
  return (
    <Section title="Đội chủ quản" icon={Users}>
      {query.isPending ? (
        <p className="type-body" role="status">
          Đang tải đội tuyển…
        </p>
      ) : query.isLoadingError ? (
        <div className="space-y-2" role="alert">
          <p className="type-body text-destructive">{pageError(query.error)}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Thử lại
          </Button>
        </div>
      ) : !teams.length ? (
        <p className="type-meta">Chưa có đội tuyển nào chọn tổ chức này làm chủ quản.</p>
      ) : (
        <div className="max-h-80 overflow-y-auto rounded-lg border">
          <ul className="divide-y">
            {teams.map((team) => (
              <li key={team.id}>
                <Link to={`/pages/${team.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-muted">
                  <Avatar className="size-9 rounded-lg border bg-background">
                    <AvatarImage src={team.content?.avatarUrl || undefined} alt="" className="object-contain" />
                    <AvatarFallback className="rounded-lg">
                      <ProfileTypeIcon kind="TEAM" className="size-4" />
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="type-body block truncate">{team.content?.name || team.code}</span>
                    <span className="type-meta block">{team.published ? "Đã xuất bản" : "Bản nháp"}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <InfiniteScroll query={query} label="Đang tải thêm đội tuyển" />
        </div>
      )}
    </Section>
  )
}
