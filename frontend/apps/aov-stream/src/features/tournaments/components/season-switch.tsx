import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import type { CompetitionView } from "@aov/community-contracts"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@aov/ui/components/public-overlay"
import { competitionStatusLabels, dayRange } from "../../../components/community-ui"
import { StreamIcon } from "../../../components/stream-icon"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { competitionChampion } from "../../../lib/champion-model"
import { competitionStatus } from "../../../lib/competition-model"
import { circuitIdOf, seasonRows, type SeasonRow } from "../../../lib/directory-model"
import { seasonName } from "../../../lib/season-name"
import { competitionCatalogQuery } from "../../../lib/tournament-api"

/**
 * The season being read, which opens the list of its circuit's seasons. Choosing one keeps the part of the page that is
 * open. A competition outside any circuit has nothing to choose, so it shows nothing: its head names it.
 */
export function SeasonSwitch({ view }: { view: CompetitionView }) {
  const { text } = useStreamLocale()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [open, setOpen] = useState(false)
  // The seasons are read when they are asked for.
  const catalog = useQuery({ ...competitionCatalogQuery, enabled: open })
  const circuit = circuitIdOf(view)
  if (!circuit) return null
  const { tournament } = view.content
  const name = view.content.circuit?.name
  const rows = seasonRows((catalog.data ?? []).filter((item) => circuitIdOf(item) === circuit))
  const tab = params.get("tab")
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="wy-switch"
          aria-label={text(
            `${seasonName(tournament.name, name)}, chọn mùa khác`,
            `${seasonName(tournament.name, name)}, choose another season`,
          )}
        >
          <span>{seasonName(tournament.name, name)}</span>
          <StreamIcon name="chevronRight" size={14} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        collisionPadding={12}
        className="hub-popover wy-menu"
        drawerTitle={text("Chọn mùa giải", "Choose a season")}
      >
        {rows.length ? (
          rows.map((row) => (
            <DropdownMenuItem
              key={row.view.id}
              className="hub-menu-item"
              onSelect={() => void navigate(`/competitions/${row.view.id}${tab ? `?tab=${tab}` : ""}`)}
            >
              <SeasonChoice row={row} circuit={name} current={row.view.id === view.id} />
            </DropdownMenuItem>
          ))
        ) : (
          <p className="wy-menu-wait" role="status">
            {catalog.isError
              ? text("Chưa tải được các mùa giải.", "The seasons could not be loaded.")
              : text("Đang tải các mùa giải…", "Loading the seasons…")}
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** A season in the list: its champion's logo, its name and who won it or when it is. */
function SeasonChoice({
  row: { view, part },
  circuit,
  current,
}: {
  row: SeasonRow
  circuit?: string
  current: boolean
}) {
  const { text } = useStreamLocale()
  const { tournament } = view.content
  const status = competitionStatus(view.content)
  const won = status === "FINISHED" && !part ? competitionChampion(view) : null
  const days = dayRange(tournament.startsOn, tournament.endsOn, text("Chờ lịch", "To be scheduled"))
  return (
    <span className="wy-menu-row" data-part={part || undefined}>
      {!part &&
        (won ? (
          <StreamImage src={won.winner.logoUrl} darkSrc={won.winner.logoDarkUrl} logo name={won.winner.name} />
        ) : (
          <i aria-hidden="true" />
        ))}
      <span>
        <b>{seasonName(tournament.name, circuit)}</b>
        {!part && (
          <small>
            {won
              ? text(`${won.winner.name} vô địch`, `Won by ${won.winner.name}`)
              : status && status !== "FINISHED"
                ? `${competitionStatusLabels()[status]}, ${days}`
                : days}
          </small>
        )}
      </span>
      {current && <StreamIcon name="check" size={16} />}
    </span>
  )
}
