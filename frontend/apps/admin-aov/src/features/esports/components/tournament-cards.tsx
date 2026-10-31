import type { CSSProperties, ReactNode } from "react"
import type { TournamentContent } from "@aov/community-contracts"
import { CalendarDays, ExternalLink, MapPin, Swords, Trophy, Users } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import arenaBanner from "../assets/arena-banner.webp"
import { FORMAT_LABELS, VENUE_LABELS, dateRange, regionName, seasonProgress } from "../model/labels"
import { initials } from "../model/game-view"
import { Monogram, RegionFlag, StatusPill, TierBadge } from "./primitives"

const bannerStyle = { "--esp-banner-image": `url(${arenaBanner})` } as CSSProperties

function TournamentMark({ content, size }: { content: TournamentContent; size: number }) {
  return (
    <Monogram
      url={content.logoUrl}
      label={`Logo ${content.name}`}
      text={initials(content.name).slice(0, 3)}
      size={size}
      className="rounded-xl ring-1 ring-white/20 [&>img]:p-1.5"
    />
  )
}

export type TournamentStats = { teams: number; matches: number; played: number }

/** Big header for one tournament; stays dark in both themes. */
export function TournamentBanner({
  content,
  stats,
  actions,
  children,
}: {
  content: TournamentContent
  stats: TournamentStats
  actions?: ReactNode
  children?: ReactNode
}) {
  const progress = seasonProgress(content.startsOn, content.endsOn)
  return (
    <section className="esp-banner rounded-2xl" style={bannerStyle}>
      <div className="flex flex-col gap-5 p-5 @3xl:p-7">
        <div className="flex flex-wrap items-start gap-4">
          <TournamentMark content={content} size={72} />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <TierBadge tier={content.tier} />
              <StatusPill status={content.status} onDark />
              {content.competitionType && content.competitionType !== "UNKNOWN" && (
                <span className="text-xs text-white/70">{FORMAT_LABELS[content.competitionType]}</span>
              )}
            </div>
            <h1 className="text-balance text-2xl font-bold tracking-tight @3xl:text-3xl">{content.name}</h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/75">
              <RegionFlag code={content.region} />
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={14} /> {dateRange(content.startsOn, content.endsOn)}
              </span>
              {content.venueMode && content.venueMode !== "UNKNOWN" && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={14} /> {VENUE_LABELS[content.venueMode]}
                </span>
              )}
            </div>
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
        <div className="grid grid-cols-3 gap-2 @3xl:max-w-xl">
          {[
            { icon: Users, label: "Đội", value: stats.teams },
            { icon: Swords, label: "Trận đã đấu", value: `${stats.played}/${stats.matches}` },
            { icon: Trophy, label: "Vô địch", value: content.result?.winnerName ?? "Chưa có" },
          ].map((item) => (
            <div key={item.label} className="esp-glass rounded-xl px-3 py-2">
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-white/60">
                <item.icon size={12} /> {item.label}
              </p>
              <p className="esp-num truncate text-lg font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
        {progress !== null && content.status !== "FINISHED" && (
          <div className="space-y-1 @3xl:max-w-xl">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-[var(--esp-gold)]" style={{ width: `${progress * 100}%` }} />
            </div>
            <p className="text-xs text-white/60">Tiến độ lịch thi đấu {Math.round(progress * 100)}%</p>
          </div>
        )}
        {children}
      </div>
    </section>
  )
}

export function TournamentCard({
  content,
  stats,
  onOpen,
  featured = false,
}: {
  content: TournamentContent
  stats: TournamentStats
  onOpen: () => void
  featured?: boolean
}) {
  const progress = seasonProgress(content.startsOn, content.endsOn)
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border bg-card text-left shadow-xs transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-[var(--esp-gold)]",
        featured && "@3xl:col-span-2",
      )}
    >
      <span className={cn("esp-banner flex items-end gap-3 p-4", featured ? "h-36" : "h-28")} style={bannerStyle}>
        <TournamentMark content={content} size={featured ? 56 : 44} />
        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2">
            <TierBadge tier={content.tier} />
            <StatusPill status={content.status} onDark />
          </span>
          <span className={cn("line-clamp-2 font-bold leading-tight", featured ? "text-xl" : "text-base")}>
            {content.name}
          </span>
        </span>
      </span>
      <span className="flex flex-1 flex-col gap-3 p-4 text-sm">
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
          <RegionFlag code={content.region} />
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays size={14} /> {dateRange(content.startsOn, content.endsOn)}
          </span>
        </span>
        <span className="esp-num grid grid-cols-3 gap-2 text-center">
          <span className="rounded-lg bg-muted/60 py-1.5">
            <strong className="block text-base">{stats.teams}</strong>
            <span className="text-xs text-muted-foreground">đội</span>
          </span>
          <span className="rounded-lg bg-muted/60 py-1.5">
            <strong className="block text-base">{stats.matches}</strong>
            <span className="text-xs text-muted-foreground">trận</span>
          </span>
          <span className="rounded-lg bg-muted/60 py-1.5">
            <strong className="block text-base">{stats.played}</strong>
            <span className="text-xs text-muted-foreground">đã đấu</span>
          </span>
        </span>
        {progress !== null && content.status === "ONGOING" && (
          <span className="mt-auto block h-1 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-[var(--esp-gold)]" style={{ width: `${progress * 100}%` }} />
          </span>
        )}
      </span>
    </button>
  )
}

/** Liquipedia-style infobox with only the fields the record actually holds. */
export function TournamentInfobox({ content, teams }: { content: TournamentContent; teams: number }) {
  const rows: [string, ReactNode][] = [
    ["Khu vực", regionName(content.region)],
    ["Thể thức", content.competitionType ? FORMAT_LABELS[content.competitionType] : null],
    ["Hình thức", content.venueMode ? VENUE_LABELS[content.venueMode] : null],
    ["Hạng giải", content.tier && content.tier !== "UNKNOWN" ? <TierBadge tier={content.tier} /> : null],
    ["Bắt đầu", content.startsOn ? dateRange(content.startsOn).replace("Từ ", "") : null],
    ["Kết thúc", content.endsOn ? dateRange(undefined, content.endsOn).replace("Đến ", "") : null],
    ["Số đội", teams || null],
    [
      "Vô địch",
      content.result ? (
        <span className="font-semibold">
          {content.result.winnerName}
          {content.result.winnerScore != null &&
            ` (${content.result.winnerScore}–${content.result.runnerUpScore ?? "?"})`}
        </span>
      ) : null,
    ],
    ["Á quân", content.result?.runnerUpName ?? null],
  ]
  return (
    <aside className="overflow-hidden rounded-xl border bg-card text-sm">
      <p className="bg-muted/60 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Thông tin giải
      </p>
      <dl className="divide-y">
        {rows
          .filter(([, value]) => value !== null && value !== undefined && value !== "")
          .map(([label, value]) => (
            <div key={label} className="grid grid-cols-[96px_1fr] gap-3 px-4 py-2">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="min-w-0">{value}</dd>
            </div>
          ))}
      </dl>
      {content.sourceUrl && /^https?:\/\//.test(content.sourceUrl) && (
        <a
          href={content.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 border-t px-4 py-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <ExternalLink size={12} /> Nguồn tham khảo
        </a>
      )}
      {content.note && (
        <p className="border-t px-4 py-3 text-xs leading-relaxed text-muted-foreground">{content.note}</p>
      )}
    </aside>
  )
}
