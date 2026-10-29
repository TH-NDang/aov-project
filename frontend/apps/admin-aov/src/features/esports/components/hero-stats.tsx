import { useState } from "react"
import { Clock3, Shield, Swords } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import type { IconRef } from "../model/game-view"
import { rate, type GameStats, type HeroStat } from "../model/statistics"
import { formatClock } from "../model/vod"
import { HeroIcon } from "./primitives"

type SortKey = "presence" | "picks" | "bans" | "winrate"

const SORTS: { key: SortKey; label: string; value: (hero: HeroStat) => number }[] = [
  { key: "presence", label: "Có mặt", value: (hero) => hero.picks + hero.bans },
  { key: "picks", label: "Lượt chọn", value: (hero) => hero.picks },
  { key: "bans", label: "Lượt cấm", value: (hero) => hero.bans },
  { key: "winrate", label: "Tỉ lệ thắng", value: (hero) => (hero.picks ? hero.wins / hero.picks : -1) },
]

export function HeroStatistics({ stats, icon }: { stats: GameStats; icon: (key: string, name: string) => IconRef }) {
  const [sort, setSort] = useState<SortKey>("presence")
  const value = SORTS.find((entry) => entry.key === sort)!.value
  const heroes = [...stats.heroes].sort((a, b) => value(b) - value(a))
  const maxPresence = Math.max(1, ...stats.heroes.map((hero) => hero.picks + hero.bans))
  return (
    <div className="space-y-4">
      <div className="esp-num grid grid-cols-2 gap-2 @3xl:grid-cols-4">
        {[
          { label: "Ván đã ghi", value: stats.games, icon: Swords },
          {
            label: "Xanh thắng / Đỏ thắng",
            value: `${stats.sideWins.BLUE} / ${stats.sideWins.RED}`,
            icon: Shield,
          },
          { label: "Thời lượng TB", value: formatClock(stats.averageSeconds), icon: Clock3 },
          {
            label: "Ngắn nhất / dài nhất",
            value: `${formatClock(stats.shortest?.seconds)} / ${formatClock(stats.longest?.seconds)}`,
            icon: Clock3,
          },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border bg-card px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <card.icon size={13} /> {card.label}
            </p>
            <p className="text-lg font-semibold">{card.value}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Sắp xếp">
        {SORTS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            aria-pressed={sort === entry.key}
            onClick={() => setSort(entry.key)}
            className={cn(
              "h-7 rounded-full border px-3 text-xs font-medium transition",
              sort === entry.key ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="esp-num w-full min-w-[560px] text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Tướng</th>
              <th className="px-2 py-2 text-left font-medium">Có mặt</th>
              <th className="px-2 py-2 text-center font-medium">Chọn</th>
              <th className="px-2 py-2 text-center font-medium">T–B</th>
              <th className="px-2 py-2 text-center font-medium">Tỉ lệ thắng</th>
              <th className="px-2 py-2 text-center font-medium text-[var(--esp-blue)]">Xanh</th>
              <th className="px-2 py-2 text-center font-medium text-[var(--esp-red)]">Đỏ</th>
              <th className="px-3 py-2 text-center font-medium">Cấm</th>
            </tr>
          </thead>
          <tbody>
            {heroes.map((hero) => (
              <tr key={hero.key} className="border-t">
                <td className="px-3 py-1.5">
                  <span className="flex items-center gap-2">
                    <HeroIcon hero={icon(hero.key, hero.name)} size={28} />
                    <span className="font-medium">{hero.name}</span>
                  </span>
                </td>
                <td className="px-2 py-1.5">
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-[var(--esp-gold)]"
                        style={{ width: `${((hero.picks + hero.bans) / maxPresence) * 100}%` }}
                      />
                    </span>
                    {rate(hero.picks + hero.bans, stats.games)}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-center">{hero.picks}</td>
                <td className="px-2 py-1.5 text-center text-muted-foreground">
                  {hero.wins}–{hero.picks - hero.wins}
                </td>
                <td className="px-2 py-1.5 text-center font-medium">{rate(hero.wins, hero.picks)}</td>
                <td className="px-2 py-1.5 text-center">{rate(hero.blue.wins, hero.blue.picks)}</td>
                <td className="px-2 py-1.5 text-center">{rate(hero.red.wins, hero.red.picks)}</td>
                <td className="px-3 py-1.5 text-center">{hero.bans}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Tỉ lệ có mặt = (chọn + cấm) / số ván đã ghi. Ván chưa có đội thắng vẫn được tính lượt chọn/cấm.
      </p>
    </div>
  )
}
