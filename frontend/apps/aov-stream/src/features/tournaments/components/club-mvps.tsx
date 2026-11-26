import type { Ref } from "react"
import { Link } from "react-router"
import { FoldButton } from "../../../components/fold-button"
import { EntityPageLink } from "../../../components/go-link"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { gamesText } from "../../../lib/feed-words"
import { statsHref } from "../../../lib/statistics-routes"
import { mvpRecords, type MvpRecord } from "../../../lib/team-draft-model"
import { useFold } from "../../../lib/use-fold"
import { useWidth } from "../../../lib/use-width"
import { cellUnit, GameCells } from "./game-marks"
import { Section } from "./section"
import type { StatsData } from "./stats-data"
import "./club-mvps.css"

/** Players the list opens with. */
const SHOWN = 10

function Mvp({
  data,
  record,
  longest,
  unit,
  track,
}: {
  data: StatsData
  record: MvpRecord
  longest: number
  unit: number
  /** Measures the room for the cells, on the line that is given it. */
  track?: Ref<HTMLSpanElement>
}) {
  const { text, languageTag } = useStreamLocale()
  const { view, period } = data
  // The finder only knows the players the competition names.
  const known = view.content.players[record.playerId]?.nickname
  const team = record.teamId ? view.content.teams[record.teamId] : undefined
  const name = known ?? text("Chưa rõ tên", "Name not known")
  const games = record.games.length
  const count = gamesText(games, text, languageTag)
  return (
    <li>
      {team ? (
        <StreamImage src={team.logoUrl} darkSrc={team.logoDarkUrl} logo name={team.shortName || team.name} />
      ) : (
        <span />
      )}
      <span className="tn-club-mvp-name">
        <strong>{known ? <EntityPageLink kind="PLAYER" id={record.playerId} name={name} /> : name}</strong>
        {team && <small>{team.shortName || team.name}</small>}
      </span>
      <span className="tn-club-mvp-cells" ref={track}>
        <GameCells wins={games} losses={0} unit={unit} whole={longest} height={14} />
      </span>
      {known ? (
        <Link
          className="tn-club-mvp-count"
          to={statsHref(view.id, { question: { player: record.playerId, mvp: true }, scope: period?.key })}
          aria-label={text(`${count} ${name} là MVP`, `${count} with ${name} as the MVP`)}
        >
          {count}
        </Link>
      ) : (
        <span className="tn-club-mvp-count">{count}</span>
      )}
    </li>
  )
}

/** Who was named the best of a game most often, one cell a game. Nothing shows while no game names anyone. */
export function ClubMvps({ data }: { data: StatsData }) {
  const { text } = useStreamLocale()
  const { ref, width } = useWidth<HTMLSpanElement>(120)
  const records = mvpRecords(data.feed)
  const fold = useFold(records, SHOWN, "mvps")
  if (!records.length) return null
  const longest = records[0]!.games.length
  const { rest } = fold
  return (
    <Section title={text("MVP nhiều nhất", "Most MVPs")}>
      <ol className="tn-club-mvps">
        {fold.rows.map((record, index) => (
          <Mvp
            key={record.playerId}
            data={data}
            record={record}
            longest={longest}
            unit={cellUnit(longest, width)}
            track={index ? undefined : ref}
          />
        ))}
      </ol>
      <FoldButton
        fold={fold}
        more={text(`Xem thêm ${rest} tuyển thủ`, `Show ${rest} more ${rest === 1 ? "player" : "players"}`)}
      />
    </Section>
  )
}
