import { Link, useSearchParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import type { CompetitionView } from "@aov/community-contracts"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aov/ui/components/public-select"
import { StreamShell } from "../../components/stream-shell"
import { StreamIcon } from "../../components/stream-icon"
import { CommunityAside } from "../community/community-aside"
import { competitionStatus, competitionStatusLabels } from "../community/community-ui"
import { CompetitionEvent } from "../community/public-competitions"
import { competitionCatalogQuery } from "./tournament-api"
import { competitionMatches } from "./match-model"
import { CompetitionSchedule } from "./competition-schedule"

const normalized = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")

export function CompetitionDirectory() {
  const query = useQuery(competitionCatalogQuery)
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
      <title>Giải đấu & lịch thi đấu — AOV Stream</title>
      <div className="competition-hub cp-container">
        <header className="competition-hub-header hub-card">
          <span className="competition-hub-mark">
            <StreamIcon name="trophy" size={26} />
          </span>
          <div>
            <span className="hub-kicker">Đấu trường Liên Quân</span>
            <h1>Giải đấu</h1>
            <p>Theo dõi mùa giải, lịch thi đấu và kết quả từng trận.</p>
          </div>
          <Link className="cp-button competition-lookup" to="/games">
            <StreamIcon name="search" size={15} />
            Tra cứu ván đấu
          </Link>
        </header>
        <section className="hub-card competition-hub-body">
          <nav className="cp-tabs" aria-label="Nội dung giải đấu">
            <button
              aria-current={tab === "competitions" ? "page" : undefined}
              onClick={() => update("tab", "competitions")}
            >
              Các giải đấu
            </button>
            <button aria-current={tab === "schedule" ? "page" : undefined} onClick={() => update("tab", "schedule")}>
              Lịch & kết quả
            </button>
          </nav>
          <div className="competition-filters">
            <label className="stream-search">
              <StreamIcon name="search" size={16} />
              <input
                aria-label="Tìm giải đấu"
                placeholder="Tìm giải đấu, hệ thống giải…"
                value={search}
                onChange={(event) => update("q", event.target.value)}
              />
            </label>
            <Filter
              label="Khu vực"
              value={region}
              onChange={(value) => update("region", value)}
              all="Mọi khu vực"
              options={regions.map((value) => [value, value])}
            />
            <Filter
              label="Năm"
              value={year}
              onChange={(value) => update("year", value)}
              all="Mọi năm"
              options={years.map((value) => [String(value), String(value)])}
            />
            <Filter
              label="Trạng thái giải"
              value={status}
              onChange={(value) => update("status", value)}
              all="Mọi trạng thái"
              options={Object.entries(competitionStatusLabels)}
            />
            {(region !== "all" || year !== "all" || status !== "all" || search) && (
              <button
                className="competition-clear"
                onClick={() => setParams(tab === "schedule" ? { tab: "schedule" } : {})}
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
          <div className="competition-hub-results">
            {query.isPending ? (
              <div className="hub-skeleton-rows" role="status" aria-label="Đang tải giải đấu" />
            ) : query.isError && !query.data ? (
              <div className="hub-state" role="alert">
                <StreamIcon name="info" size={28} />
                <h3>Chưa tải được giải đấu</h3>
                <button className="cp-button" onClick={() => void query.refetch()}>
                  Thử lại
                </button>
              </div>
            ) : (
              <>
                {query.isError && (
                  <p className="cp-error" role="alert">
                    Chưa cập nhật được dữ liệu. Đang hiển thị bản đã tải.{" "}
                    <button onClick={() => void query.refetch()}>Thử lại</button>
                  </p>
                )}
                {tab === "schedule" ? (
                  <CompetitionSchedule entries={competitionMatches(visible)} />
                ) : groups.size ? (
                  [...groups].map(([key, entries]) => (
                    <section className="competition-group" key={key}>
                      <div className="competition-group-heading">
                        <h2>
                          {entries[0]!.content.circuit?.name || entries[0]!.content.plan.circuit || "Các giải đấu khác"}
                        </h2>
                        <span>{entries.length} mùa giải</span>
                        {entries[0]!.content.circuit?.published && (
                          <Link to={`/pages/${entries[0]!.content.circuit!.code}`}>
                            Hệ thống giải <StreamIcon name="arrow" size={14} />
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
                    <h3>{items.length ? "Không có giải phù hợp" : "Chưa có giải đấu được công bố"}</h3>
                    <p>
                      {items.length
                        ? "Thử khu vực, năm hoặc trạng thái khác."
                        : "Các mùa giải và lịch thi đấu sẽ xuất hiện tại đây."}
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
