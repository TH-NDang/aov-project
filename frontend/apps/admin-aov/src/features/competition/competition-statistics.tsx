import { useGameCatalog, useTournamentGames } from "@/features/esports/data/use-esports-data"
import { HeroStatistics } from "@/features/esports/components/hero-stats"
import { gameStatistics } from "@/features/esports/model/statistics"
import { referenceIndex } from "@/features/esports/model/game-view"
import { Section } from "@/features/community/profile-fields"

export function CompetitionStatistics({ tournamentId, seriesIds }: { tournamentId: string; seriesIds: string[] }) {
  const query = useTournamentGames(tournamentId)
  const contents = (query.data || [])
    .filter((row) => seriesIds.includes(row.content.seriesId))
    .map((row) => row.content)
  const catalog = useGameCatalog(contents[0])
  const lookup = referenceIndex(catalog.data?.heroes)
  return (
    <Section
      title="Thống kê các ván đã ghi"
      description="Tổng hợp dữ liệu biên tập của giải, gồm cả bản nháp. Ván chưa có kết quả không tính vào số ván thắng."
    >
      {query.isPending ? (
        <p className="type-body">Đang tải…</p>
      ) : query.isError ? (
        <p className="type-body text-destructive">Chưa tải được dữ liệu ván đấu.</p>
      ) : !contents.length ? (
        <p className="type-body text-muted-foreground">
          Thống kê cấm/chọn và tỉ lệ thắng xuất hiện khi các ván có dữ liệu.
        </p>
      ) : (
        <HeroStatistics
          stats={gameStatistics(contents)}
          icon={(key, name) => lookup({ id: key.startsWith("name:") ? null : key, name }) || { name }}
        />
      )}
    </Section>
  )
}
