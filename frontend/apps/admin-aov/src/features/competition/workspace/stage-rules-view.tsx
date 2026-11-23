import { useQuery } from "@tanstack/react-query"
import type { CompetitionStage } from "@aov/community-contracts"
import { formatCalendarDate } from "@aov/ui/lib/time-zone"
import { wikiPatchApi, wikiPatchKeys } from "../wiki-patch-api"
import { hostOf } from "./model"
import { Chip } from "./parts"
import { DRAFT_RULE_NAMES, SIDE_SELECTION_NAMES, patchLineTitle } from "./stage-rules"

/** Read-only rules and game updates of a stage, as the format step shows them. */
export function StageRulesView({ stage, region }: { stage: CompetitionStage; region: string }) {
  const wikiPatches = useQuery({
    queryKey: wikiPatchKeys.patches(region),
    queryFn: () => wikiPatchApi.patches(region),
    staleTime: 5 * 60_000,
  })
  const lines = stage.patches ?? []
  return (
    <div className="space-y-3 border-t p-4">
      <h3 className="type-label text-muted-foreground">Luật & phiên bản</h3>
      <div className="flex flex-wrap gap-2">
        <Chip tone={stage.draftRule ? "gold" : "neutral"}>
          {stage.draftRule ? DRAFT_RULE_NAMES[stage.draftRule] : "Cấm chọn: chưa ghi"}
        </Chip>
        <Chip tone={stage.sideSelection ? "gold" : "neutral"}>
          {stage.sideSelection ? SIDE_SELECTION_NAMES[stage.sideSelection] : "Chọn bên: chưa ghi"}
        </Chip>
      </div>
      {stage.rulesNote?.trim() && <p className="type-body whitespace-pre-line">{stage.rulesNote}</p>}
      {lines.length ? (
        <ol className="space-y-2">
          {lines.map((line, index) => {
            const wiki = wikiPatches.data?.find((patch) => patch.id === line.patchId)
            return (
              <li key={index} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2">
                {line.label?.trim() && <span className="type-label">{line.label}</span>}
                <span className="type-body">{patchLineTitle(line, wiki)}</span>
                {line.releasedOn && line.name?.trim() && (
                  <span className="type-meta">{formatCalendarDate(line.releasedOn)}</span>
                )}
                {line.seasonName && <Chip tone="info">{line.seasonName}</Chip>}
                {line.patchId ? <Chip tone="ok">Có trong Wiki</Chip> : <Chip tone="warn">Chưa có trong Wiki</Chip>}
                {line.sourceUrl && (
                  <a className="type-meta underline" href={line.sourceUrl} target="_blank" rel="noreferrer">
                    {hostOf(line.sourceUrl)}
                  </a>
                )}
                {line.note?.trim() && <span className="type-meta">{line.note}</span>}
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="type-meta">Chưa ghi phiên bản.</p>
      )}
    </div>
  )
}
