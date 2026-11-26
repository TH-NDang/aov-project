import type { TournamentContent } from "@aov/community-contracts"
import { ExternalLink } from "lucide-react"
import { LocalMoney } from "@aov/ui/components/local-money"
import { ThemedLogoImg } from "@/components/themed-logo-img"
import { awardGroups } from "../model/award-groups"
import type { TeamView } from "../model/game-view"
import { PlayerPhoto, SectionTitle } from "./primitives"

/**
 * The awards of a tournament by their title, and its related links. A linked team shows its logo and a linked recipient
 * their photo, so a name still written as text stands out as one without a record.
 */
export function TournamentAwards({
  content,
  team,
  player,
}: {
  content: Pick<TournamentContent, "awards" | "links" | "localCurrency" | "startsOn" | "endsOn">
  team: (id: string) => TeamView
  /** A registered player the awards name, when the screen has them. */
  player?: (id: string) => { name: string; photoUrl?: string | null } | undefined
}) {
  const { awards = [], links = [], localCurrency } = content
  const currency = localCurrency || "nội tệ"
  // Prizes read at the rate of the day they were awarded.
  const prizeDay = content.endsOn ?? content.startsOn
  return (
    <section className="space-y-3">
      <SectionTitle>Giải thưởng</SectionTitle>
      {!awards.length && <p className="type-meta">Chưa có giải thưởng.</p>}
      {!!awards.length && (
        <ul className="grid gap-x-6 @2xl:grid-cols-2 @5xl:grid-cols-3">
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
