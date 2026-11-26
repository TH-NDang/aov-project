import { useMemo, type CSSProperties } from "react"
import { Link } from "react-router"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { useStreamLocale } from "../../../components/stream-locale"
import { lineFate, type HeroLine, type HeroOrder } from "../../../lib/hero-model"
import { firstOfWall, heroFigure, heroSummary, heroWall, shelfTitle, type HeroShelf } from "../../../lib/heroes-view"
import { statsHref } from "../../../lib/statistics-routes"
import { useKeptRows } from "../../../lib/use-kept-rows"
import { FateBar } from "./fate-bar"
import { HeroPortrait } from "./hero-portrait"
import type { StatsData } from "./stats-data"
import "./hero-shelves.css"

/** Heroes set out before the reader scrolls for more. */
const HEROES = 64

/** On a face smaller than this the parts of a bar are too short to tell apart. */
const BARRED = 80

/**
 * Every hero as a face on the shelf it belongs to, the higher the larger. Each shelf says in numbers what its heroes
 * share; `name` tells one list from another, so that a new one starts from its top.
 */
export function HeroShelves({
  data,
  lines,
  by,
  name,
}: {
  data: StatsData
  lines: HeroLine[]
  by: HeroOrder
  name: string
}) {
  const { text } = useStreamLocale()
  const { counted } = data
  const wall = useMemo(() => heroWall(lines, by, counted), [lines, by, counted])
  const { rows, loader } = useKeptRows(lines, name, HEROES)
  return (
    <div className="tn-shelves">
      <div className="tn-shelves-wall">
        {firstOfWall(wall, rows.length).map(({ shelf, lines: shown }) => (
          <Shelf key={`${shelf.kind}${shelf.from}`} data={data} shelf={shelf} shown={shown} by={by} />
        ))}
      </div>
      <InfiniteScroll
        query={loader}
        label={text("Đang tải thêm tướng", "Loading more heroes")}
        retryLabel={text("Tải lại phần tiếp theo", "Load the next part again")}
      />
    </div>
  )
}

function Shelf({ data, shelf, shown, by }: { data: StatsData; shelf: HeroShelf; shown: HeroLine[]; by: HeroOrder }) {
  const { text, languageTag } = useStreamLocale()
  const count = shelf.lines.length
  const number = count.toLocaleString(languageTag)
  return (
    <section
      className="tn-shelf"
      data-face={shelf.face}
      data-kind={shelf.kind}
      data-barred={shelf.face >= BARRED || undefined}
      style={{ "--count": count } as CSSProperties}
    >
      <h3>
        {shelfTitle(shelf, by, data.counted, text)}{" "}
        <span>{text(`${number} tướng`, `${number} ${count === 1 ? "hero" : "heroes"}`)}</span>
      </h3>
      <ol>
        {shown.map((line) => (
          <Face key={line.hero.key} data={data} shelf={shelf} line={line} by={by} />
        ))}
      </ol>
    </section>
  )
}

function Face({ data, shelf, line, by }: { data: StatsData; shelf: HeroShelf; line: HeroLine; by: HeroOrder }) {
  const { text, languageTag } = useStreamLocale()
  const { counted } = data
  const { hero } = line
  const figure = heroFigure(line, shelf, by, counted, text, languageTag)
  return (
    <li>
      <Link
        to={statsHref(data.view.id, { hero, scope: data.period?.key })}
        aria-label={heroSummary(line, counted, text, languageTag)}
      >
        <HeroPortrait hero={hero} />
        {shelf.face >= BARRED && <FateBar fate={lineFate(line, counted)} />}
        {figure && (
          <span className="tn-shelf-figure" data-share={figure.share ? "" : undefined}>
            <b>{figure.figure}</b> <span>{figure.unit ?? figure.share}</span>
          </span>
        )}
        <span className="tn-shelf-name">{hero.name}</span>
      </Link>
    </li>
  )
}
