import { Fragment, type CSSProperties } from "react"
import { Link } from "react-router"
import { personRoleLabels, profileKindLabels } from "@aov/community-contracts"
import { CompetitionLogo, StatusBadge } from "./competition-card"
import { dayRange, hueOf, personRoleEnglish, profileKindEnglish, regionName } from "./community-ui"
import { ProfileMark } from "./page-mark"
import { PlayerMark } from "./player-mark"
import { RegionMark } from "./region-mark"
import { StreamIcon } from "./stream-icon"
import { StreamImage } from "./stream-image"
import { useStreamLocale } from "./stream-locale"
import { competitionStatus } from "../lib/competition-model"
import { markMatch } from "../lib/search-model"
import type { Suggestion, SuggestionGroup, useSearchSuggestions } from "../lib/use-search-suggestions"
import "./stream-search-matches.css"

/** `card` draws the closest name as a card above the groups; `list` keeps it in its group. */
export type SearchLook = "card" | "list"

const GROUP_NAMES: Record<SuggestionGroup["key"], readonly [string, string]> = {
  TEAM: ["Đội tuyển", "Teams"],
  PLAYER: ["Tuyển thủ", "Players"],
  PERSON: ["Nhân sự", "Staff"],
  COMPETITION: ["Giải đấu", "Tournaments"],
  PAGE: ["Trang", "Pages"],
}

/** The part of a name that matches the search, drawn apart. */
function Marked({ name, search }: { name: string; search: string }) {
  return (
    <>
      {markMatch(name, search).map((part, index) =>
        part.hit ? <mark key={index}>{part.text}</mark> : <Fragment key={index}>{part.text}</Fragment>,
      )}
    </>
  )
}

/** A suggestion's picture: a team's or a competition's logo on its plate, a player's shirt, a page's mark. */
function SuggestionMark({ suggestion, size }: { suggestion: Suggestion; size: number }) {
  switch (suggestion.kind) {
    case "TEAM":
      return (
        <StreamImage
          src={suggestion.item.imageUrl}
          darkSrc={suggestion.item.imageDarkUrl}
          logo
          name={suggestion.item.shortName || suggestion.name}
        />
      )
    case "PLAYER":
    case "PERSON":
      return <PlayerMark name={suggestion.name} size={size} round={suggestion.kind === "PERSON"} />
    case "COMPETITION": {
      const { tournament } = suggestion.entry.content
      return (
        <CompetitionLogo
          name={tournament.name}
          url={tournament.logoUrl}
          darkUrl={tournament.logoDarkUrl}
          size={size > 40 ? "card" : undefined}
        />
      )
    }
    case "PAGE":
      return <ProfileMark profile={suggestion.profile} size={size} />
  }
}

/** The second line of a suggestion: where a team plays, a player's team, a competition's state and dates. */
function SuggestionMeta({ suggestion }: { suggestion: Suggestion }) {
  const { text, languageTag } = useStreamLocale()
  switch (suggestion.kind) {
    case "COMPETITION": {
      const { tournament } = suggestion.entry.content
      return (
        <>
          <StatusBadge status={competitionStatus(suggestion.entry.content)} size="small" />
          <span>{dayRange(tournament.startsOn, tournament.endsOn, text("Chờ lịch", "To be scheduled"))}</span>
        </>
      )
    }
    case "PAGE": {
      const { kind, content } = suggestion.profile
      return (
        <>
          <span>{text(profileKindLabels[kind], profileKindEnglish[kind])}</span>
          {content?.country && <RegionMark code={content.country} size={14} />}
        </>
      )
    }
    default: {
      const { item } = suggestion
      const region = regionName(item.country, languageTag)
      const detail =
        item.kind === "PERSON"
          ? item.roles.map((role) => text(personRoleLabels[role], personRoleEnglish[role])).join(", ")
          : item.kind === "PLAYER"
            ? item.team?.shortName || item.team?.name
            : text(
                `${item.competitions} giải`,
                `${item.competitions} ${item.competitions === 1 ? "tournament" : "tournaments"}`,
              )
      return (
        <>
          {item.country && <RegionMark code={item.country} size={14} />}
          <span>{[detail, item.kind === "TEAM" ? region : null].filter(Boolean).join(" · ")}</span>
        </>
      )
    }
  }
}

/** The picture a card washes its back with: the logo, blurred, or for those without one the colour of the name. */
function washOf(suggestion: Suggestion) {
  switch (suggestion.kind) {
    case "TEAM":
      return suggestion.item.imageUrl || suggestion.item.imageDarkUrl
    case "COMPETITION":
      return suggestion.entry.content.tournament.logoUrl || suggestion.entry.content.tournament.logoDarkUrl
    case "PAGE":
      return suggestion.profile.content?.avatarUrl
    default:
      return null
  }
}

type OptionProps = {
  id: string
  selected: boolean
  onPick: () => void
  onHover: () => void
}

/** The closest name, as a card: its picture large over a wash of it, what it is, and its second line. */
function TopMatch({
  suggestion,
  search,
  id,
  selected,
  onPick,
  onHover,
}: { suggestion: Suggestion; search: string } & OptionProps) {
  const { text } = useStreamLocale()
  const wash = washOf(suggestion)
  const kind = suggestion.kind === "PAGE" ? suggestion.profile.kind : suggestion.kind
  const kindName =
    kind === "COMPETITION" ? text("Giải đấu", "Tournament") : text(profileKindLabels[kind], profileKindEnglish[kind])
  return (
    <Link
      id={id}
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      to={suggestion.to}
      className="hub-top-match"
      data-kind={suggestion.kind}
      style={{ "--hub-top-hue": hueOf(suggestion.name) } as CSSProperties}
      onClick={onPick}
      onMouseEnter={onHover}
    >
      {wash && <img className="hub-top-match-wash" src={wash} alt="" aria-hidden="true" />}
      <span className="hub-top-match-mark">
        <SuggestionMark suggestion={suggestion} size={60} />
      </span>
      <span className="hub-top-match-text">
        <small>{kindName}</small>
        <strong>
          <Marked name={suggestion.name} search={search} />
        </strong>
        <span className="hub-match-meta">
          <SuggestionMeta suggestion={suggestion} />
        </span>
      </span>
      <StreamIcon name="arrow" size={18} />
    </Link>
  )
}

function MatchRow({
  suggestion,
  search,
  id,
  selected,
  onPick,
  onHover,
}: { suggestion: Suggestion; search: string } & OptionProps) {
  return (
    <Link
      id={id}
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      to={suggestion.to}
      className="hub-match"
      data-kind={suggestion.kind}
      onClick={onPick}
      onMouseEnter={onHover}
    >
      <span className="hub-match-mark">
        <SuggestionMark suggestion={suggestion} size={36} />
      </span>
      <span className="hub-match-text">
        <strong>
          <Marked name={suggestion.name} search={search} />
        </strong>
        <span className="hub-match-meta">
          <SuggestionMeta suggestion={suggestion} />
        </span>
      </span>
    </Link>
  )
}

/**
 * The suggestions for what is typed. The first row opens every result of the search; then the groups, each drawn its
 * own way, with the matching part of each name marked. Option ids follow the order of `suggestionList`, after the row
 * of all results at 0.
 */
export function StreamSearchMatches({
  listId,
  search,
  resultsTo,
  suggestions,
  look,
  marked,
  onHover,
  onPick,
}: {
  listId: string
  search: string
  resultsTo: string
  suggestions: ReturnType<typeof useSearchSuggestions>
  look: SearchLook
  marked: number
  onHover: (index: number) => void
  onPick: (results: boolean) => void
}) {
  const { text } = useStreamLocale()
  const { groups, pending, failed, retry } = suggestions
  const first = groups[0]?.items[0]
  const top = look === "card" && first && first.rank <= 1 ? first : null
  let index = 0
  const option = (suggestion: Suggestion) => {
    index += 1
    const position = index
    return {
      suggestion,
      search,
      id: `${listId}-${position}`,
      selected: position === marked,
      onPick: () => onPick(false),
      onHover: () => onHover(position),
    }
  }

  return (
    <div id={listId} role="listbox" className="hub-matches" aria-label={text("Gợi ý tìm kiếm", "Search suggestions")}>
      <Link
        id={`${listId}-0`}
        role="option"
        aria-selected={marked === 0}
        tabIndex={-1}
        to={resultsTo}
        className="hub-matches-all"
        onClick={() => onPick(true)}
        onMouseEnter={() => onHover(0)}
      >
        <StreamIcon name="search" size={16} />
        <strong>{search}</strong>
        <span>{text("Tất cả kết quả", "All results")}</span>
        <kbd aria-hidden="true">↵</kbd>
      </Link>
      {top && <TopMatch {...option(top)} />}
      {groups.map((group) => {
        const items = group.items.filter((item) => item !== top)
        if (!items.length) return null
        return (
          <div
            key={group.key}
            role="group"
            aria-labelledby={`${listId}-${group.key}`}
            className="hub-matches-group"
            data-kind={group.key}
          >
            <p id={`${listId}-${group.key}`}>{text(...GROUP_NAMES[group.key])}</p>
            {items.map((item) => (
              <MatchRow key={`${item.kind}:${item.id}`} {...option(item)} />
            ))}
          </div>
        )
      })}
      {groups.length === 0 && (
        <p className="hub-matches-note" role="status">
          {pending ? (
            text("Đang tìm…", "Searching…")
          ) : failed ? (
            <>
              {text("Chưa tải được gợi ý.", "Suggestions could not be loaded.")}{" "}
              <button type="button" onClick={retry}>
                {text("Thử lại", "Retry")}
              </button>
            </>
          ) : (
            text("Không có gợi ý nào.", "No suggestions.")
          )}
        </p>
      )}
    </div>
  )
}
