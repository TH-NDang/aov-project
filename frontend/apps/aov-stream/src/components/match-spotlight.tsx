import { Link } from "react-router"
import { MatchTime } from "./match-time"
import { Stage } from "./stage"
import { StreamImage } from "./stream-image"
import { useStreamLocale } from "./stream-locale"
import { matchUnderway } from "../lib/competition-model"
import { timeUntil } from "../lib/countdown"
import { competitionMatchHref, type CompetitionMatch } from "../lib/match-model"
import { matchRound, matchSides, type MatchSide } from "../lib/match-schedule"
import { useNow } from "../lib/use-now"
import "./match-spotlight.css"

function Side({ team }: { team: MatchSide }) {
  return (
    <span className="tn-spot-team" data-side={team.side} data-open={!team.known || undefined}>
      {team.known ? (
        <StreamImage src={team.logoUrl} darkSrc={team.logoDarkUrl} logo name={team.name} />
      ) : (
        <span className="tn-spot-blank" aria-hidden="true" />
      )}
      <strong title={team.fullName}>{team.known ? team.fullName : team.brief}</strong>
    </span>
  )
}

/**
 * The match a reader came for, on a stage lit by both teams: on now, or the next one with how long until it starts.
 * The whole stage opens the match.
 */
export function MatchSpotlight({ entry }: { entry: CompetitionMatch }) {
  const { text, languageTag } = useStreamLocale()
  const now = useNow()
  const { match, competition } = entry
  const [a, b] = matchSides(entry, languageTag)
  const live = matchUnderway(entry, now)
  const left = timeUntil(Date.parse(match.scheduledAt || ""), now, languageTag)
  const round = matchRound(entry, languageTag)
  return (
    <Link className="tn-spot" to={competitionMatchHref(competition.id, match.key)} data-live={live || undefined}>
      <Stage
        tint={competition.content.tournament.name}
        lights={[
          { src: a.logoUrl, darkSrc: a.logoDarkUrl, at: "left" },
          { src: b.logoUrl, darkSrc: b.logoDarkUrl, at: "right" },
        ]}
        className="tn-spot-stage"
      >
        <span className="tn-spot-meta">
          {round && <span>{round}</span>}
          <span>BO{match.bestOf}</span>
        </span>
        <Side team={a} />
        <span className="tn-spot-when">
          {live ? (
            <>
              <span className="tn-live">{text("Đang diễn ra", "Live")}</span>
              <span>
                {text("Bắt đầu", "Started")} <MatchTime entry={entry} />
              </span>
            </>
          ) : left ? (
            <>
              <b>{left}</b>
              <span>
                <MatchTime entry={entry} />
              </span>
            </>
          ) : (
            <b>
              <MatchTime entry={entry} />
            </b>
          )}
        </span>
        <Side team={b} />
      </Stage>
    </Link>
  )
}
