import { useDeferredValue, useEffect, useRef, type CSSProperties } from "react"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { Link, useSearchParams } from "react-router"
import { StreamIcon } from "../../components/stream-icon"
import { useStreamLocale } from "../../components/stream-locale"
import { StreamShell } from "../../components/stream-shell"
import { gamesQuery, tournamentsQuery } from "./tournament-api"
import { GameCard } from "./game-card"
import { CommunityAside } from "../community/community-aside"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"

export function TournamentDirectory() {
  const { text } = useStreamLocale()
  const layout = usePageLayout()
  const [params, setParams] = useSearchParams()
  const tournament = params.get("tournament") || ""
  const seriesId = params.get("series") || ""
  const q = params.get("q") || ""
  const search = useDeferredValue(
    q
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("vi-VN"),
  )
  const games = useInfiniteQuery(gamesQuery({ tournamentId: tournament || undefined, seriesId: seriesId || undefined }))
  const tournaments = useQuery(tournamentsQuery)
  const sentinel = useRef<HTMLDivElement>(null)
  const entries = games.data?.pages.flatMap((page) => page.items) || []
  const visible = entries.filter(
    (game) =>
      !search ||
      [game.tournament.name, game.series.name, game.series.stage, ...Object.values(game.teams).map((team) => team.name)]
        .filter(Boolean)
        .join(" ")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("vi-VN")
        .includes(search),
  )
  useEffect(() => {
    if (!sentinel.current || !games.hasNextPage || games.isFetching || games.isFetchNextPageError) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void games.fetchNextPage()
      },
      { rootMargin: "300px" },
    )
    observer.observe(sentinel.current)
    return () => observer.disconnect()
  }, [games.hasNextPage, games.isFetching, games.isFetchNextPageError, games.fetchNextPage, visible.length])
  function filter(key: string, value: string) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (key === "tournament") next.delete("series")
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: key === "q" },
    )
  }
  return (
    <StreamShell aside={<CommunityAside schedule />}>
      <title>{text("Tra cứu ván đấu — AOV Stream", "Game lookup — AOV Stream")}</title>
      <Link className="cp-back" to="/competitions">
        <StreamIcon name="back" size={16} />
        {text("Giải đấu", "Tournaments")}
      </Link>
      <header className="hub-banner hub-art" style={{ "--hub-hue": 252 } as CSSProperties}>
        <div className="hub-banner-copy">
          {layout === "wide" && (
            <span className="hub-kicker">{text("Đấu trường trong tầm ngắm", "The arena in your sights")}</span>
          )}
          <h1>{text("Tra cứu ván đấu", "Game lookup")}</h1>
          {layout === "wide" && (
            <p>
              {text(
                "Theo dấu đội hình, cách lên đồ và những lựa chọn làm nên ván đấu.",
                "Trace the lineups, the item builds and the choices that made each game.",
              )}
            </p>
          )}
          <div className="hub-banner-stats">
            <span>
              <StreamIcon name="gamepad" size={14} />
              {games.data?.pages[0]?.totalElements ?? "—"}{" "}
              {text("ván đã biên tập", games.data?.pages[0]?.totalElements === 1 ? "edited game" : "edited games")}
            </span>
            <span>
              <StreamIcon name="trophy" size={14} />
              {tournaments.data?.items.length ?? "—"}{" "}
              {text("giải đấu", tournaments.data?.items.length === 1 ? "tournament" : "tournaments")}
            </span>
          </div>
        </div>
      </header>
      <section className="stream-directory" id="matches">
        <div className="stream-toolbar">
          <div className="stream-toolbar-row">
            <div className="hub-section-heading">
              <h2>
                <StreamIcon name="trophy" size={20} />
                {text("Ván đấu đã công bố", "Published games")}
              </h2>
            </div>
            <label className="stream-search">
              <StreamIcon name="search" size={16} />
              <input
                aria-label={text("Tìm giải đấu hoặc đội tuyển", "Search tournaments or teams")}
                placeholder={text("Tìm giải đấu, đội tuyển…", "Search tournaments, teams…")}
                value={q}
                onChange={(event) => filter("q", event.target.value)}
              />
            </label>
          </div>
          <div className="hub-pills" role="group" aria-label={text("Chọn giải đấu", "Choose a tournament")}>
            <button type="button" aria-pressed={!tournament} onClick={() => filter("tournament", "")}>
              <StreamIcon name="list" size={15} />
              {text("Tất cả", "All")}
            </button>
            {tournaments.data?.items.map((entry) => (
              <button
                type="button"
                key={entry.id}
                aria-pressed={entry.id === tournament}
                onClick={() => filter("tournament", entry.id)}
              >
                {entry.content.name}
                <small>{entry.gameCount}</small>
              </button>
            ))}
          </div>
        </div>
        {games.isPending ? (
          <div className="game-card-grid" role="status" aria-label={text("Đang tải ván đấu", "Loading games")}>
            {Array.from({ length: 4 }, (_, index) => (
              <div className="game-card-skeleton" key={index} aria-hidden="true" />
            ))}
          </div>
        ) : games.isError && !games.data ? (
          <div className="hub-state">
            <StreamIcon name="reset" size={28} />
            <h3>{text("Chưa kết nối được dữ liệu", "The data could not be reached")}</h3>
            <p>
              {text("Thử lại sau khi máy chủ giải đấu đã sẵn sàng.", "Try again once the tournament server is ready.")}
            </p>
            <button type="button" className="cp-button" onClick={() => void games.refetch()}>
              {text("Thử lại", "Retry")}
            </button>
          </div>
        ) : visible.length ? (
          <div className="game-card-grid">
            {visible.map((game) => (
              <GameCard game={game} key={game.id} />
            ))}
          </div>
        ) : (
          <div className="hub-state">
            <StreamIcon name="gamepad" size={28} />
            <h3>
              {q
                ? text("Chưa tìm thấy ván phù hợp", "No matching games found")
                : text("Chưa có ván đấu được công bố", "No games published yet")}
            </h3>
            <p>
              {q
                ? text("Thử tên đội hoặc chọn giải khác.", "Try a team name or choose another tournament.")
                : text(
                    "Các ván đã được rà soát và xuất bản sẽ xuất hiện tại đây.",
                    "Games that have been reviewed and published will appear here.",
                  )}
            </p>
            {!q && (
              <Link className="cp-button" to="/competitions">
                {text("Xem giải đấu", "See tournaments")} <StreamIcon name="arrow" size={15} />
              </Link>
            )}
          </div>
        )}
        <div ref={sentinel} className="stream-load-more" role="status">
          {games.isFetchingNextPage ? (
            text("Đang tải thêm ván đấu…", "Loading more games…")
          ) : games.isFetchNextPageError ? (
            <button type="button" onClick={() => void games.fetchNextPage()}>
              {text("Tải lại phần tiếp theo", "Load the next part again")}
            </button>
          ) : null}
        </div>
        {games.isError && games.data && (
          <p className="stream-connection-note">
            {text("Đang hiển thị dữ liệu đã tải.", "Showing the data already loaded.")}{" "}
            <button type="button" onClick={() => void games.refetch()}>
              {text("Kết nối lại", "Reconnect")}
            </button>
          </p>
        )}
      </section>
    </StreamShell>
  )
}
