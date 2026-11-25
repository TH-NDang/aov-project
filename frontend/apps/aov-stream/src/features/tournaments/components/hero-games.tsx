import { useInfiniteQuery } from "@tanstack/react-query"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { GoLink } from "../../../components/go-link"
import { PlaceSteps, PlaceTrail, type Step } from "../../../components/place-trail"
import { Stage } from "../../../components/stage"
import { useStreamLocale } from "../../../components/stream-locale"
import { WIKI_URL } from "../../../components/stream-shell"
import { beside } from "../../../lib/neighbours"
import { heroHref, percent, type HeroLine } from "../../../lib/statistics-model"
import { gamesQuery } from "../../../lib/tournament-api"
import { GameRow } from "./game-card"
import { HeroPortrait } from "./hero-portrait"
import "./hero-games.css"

/**
 * One hero in a competition: how it did, then every game it was picked in, the newest first. `heroes` are all of them in
 * the order of the table, so the ones before and after are a step away.
 */
export function HeroGames({
  competitionId,
  hero,
  heroes,
  games,
}: {
  competitionId: string
  hero: HeroLine
  heroes: HeroLine[]
  games: number
}) {
  const { text } = useStreamLocale()
  const query = useInfiniteQuery(gamesQuery({ tournamentId: competitionId, heroId: hero.id ?? undefined }))
  const entries = query.data?.pages.flatMap((page) => page.items) ?? []
  const { name, picks, wins, bans, bluePicks, presence, code, iconUrl } = hero
  const listed = heroes.filter((line) => line.id)
  const near = beside(
    listed,
    listed.findIndex((line) => line.id === hero.id),
  )
  const step = (other: HeroLine | null): Step | null =>
    other && { to: heroHref(competitionId, other), name: other.name }
  const figures: [string, string, string?][] = [
    [text("Có mặt", "Presence"), `${percent(presence, games)}%`],
    [text("Chọn", "Picked"), String(picks)],
    [text("Thắng", "Won"), picks ? `${percent(wins, picks)}%` : "–", picks ? `${wins}–${picks - wins}` : undefined],
    [text("Cấm", "Banned"), String(bans)],
    [text("Bên xanh / đỏ", "Blue / red side"), `${bluePicks} / ${picks - bluePicks}`],
  ]
  return (
    <div className="tn-hero-page">
      <PlaceTrail
        places={[{ to: `/competitions/${competitionId}?tab=stats`, name: text("Thống kê", "Statistics") }]}
        current={name}
        steps={
          <PlaceSteps
            label={text("Tướng liền kề", "Heroes before and after")}
            before={step(near.before)}
            after={step(near.after)}
          />
        }
      />
      <Stage tint={name} lights={[{ src: iconUrl, at: "left" }]} className="tn-hero-head">
        <HeroPortrait hero={hero} />
        <div>
          <h2>{code ? <GoLink to={`${WIKI_URL.replace(/\/$/, "")}/heroes/${code}`}>{name}</GoLink> : name}</h2>
          <dl>
            {figures.map(([label, value, note]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  {value}
                  {note && <small>{note}</small>}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Stage>
      {query.isPending ? (
        <div className="tn-game-list" role="status" aria-label={text("Đang tải ván đấu", "Loading games")}>
          {Array.from({ length: 6 }, (_, index) => (
            <span className="hub-skeleton tn-game-skeleton" key={index} aria-hidden="true" />
          ))}
        </div>
      ) : query.isLoadingError ? (
        <div className="hub-state" role="alert">
          <h2>{text("Chưa tải được ván đấu", "The games could not be loaded")}</h2>
          <button type="button" className="cp-button" onClick={() => void query.refetch()}>
            {text("Thử lại", "Retry")}
          </button>
        </div>
      ) : entries.length ? (
        <div className="tn-game-list">
          {entries.map((game) => (
            <GameRow key={game.id} game={game} heroId={hero.id} />
          ))}
        </div>
      ) : (
        <div className="hub-state">
          <h2>{text("Tướng này chưa được chọn ván nào", "This hero was not picked in any game")}</h2>
        </div>
      )}
      <InfiniteScroll
        query={query}
        label={text("Đang tải thêm ván đấu", "Loading more games")}
        retryLabel={text("Tải lại phần tiếp theo", "Load the next part again")}
      />
    </div>
  )
}
