import { useDeferredValue, useEffect, useRef } from "react"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router"
import { StreamBrand } from "../../components/stream-brand"
import { StreamIcon } from "../../components/stream-icon"
import { StreamShell, ADMIN_URL } from "../../components/stream-shell"
import { gamesQuery, tournamentsQuery } from "./tournament-api"
import { GameCard } from "./game-card"

export function TournamentDirectory() {
  const [params, setParams] = useSearchParams()
  const tournament = params.get("tournament") || ""
  const q = params.get("q") || ""
  const search = useDeferredValue(
    q
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("vi-VN"),
  )
  const games = useInfiniteQuery(gamesQuery({ tournamentId: tournament || undefined }))
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
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: key === "q" },
    )
  }
  return (
    <StreamShell>
      <title>Giải đấu — AOV Stream</title>
      <section className="stream-intro">
        <div>
          <span className="stream-eyebrow">
            <i />
            ĐẤU TRƯỜNG TRONG TẦM NGẮM
          </span>
          <h1>
            Mỗi trận đấu,
            <br />
            một góc nhìn mới<span>.</span>
          </h1>
          <p>Theo dấu đội hình, cách lên đồ và những lựa chọn làm nên ván đấu.</p>
          <a href="#matches" className="stream-discover">
            Khám phá trận đấu <StreamIcon name="arrow" size={17} />
          </a>
        </div>
        <div className="stream-observatory" aria-hidden="true">
          <span className="orbit orbit-one" />
          <span className="orbit orbit-two" />
          <span className="orbit-star star-one">✦</span>
          <span className="orbit-star star-two">✧</span>
          <StreamBrand compact />
          <span className="orbit-label">LOOK CLOSER. PLAY SMARTER.</span>
        </div>
      </section>
      <section className="stream-directory" id="matches">
        <div className="stream-section-heading">
          <h2>
            <StreamIcon name="trophy" size={21} />
            Trận đấu
          </h2>
          <span>{games.data?.pages[0]?.totalElements ?? "—"} ván đã biên tập</span>
          <label className="stream-search">
            <StreamIcon name="search" size={16} />
            <input
              aria-label="Tìm giải đấu hoặc đội tuyển"
              placeholder="Tìm giải đấu, đội tuyển…"
              value={q}
              onChange={(event) => filter("q", event.target.value)}
            />
          </label>
        </div>
        <div className="stream-tournament-filter" aria-label="Chọn giải đấu">
          <button type="button" aria-pressed={!tournament} onClick={() => filter("tournament", "")}>
            <StreamIcon name="list" size={15} />
            Tất cả
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
        {games.isPending ? (
          <div className="game-card-grid" role="status" aria-label="Đang tải trận đấu">
            {Array.from({ length: 6 }, (_, index) => (
              <div className="game-card game-card-skeleton" key={index} aria-hidden="true" />
            ))}
          </div>
        ) : games.isError && !games.data ? (
          <div className="stream-state">
            <StreamIcon name="reset" size={32} />
            <h3>Chưa kết nối được dữ liệu</h3>
            <p>Thử lại sau khi máy chủ giải đấu đã sẵn sàng.</p>
            <button type="button" onClick={() => void games.refetch()}>
              Thử lại
            </button>
          </div>
        ) : visible.length ? (
          <div className="game-card-grid">
            {visible.map((game) => (
              <GameCard game={game} key={game.id} />
            ))}
          </div>
        ) : (
          <div className="stream-state">
            <StreamBrand compact />
            <h3>{q ? "Chưa tìm thấy trận phù hợp" : "Đấu trường đang chờ những bản ghi đầu tiên"}</h3>
            <p>
              {q ? "Thử tên đội hoặc chọn giải khác." : "Các ván đã được rà soát và xuất bản sẽ xuất hiện tại đây."}
            </p>
            {!q && (
              <a href={`${ADMIN_URL}/tournaments`}>
                Đến trang biên tập <StreamIcon name="arrow" size={15} />
              </a>
            )}
          </div>
        )}
        <div ref={sentinel} className="stream-load-more" role="status">
          {games.isFetchingNextPage ? (
            "Đang tải thêm trận đấu…"
          ) : games.isFetchNextPageError ? (
            <button type="button" onClick={() => void games.fetchNextPage()}>
              Tải lại phần tiếp theo
            </button>
          ) : null}
        </div>
        {games.isError && games.data && (
          <p className="stream-connection-note">
            Đang hiển thị dữ liệu đã tải.{" "}
            <button type="button" onClick={() => void games.refetch()}>
              Kết nối lại
            </button>
          </p>
        )}
      </section>
    </StreamShell>
  )
}
