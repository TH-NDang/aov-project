import { Link } from "react-router"
import { useInfiniteQuery } from "@tanstack/react-query"
import { ArrowRight, CalendarDays } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { competitionApi, competitionKeys } from "@/features/competition/competition-api"
import { Section } from "./profile-fields"
import { InfiniteScroll } from "@/components/infinite-scroll"
import { nextPageOf } from "@aov/ui/lib/page-slice"

export function OrganizationCompetitions({
  organizationId,
  actorKey,
  kind = "ORGANIZATION",
}: {
  organizationId: string
  actorKey: string
  kind?: "ORGANIZATION" | "CIRCUIT"
}) {
  const circuit = kind === "CIRCUIT"
  const query = useInfiniteQuery({
    queryKey: [...competitionKeys, actorKey, kind, organizationId],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      circuit
        ? competitionApi.inCircuit(organizationId, pageParam)
        : competitionApi.organizedBy(organizationId, pageParam),
    getNextPageParam: nextPageOf,
  })
  const competitions = query.data?.pages.flatMap((page) => page.items) ?? []
  return (
    <Section
      title={circuit ? "Các mùa giải" : "Giải đấu tổ chức"}
      icon={CalendarDays}
      description={
        circuit
          ? "Các mùa giải thuộc hệ thống giải này, gồm bản nháp và bản đã xuất bản."
          : "Tự động hiển thị các mùa giải chọn tổ chức này làm đơn vị tổ chức, gồm bản nháp và bản đã xuất bản."
      }
    >
      {query.isPending ? (
        <p className="type-body" role="status">
          Đang tải giải đấu…
        </p>
      ) : query.isLoadingError ? (
        <div className="space-y-3" role="alert">
          <p className="type-body">Chưa tải được giải đấu. Hãy kiểm tra kết nối và thử lại.</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Thử lại
          </Button>
        </div>
      ) : !competitions.length ? (
        <div className="space-y-2 rounded-lg border border-dashed p-6">
          <h3 className="type-section-title">Chưa có giải đấu liên kết</h3>
          <p className="type-body text-muted-foreground">
            {circuit
              ? "Chọn hồ sơ này trong mục Hệ thống giải ở bước Thông tin của mùa giải, rồi lưu bản nháp."
              : "Chọn tổ chức này trong mục Đơn vị tổ chức ở bước Thông tin của giải, rồi lưu bản nháp."}
          </p>
        </div>
      ) : (
        <>
          <p className="type-meta">{query.data.pages[0].totalElements} mùa giải</p>
          <div className="divide-y rounded-lg border">
            {competitions.map((entry) => (
              <Link
                key={entry.id}
                to={`/tournaments/${entry.id}?step=0`}
                className="flex items-center gap-4 p-4 hover:bg-muted/50"
              >
                <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                  {entry.tournament.logoUrl ? (
                    <img src={entry.tournament.logoUrl} alt="" className="size-full object-contain" />
                  ) : (
                    <CalendarDays className="size-5 text-muted-foreground" />
                  )}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <h3 className="type-section-title break-words">{entry.tournament.name}</h3>
                  <p className="type-meta">
                    {entry.tournament.startsOn || "Chưa có ngày bắt đầu"} →{" "}
                    {entry.tournament.endsOn || "Chưa có ngày kết thúc"}
                  </p>
                  <p className="type-meta">
                    {entry.entrants} đội · {entry.matches} trận
                  </p>
                </div>
                <span className="type-label rounded-md bg-muted px-2 py-1">
                  {entry.publishedAt ? "Đã xuất bản" : "Bản nháp"}
                </span>
                <ArrowRight className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
              </Link>
            ))}
          </div>
          <InfiniteScroll query={query} label="Đang tải thêm giải đấu" />
        </>
      )}
      <Button variant="outline" asChild>
        <Link to="/tournaments">
          Quản lý giải đấu
          <ArrowRight className="size-4" />
        </Link>
      </Button>
    </Section>
  )
}
