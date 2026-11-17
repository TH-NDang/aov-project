import { useState } from "react"
import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { ArrowUpRight, Link2 } from "lucide-react"
import { profileKindLabels } from "@aov/community-contracts"
import { Avatar, AvatarFallback, AvatarImage } from "@aov/ui/components/avatar"
import { Button } from "@aov/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { useTournamentAccess } from "@/features/esports/data/use-esports-data"
import { pageApi, pageKeys, publicSite } from "../api/page-api"
import { ProfileTypeIcon } from "./profile-icons"

/** Unpublished reference details are only available to editors. */
export function PageReference({ id, label = "Xem hồ sơ" }: { id: string; label?: string }) {
  const [open, setOpen] = useState(false)
  const access = useTournamentAccess()
  const query = useQuery({
    queryKey: [...pageKeys, access.canRead ? access.actorKey : "public", id],
    queryFn: () => (access.canRead ? pageApi.read(id) : pageApi.readPublic(id)),
    enabled: open && !access.me.isPending,
  })
  const profile = query.data
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex max-w-full items-center gap-1.5 text-left text-primary underline decoration-dotted underline-offset-4 hover:decoration-solid"
          aria-label={`Xem tham chiếu: ${label}`}
        >
          <span className="break-words">{label}</span>
          <Link2 aria-hidden className="size-3.5 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-w-[calc(100vw-2rem)] space-y-4" align="start">
        {query.isPending ? (
          <p role="status" className="type-body">
            Đang tải hồ sơ…
          </p>
        ) : query.isError || !profile?.content ? (
          <div className="space-y-2">
            <p className="type-body">Hồ sơ chưa có bản công khai hoặc hiện không khả dụng.</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void query.refetch()}>
              Thử lại
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Avatar className="size-12 rounded-lg border">
                <AvatarImage src={profile.content.avatarUrl || undefined} alt="" className="object-contain" />
                <AvatarFallback className="rounded-lg">
                  <ProfileTypeIcon kind={profile.kind} className="size-5" />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="type-section-title break-words">{profile.content.name}</p>
                <p className="type-meta">
                  {profileKindLabels[profile.kind]}
                  {!profile.published && " · Bản nháp"}
                </p>
              </div>
            </div>
            <p className="type-body line-clamp-5 whitespace-pre-wrap text-muted-foreground">
              {profile.content.biography || "Chưa bổ sung giới thiệu."}
            </p>
            <Button variant="outline" size="sm" asChild>
              {access.canRead ? (
                <Link to={`/pages/${id}`} target="_blank" rel="noreferrer">
                  Mở hồ sơ
                  <ArrowUpRight className="size-4" />
                </Link>
              ) : (
                <a href={`${publicSite}/pages/${profile.code}`}>
                  Mở hồ sơ
                  <ArrowUpRight className="size-4" />
                </a>
              )}
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
