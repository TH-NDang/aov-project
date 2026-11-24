import type { ReactNode } from "react"
import type { TournamentContent } from "@aov/community-contracts"
import { ExternalLink, Trophy } from "lucide-react"
import { RankBadge, medalOf } from "@aov/ui/components/rank-badge"
import { cn } from "@aov/ui/lib/utils"
import { LocalMoney } from "@aov/ui/components/local-money"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@aov/ui/components/table"
import { awardGroups } from "../model/award-groups"
import type { TeamView } from "../model/game-view"
import { PlayerPhoto, SectionTitle } from "./primitives"
import { ThemedLogoImg } from "@/components/themed-logo-img"

/**
 * Final standings, prizes and related links of a tournament. A linked team shows its logo and a linked recipient their
 * photo, so a name still written as text stands out as one without a record.
 */
export function TournamentFinalTable({
  content,
  team,
  player,
  action,
}: {
  content: TournamentContent
  team: (id: string) => TeamView
  /** A registered player the awards name, when the screen has them. */
  player?: (id: string) => { name: string; photoUrl?: string | null } | undefined
  action?: ReactNode
}) {
  const { placements = [], awards = [], links = [], localCurrency } = content
  const currency = localCurrency || "nội tệ"
  // Prizes read at the rate of the day they were awarded.
  const prizeDay = content.endsOn ?? content.startsOn
  const hasPrize = placements.some((line) => line.prizeUsd != null || line.prizeLocal != null)
  const hasLastMatch = placements.some((line) => line.lastOpponent)
  const empty = !placements.length && !awards.length && !links.length
  if (empty && !action) return null
  return (
    <section className="space-y-3">
      <SectionTitle action={action}>Kết quả chung cuộc</SectionTitle>
      {empty && <p className="type-meta">Chưa có bảng xếp hạng chung cuộc, giải thưởng hay liên kết.</p>}
      {!!placements.length && (
        <div className="overflow-x-auto admin-section">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="type-label w-20">Hạng</TableHead>
                <TableHead className="type-label">Đội</TableHead>
                {hasPrize && <TableHead className="type-label">Tiền thưởng</TableHead>}
                {hasLastMatch && <TableHead className="type-label">Trận cuối</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {placements.map((line, index) => {
                const view = line.teamId ? team(line.teamId) : null
                return (
                  <TableRow
                    key={`${line.place}-${line.teamName}-${index}`}
                    className={cn(medalOf(line.place) && "esp-medal-row")}
                    data-medal={medalOf(line.place) ?? undefined}
                  >
                    <TableCell className="type-body">
                      <RankBadge place={line.place} size={32} />
                    </TableCell>
                    <TableCell className="type-body">
                      <span className="flex min-w-0 items-center gap-2">
                        <ThemedLogoImg
                          url={view?.logoUrl}
                          darkUrl={view?.logoDarkUrl}
                          className={cn(
                            "shrink-0 rounded object-contain",
                            medalOf(line.place) === "gold" ? "size-8" : "size-6",
                          )}
                          fallback={
                            line.place === "1" && <Trophy className="size-4 shrink-0 text-primary" aria-hidden />
                          }
                        />
                        <span className={cn("truncate", medalOf(line.place) && "font-semibold")}>{line.teamName}</span>
                      </span>
                    </TableCell>
                    {hasPrize && (
                      <TableCell className="type-body">
                        <LocalMoney
                          amounts={[
                            { amount: line.prizeUsd, currency: "USD" },
                            { amount: line.prizeLocal, currency },
                          ]}
                          on={prizeDay}
                        />
                      </TableCell>
                    )}
                    {hasLastMatch && (
                      <TableCell className="type-meta">
                        {line.lastOpponent ? `${line.lastScore ? `${line.lastScore} ` : ""}${line.lastOpponent}` : ""}
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {!!awards.length && (
        <ul className="grid gap-x-6 @2xl:grid-cols-2">
          {awardGroups(awards).map((group) => (
            <li key={group.title} className="space-y-1.5 border-t py-3">
              <p className="type-label text-muted-foreground">{group.title}</p>
              <ul className="space-y-1.5">
                {group.awards.map((award, index) => {
                  const recipient = award.playerId ? player?.(award.playerId) : undefined
                  const view = award.teamId ? team(award.teamId) : undefined
                  return (
                    <li key={index} className="type-body flex min-w-0 items-center gap-2">
                      {award.playerId && (
                        <PlayerPhoto name={award.recipientName} url={recipient?.photoUrl ?? undefined} size={24} />
                      )}
                      <span className="truncate">{award.recipientName}</span>
                      {award.teamName && (
                        <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                          <ThemedLogoImg
                            url={view?.logoUrl}
                            darkUrl={view?.logoDarkUrl}
                            className="size-5 shrink-0 object-contain"
                          />
                          <span className="truncate">{award.teamName}</span>
                        </span>
                      )}
                      {(award.prizeUsd != null || award.prizeLocal != null) && (
                        <span className="type-meta ml-auto shrink-0">
                          <LocalMoney
                            amounts={[
                              { amount: award.prizeUsd, currency: "USD" },
                              { amount: award.prizeLocal, currency },
                            ]}
                            on={prizeDay}
                          />
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {!!links.length && (
        <ul className="flex flex-wrap gap-2">
          {links.map((link) => (
            <li key={link.url}>
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="type-body inline-flex items-center gap-1 text-primary hover:underline"
              >
                {link.label}
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
