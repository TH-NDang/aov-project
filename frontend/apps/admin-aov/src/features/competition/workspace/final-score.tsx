import type { ReactNode } from "react"
import type { TournamentContent } from "@aov/community-contracts"
import { Check, CircleAlert, Clock3 } from "lucide-react"
import { formatCalendarDate } from "@aov/ui/lib/time-zone"
import type { PodiumTeam } from "@aov/ui/lib/tournament-podium"
import { cn } from "@aov/ui/lib/utils"
import { TeamName } from "../peek/competitor-peek"
import { TeamLogo } from "@/features/esports/components/primitives"
import { RESULT_VERIFICATIONS } from "@/features/tournaments/components/tournament-metadata"
import { placeLabel } from "./final-places-table"
import { finalCheckState, finalStateText, sharedFirst, type FinalOutcome } from "./final-state"
import { hostOf, isWebLink, type CheckState } from "./model"
import { Chip, type Tone, type Workspace } from "./parts"

const STATUS: Record<CheckState, { icon: typeof Check; tone: Tone }> = {
  ok: { icon: Check, tone: "ok" },
  todo: { icon: CircleAlert, tone: "warn" },
  waiting: { icon: Clock3, tone: "neutral" },
}

/** One thing the final step asks for, and whether it is there. */
function Status({ state, children }: { state: CheckState; children: ReactNode }) {
  const { icon: Icon, tone } = STATUS[state]
  return (
    <li>
      <Chip tone={tone}>
        <Icon aria-hidden className="size-3.5" />
        {children}
      </Chip>
    </li>
  )
}

/** A finalist with the games it won, which a narrow screen writes beside the name and a wide one between the two. */
function Finalist({
  ws,
  team,
  label,
  games,
  champion,
}: {
  ws: Workspace
  team: PodiumTeam
  label: string
  games?: string
  champion?: boolean
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", champion ? "@2xl:order-1" : "@2xl:order-3")}>
      <TeamLogo
        team={team.teamId ? ws.team(team.teamId) : { id: "", name: team.name, shortName: team.name }}
        size={40}
      />
      <div className="min-w-0 flex-1">
        <p className={cn("type-label", champion ? "text-primary" : "text-muted-foreground")}>{label}</p>
        <p className={cn("truncate", champion ? "type-section-title" : "type-body")}>
          {team.teamId ? <TeamName id={team.teamId}>{team.name}</TeamName> : team.name}
        </p>
      </div>
      {games && <span className="type-section-title tabular-nums @2xl:hidden">{games}</span>}
    </div>
  )
}

/** Where the champion shown is recorded. */
function Source({ tournament, outcome }: { tournament: TournamentContent; outcome: FinalOutcome }) {
  const { result } = tournament
  if (outcome.result?.source === "MATCHES") return "Theo kết quả các trận, chưa ghi vào giải."
  if (outcome.result?.source === "TABLE" || !result) return "Theo bảng thứ hạng."
  return (
    <>
      Kết quả ghi từ{" "}
      {isWebLink(result.sourceUrl) ? (
        <a className="underline" href={result.sourceUrl} target="_blank" rel="noreferrer">
          {hostOf(result.sourceUrl)}
        </a>
      ) : (
        "nguồn chưa rõ"
      )}
      {` (${RESULT_VERIFICATIONS[result.verification].toLocaleLowerCase("vi-VN")})`}
      {result.verifiedOn && `, đối chiếu ngày ${formatCalendarDate(result.verifiedOn)}`}.
    </>
  )
}

/** The final as readers see it, where it is recorded, and what the step still lacks. */
export function FinalScore({
  ws,
  tournament,
  outcome,
}: {
  ws: Workspace
  tournament: TournamentContent
  outcome: FinalOutcome
}) {
  const { result, issue, over, state, suggestions, rows } = outcome
  const [own, rival] = result?.score?.split("–") ?? []
  const shared = result ? null : sharedFirst(rows)
  const recorded = result ? result.source !== "MATCHES" : !!shared?.recorded
  const confirmed = !!result && suggestions.lines.some(({ place, teamId }) => place === "1" && teamId)
  const awards = tournament.awards?.length ?? 0
  const noneText = () => {
    if (!shared) return "Chưa có nhà vô địch."
    if (!shared.recorded) return `Theo các trận, ${shared.teams.length} đội cùng đi tiếp.`
    return `Hạng ${placeLabel(shared.place)}: ${shared.teams.join(", ")}.`
  }
  const resultText = () => {
    if (issue) return issue.kind === "SCORE" ? "Tỷ số lệch" : "Kết quả lệch"
    if (!recorded) return "Chưa ghi kết quả"
    return confirmed ? "Kết quả khớp các trận" : "Có kết quả"
  }
  // The places of a table that contradicts the matches are counted all the same; the result beside them says so.
  const full = state.kind === "FULL" || (state.kind === "CONFLICT" && state.placed > 0 && state.placed === state.teams)
  const placesText = () => {
    if (full) return `Đủ thứ hạng ${state.teams} đội`
    if (state.kind !== "CONFLICT") return finalStateText(state)
    return state.placed ? `${state.placed}/${state.teams} đội có hạng` : "Chưa có thứ hạng"
  }
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-b px-4 py-3",
        result && "esp-medal-row",
      )}
      data-medal={result ? "gold" : undefined}
    >
      <div className="min-w-0 space-y-1.5 @max-2xl:w-full">
        {result ? (
          <div className="flex min-w-0 flex-col gap-2.5 @2xl:flex-row @2xl:items-center @2xl:gap-6">
            <Finalist ws={ws} team={result.winner} label="Vô địch" games={own} champion />
            {result.score && (
              <span className="type-page-title hidden shrink-0 tabular-nums @2xl:order-2 @2xl:block">
                {result.score}
              </span>
            )}
            {result.runnerUp && <Finalist ws={ws} team={result.runnerUp} label="Á quân" games={rival} />}
          </div>
        ) : (
          <p className="type-body">{noneText()}</p>
        )}
        {result && (
          <p className="type-meta">
            <Source tournament={tournament} outcome={outcome} />
          </p>
        )}
      </div>
      <ul className="flex flex-wrap gap-2" aria-label="Những gì bước này cần">
        <Status state={recorded && !issue ? "ok" : over ? "todo" : "waiting"}>{resultText()}</Status>
        <Status state={full ? "ok" : finalCheckState(outcome)}>{placesText()}</Status>
        <Status state={awards ? "ok" : "waiting"}>{awards ? `${awards} giải thưởng` : "Chưa có giải thưởng"}</Status>
      </ul>
    </div>
  )
}
