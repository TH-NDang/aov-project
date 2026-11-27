import type { CompetitionStage, PlannedMatch } from "@aov/community-contracts"
import { Trophy } from "lucide-react"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { cn } from "@aov/ui/lib/utils"
import { Segmented } from "@/components/segmented"
import type { MatchPanelMode } from "../workspace/match-panel"
import { defaultGroupMode, groupMatches, hasScore, matchLabel, type GroupMode } from "../workspace/model"
import { Panel, type Workspace } from "../workspace/parts"
import { PlanBracket } from "../workspace/plan-bracket"
import { MatchDetail, MatchGroups, MatchSheet, ScoreChip, SideName } from "./match-groups"
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
  const compact = usePageLayout() === "compact"
  const mode: GroupMode =
    ws.focus.group === "day" || ws.focus.group === "round" ? ws.focus.group : defaultGroupMode(matches)
  // Below the widest screens the standings would sit after every match; they get a switch of their own instead.
  const table = ws.focus.view === "table"
  return (
    <div className="grid items-start gap-x-5 gap-y-3 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex items-center justify-between gap-2 xl:col-span-2 xl:hidden">
        <Segmented
          label="Xem trận hay bảng xếp hạng"
          value={table ? "table" : "matches"}
          options={[
            ["matches", "Trận đấu"],
            ["table", "Bảng xếp hạng"],
          ]}
          onChange={(next) => ws.keep({ view: next === "table" ? "table" : undefined })}
        />
        {!table && (
          <Segmented
            label="Cách gom trận"
            value={mode}
            options={[
              ["round", compact ? "Vòng" : "Theo vòng"],
              ["day", compact ? "Ngày" : "Theo ngày"],
            ]}
            onChange={(next) => ws.keep({ group: next })}
          />
        )}
      </div>
      <div className={cn("min-w-0 space-y-3", table && "max-xl:hidden")}>
        <div className="flex items-center justify-between gap-2 max-xl:hidden">
          <Segmented
            label="Cách gom trận"
            value={mode}
            options={[
              ["round", "Theo vòng"],
              ["day", "Theo ngày"],
            ]}
            onChange={(next) => ws.keep({ group: next })}
          />
          <span className="type-meta">{shown.length} trận</span>
        </div>
        <MatchGroups
          key={mode}
          ws={ws}
          groups={groupMatches(shown, mode, ws.plan.timezone, ws.resolved)}
          mode={mode}
          restFrom={narrowed ? undefined : teamIds}
          focus={focus}
          focusMode={focusMode}
          openAll={narrowed}
          remember={`${stage.code}:${mode}`}
        />
        {!shown.length && (
          <p className="type-body rounded-lg border border-dashed px-4 py-6 text-muted-foreground">
            {matches.length ? "Không có trận nào khớp bộ lọc." : "Giai đoạn này chưa có trận."}
          </p>
        )}
      </div>
      {/* On a wide screen the table stays beside the matches while they scroll. */}
      <div
        className={cn(
          "min-w-0 xl:sticky xl:top-24 xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto",
          !table && "max-xl:hidden",
        )}
      >
        <StandingsPanel ws={ws} stage={stage} />
      </div>
    </div>
  )
}

export function BracketMatches({ ws, stage, matches, shown, narrowed, focus, focusMode }: StageProps) {
  const compact = usePageLayout() === "compact"
  // A phone reads a bracket as a list by default: the drawn one is wider than the screen.
  const usual = compact ? "list" : "bracket"
  const view = ws.focus.view === "list" || ws.focus.view === "bracket" ? ws.focus.view : usual
  // A wide screen always shows one match under the bracket: the one asked for, else the next without a score. A phone
  // shows a match only when one is picked, in a sheet over the bracket.
  const selected =
    focus ?? (compact ? null : (matches.find((match) => !hasScore(ws.resolved.get(match.key)))?.key ?? null))
  const chosen = matches.find((match) => match.key === selected)
  const usesSeeds = matches.some((match) => match.a.type === "SEED" || match.b.type === "SEED")
  // A narrowed bracket would have holes, so a filter reads as a list.
  const drawn = view === "bracket" && !narrowed
  const select = (key: string | null) => ws.keep({ key: key ?? undefined, match: undefined, open: undefined })
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
                ["bracket", compact ? "Nhánh" : "Sơ đồ nhánh"],
                ["list", "Danh sách"],
              ]}
              onChange={(next) => ws.keep({ view: next === usual ? undefined : next })}
            />
          )
        }
      >
        {drawn ? (
          <div className="p-4">
            {matches.length ? (
              <PlanBracket ws={ws} matches={matches} selected={selected} onSelect={select} />
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
              remember={`${stage.code}:round`}
            />
          </div>
        )}
      </Panel>
      {drawn && chosen && compact && (
        <MatchSheet ws={ws} match={chosen} mode={focusMode} onClose={() => select(null)} />
      )}
      {drawn && chosen && !compact && (
        <Panel
          title={matchLabel(chosen)}
          meta={
            <>
              <SideName ws={ws} match={chosen} which="a" /> gặp <SideName ws={ws} match={chosen} which="b" /> · BO
              {chosen.bestOf}
            </>
          }
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
