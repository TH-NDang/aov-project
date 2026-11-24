import { useState } from "react"
import type { CompetitionStage, PlannedMatch } from "@aov/community-contracts"
import { Trophy } from "lucide-react"
import { Segmented } from "@/components/segmented"
import type { MatchPanelMode } from "../workspace/match-panel"
import { defaultGroupMode, groupMatches, hasScore, matchLabel, type GroupMode } from "../workspace/model"
import { Panel, type Workspace } from "../workspace/parts"
import { PlanBracket } from "../workspace/plan-bracket"
import { MatchDetail, MatchGroups, ScoreChip, sideName } from "./match-groups"
import { SeedStrip } from "./seed-strip"
import { StandingsPanel } from "./standings-panel"

type StageProps = {
  ws: Workspace
  stage: CompetitionStage
  /** Every match of the stage. */
  matches: PlannedMatch[]
  /** Those the filters let through. */
  shown: PlannedMatch[]
  narrowed: boolean
  /** The key of a match to open first, and what it opens with. */
  focus?: string
  focusMode?: MatchPanelMode
  teamIds: string[]
}

export function LeagueMatches({ ws, stage, matches, shown, narrowed, focus, focusMode, teamIds }: StageProps) {
  const [mode, setMode] = useState<GroupMode>(() => defaultGroupMode(matches))
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Segmented
            label="Cách gom trận"
            value={mode}
            options={[
              ["round", "Theo vòng"],
              ["day", "Theo ngày"],
            ]}
            onChange={setMode}
          />
          <span className="type-meta">{shown.length} trận</span>
        </div>
        <MatchGroups
          ws={ws}
          groups={groupMatches(shown, mode, ws.plan.timezone, ws.resolved)}
          mode={mode}
          restFrom={narrowed ? undefined : teamIds}
          focus={focus}
          focusMode={focusMode}
          openAll={narrowed}
        />
        {!shown.length && (
          <p className="type-body rounded-lg border border-dashed px-4 py-6 text-muted-foreground">
            {matches.length ? "Không có trận nào khớp bộ lọc." : "Giai đoạn này chưa có trận."}
          </p>
        )}
      </div>
      <StandingsPanel ws={ws} stage={stage} />
    </div>
  )
}

export function BracketMatches({ ws, stage, matches, shown, narrowed, focus, focusMode }: StageProps) {
  const [view, setView] = useState<"bracket" | "list">("bracket")
  const [selected, setSelected] = useState<string | null>(
    () => focus ?? matches.find((match) => !hasScore(ws.resolved.get(match.key)))?.key ?? null,
  )
  const chosen = matches.find((match) => match.key === selected)
  const usesSeeds = matches.some((match) => match.a.type === "SEED" || match.b.type === "SEED")
  // A narrowed bracket would have holes, so a filter reads as a list.
  const drawn = view === "bracket" && !narrowed
  return (
    <div className="space-y-4">
      {usesSeeds && <SeedStrip ws={ws} matches={matches} />}
      <Panel
        title={stage.name}
        icon={Trophy}
        meta={`BO${stage.bestOf} · ${shown.length} trận`}
        action={
          !narrowed && (
            <Segmented
              label="Cách xem"
              value={view}
              options={[
                ["bracket", "Sơ đồ nhánh"],
                ["list", "Danh sách"],
              ]}
              onChange={setView}
            />
          )
        }
      >
        {drawn ? (
          <div className="p-4">
            {matches.length ? (
              <PlanBracket ws={ws} matches={matches} selected={selected} onSelect={setSelected} />
            ) : (
              <p className="type-body text-muted-foreground">Giai đoạn này chưa có trận.</p>
            )}
          </div>
        ) : (
          <div className="p-3">
            <MatchGroups
              ws={ws}
              groups={groupMatches(shown, "round", ws.plan.timezone, ws.resolved)}
              mode="round"
              focus={focus}
              focusMode={focusMode}
              openAll={narrowed}
            />
          </div>
        )}
      </Panel>
      {drawn && chosen && (
        <Panel
          title={matchLabel(chosen)}
          meta={`${sideName(ws, chosen, "a")} gặp ${sideName(ws, chosen, "b")} · BO${chosen.bestOf}`}
          action={<ScoreChip ws={ws} match={chosen} />}
          className="border-primary/60"
          label="Trận đang chọn"
        >
          <MatchDetail key={chosen.key} ws={ws} match={chosen} mode={chosen.key === focus ? focusMode : undefined} />
        </Panel>
      )}
    </div>
  )
}
