import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { CompetitionView } from "@aov/community-contracts"
import { onDemand, OnDemandPart, useAhead, type OnDemand } from "../../../components/on-demand"
import { useStreamLocale } from "../../../components/stream-locale"
import type { CompetitionTab } from "../../../lib/competition-tabs"
import { lineupsQuery } from "../../../lib/tournament-api"

type TabPart = OnDemand<{ view: CompetitionView }>

/** The tabs of a competition that come with a file of their own: they are large, and many readers open neither. */
const standings: TabPart = onDemand(() => import("./competition-standings").then((file) => file.CompetitionStandings))
export const statistics: TabPart = onDemand(() =>
  import("./competition-statistics").then((file) => file.CompetitionStatisticsTab),
)
export const TAB_PARTS: Partial<Record<CompetitionTab, TabPart>> = { standings, stats: statistics }

/** Asks for the tab that is open at once, and for what may be opened next once the page offers it. */
export function useTabsAhead(open: CompetitionTab, drawn: boolean, counted: boolean) {
  useEffect(() => TAB_PARTS[open]?.ask(), [open])
  useAhead(standings, drawn)
  useAhead(statistics, counted)
}

/** What stands in for a tab that is on its way; `tall` where the page stands scrolled to it already. */
export const TabSkeleton = ({ label, tall }: { label: string; tall?: boolean }) => (
  <div className="tn-comp-skeleton" data-tall={tall || undefined} role="status" aria-label={label}>
    <span className="hub-skeleton" data-shape="rows" />
  </div>
)

/** The same while its file is on its way; the games the tab counts are asked for meanwhile. */
function TabOnItsWay({ id, label }: { id: string; label: string }) {
  const client = useQueryClient()
  useEffect(() => void client.prefetchQuery(lineupsQuery(id)), [client, id])
  return <TabSkeleton label={label} tall />
}

function OnDemandTab({
  part,
  view,
  waiting,
  failed,
}: {
  part: TabPart
  view: CompetitionView
  waiting: string
  failed: string
}) {
  const { text } = useStreamLocale()
  return (
    <OnDemandPart
      part={part}
      waiting={<TabOnItsWay id={view.id} label={waiting} />}
      failed={(again) => (
        <div className="hub-state" role="alert">
          <h2>{failed}</h2>
          <button type="button" className="cp-button" onClick={again}>
            {text("Thử lại", "Retry")}
          </button>
        </div>
      )}
    >
      {(Tab) => <Tab view={view} />}
    </OnDemandPart>
  )
}

export function StandingsTab({ view }: { view: CompetitionView }) {
  const { text } = useStreamLocale()
  return (
    <OnDemandTab
      part={standings}
      view={view}
      waiting={text("Đang tải BXH & nhánh đấu…", "Loading standings & bracket…")}
      failed={text("Chưa tải được BXH & nhánh đấu", "The standings and the bracket could not be loaded")}
    />
  )
}

export function StatisticsTab({ view }: { view: CompetitionView }) {
  const { text } = useStreamLocale()
  return (
    <OnDemandTab
      part={statistics}
      view={view}
      waiting={text("Đang tải thống kê…", "Loading statistics…")}
      failed={text("Chưa tải được thống kê", "The statistics could not be loaded")}
    />
  )
}
