import { useState, type ReactNode } from "react"
import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { personRoleLabels, type ReferenceKind, type ReferencePreview } from "@aov/community-contracts"
import { entityKindIcons } from "@aov/ui/components/entity-kind-icons"
import {
  entityKindLabel,
  referenceTranslation,
  safeEntityIconUrl,
  type EntityReference,
} from "@aov/ui/lib/entity-rich-text"
import { codeName, TIER_NAMES } from "../lib/competition-model"
import { referencePreviewQuery } from "../lib/reference-api"
import { firstLine, previewKind } from "../lib/reference-model"
import { dayRange, personRoleEnglish, regionName } from "./community-ui"
import { PlayerMark } from "./player-mark"
import { RegionMark } from "./region-mark"
import { StreamIcon } from "./stream-icon"
import { StreamImage } from "./stream-image"
import { useStreamLocale } from "./stream-locale"
import "./reference-card.css"

type CardProps = { entity: EntityReference; label: string; to: string }

/** What a name in a text opens, at a glance: its mark, what kind of thing it is, its name and one line about it. */
export function ReferenceCard(props: CardProps) {
  const kind = previewKind(props.entity.kind)
  return kind ? <RecordCard {...props} kind={kind} /> : <GameCard {...props} />
}

/** A record of the community; its name shows at once, its logo and its line when they are read. */
function RecordCard({ entity, label, to, kind }: CardProps & { kind: ReferenceKind }) {
  const { languageTag } = useStreamLocale()
  const { data, isPending } = useQuery(referencePreviewQuery(kind, entity.id))
  const name = data?.name ?? referenceTranslation(entity, languageTag)?.name ?? label
  const person = kind === "PLAYER" || kind === "PERSON"
  return (
    <CardFrame
      entity={entity}
      to={to}
      name={name}
      shortName={data?.shortName}
      mark={
        person ? (
          <PlayerMark name={name} size={48} round={kind === "PERSON"} />
        ) : (
          <StreamImage src={data?.logoUrl} darkSrc={data?.logoDarkUrl} logo name={data?.shortName || name} />
        )
      }
    >
      {data ? <RecordLine preview={data} /> : isPending ? <i className="hub-ref-wait" aria-hidden="true" /> : null}
    </CardFrame>
  )
}

function RecordLine({ preview }: { preview: ReferencePreview }) {
  const { text, languageTag } = useStreamLocale()
  const { kind, country, summary, competitions, event, latest } = preview
  const region = regionName(country, languageTag)
  const count = text(`${competitions} giải`, `${competitions} ${competitions === 1 ? "tournament" : "tournaments"}`)
  if (kind === "CIRCUIT" || kind === "ORGANIZATION")
    return (
      <>
        {summary ||
          (kind === "CIRCUIT" && competitions > 0
            ? text(`${competitions} mùa giải`, `${competitions} ${competitions === 1 ? "season" : "seasons"}`)
            : region)}
      </>
    )
  const parts =
    kind === "COMPETITION"
      ? [
          event?.startsOn || event?.endsOn ? dayRange(event.startsOn, event.endsOn) : null,
          codeName(TIER_NAMES, event?.tier, text),
          region,
        ]
      : kind === "TEAM"
        ? [region, competitions > 0 && count, latest?.competition]
        : kind === "PLAYER"
          ? [latest?.team?.name ?? region, latest?.competition]
          : [
              latest?.roles.map((role) => text(personRoleLabels[role], personRoleEnglish[role])).join(", "),
              latest?.team?.name,
              latest?.competition,
            ]
  return (
    <>
      {region && kind !== "PERSON" && <RegionMark code={country} size={16} />}
      {parts.filter(Boolean).join(" · ")}
    </>
  )
}

/** An entry of the game, which opens on the Wiki. */
function GameCard({ entity, label, to }: CardProps) {
  const { text, languageTag } = useStreamLocale()
  const [failed, setFailed] = useState(false)
  const translation = referenceTranslation(entity, languageTag)
  const icon = safeEntityIconUrl(entity.icon)
  const Fallback = entityKindIcons[entity.kind]
  return (
    <CardFrame
      entity={entity}
      to={to}
      name={translation?.name ?? label}
      mark={
        icon && !failed ? (
          <img className="hub-ref-art" src={icon} alt="" onError={() => setFailed(true)} />
        ) : (
          <span className="hub-ref-art">
            <Fallback size={26} />
          </span>
        )
      }
    >
      {firstLine(translation?.description ?? "") ?? text("Mở trên AOV WiKi", "Opens on AOV WiKi")}
    </CardFrame>
  )
}

/** The whole card is one link, with the arrow every card that opens a page has at its end. */
function CardFrame({
  entity,
  to,
  name,
  shortName,
  mark,
  children,
}: {
  entity: EntityReference
  to: string
  name: string
  shortName?: string
  mark: ReactNode
  children: ReactNode
}) {
  const { languageTag } = useStreamLocale()
  const external = !to.startsWith("/")
  const content = (
    <>
      <span className="hub-ref-mark">{mark}</span>
      <span className="hub-ref-words">
        <span className="hub-ref-kind">{entityKindLabel(entity.kind, languageTag)}</span>
        <b>
          {name}
          {shortName && shortName !== name && <abbr>{shortName}</abbr>}
        </b>
        <span className="hub-ref-line">{children}</span>
      </span>
      <StreamIcon name={external ? "external" : "chevronRight"} size={16} />
    </>
  )
  return external ? (
    <a className="hub-ref-card" href={to}>
      {content}
    </a>
  ) : (
    <Link className="hub-ref-card" to={to}>
      {content}
    </Link>
  )
}
