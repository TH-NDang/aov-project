import { Link, useSearchParams } from "react-router"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { FoldButton } from "../../../components/fold-button"
import { useStreamLocale } from "../../../components/stream-locale"
import { gamesText, score } from "../../../lib/feed-words"
import { enoughPicks, heroMates, type HeroMate, type HeroRecord, type Relation } from "../../../lib/hero-model"
import { mateRows, type MateOrder } from "../../../lib/hero-page-model"
import { withParam } from "../../../lib/params"
import { ENOUGH_FOR_SHARE, shareText } from "../../../lib/shares"
import { statsHref } from "../../../lib/statistics-routes"
import { useEntryState } from "../../../lib/use-entry-state"
import { useFold } from "../../../lib/use-fold"
import { useWidth } from "../../../lib/use-width"
import { ChoiceTrack } from "./choice-track"
import { ChoiceWords } from "./choice-words"
import { cellUnit, GameCells } from "./game-marks"
import { HeroPortrait } from "./hero-portrait"
import { Section } from "./section"
import type { StatsData } from "./stats-data"
import "./hero-wings.css"

type Wing = "with" | "against"

/** Heroes of a wing before the reader asks for all of them. */
const SHOWN = 6
/** Where the one list of a compact layout is narrower, the cells of a row stand under its name. */
const NARROW = 640
/** What a row holds besides its cells: the portrait, the name, the record and the gaps; less where the name is above. */
const BESIDE = { wing: 320, line: 344, lines: 48 }
/** A bar stands in for cells that would be too thin; longer ones would not compare any more. */
const LONGEST_BAR = 180

/** The cells of a row, or a bar of the same length where a cell would be thinner than three pixels. */
function Marks({ mate: { wins, losses }, longest, track }: { mate: HeroMate; longest: number; track: number }) {
  const unit = cellUnit(longest, track)
  const games = wins + losses
  const width = Math.max(4, (Math.min(track, LONGEST_BAR) * games) / longest)
  return (
    <span className="tn-wings-marks" style={unit < 3 ? { width } : undefined}>
      <GameCells wins={wins} losses={losses} unit={unit} whole={games} height={18} />
    </span>
  )
}

type ListProps = {
  data: StatsData
  hero: HeroRecord["hero"]
  relation: Relation
  by: MateOrder
  longest: number
  mates: HeroMate[]
}

/** A hero met, with the games both were in; the line opens them. */
function MateRow({
  data,
  hero,
  relation,
  mate,
  longest,
  track,
}: Omit<ListProps, "mates" | "by"> & { mate: HeroMate; track: number }) {
  const { text, languageTag } = useStreamLocale()
  const { wins, losses, games } = mate
  const question =
    relation === "with"
      ? { pick: [hero, mate.hero] }
      : { pick: [hero], vs: [mate.hero], duel: relation === "lane" || undefined }
  const count = gamesText(games.length, text, languageTag)
  return (
    <li>
      <Link
        className="tn-wings-row"
        to={statsHref(data.view.id, { question, scope: data.period?.key })}
        aria-label={text(
          `${mate.hero.name}: ${count}, ${hero.name} thắng ${wins}, thua ${losses}`,
          `${mate.hero.name}: ${count}, ${hero.name} won ${wins}, lost ${losses}`,
        )}
      >
        <HeroPortrait hero={mate.hero} />
        <strong>{mate.hero.name}</strong>
        <Marks mate={mate} longest={longest} track={track} />
        <span className="tn-wings-record">
          <b>{score(mate)}</b>
          {wins + losses >= ENOUGH_FOR_SHARE && <span>{shareText(wins, wins + losses)}</span>}
        </span>
      </Link>
    </li>
  )
}

/** The heroes of one wing, the first few until the reader asks for all. */
function MateList({ data, hero, relation, by, longest, mates }: ListProps) {
  const { text } = useStreamLocale()
  const layout = usePageLayout()
  const { ref, width } = useWidth<HTMLDivElement>()
  const beside = layout === "wide" ? BESIDE.wing : width < NARROW ? BESIDE.lines : BESIDE.line
  const fold = useFold(mates, SHOWN, `${hero.key}:${relation}`)
  const enough = enoughPicks(data.feed.games.length)
  const { ranked, few } = mateRows(mates, by, enough)
  const first = fold.whole ? ranked : ranked.slice(0, SHOWN)
  const rest = fold.whole ? few : few.slice(0, Math.max(0, SHOWN - ranked.length))
  const row = (mate: HeroMate) => (
    <MateRow
      key={mate.hero.key}
      data={data}
      hero={hero}
      relation={relation}
      mate={mate}
      longest={longest}
      track={width - beside}
    />
  )
  return (
    <div className="tn-wings-list" ref={ref}>
      <ul>
        {first.map(row)}
        {rest.length > 0 && (
          <li className="tn-wings-few">
            {text(`Dưới ${enough} ván, chưa đủ để so`, `Under ${enough} games, too few to compare`)}
          </li>
        )}
        {rest.map(row)}
      </ul>
      <FoldButton fold={fold} more={text(`Xem cả ${mates.length} tướng`, `Show all ${mates.length} heroes`)} />
    </div>
  )
}

/**
 * Who stood beside a hero and who stood against it, as two wings with the hero between them: each row the games the two
 * were both in, those the hero won first. On a phone the wings are one list with a choice between them.
 */
export function HeroWings({ data, record }: { data: StatsData; record: HeroRecord }) {
  const { text } = useStreamLocale()
  const compact = usePageLayout() === "compact"
  const [params, setParams] = useSearchParams()
  const [wing, setWing] = useEntryState<Wing>("wing", "against")
  const [order, setOrder] = useEntryState<MateOrder>("wing order", "games")
  const { hero } = record
  const mates = { with: heroMates(record, "with"), against: heroMates(record, "against") }
  const rivals = heroMates(record, "lane")
  const everyone = [...mates.with, ...mates.against]
  if (!everyone.length) return null
  // Where no lane is recorded there are no opponents of the same lane to choose.
  const lane = params.get("rel") === "lane" && rivals.length > 0
  const longest = Math.max(...everyone.map(({ games }) => games.length))
  const enough = enoughPicks(data.feed.games.length)
  // An order by results is offered where it would order something.
  const ordered = everyone.filter(({ games }) => games.length >= enough).length > 1
  const list = (of: Wing) => (
    <MateList
      data={data}
      hero={hero}
      relation={of === "against" && lane ? "lane" : of}
      by={ordered ? order : "games"}
      longest={longest}
      mates={of === "against" && lane ? rivals : mates[of]}
    />
  )
  const names = { with: text("Cùng đội", "Same team"), against: text("Đối thủ", "Opponents") }
  const orders = ordered && (
    <ChoiceWords
      label={text("Thứ tự", "Order")}
      value={order}
      choices={[
        { key: "games", name: text("Nhiều ván", "Most games") },
        { key: "won", name: text("Tỷ lệ thắng", "Win rate") },
      ]}
      onChoose={setOrder}
    />
  )
  const whom = rivals.length > 0 && (
    <ChoiceWords
      label={text("Đối thủ nào", "Which opponents")}
      value={lane ? "lane" : "team"}
      choices={[
        { key: "team", name: text("Cả đội", "Whole team") },
        { key: "lane", name: text("Cùng đường", "Same lane") },
      ]}
      onChoose={(key) =>
        setParams((current) => withParam(current, "rel", key === "lane" ? key : null), { replace: true })
      }
    />
  )
  return (
    <Section
      id="hero-wings"
      title={text("Đi cùng ai, gặp ai", "With whom, against whom")}
      note={text(`vạch cao là ván ${hero.name} thắng`, `tall marks are games ${hero.name} won`)}
      control={!compact && orders}
    >
      {compact ? (
        <>
          <ChoiceTrack
            label={text("Những tướng nào", "Which heroes")}
            fill="compact"
            value={wing}
            choices={(["with", "against"] as const).map((key) => ({ key, name: names[key] }))}
            onChoose={setWing}
          />
          <div className="tn-wings-orders">
            {orders}
            {wing === "against" && whom}
          </div>
          {list(wing)}
        </>
      ) : (
        <div className="tn-wings">
          <div className="tn-wings-side" data-wing="with">
            <div className="tn-wings-head">
              <h3>{names.with}</h3>
            </div>
            {list("with")}
          </div>
          <span className="tn-wings-hero">
            <HeroPortrait hero={hero} />
          </span>
          <div className="tn-wings-side" data-wing="against">
            <div className="tn-wings-head">
              <h3>{names.against}</h3>
              {whom}
            </div>
            {list("against")}
          </div>
        </div>
      )}
    </Section>
  )
}
