import { useDeferredValue } from "react"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { Link, useSearchParams } from "react-router"
import type { PublishedGame } from "@aov/community-contracts"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { foldSearchText } from "@aov/ui/lib/search-text"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { StreamShell } from "../../../components/stream-shell"
import { gamesBySeries } from "../../../lib/series-model"
import { gamesQuery, tournamentsQuery } from "../../../lib/tournament-api"
import { seriesRound, seriesTeams } from "../../../lib/tournament-model"
import { GameSeries } from "../components/game-series"
import { FilterSelect } from "../components/schedule-controls"
import { ScheduleNote } from "../components/schedule-list"
import "./games-page.css"

/** The match a game belongs to in a few words: both teams and, where the match has one, its round. */
function matchName(game: PublishedGame, locale: string) {
  const round = seriesRound(game.series, locale)
  const teams = seriesTeams(game, locale)
    .map((team) => team.shortName)
    .join(" vs ")
  return round ? `${teams} (${round})` : teams
}

/**
 * Every published game, newest first and gathered by match, loading as the reader scrolls. The search reads the teams
 * and the round of the games loaded so far and goes on loading until the list is exhausted.
 */
export function GamesPage() {
  const { text, languageTag } = useStreamLocale()
  const [params, setParams] = useSearchParams()
  const tournament = params.get("tournament") || ""
  const seriesId = params.get("series") || ""
  const q = params.get("q") || ""
  const search = useDeferredValue(foldSearchText(q.trim()))
  const games = useInfiniteQuery(gamesQuery({ tournamentId: tournament || undefined, seriesId: seriesId || undefined }))
  const tournaments = useQuery(tournamentsQuery)
  const competitions = tournaments.data?.items ?? []
  const entries = games.data?.pages.flatMap((page) => page.items) || []
  const visible = entries.filter(
    (game) =>
      !search ||
      foldSearchText(
        [
          game.tournament.name,
          seriesRound(game.series, languageTag),
          ...Object.values(game.teams).flatMap((team) => [team.name, team.shortName]),
        ]
          .filter(Boolean)
          .join(" "),
      ).includes(search),
  )
  const total = games.data?.pages[0]?.totalElements
  // A list that holds one competition names it once in the head instead of on every match.
  const only = competitions.length === 1 ? competitions[0]!.content.name : null
  const mixed = !tournament && !seriesId && competitions.length > 1
  const series = seriesId ? entries[0] : undefined
  const filtered = !!(q || tournament || seriesId)
  function filter(key: string, value: string) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (key === "tournament") next.delete("series")
        if (value && value !== "all") next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: key === "q" },
    )
  }
  return (
    <StreamShell
      search={{
        value: q,
        onChange: (value) => filter("q", value),
        label: text("Tìm ván đấu theo đội hoặc vòng đấu", "Search games by team or round"),
        placeholder: text("Tìm đội, vòng đấu…", "Search teams, rounds…"),
      }}
    >
      <title>{text("Tra cứu ván đấu — AOV Stream", "Game lookup — AOV Stream")}</title>
      <div className="tn-games">
        <h1 className="sr-only">{text("Tra cứu ván đấu", "Game lookup")}</h1>
        <div className="tn-games-bar">
          <Link className="cp-back" data-flush="" to="/competitions">
            <StreamIcon name="back" size={16} />
            {text("Giải đấu", "Tournaments")}
          </Link>
          {!!total && (
            <span className="tn-games-count">
              {[
                text(
                  `${total.toLocaleString(languageTag)} ván`,
                  `${total.toLocaleString(languageTag)} ${total === 1 ? "game" : "games"}`,
                ),
                !seriesId && only,
              ]
                .filter(Boolean)
                .join(", ")}
            </span>
          )}
          {competitions.length > 1 && (
            <FilterSelect
              label={text("Giải đấu", "Tournament")}
              value={tournament || "all"}
              onChange={(value) => filter("tournament", value)}
              all={text("Mọi giải đấu", "All tournaments")}
              options={competitions.map((entry) => [entry.id, `${entry.content.name} (${entry.gameCount})`])}
              className="tn-games-select"
            />
          )}
        </div>
        <ScheduleNote
          filters={
            seriesId
              ? [
                  series
                    ? text(
                        `các ván của trận ${matchName(series, languageTag)}`,
                        `games of ${matchName(series, languageTag)}`,
                      )
                    : text("các ván của một trận", "games of one match"),
                ]
              : []
          }
          onClear={() => filter("series", "")}
        />
        {games.isPending ? (
          <div className="tn-series-list" role="status" aria-label={text("Đang tải ván đấu", "Loading games")}>
            {Array.from({ length: 3 }, (_, index) => (
              <span className="hub-skeleton tn-series-skeleton" key={index} aria-hidden="true" />
            ))}
          </div>
        ) : games.isLoadingError ? (
          <div className="hub-state" role="alert">
            <h2>{text("Chưa tải được ván đấu", "The games could not be loaded")}</h2>
            <p>
              {text(
                "Kho dữ liệu giải đấu chưa phản hồi. Thử lại sau ít phút.",
                "The tournament data store is not answering. Try again in a few minutes.",
              )}
            </p>
            <button type="button" className="cp-button" onClick={() => void games.refetch()}>
              {text("Thử lại", "Retry")}
            </button>
          </div>
        ) : visible.length ? (
          <div className="tn-series-list">
            {gamesBySeries(visible).map((group) => (
              <GameSeries games={group} key={group[0]!.id} competition={mixed} />
            ))}
          </div>
        ) : games.hasNextPage ? null : (
          <div className="hub-state">
            <h2>
              {filtered
                ? text("Không tìm thấy ván phù hợp", "No matching games found")
                : text("Chưa có ván đấu được công bố", "No games published yet")}
            </h2>
            <p>
              {filtered
                ? text(
                    "Thử tên đội khác hoặc bỏ bộ lọc đang chọn.",
                    "Try another team name or clear the chosen filters.",
                  )
                : text(
                    "Các ván đã được rà soát và xuất bản sẽ xuất hiện tại đây.",
                    "Games that have been reviewed and published will appear here.",
                  )}
            </p>
            {filtered ? (
              <button type="button" className="cp-button" onClick={() => setParams({}, { replace: true })}>
                {text("Xóa bộ lọc", "Clear filters")}
              </button>
            ) : (
              <Link className="cp-button" to="/competitions">
                {text("Xem giải đấu", "See tournaments")} <StreamIcon name="arrow" size={15} />
              </Link>
            )}
          </div>
        )}
        <InfiniteScroll
          query={games}
          label={text("Đang tải thêm ván đấu", "Loading more games")}
          retryLabel={text("Tải lại phần tiếp theo", "Load the next part again")}
        />
      </div>
    </StreamShell>
  )
}
