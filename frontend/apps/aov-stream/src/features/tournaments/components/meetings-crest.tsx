import type { CompetitionView } from "@aov/community-contracts"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { namesOf } from "../../../lib/question-words"

/** The crest of a team beside its name, which says it already. */
export function MeetingsCrest({ view, teamId }: { view: CompetitionView; teamId: string }) {
  const { text } = useStreamLocale()
  const team = view.content.teams[teamId]
  return (
    <span aria-hidden="true">
      <StreamImage src={team?.logoUrl} darkSrc={team?.logoDarkUrl} logo name={namesOf(view, text).team(teamId)} />
    </span>
  )
}
