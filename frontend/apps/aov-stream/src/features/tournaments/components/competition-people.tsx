import { Link } from "react-router"
import {
  broadcastRoles,
  personRoleLabels,
  staffRoles,
  type BroadcastRole,
  type CompetitionView,
  type CrewMember,
  type StaffMember,
} from "@aov/community-contracts"
import { StreamIcon } from "../../../components/stream-icon"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { personRoleEnglish } from "../../../components/community-ui"
import { EntityPageLink } from "../../../components/public-competitions"
import {
  crewGroups,
  teamStaff,
  type CrewGroup,
  type NamedPlayer,
  type People,
  type PersonEntry,
} from "../../../lib/crew-model"
import "./competition-people.css"

/** A broadcast role as the heading of its group, in English for one person and for several. */
const CREW_GROUP_ENGLISH: Record<BroadcastRole, readonly [one: string, many: string]> = {
  HOST: ["Host", "Hosts"],
  CASTER: ["Caster", "Casters"],
  INTERVIEWER: ["Interviewer", "Interviewers"],
  GUEST_ANALYST: ["Guest analyst", "Guest analysts"],
}

/** A person's picture, or the first letters of their name; the name beside it says who it is. */
function PersonFace({ person, size }: { person: PersonEntry; size?: "small" }) {
  return (
    <span className="tn-face" data-size={size} aria-hidden="true">
      <StreamImage src={person.avatarUrl} name={person.name} />
    </span>
  )
}

/** A person's name, which opens their page once it is published. */
function PersonName({ person }: { person: PersonEntry }) {
  return person.href ? <Link to={person.href}>{person.name}</Link> : <span>{person.name}</span>
}

/** A crew by role: each role once, then its people with their picture. */
function CrewGroups({ groups }: { groups: CrewGroup[] }) {
  const { text } = useStreamLocale()
  return (
    <dl className="tn-crew">
      {groups.map(({ role, people }) => (
        <div key={role}>
          <dt>
            {CREW_GROUP_ENGLISH[role]
              ? text(personRoleLabels[role], CREW_GROUP_ENGLISH[role][people.length > 1 ? 1 : 0])
              : role}
          </dt>
          <dd>
            <ul>
              {people.map((person) => (
                <li key={person.pageId}>
                  <PersonFace person={person} />
                  <PersonName person={person} />
                </li>
              ))}
            </ul>
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** The broadcast crew of a whole competition, as a card beside its overview. Nothing shows while it has none. */
export function CompetitionCrew({ view }: { view: CompetitionView }) {
  const { text } = useStreamLocale()
  const groups = crewGroups(view.content.tournament.broadcast, view.content.people, broadcastRoles)
  if (!groups.length) return null
  return (
    <section className="tn-side-card">
      <h2>{text("Ê-kíp phát sóng", "Broadcast crew")}</h2>
      <CrewGroups groups={groups} />
    </section>
  )
}

/** The people who worked one match's broadcast besides the competition's crew. Nothing shows while it has none. */
export function MatchCrew({ crew, people }: { crew?: CrewMember[] | null; people: People }) {
  const { text } = useStreamLocale()
  const groups = crewGroups(crew, people, broadcastRoles)
  if (!groups.length) return null
  return (
    <section className="tn-match-crew" aria-labelledby="match-crew">
      <div className="tn-heading" data-flush="">
        <h2 id="match-crew">
          {text("Ê-kíp phát sóng", "Broadcast crew")} <small>{text("của trận này", "for this match")}</small>
        </h2>
      </div>
      <div className="tn-crew-panel">
        <CrewGroups groups={groups} />
      </div>
    </section>
  )
}

/**
 * A team's staff at a competition, under its roster in the team's card: each person with the title the record
 * gives, or the name of their role when it gives none. Nothing shows while the team has no staff recorded.
 */
export function TeamStaff({ staff, teamId, people }: { staff?: StaffMember[] | null; teamId: string; people: People }) {
  const { text } = useStreamLocale()
  const rows = teamStaff(staff, teamId, people, staffRoles)
  if (!rows.length) return null
  return (
    <div className="tn-staff">
      <h3>{text("Ban huấn luyện", "Coaching staff")}</h3>
      <ul>
        {rows.map((row) => (
          <li key={`${row.pageId}:${row.role}`}>
            <PersonFace person={row} size="small" />
            <PersonName person={row} />
            <small>{row.title || text(personRoleLabels[row.role], personRoleEnglish[row.role])}</small>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The MVP of a match or a game among the facts of its head, linked to the player's page once it is published. */
export function MvpFact({ label, player }: { label: string; player: NamedPlayer }) {
  return (
    <span className="tn-mvp">
      <StreamIcon name="spark" size={14} />
      {label}
      <b>
        <EntityPageLink kind="PLAYER" id={player.id} name={player.name} />
      </b>
    </span>
  )
}
