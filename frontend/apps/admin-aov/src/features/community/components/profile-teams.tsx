import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { ArrowUpRight, UsersRound } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@aov/ui/components/tooltip"
import { ThemedLogoImg } from "@/components/themed-logo-img"
import { useTournamentAccess } from "@/features/esports/data/use-esports-data"
import { pageApi, pageKeys } from "../api/page-api"
import { Section } from "./profile-form-primitives"

export function ProfileTeams({ pageId }: { pageId: string }) {
  const access = useTournamentAccess()
  const query = useQuery({
    queryKey: pageKeys.teams(access.actorKey, pageId),
    queryFn: () => pageApi.teams(pageId),
  })
  return (
    <Section
      title="Đội tuyển liên kết"
      icon={UsersRound}
      description="Cập nhật từ danh sách thành viên của đội. Chỉnh sửa tại đội tuyển tương ứng."
    >
      {query.isPending && (
        <p className="type-meta" role="status">
          Đang tải đội tuyển…
        </p>
      )}
      {query.isError && (
        <p className="type-body text-destructive" role="alert">
          Chưa tải được đội tuyển.{" "}
          <Button type="button" variant="ghost" onClick={() => void query.refetch()}>
            Thử lại
          </Button>
        </p>
      )}
      {query.data?.length === 0 && (
        <p className="type-meta">Chưa liên kết đội tuyển. Mở một đội và chọn hồ sơ này trong mục thành viên.</p>
      )}
      {!!query.data?.length && (
        <div className="divide-y rounded-lg border">
          {query.data.map((team, index) => (
            <div key={`${team.teamPageId}:${index}`} className="flex items-center gap-3 p-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <ThemedLogoImg
                  url={team.teamAvatarUrl}
                  className="size-full object-contain"
                  fallback={<UsersRound className="size-5" />}
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="type-body">{team.teamName}</p>
                <p className="type-meta">{[team.member.role, team.member.status].filter(Boolean).join(" · ")}</p>
                {(team.member.startsOn || team.member.endsOn) && (
                  <p className="type-meta">
                    {team.member.startsOn || "Chưa rõ ngày"} → {team.member.endsOn || "Chưa ghi nhận kết thúc"}
                  </p>
                )}
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button asChild variant="ghost" size="icon" aria-label={`Sửa thành viên tại ${team.teamName}`}>
                    <Link to={`/pages/${team.teamPageId}?tab=roster`}>
                      <ArrowUpRight className="size-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Sửa tại {team.teamName}</TooltipContent>
              </Tooltip>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}
