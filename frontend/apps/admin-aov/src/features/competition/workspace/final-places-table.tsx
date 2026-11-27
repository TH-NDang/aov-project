import type { ReactNode } from "react"
import type { TournamentContent } from "@aov/community-contracts"
import { Check } from "lucide-react"
import { LocalMoney } from "@aov/ui/components/local-money"
import { RankBadge, medalOf } from "@aov/ui/components/rank-badge"
import { cn } from "@aov/ui/lib/utils"
import { TeamName } from "../peek/competitor-peek"
import { TeamLogo } from "@/features/esports/components/primitives"
import type { TeamView } from "@/features/esports/model/game-view"
import type { FinalRow } from "./final-state"
import { Chip } from "./parts"

/** A range of places as readers see it, with the long dash. */
export const placeLabel = (place: string) => place.replace(/\s*-\s*/, "–")

/** The last match of a row, as recorded or as the matches tell. Imported lines carry the games of the rival alone. */
function lastMatch({ recorded, suggested }: FinalRow) {
  const opponent = recorded?.lastOpponent || suggested?.lastOpponent
  if (!opponent) return null
  const written = /^\s*(\d+)\s*[-–:]\s*(\d+)\s*$/.exec(recorded?.lastScore ?? "")
  const played = suggested?.lastOpponent === opponent ? suggested.lastScore : undefined
  return { opponent, score: written ? `${written[1]}–${written[2]}` : played }
}

/** A place the final table does not hold yet stands in a dashed ring. */
function Place({ row: { place = "", recorded } }: { row: FinalRow }) {
  return (
    <span className="grid w-12 justify-items-center">
      <span
        className={cn(
          "grid h-8 min-w-8 place-items-center rounded-full",
          !recorded && "border border-dashed border-muted-foreground/50 text-muted-foreground",
          !recorded && !medalOf(place) && "px-1.5",
        )}
      >
        <RankBadge place={placeLabel(place)} size={28} />
      </span>
    </span>
  )
}

/** What the matches say about a row, beside the place the table gives it. */
function Verdict({ row, mixed }: { row: FinalRow; mixed: boolean }) {
  const { state, suggested, reason } = row
  if (state === "PENDING" || state === "OPEN") return null
  if (state === "RECORDED") return "Không đối chiếu được"
  if (state === "SAME")
    return (
      <span className="inline-flex items-center gap-1.5">
        <Check className="size-3.5 shrink-0 text-(--aov-success)" role="img" aria-label="Khớp" />
        {suggested!.reason}
      </span>
    )
  const chip = {
    DIFFERS: `Gợi ý hạng ${placeLabel(suggested!.place)}`,
    MISSING: mixed ? "Chưa điền" : null,
    TAKEN: "Trùng hạng",
  }[state]
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      {chip && <Chip tone="warn">{chip}</Chip>}
      {suggested!.reason}
      {state === "TAKEN" && `, hạng này đã có ${reason}`}
    </span>
  )
}

function Row({
  row,
  mixed,
  team,
  prize,
}: {
  row: FinalRow
  /** Whether the table holds some lines already, so that those it lacks are marked. */
  mixed: boolean
  team: (id: string) => TeamView
  /** Absent when no line of the table has a prize. */
  prize?: ReactNode
}) {
  const place = row.place ?? ""
  const medal = row.recorded ? medalOf(place) : null
  const match = lastMatch(row)
  const last = match && (
    <span className="text-muted-foreground">
      {match.score ? <span className="text-foreground tabular-nums">{match.score}</span> : "gặp"} {match.opponent}
    </span>
  )
  const verdict = <Verdict row={row} mixed={mixed} />
  return (
    <tr
      className={cn("type-body border-b last:border-b-0", medal && "esp-medal-row")}
      data-medal={medal ?? undefined}
      data-state={row.state}
    >
      <td className="w-px px-3 py-1 align-top whitespace-nowrap @3xl:align-middle">
        <Place row={row} />
      </td>
      <td className="py-1 pr-4 align-middle @3xl:w-[34%]">
        {row.state === "PENDING" ? (
          <span className="flex min-h-8 items-center text-muted-foreground">{row.suggested!.reason}</span>
        ) : (
          <span className="flex min-h-8 min-w-0 items-center gap-2.5">
            <span className="grid w-8 shrink-0 justify-items-center">
              <TeamLogo
                team={row.teamId ? team(row.teamId) : { id: "", name: row.teamName, shortName: row.teamName }}
                size={medalOf(place) === "gold" ? 32 : 24}
              />
            </span>
            {row.teamId ? (
              <TeamName id={row.teamId} className={cn("min-w-0", medalOf(place) && "font-semibold")}>
                {row.teamName}
              </TeamName>
            ) : (
              <span className={cn("min-w-0 break-words", medalOf(place) && "font-semibold")}>{row.teamName}</span>
            )}
          </span>
        )}
        <span className="type-meta block space-y-0.5 pb-1 pl-10.5 @3xl:hidden">
          {last && <span className="block">{last}</span>}
          <span className="block">{verdict}</span>
          {prize && <span className="block">{prize}</span>}
        </span>
      </td>
      <td className="hidden py-1 pr-4 align-middle @3xl:table-cell">{last}</td>
      {prize !== undefined && (
        <td className="hidden py-1 pr-4 align-middle whitespace-nowrap @3xl:table-cell">{prize}</td>
      )}
      <td className="type-meta hidden py-1 pr-4 align-middle @3xl:table-cell">{verdict}</td>
    </tr>
  )
}

/** Every team with a place, its last match and prize, and what the matches say about the place. */
export function FinalPlacesTable({
  rows,
  content,
  team,
}: {
  rows: FinalRow[]
  content: Pick<TournamentContent, "localCurrency" | "startsOn" | "endsOn">
  team: (id: string) => TeamView
}) {
  const currency = content.localCurrency || "nội tệ"
  // Prizes read at the rate of the day they were awarded.
  const prizeDay = content.endsOn ?? content.startsOn
  const hasPrize = rows.some(({ recorded }) => recorded?.prizeUsd != null || recorded?.prizeLocal != null)
  const mixed = rows.some((row) => row.recorded)
  return (
    <table className="w-full">
      <thead className="sr-only @3xl:not-sr-only">
        <tr className="type-label border-b text-left text-muted-foreground">
          <th className="px-3 py-2 text-center font-semibold">Hạng</th>
          <th className="py-2 pr-4 font-semibold">Đội</th>
          <th className="py-2 pr-4 font-semibold">Trận cuối</th>
          {hasPrize && <th className="py-2 pr-4 font-semibold">Tiền thưởng</th>}
          <th className="py-2 pr-4 font-semibold">Theo các trận</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <Row
            key={row.key}
            row={row}
            mixed={mixed}
            team={team}
            prize={
              hasPrize ? (
                <LocalMoney
                  amounts={[
                    { amount: row.recorded?.prizeUsd, currency: "USD" },
                    { amount: row.recorded?.prizeLocal, currency },
                  ]}
                  on={prizeDay}
                />
              ) : undefined
            }
          />
        ))}
      </tbody>
    </table>
  )
}
