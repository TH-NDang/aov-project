import { Fragment, useState } from "react"
import { Link } from "react-router"
import { useQueryClient } from "@tanstack/react-query"
import type { LinkMention, SeriesContent } from "@aov/community-contracts"
import { ArrowRight, Link2, UserRoundSearch } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { pageKeys } from "@/features/community/api/page-api"
import { PageSearchDialog } from "@/features/community/components/page-search-dialog"
import { PlayerPhoto, TeamLogo } from "@/features/esports/components/primitives"
import { initials, type TeamView } from "@/features/esports/model/game-view"
import { matchPath, tournamentPath } from "@/features/esports/pages/esports-shell"
import { LINK_MENTION_ACTIONS, mentionPlace, mentionTarget } from "../model/link-review-model"
import type { LinkChoice } from "../model/link-review-runner"
import type { LinkCandidate, NameSuggestion, RowSuggestion } from "../model/link-suggestion-model"
import { RecordPicker } from "./record-picker"

const CHIP =
  "inline-flex max-w-full min-w-0 items-center gap-2 rounded-full border bg-card py-0.5 pr-3 pl-0.5 hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"

const targetPath = (mention: LinkMention) => {
  const target = mentionTarget(mention)
  return target.screen === "match"
    ? `${matchPath(target.tournamentId, target.seriesId)}?${target.search}`
    : `${tournamentPath(target.tournamentId)}?${target.search}`
}

/**
 * One name waiting for a link: where it is written, the name itself, and the records it may stand for. A click on a
 * record links it; the picker finds any other, and the place it is written stays one link away.
 */
export function LinkReviewRow({
  mention,
  suggestion,
  series,
  team,
  actorKey,
  busy,
  canWrite,
  onLink,
}: {
  mention: LinkMention
  suggestion: RowSuggestion | null
  series?: SeriesContent
  team: (id: string) => TeamView
  actorKey: string
  busy: boolean
  canWrite: boolean
  onLink: (choices: LinkChoice[]) => void
}) {
  const names = suggestion?.names ?? []
  const written = names.map((entry) => entry.name).join(", ") || mention.text
  return (
    <li
      data-link-row
      aria-busy={busy}
      className={cn(
        "grid items-center gap-x-4 gap-y-2 px-4 py-2.5 @4xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,2fr)_auto]",
        busy && "opacity-50",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        {series && (
          <span className="flex shrink-0 items-center gap-1">
            <TeamLogo team={team(series.teamAId)} size={22} />
            <TeamLogo team={team(series.teamBId)} size={22} />
          </span>
        )}
        <span className="type-body min-w-0 truncate" title={mentionPlace(mention)}>
          {mentionPlace({ ...mention, gameNumber: null })}
        </span>
        {mention.gameNumber != null && (
          <span className="type-meta shrink-0 rounded bg-muted px-1.5">Ván {mention.gameNumber}</span>
        )}
      </span>
      <span className="type-body min-w-0 truncate" title={mention.text}>
        {written}
      </span>
      <span className="flex min-w-0 flex-wrap items-center gap-1.5">
        {!canWrite ? null : mention.kind === "SERIES_BROADCAST" ? (
          <CasterChoice key={written} names={names} actorKey={actorKey} busy={busy} onLink={onLink} />
        ) : (
          <RecordChoice mention={mention} names={names} series={series} busy={busy} onLink={onLink} />
        )}
      </span>
      <Button asChild variant="ghost" size="sm" className="justify-self-start @4xl:justify-self-end">
        <Link to={targetPath(mention)}>
          {LINK_MENTION_ACTIONS[mention.kind]} <ArrowRight aria-hidden />
        </Link>
      </Button>
    </li>
  )
}

function CandidatePicture({ candidate, team }: { candidate: LinkCandidate; team: boolean }) {
  return team ? (
    <TeamLogo
      team={{
        id: candidate.id,
        name: candidate.name,
        shortName: initials(candidate.name),
        logoUrl: candidate.imageUrl ?? undefined,
        logoDarkUrl: candidate.imageDarkUrl,
      }}
      size={24}
    />
  ) : (
    <PlayerPhoto name={candidate.name} url={candidate.imageUrl ?? undefined} size={24} />
  )
}

/** The records a row of one name may be linked to. Names that only resemble the written one have a dashed outline. */
function RecordChoice({
  mention,
  names,
  series,
  busy,
  onLink,
}: {
  mention: LinkMention
  names: NameSuggestion[]
  series?: SeriesContent
  busy: boolean
  onLink: (choices: LinkChoice[]) => void
}) {
  const isTeam = mention.kind === "AWARD_TEAM"
  // Several names in one row each offer their best match; a single name offers all it has.
  const offered = names.flatMap((name) =>
    (names.length > 1 ? name.candidates.slice(0, 1) : name.candidates).map((candidate) => ({ name, candidate })),
  )
  const label = isTeam ? "Đội" : "Tuyển thủ"
  return (
    <>
      {offered.map(({ name, candidate }, index) => (
        <button
          key={`${name.name}-${candidate.id}`}
          type="button"
          data-link-main={index === 0 || undefined}
          disabled={busy}
          aria-label={`Liên kết ${name.name} với ${candidate.name} · ${candidate.detail}`}
          title={`${candidate.name} · ${candidate.detail}`}
          onClick={() => onLink([candidate])}
          className={cn(CHIP, candidate.exact && candidate.inside ? "border-primary" : "border-dashed")}
        >
          <CandidatePicture candidate={candidate} team={isTeam} />
          <span className="type-body truncate">{candidate.name}</span>
          <span className="type-meta truncate">{candidate.detail}</span>
          <Link2 size={14} className="shrink-0 text-primary" aria-hidden />
        </button>
      ))}
      <span className="w-36 shrink-0" data-link-main={!offered.length || undefined}>
        <RecordPicker
          kind={isTeam ? "teams" : "players"}
          label={label}
          placeholder={offered.length ? "Chọn khác…" : "Chọn…"}
          value=""
          compact
          disabled={busy}
          context={{ tournamentId: mention.tournamentId, teamId: isTeam ? undefined : series?.teamAId }}
          onChange={(id, name) => id && onLink([{ id, name }])}
        />
      </span>
    </>
  )
}

/** Casters are linked together, because the row leaves the list as soon as the match has any of them. */
function CasterChoice({
  names,
  actorKey,
  busy,
  onLink,
}: {
  names: NameSuggestion[]
  actorKey: string
  busy: boolean
  onLink: (choices: LinkChoice[]) => void
}) {
  const client = useQueryClient()
  const [chosen, setChosen] = useState<Record<string, LinkCandidate>>({})
  const [picking, setPicking] = useState<NameSuggestion | null>(null)
  const people = names.map((name) => ({
    name,
    person: chosen[name.name] ?? (name.candidates.length === 1 ? name.candidates[0]! : null),
  }))
  const ready = people.flatMap(({ person }) => (person ? [person] : []))
  return (
    <>
      {people.map(({ name, person }) => (
        <Fragment key={name.name}>
          {/* Namesakes are offered side by side; the search reaches anyone else. */}
          {!person &&
            name.candidates.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                disabled={busy}
                aria-label={`${name.name}: chọn ${candidate.detail}`}
                onClick={() => setChosen((current) => ({ ...current, [name.name]: candidate }))}
                className={cn(CHIP, "border-dashed")}
              >
                <CandidatePicture candidate={candidate} team={false} />
                <span className="type-body truncate">{candidate.name}</span>
                <span className="type-meta truncate">{candidate.detail}</span>
              </button>
            ))}
          <button
            type="button"
            disabled={busy}
            aria-label={person ? `${name.name}: ${person.name}, chọn người khác` : `Tìm hồ sơ của ${name.name}`}
            title={person ? `Chọn khác cho ${name.name}` : `Tìm hồ sơ của ${name.name}`}
            onClick={() => setPicking(name)}
            className={cn(CHIP, !person && "border-dashed pl-2.5")}
          >
            {person ? (
              <CandidatePicture candidate={person} team={false} />
            ) : (
              <UserRoundSearch size={16} className="shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span className="type-body truncate">
              {person ? person.name : name.candidates.length ? "Chọn khác…" : name.name}
            </span>
            {(person || !name.candidates.length) && (
              <span className="type-meta truncate">{person?.detail ?? "Chọn…"}</span>
            )}
          </button>
        </Fragment>
      ))}
      <Button
        size="sm"
        variant="outline"
        data-link-main
        disabled={busy || ready.length < people.length || !people.length}
        onClick={() => onLink(ready)}
      >
        <Link2 aria-hidden /> Liên kết {people.length} người
      </Button>
      <PageSearchDialog
        open={!!picking}
        onOpenChange={(open) => !open && setPicking(null)}
        label={picking ? `Hồ sơ của ${picking.name}` : "Người phát sóng"}
        kinds={["PERSON", "PLAYER"]}
        actorKey={actorKey}
        canCreate
        initialName={picking?.name}
        createRoles={["CASTER"]}
        onSelect={(profile) => {
          if (!profile || !picking) return
          client.setQueryData(pageKeys.page(actorKey, profile.id), profile)
          const person: LinkCandidate = {
            id: profile.id,
            name: profile.content?.name ?? profile.code,
            imageUrl: profile.content?.avatarUrl,
            detail: "Đã chọn",
            exact: true,
            inside: true,
          }
          setChosen((current) => ({ ...current, [picking.name]: person }))
        }}
      />
    </>
  )
}
