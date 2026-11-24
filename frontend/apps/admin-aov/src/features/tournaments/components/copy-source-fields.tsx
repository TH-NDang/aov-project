import { useQuery } from "@tanstack/react-query"
import type { CompetitionView } from "@aov/community-contracts"
import { CalendarRange, Info, Megaphone, Shield, UserCog, Users, type LucideIcon } from "lucide-react"
import { Checkbox } from "@aov/ui/components/checkbox"
import { competitionApi, competitionKeys } from "@/features/competition/competition-api"
import { COPY_PARTS, COPY_PART_LABELS, type CopyPart } from "@/features/competition/model/copy-setup"
import { tournamentError } from "../api/tournament-api"
import { partNeedsEntrants } from "../model/create-tournament-model"
import { RecordPicker } from "./record-picker"

export const COPY_PART_ICONS: Record<CopyPart, LucideIcon> = {
  info: Info,
  entrants: Shield,
  rosters: Users,
  stages: CalendarRange,
  staff: UserCog,
  broadcast: Megaphone,
}

const UNITS: Record<Exclude<CopyPart, "info">, string> = {
  entrants: "đội",
  rosters: "tuyển thủ",
  stages: "giai đoạn",
  staff: "người",
  broadcast: "người",
}

export const partCount = (part: CopyPart, count?: number) =>
  part === "info" || count === undefined ? "" : `${count} ${UNITS[part]}`

/** How much of each part the earlier tournament has to give. */
function sourceCounts({ content }: CompetitionView): Partial<Record<CopyPart, number>> {
  const teams = content.plan.entrants.filter((entry) => entry.status !== "WITHDRAWN").map((entry) => entry.teamId)
  return {
    entrants: teams.length,
    rosters: content.rosters.filter((line) => line.status !== "INACTIVE" && teams.includes(line.teamId)).length,
    stages: content.plan.stages.length,
    staff: content.tournament.staff?.filter((line) => teams.includes(line.teamId)).length ?? 0,
    broadcast: content.tournament.broadcast?.length ?? 0,
  }
}

/** Picks the tournament a new one starts from and which parts of its setup come along. */
export function CopySourceFields({
  actorKey,
  sourceId,
  parts,
  disabled,
  onSource,
  onPart,
}: {
  actorKey: string
  sourceId: string
  parts: ReadonlySet<CopyPart>
  disabled: boolean
  onSource: (id: string) => void
  onPart: (part: CopyPart, chosen: boolean) => void
}) {
  const source = useQuery({
    queryKey: competitionKeys.plan(actorKey, sourceId),
    queryFn: () => competitionApi.read(sourceId),
    enabled: !!sourceId,
  })
  const counts = source.data ? sourceCounts(source.data) : {}

  return (
    <section className="col-span-full grid gap-3 border-t pt-4" aria-labelledby="copy-source-title">
      <h3 id="copy-source-title" className="type-section-title">
        Bắt đầu từ giải có sẵn
      </h3>
      <RecordPicker
        kind="tournaments"
        label="Giải có sẵn"
        placeholder="Chọn giải để chép thiết lập"
        value={sourceId}
        disabled={disabled}
        onChange={onSource}
      />
      {source.isError && (
        <p className="tournament-error" role="alert">
          {tournamentError(source.error)}
        </p>
      )}
      {sourceId && (
        <ul className="grid gap-1">
          {COPY_PARTS.map((part) => {
            const Icon = COPY_PART_ICONS[part]
            const blocked = partNeedsEntrants(part) && !parts.has("entrants")
            const empty = counts[part] === 0
            return (
              <li key={part}>
                <label className="tournament-copy-part">
                  <Checkbox
                    checked={parts.has(part) && !blocked && !empty}
                    disabled={disabled || blocked || empty}
                    onCheckedChange={(checked) => onPart(part, checked === true)}
                  />
                  <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                  <span className="type-body min-w-0 flex-1">{COPY_PART_LABELS[part]}</span>
                  <span className="type-meta shrink-0 tabular-nums">
                    {blocked ? "Cần chép đội tham dự" : partCount(part, counts[part])}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
