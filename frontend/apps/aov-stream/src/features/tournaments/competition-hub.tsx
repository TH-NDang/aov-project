import { Link, useSearchParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import type { CompetitionView } from "@aov/community-contracts"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aov/ui/components/public-select"
import { navArtIcons } from "@aov/ui/components/nav-art-icons"
import { StreamShell } from "../../components/stream-shell"
import { StreamIcon } from "../../components/stream-icon"
import { useStreamLocale } from "../../components/stream-locale"
import { CommunityAside } from "../community/community-aside"
import { competitionStatus, competitionStatusLabels } from "../community/community-ui"
import { CompetitionEvent } from "../community/public-competitions"
import { competitionCatalogQuery } from "./tournament-api"
import { competitionMatches } from "./match-model"
import { CompetitionSchedule } from "./competition-schedule"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { PublicFilterSheet } from "@aov/ui/components/public-filter-sheet"

const normalized = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")

export function CompetitionDirectory() {
  const { text } = useStreamLocale()
  const query = useQuery(competitionCatalogQuery)
  const layout = usePageLayout()
  const [params, setParams] = useSearchParams()
  const tab = params.get("tab") === "schedule" ? "schedule" : "competitions"
  const region = params.get("region") || "all"
  const year = params.get("year") || "all"
  const status = params.get("status") || "all"
  const search = params.get("q") || ""
  const items = query.data || []
  const regions = [...new Set(items.map((entry) => entry.content.tournament.region).filter(Boolean))].sort()
  const years = [...new Set(items.map((entry) => entry.content.tournament.year).filter((value) => value != null))].sort(
    (a, b) => b - a,
  )
  const update = (key: string, value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (!value || value === "all" || (key === "tab" && value === "competitions")) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: key === "q" },
    )
  const visible = items.filter(
    ({ content: { tournament, plan } }) =>
      (region === "all" || region === tournament.region) &&
      (year === "all" || year === String(tournament.year)) &&
      (status === "all" || status === competitionStatus(tournament)) &&
      (!search.trim() ||
        normalized(`${tournament.name} ${plan.circuit} ${plan.organizer}`).includes(normalized(search.trim()))),
  )
  const clearFilters = () => setParams(tab === "schedule" ? { tab: "schedule" } : {})
  const filters = (
    <>
      <Filter
        label={text("Khu vực", "Region")}
        value={region}
        onChange={(value) => update("region", value)}
        all={text("Mọi khu vực", "All regions")}
        options={regions.map((value) => [value, value])}
      />
      <Filter
        label={text("Năm", "Year")}
        value={year}
        onChange={(value) => update("year", value)}
        all={text("Mọi năm", "All years")}
        options={years.map((value) => [String(value), String(value)])}
      />
      <Filter
        label={text("Trạng thái giải", "Tournament status")}
        value={status}
        onChange={(value) => update("status", value)}
        all={text("Mọi trạng thái", "All statuses")}
        options={Object.entries(competitionStatusLabels())}
      />
    </>
  )
  const groups = new Map<string, CompetitionView[]>()
  const order = ["ONGOING", "UPCOMING", "ANNOUNCED", null, "FINISHED"]
  for (const entry of [...visible].sort(
    (a, b) =>
      order.indexOf(competitionStatus(a.content.tournament)) - order.indexOf(competitionStatus(b.content.tournament)) ||
      (b.content.tournament.year || 0) - (a.content.tournament.year || 0),
  )) {
    const key = entry.content.circuit?.id || entry.content.plan.circuit || "other"
    groups.set(key, [...(groups.get(key) || []), entry])
  }
  return (
    <StreamShell aside={<CommunityAside schedule={false} />}>
      <title>{text("Giải đấu & lịch thi đấu — AOV Stream", "Tournaments & schedule — AOV Stream")}</title>
      <div className="competition-hub cp-container">
        <header className="competition-hub-header">
          {layout === "wide" && <navArtIcons.tournaments size={48} />}
          <div>
            <h1>{text("Giải đấu", "Tournaments")}</h1>
            {layout === "wide" && (
              <p>
                {text(
                  "Theo dõi mùa giải, lịch thi đấu và kết quả từng trận.",
                  "Follow seasons, schedules and the result of every match.",
                )}
              </p>
            )}
          </div>
          <Link className="cp-button competition-lookup" to="/games">
            <StreamIcon name="search" size={15} />
            {text("Tra cứu ván đấu", "Game lookup")}
          </Link>
        </header>
        <section className="competition-hub-body">
          <nav className="cp-tabs" aria-label={text("Nội dung giải đấu", "Tournament content")}>
            <button
              aria-current={tab === "competitions" ? "page" : undefined}
              onClick={() => update("tab", "competitions")}
            >
              {text("Các giải đấu", "Tournaments")}
            </button>
            <button aria-current={tab === "schedule" ? "page" : undefined} onClick={() => update("tab", "schedule")}>
              {text("Lịch & kết quả", "Schedule & results")}
            </button>
          </nav>
          <div className="competition-filters">
            <label className="stream-search">
              <StreamIcon name="search" size={16} />
              <input
                aria-label={text("Tìm giải đấu", "Search tournaments")}
                placeholder={text("Tìm giải đấu, hệ thống giải…", "Search tournaments, circuits…")}
                value={search}
                onChange={(event) => update("q", event.target.value)}
              />
            </label>
            {layout === "compact" ? (
              <PublicFilterSheet
                title={text("Lọc giải đấu", "Filter tournaments")}
                triggerLabel={text("Lọc", "Filter")}
                count={[region, year, status].filter((value) => value !== "all").length}
                resetLabel={text("Xóa lọc", "Clear filters")}
                onReset={clearFilters}
                resultLabel={text(
                  `Xem ${visible.length} giải đấu`,
                  `Show ${visible.length} ${visible.length === 1 ? "tournament" : "tournaments"}`,
                )}
              >
                <div className="competition-sheet-filters">{filters}</div>
              </PublicFilterSheet>
            ) : (
              <div className="competition-filter-group">
                {filters}
                {(region !== "all" || year !== "all" || status !== "all" || search) && (
                  <button className="competition-clear" onClick={clearFilters}>
                    {text("Xóa bộ lọc", "Clear filters")}
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="competition-hub-results">
            {query.isPending ? (
              <div
                className="hub-skeleton-rows"
                role="status"
                aria-label={text("Đang tải giải đấu", "Loading tournaments")}
              />
            ) : query.isError && !query.data ? (
              <div className="hub-state" role="alert">
                <StreamIcon name="info" size={28} />
                <h3>{text("Chưa tải được giải đấu", "Tournaments could not be loaded")}</h3>
                <button className="cp-button" onClick={() => void query.refetch()}>
                  {text("Thử lại", "Retry")}
                </button>
              </div>
            ) : (
              <>
                {query.isError && (
                  <p className="cp-error" role="alert">
                    {text(
                      "Chưa cập nhật được dữ liệu. Đang hiển thị bản đã tải.",
                      "The data could not be updated. Showing the version already loaded.",
                    )}{" "}
                    <button onClick={() => void query.refetch()}>{text("Thử lại", "Retry")}</button>
                  </p>
                )}
                {tab === "schedule" ? (
                  <CompetitionSchedule entries={competitionMatches(visible)} />
                ) : groups.size ? (
                  [...groups].map(([key, entries]) => (
                    <section className="competition-group" key={key}>
                      <div className="competition-group-heading">
                        <h2>
                          {entries[0]!.content.circuit?.name ||
                            entries[0]!.content.plan.circuit ||
                            text("Các giải đấu khác", "Other tournaments")}
                        </h2>
                        <span>
                          {text(
                            `${entries.length} mùa giải`,
                            `${entries.length} ${entries.length === 1 ? "season" : "seasons"}`,
                          )}
                        </span>
                        {entries[0]!.content.circuit?.published && (
                          <Link to={`/pages/${entries[0]!.content.circuit!.code}`}>
                            {text("Hệ thống giải", "Circuit")} <StreamIcon name="arrow" size={14} />
                          </Link>
                        )}
                      </div>
                      <div className="hub-event-list">
                        {entries.map((entry) => (
                          <CompetitionEvent key={entry.id} entry={entry} />
                        ))}
                      </div>
                    </section>
                  ))
                ) : (
                  <div className="hub-state">
                    <StreamIcon name="trophy" size={30} />
                    <h3>
                      {items.length
                        ? text("Không có giải phù hợp", "No matching tournaments")
                        : text("Chưa có giải đấu được công bố", "No tournaments published yet")}
                    </h3>
                    <p>
                      {items.length
                        ? text("Thử khu vực, năm hoặc trạng thái khác.", "Try another region, year or status.")
                        : text(
                            "Các mùa giải và lịch thi đấu sẽ xuất hiện tại đây.",
                            "Seasons and schedules will appear here.",
                          )}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </StreamShell>
  )
}

function Filter({
  label,
  value,
  onChange,
  all,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  all: string
  options: string[][]
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="competition-select">
        <SelectValue />
      </SelectTrigger>
      <SelectContent drawerTitle={label}>
        <SelectItem value="all">{all}</SelectItem>
        {options.map(([key, text]) => (
          <SelectItem key={key} value={key!}>
            {text}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
